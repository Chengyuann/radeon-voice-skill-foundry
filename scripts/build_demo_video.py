#!/usr/bin/env python3
"""Stable entry point for the final Product Demo video build."""

from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).with_name("build_product_demo_video.py")),
    run_name="__main__",
)
