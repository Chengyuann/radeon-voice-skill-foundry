#!/usr/bin/env python3
"""Stable entry point for final Demo narration generation."""

from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).with_name("generate_product_demo_tts.py")),
    run_name="__main__",
)
