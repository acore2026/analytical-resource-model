#!/usr/bin/env python3
"""Analytical resource model for an agentic 6G core control plane.

The numbers are synthetic and intended for paper sensitivity analysis, not as
deployment measurements. Traffic is derived from user population and per-user
per-hour control-plane event frequencies.
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from agentic_model_config import (
    INTENT_SETTINGS,
    QWEN3_INVOCATION_SETTINGS,
    QWEN3_TOKEN_CAPACITY_SETTINGS,
    SENSITIVITY_USERS,
    ModelConfig,
)
from agentic_model_core import evaluate
from agentic_model_outputs import maybe_write_plots, maybe_write_user_count_plot, write_csv

def main() -> None:
    config = ModelConfig()
    rows = [evaluate(config, ratio) for ratio in INTENT_SETTINGS]
    out_dir = Path("outputs")
    write_csv(rows, out_dir / "agentic_resource_results.csv")
    sensitivity_rows = [
        evaluate(replace(config, user_count=user_count), ratio)
        for user_count in SENSITIVITY_USERS
        for ratio in INTENT_SETTINGS
    ]
    write_csv(sensitivity_rows, out_dir / "agentic_resource_sensitivity.csv")
    qwen3_rows = [
        evaluate(
            replace(config, qwen3_invocation_ratio=invocation_ratio, qwen3_token_capacity_per_replica=capacity),
            1.0,
        )
        for invocation_ratio in QWEN3_INVOCATION_SETTINGS
        for capacity in QWEN3_TOKEN_CAPACITY_SETTINGS
    ]
    write_csv(qwen3_rows, out_dir / "agentic_qwen3_sizing_sensitivity.csv")
    maybe_write_plots(rows, out_dir)
    maybe_write_user_count_plot(config, out_dir)

    print("Wrote outputs/agentic_resource_results.csv")
    print("Wrote outputs/agentic_resource_sensitivity.csv")
    print("Wrote outputs/agentic_qwen3_sizing_sensitivity.csv")
    if (out_dir / "agentic_resource_utilization.png").exists():
        print("Wrote outputs/agentic_resource_utilization.png")
        print("Wrote outputs/agentic_latency.png")
        print("Wrote outputs/agentic_user_count_sensitivity.png")


if __name__ == "__main__":
    main()
