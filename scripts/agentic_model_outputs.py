"""CSV and plot writers for the agentic resource model."""

from __future__ import annotations

import csv
import math
from dataclasses import replace
from pathlib import Path
from typing import Dict, Iterable, List

from agentic_model_config import SENSITIVITY_USERS, USER_COUNT_PLOT_INTENT_RATIO, ModelConfig
from agentic_model_core import evaluate, fmt

CPU_COLOR = "#2a7f3e"
NETWORK_COLOR = "#1f77b4"
NPU_COLOR = "#d66a00"


def write_csv(rows: Iterable[Dict[str, float | str]], path: Path) -> None:
    rows = list(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: fmt(value) if isinstance(value, float) else value for key, value in row.items()})


def maybe_write_plots(rows: List[Dict[str, float | str]], out_dir: Path) -> None:
    try:
        import matplotlib.pyplot as plt  # type: ignore
    except Exception:
        return

    out_dir.mkdir(parents=True, exist_ok=True)
    x = [100.0 * float(r["intent_ratio"]) for r in rows]

    def finite_series(key: str) -> List[float | None]:
        values: List[float | None] = []
        for row in rows:
            value = float(row[key])
            values.append(None if math.isinf(value) else value)
        return values

    fig, ax_util = plt.subplots(figsize=(7, 4.2))
    cpu_line, = ax_util.plot(
        x,
        [float(r["cpu_utilization"]) * 100.0 for r in rows],
        marker="o",
        markevery=10,
        color=CPU_COLOR,
        label="CPU util",
    )
    net_line, = ax_util.plot(
        x,
        [float(r["network_utilization"]) * 100.0 for r in rows],
        marker="s",
        markevery=10,
        color=NETWORK_COLOR,
        label="Network util",
    )
    npu_line, = ax_util.plot(
        x,
        [float(r["npu_utilization"]) * 100.0 for r in rows],
        marker="^",
        markevery=10,
        color=NPU_COLOR,
        label="NPU util",
    )
    ax_util.axhline(70, color="tab:gray", linestyle="--", linewidth=1, label="70% utilization")
    ax_util.axhline(100, color="tab:red", linestyle="--", linewidth=1, label="100% capacity")
    ax_util.set_xlabel("Intent ratio across all requests (%)")
    ax_util.set_ylabel("CPU / Network / NPU utilization (%)")
    ax_util.set_title("Convex nonlinear utilization vs. intent ratio")
    ax_util.text(
        0.99,
        0.03,
        "Curvature reflects contention overhead as load grows.",
        transform=ax_util.transAxes,
        ha="right",
        va="bottom",
        fontsize=8,
        color="#5f6661",
        bbox={"boxstyle": "round,pad=0.25", "fc": "white", "ec": "#5f6661", "alpha": 0.72},
    )
    ax_util.grid(True, alpha=0.3)
    lines = [cpu_line, net_line, npu_line]
    labels = [line.get_label() for line in lines]
    ax_util.legend(lines, labels, loc="upper left")
    plt.tight_layout()
    plt.savefig(out_dir / "agentic_resource_utilization.png", dpi=180)
    plt.close()

    plt.figure(figsize=(7, 4.2))
    plt.plot(x, finite_series("mean_latency_ms"), marker="o", markevery=10, color="#2a7f3e", label="mean, no queueing")
    plt.xlabel("Intent ratio across all requests (%)")
    plt.ylabel("Latency (ms)")
    plt.title("No-queue control-plane latency vs. intent ratio")
    plt.text(
        0.99,
        0.04,
        "Queueing delay is excluded; overload is shown by utilization status.",
        transform=plt.gca().transAxes,
        ha="right",
        va="bottom",
        fontsize=8,
        color="#5f6661",
        bbox={"boxstyle": "round,pad=0.25", "fc": "white", "ec": "#5f6661", "alpha": 0.72},
    )
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "agentic_latency.png", dpi=180)
    plt.close()


def maybe_write_user_count_plot(config: ModelConfig, out_dir: Path) -> None:
    try:
        import matplotlib.pyplot as plt  # type: ignore
    except Exception:
        return

    rows = [
        evaluate(replace(config, user_count=user_count), USER_COUNT_PLOT_INTENT_RATIO)
        for user_count in SENSITIVITY_USERS
    ]
    x = [float(row["user_count"]) / 1_000_000.0 for row in rows]

    fig, ax_util = plt.subplots(figsize=(7, 4.2))
    cpu_line, = ax_util.plot(
        x,
        [float(r["cpu_utilization"]) * 100.0 for r in rows],
        marker="o",
        color=CPU_COLOR,
        label="CPU util",
    )
    net_line, = ax_util.plot(
        x,
        [float(r["network_utilization"]) * 100.0 for r in rows],
        marker="s",
        color=NETWORK_COLOR,
        label="Network util",
    )
    npu_line, = ax_util.plot(
        x,
        [float(r["npu_utilization"]) * 100.0 for r in rows],
        marker="^",
        color=NPU_COLOR,
        label="NPU util",
    )
    ax_util.axhline(70, color="tab:gray", linestyle="--", linewidth=1, label="70% utilization")
    ax_util.axhline(100, color="tab:red", linestyle="--", linewidth=1, label="100% capacity")
    ax_util.set_xlabel("User count (million users)")
    ax_util.set_ylabel("CPU / Network / NPU utilization (%)")
    ax_util.set_title("Convex nonlinear utilization vs. user count (20% intent)")
    ax_util.grid(True, alpha=0.3)
    lines = [cpu_line, net_line, npu_line]
    labels = [line.get_label() for line in lines]
    ax_util.legend(lines, labels, loc="upper left")
    plt.tight_layout()
    plt.savefig(out_dir / "agentic_user_count_sensitivity.png", dpi=180)
    plt.close()
