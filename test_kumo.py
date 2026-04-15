"""Smoke test for Kumo RFM init. Requires KUMO_API_KEY in the environment."""

import os
import sys

if not os.environ.get("KUMO_API_KEY", "").strip():
    print(
        "ERROR: Set KUMO_API_KEY before running this script.",
        file=sys.stderr,
    )
    sys.exit(1)

import kumoai.experimental.rfm as rfm

print("Initializing Kumo AI RFM module...")
try:
    rfm.init()
    print("Initialization successful!")
except Exception as e:
    print(f"Error during initialization: {e}")
