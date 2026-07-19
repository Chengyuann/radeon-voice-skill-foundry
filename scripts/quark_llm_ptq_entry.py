#!/usr/bin/env python3
"""Run only Quark's PyTorch LLM PTQ command without importing ONNX CLI plugins."""

from __future__ import annotations

import argparse
import sys

from quark.experimental.cli.torch_llm_ptq import TorchLLM_PTQ_CLI


def main() -> None:
    parser = argparse.ArgumentParser()
    TorchLLM_PTQ_CLI.register_subcommand(parser)
    args, unknown = parser.parse_known_args()
    TorchLLM_PTQ_CLI(parser, args, unknown).run()


if __name__ == "__main__":
    sys.exit(main())
