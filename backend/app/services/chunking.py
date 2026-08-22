"""Convert DataFrame rows into text chunks ready for embedding."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class Chunk:
    text: str
    file_name: str
    row_number: int


def rows_to_chunks(df: pd.DataFrame) -> list[Chunk]:
    """Turn each DataFrame row into a human-readable text chunk.

    Each chunk looks like:
        "Row data: col1 is val1, col2 is val2, ..."
    """
    filename: str = df.attrs.get("filename", "unknown.csv")
    chunks: list[Chunk] = []

    for idx, row in df.iterrows():
        parts = [
            f"{col} is {val}"
            for col, val in row.items()
            if pd.notna(val)
        ]
        text = "Row data: " + ", ".join(parts)
        chunks.append(Chunk(text=text, file_name=filename, row_number=int(idx)))

    return chunks
