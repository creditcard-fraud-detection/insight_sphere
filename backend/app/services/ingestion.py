"""Parse uploaded CSV files into structured records using pandas."""

from __future__ import annotations

import io

import pandas as pd


def parse_csv(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Read CSV bytes into a DataFrame.

    Raises ValueError on empty or unparseable content.
    """
    df = pd.read_csv(io.BytesIO(file_bytes))
    if df.empty:
        raise ValueError("The uploaded CSV file is empty.")
    df.attrs["filename"] = filename  # carry filename through the pipeline
    return df
