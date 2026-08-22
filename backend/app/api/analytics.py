"""GET /analytics/summary — universal data analytics from ChromaDB documents."""

from __future__ import annotations

import re
from collections import Counter
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_user
from backend.app.db.chroma_client import get_collection
from backend.app.db.database import FileRecord, User, get_db

router = APIRouter(prefix="/analytics")


# ── Response schemas ──────────────────────────────────────────────────


class CategoryDistribution(BaseModel):
    column: str
    values: list[dict]  # [{name: "Overdue", value: 3}, ...]


class NumericSummary(BaseModel):
    column: str
    total: float
    average: float
    min: float
    max: float


class RawRow(BaseModel):
    file_name: str
    row_number: int
    data: dict


class AnalyticsSummary(BaseModel):
    total_records: int
    files_processed: int
    columns_detected: list[str]
    numeric_columns: list[str]
    categorical_columns: list[str]
    date_columns: list[str]
    primary_numeric: str | None
    primary_categorical: str | None
    numeric_summaries: list[NumericSummary]
    category_distributions: list[CategoryDistribution]
    raw_rows: list[RawRow]


# ── Helpers ───────────────────────────────────────────────────────────


def _parse_doc_text(text: str) -> dict[str, str]:
    """Parse a row document text into a {column: value} dict.

    The ingestion service stores rows as:
      "Row data: Customer_Name is Acme, Amount is 500, Status is Overdue"
    """
    data: dict[str, str] = {}

    # Strip "Row data: " prefix if present
    clean = text
    if clean.lower().startswith("row data:"):
        clean = clean[len("row data:"):].strip()

    # Split on ", " then match "key is value"
    parts = clean.split(", ")
    for part in parts:
        m = re.match(r"^(.+?)\s+is\s+(.+)$", part.strip())
        if m:
            data[m.group(1).strip()] = m.group(2).strip()

    return data


def _classify_columns(rows: list[dict]) -> tuple[list[str], list[str], list[str]]:
    """Auto-detect column types from parsed rows.

    Returns (numeric_cols, categorical_cols, date_cols).
    """
    if not rows:
        return [], [], []

    all_keys: list[str] = list(rows[0].keys())
    numeric: list[str] = []
    categorical: list[str] = []
    date_cols: list[str] = []

    for key in all_keys:
        values = [r.get(key, "") for r in rows if r.get(key)]
        if not values:
            continue

        # Check date patterns
        date_pattern = re.compile(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}")
        if sum(1 for v in values if date_pattern.match(str(v))) > len(values) * 0.5:
            date_cols.append(key)
            continue

        # Check numeric
        numeric_count = 0
        for v in values:
            cleaned = str(v).replace("$", "").replace(",", "").replace(" ", "")
            try:
                float(cleaned)
                numeric_count += 1
            except ValueError:
                pass

        if numeric_count > len(values) * 0.5:
            numeric.append(key)
        else:
            categorical.append(key)

    return numeric, categorical, date_cols


# ── Endpoint ──────────────────────────────────────────────────────────


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AnalyticsSummary:
    """Read the user's uploaded data from ChromaDB and compute universal analytics."""

    # 1. Get the user's file list to scope the query
    user_files = (
        db.query(FileRecord.filename)
        .filter(FileRecord.user_id == current_user.id)
        .all()
    )
    filenames = [f.filename for f in user_files]
    files_processed = len(filenames)

    print(f"DEBUG: User {current_user.username} requested analytics. Found files: {filenames}")

    if not filenames:
        return AnalyticsSummary(
            total_records=0,
            files_processed=0,
            columns_detected=[],
            numeric_columns=[],
            categorical_columns=[],
            date_columns=[],
            primary_numeric=None,
            primary_categorical=None,
            numeric_summaries=[],
            category_distributions=[],
            raw_rows=[],
        )

    # 2. Fetch all documents from ChromaDB for these files
    collection = get_collection()
    raw_rows: list[RawRow] = []
    all_parsed: list[dict] = []

    # Use $in filter when multiple files, exact match for single file
    where_filter = (
        {"file_name": {"$in": filenames}}
        if len(filenames) > 1
        else {"file_name": filenames[0]}
    )

    try:
        results = collection.get(
            where=where_filter,
            include=["documents", "metadatas"],
        )
        if results and results.get("documents"):
            for doc, meta in zip(results["documents"], results["metadatas"]):
                parsed = _parse_doc_text(doc)
                if parsed:
                    all_parsed.append(parsed)
                    raw_rows.append(RawRow(
                        file_name=meta.get("file_name", ""),
                        row_number=meta.get("row_number", 0),
                        data=parsed,
                    ))
    except Exception as exc:
        print(f"[analytics] ChromaDB query failed: {exc}")

    print(f"[analytics] Found {len(all_parsed)} records from ChromaDB")

    total_records = len(all_parsed)

    if not all_parsed:
        return AnalyticsSummary(
            total_records=0,
            files_processed=files_processed,
            columns_detected=[],
            numeric_columns=[],
            categorical_columns=[],
            date_columns=[],
            primary_numeric=None,
            primary_categorical=None,
            numeric_summaries=[],
            category_distributions=[],
            raw_rows=[],
        )

    # 3. Auto-detect column types
    numeric_cols, categorical_cols, date_cols = _classify_columns(all_parsed)
    all_columns = numeric_cols + categorical_cols + date_cols

    # Pick primary columns (prefer ones with most distinct values)
    primary_numeric = numeric_cols[0] if numeric_cols else None
    primary_categorical = categorical_cols[0] if categorical_cols else None

    # 4. Compute numeric summaries
    numeric_summaries: list[NumericSummary] = []
    for col in numeric_cols:
        values = []
        for row in all_parsed:
            raw = str(row.get(col, "0")).replace("$", "").replace(",", "").strip()
            try:
                values.append(float(raw))
            except ValueError:
                pass
        if values:
            numeric_summaries.append(NumericSummary(
                column=col,
                total=round(sum(values), 2),
                average=round(sum(values) / len(values), 2),
                min=round(min(values), 2),
                max=round(max(values), 2),
            ))

    # 5. Compute category distributions
    category_distributions: list[CategoryDistribution] = []
    for col in categorical_cols:
        counts = Counter(str(row.get(col, "Unknown")) for row in all_parsed)
        top = counts.most_common(10)
        category_distributions.append(CategoryDistribution(
            column=col,
            values=[{"name": name, "value": val} for name, val in top],
        ))

    # Also add date distributions if found
    for col in date_cols:
        # Group by year-month
        month_counts: Counter = Counter()
        for row in all_parsed:
            raw = str(row.get(col, ""))
            m = re.match(r"(\d{4}[-/]\d{1,2})", raw)
            if m:
                month_counts[m.group(1)] += 1
            else:
                month_counts[raw[:7] if len(raw) >= 7 else raw] += 1
        if month_counts:
            category_distributions.append(CategoryDistribution(
                column=col,
                values=[{"name": name, "value": val} for name, val in month_counts.most_common(12)],
            ))

    return AnalyticsSummary(
        total_records=total_records,
        files_processed=files_processed,
        columns_detected=all_columns,
        numeric_columns=numeric_cols,
        categorical_columns=categorical_cols,
        date_columns=date_cols,
        primary_numeric=primary_numeric,
        primary_categorical=primary_categorical,
        numeric_summaries=numeric_summaries,
        category_distributions=category_distributions,
        raw_rows=raw_rows,
    )
