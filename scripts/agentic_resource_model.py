#!/usr/bin/env python3
"""Analytical resource model for an agentic 6G core control plane.

The numbers are synthetic and intended for paper sensitivity analysis, not as
deployment measurements. The model keeps total request rate fixed and varies
the share of intent-bearing messages among intent-eligible procedures.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Dict, Iterable, List


@dataclass(frozen=True)
class Procedure:
    name: str
    mix: float
    base_latency_ms: float
    base_cpu_ms: float
    base_bandwidth_kb: float
    intent_eligible: bool


@dataclass(frozen=True)
class ModelConfig:
    total_rps: float = 10_000.0
    cpu_cores: float = 64.0
    nic_gbps: float = 100.0
    ram_gb: float = 256.0
    gpu_vram_gb: float = 24.0
    gpu_capacity_rps: float = 2_000.0
    cpu_degraded_util: float = 0.70
    cpu_high_risk_util: float = 0.85
    gpu_degraded_util: float = 0.70
    gpu_high_risk_util: float = 0.85
    base_ram_gb: float = 32.0
    fixed_model_vram_gb: float = 16.0
    non_intent_agent_cpu_ms: float = 0.3
    non_intent_agent_latency_ms: float = 1.0
    non_intent_mem_traffic_kb: float = 64.0
    intent_agent_cpu_ms: float = 2.0
    intent_agent_fixed_latency_ms: float = 4.0
    intent_agent_bandwidth_kb: float = 12.0
    intent_mem_traffic_kb: float = 512.0
    intent_gpu_latency_ms: float = 8.0
    intent_gpu_active_vram_mb: float = 4.0
    active_context_ram_kb: float = 128.0


PROCEDURES: List[Procedure] = [
    Procedure("registration", 0.20, 30.0, 2.0, 12.0, False),
    Procedure("pdu_session_establishment", 0.30, 40.0, 2.5, 16.0, True),
    Procedure("service_request", 0.50, 20.0, 1.2, 8.0, True),
]

INTENT_SETTINGS = [0.00, 0.01, 0.05, 0.10, 0.20, 0.50, 1.00]
SENSITIVITY_RPS = [1_000.0, 10_000.0, 50_000.0, 100_000.0]


def queue_delay_ms(util: float, service_ms: float) -> float:
    """Simple M/M/1-inspired delay term for sensitivity analysis."""
    if util >= 1.0:
        return math.inf
    if util <= 0.0:
        return 0.0
    return service_ms * util / (1.0 - util)


def status(util: float, degraded: float, high_risk: float) -> str:
    if util >= 1.0:
        return "unstable"
    if util >= high_risk:
        return "high_risk"
    if util >= degraded:
        return "degraded"
    return "stable"


def fmt(value: float) -> str:
    if math.isinf(value):
        return "inf"
    return f"{value:.3f}"


def evaluate(config: ModelConfig, eligible_intent_ratio: float) -> Dict[str, float | str]:
    eligible_mix = sum(p.mix for p in PROCEDURES if p.intent_eligible)
    actual_intent_share = eligible_mix * eligible_intent_ratio
    intent_rps = config.total_rps * actual_intent_share
    non_intent_rps = config.total_rps - intent_rps

    base_cpu_ms_avg = sum(p.mix * p.base_cpu_ms for p in PROCEDURES)
    agent_cpu_ms_avg = (
        actual_intent_share * config.intent_agent_cpu_ms
        + (1.0 - actual_intent_share) * config.non_intent_agent_cpu_ms
    )
    cpu_ms_per_request = base_cpu_ms_avg + agent_cpu_ms_avg
    cpu_core_demand = config.total_rps * cpu_ms_per_request / 1000.0
    cpu_util = cpu_core_demand / config.cpu_cores
    cpu_delay = queue_delay_ms(cpu_util, cpu_ms_per_request)

    base_bandwidth_kb_avg = sum(p.mix * p.base_bandwidth_kb for p in PROCEDURES)
    bandwidth_kb_per_request = (
        base_bandwidth_kb_avg
        + actual_intent_share * config.intent_agent_bandwidth_kb
    )
    bandwidth_gbps = config.total_rps * bandwidth_kb_per_request * 8.0 / 1_000_000.0
    network_util = bandwidth_gbps / config.nic_gbps
    network_delay = queue_delay_ms(network_util, 0.1)

    gpu_util = intent_rps / config.gpu_capacity_rps if config.gpu_capacity_rps else math.inf
    gpu_queue_delay = queue_delay_ms(gpu_util, 1_000.0 / config.gpu_capacity_rps)
    gpu_inference_latency = config.intent_gpu_latency_ms + gpu_queue_delay

    active_intent_requests = intent_rps * config.intent_gpu_latency_ms / 1000.0
    gpu_vram_gb = 0.0
    if intent_rps > 0:
        gpu_vram_gb = (
            config.fixed_model_vram_gb
            + active_intent_requests * config.intent_gpu_active_vram_mb / 1024.0
        )

    # Little's law approximation with base latency only; agent delay is added below.
    active_requests = config.total_rps * (
        sum(p.mix * p.base_latency_ms for p in PROCEDURES) / 1000.0
    )
    ram_gb = (
        config.base_ram_gb
        + active_requests * config.active_context_ram_kb / 1024.0 / 1024.0
    )
    memory_traffic_kb_per_request = (
        (1.0 - actual_intent_share) * config.non_intent_mem_traffic_kb
        + actual_intent_share * config.intent_mem_traffic_kb
    )
    memory_traffic_gbps = (
        config.total_rps * memory_traffic_kb_per_request * 8.0 / 1_000_000.0
    )

    mean_latency = 0.0
    unstable = cpu_util >= 1.0 or gpu_util >= 1.0 or network_util >= 1.0
    for proc in PROCEDURES:
        proc_rps_share = proc.mix
        if proc.intent_eligible:
            intent_share_for_proc = eligible_intent_ratio
        else:
            intent_share_for_proc = 0.0

        non_intent_latency = (
            proc.base_latency_ms
            + config.non_intent_agent_latency_ms
            + cpu_delay
            + network_delay
        )
        intent_latency = (
            proc.base_latency_ms
            + config.intent_agent_fixed_latency_ms
            + config.intent_agent_cpu_ms
            + gpu_inference_latency
            + cpu_delay
            + network_delay
        )
        if math.isinf(intent_latency):
            unstable = True

        mean_latency += proc_rps_share * (
            (1.0 - intent_share_for_proc) * non_intent_latency
            + intent_share_for_proc * intent_latency
        )

    bottleneck_util = max(cpu_util, gpu_util, network_util)
    if unstable:
        mean_latency = math.inf
        p95_latency = math.inf
        p99_latency = math.inf
    else:
        tail_amplifier = 1.0 + 2.0 * bottleneck_util / max(0.001, 1.0 - bottleneck_util)
        p95_latency = mean_latency * min(tail_amplifier, 10.0)
        p99_latency = mean_latency * min(tail_amplifier * 1.35, 15.0)

    required_gpus_70pct = (
        math.ceil(intent_rps / (config.gpu_capacity_rps * config.gpu_degraded_util))
        if intent_rps > 0
        else 0
    )

    return {
        "total_rps": config.total_rps,
        "eligible_intent_ratio": eligible_intent_ratio,
        "actual_total_intent_share": actual_intent_share,
        "intent_rps": intent_rps,
        "cpu_ms_per_request": cpu_ms_per_request,
        "cpu_core_demand": cpu_core_demand,
        "cpu_utilization": cpu_util,
        "cpu_status": status(cpu_util, config.cpu_degraded_util, config.cpu_high_risk_util),
        "ram_gb": ram_gb,
        "ram_utilization": ram_gb / config.ram_gb,
        "memory_traffic_gbps": memory_traffic_gbps,
        "gpu_utilization": gpu_util,
        "gpu_status": status(gpu_util, config.gpu_degraded_util, config.gpu_high_risk_util),
        "gpu_vram_gb": gpu_vram_gb,
        "gpu_vram_utilization": gpu_vram_gb / config.gpu_vram_gb,
        "required_gpus_for_70pct_util": required_gpus_70pct,
        "network_bandwidth_gbps": bandwidth_gbps,
        "network_utilization": network_util,
        "network_status": status(network_util, 0.70, 0.85),
        "mean_latency_ms": mean_latency,
        "p95_latency_ms": p95_latency,
        "p99_latency_ms": p99_latency,
        "system_status": "unstable" if unstable else status(bottleneck_util, 0.70, 0.85),
    }


def write_csv(rows: Iterable[Dict[str, float | str]], path: Path) -> None:
    rows = list(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow({key: fmt(value) if isinstance(value, float) else value for key, value in row.items()})


def maybe_write_plots(rows: List[Dict[str, float | str]], out_dir: Path) -> None:
    try:
        import matplotlib.pyplot as plt  # type: ignore
    except Exception:
        return

    out_dir.mkdir(parents=True, exist_ok=True)
    x = [100.0 * float(r["eligible_intent_ratio"]) for r in rows]

    def finite_series(key: str) -> List[float | None]:
        values: List[float | None] = []
        for row in rows:
            value = float(row[key])
            values.append(None if math.isinf(value) else value)
        return values

    plt.figure(figsize=(7, 4.2))
    plt.plot(x, [float(r["cpu_utilization"]) * 100.0 for r in rows], marker="o", label="CPU")
    plt.plot(x, [float(r["gpu_utilization"]) * 100.0 for r in rows], marker="o", label="GPU")
    plt.plot(x, [float(r["network_utilization"]) * 100.0 for r in rows], marker="o", label="Network")
    plt.axhline(70, color="tab:orange", linestyle="--", linewidth=1, label="70% threshold")
    plt.axhline(100, color="tab:red", linestyle="--", linewidth=1, label="100% capacity")
    plt.xlabel("Intent ratio among eligible requests (%)")
    plt.ylabel("Utilization (%)")
    plt.title("Resource utilization vs. intent ratio")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "agentic_resource_utilization.png", dpi=180)
    plt.close()

    plt.figure(figsize=(7, 4.2))
    plt.plot(x, finite_series("mean_latency_ms"), marker="o", label="mean")
    plt.plot(x, finite_series("p95_latency_ms"), marker="o", label="p95")
    plt.plot(x, finite_series("p99_latency_ms"), marker="o", label="p99")
    plt.xlabel("Intent ratio among eligible requests (%)")
    plt.ylabel("Latency (ms)")
    plt.title("Control-plane latency vs. intent ratio")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "agentic_latency.png", dpi=180)
    plt.close()


def main() -> None:
    config = ModelConfig()
    rows = [evaluate(config, ratio) for ratio in INTENT_SETTINGS]
    out_dir = Path("outputs")
    write_csv(rows, out_dir / "agentic_resource_results.csv")
    sensitivity_rows = [
        evaluate(replace(config, total_rps=total_rps), ratio)
        for total_rps in SENSITIVITY_RPS
        for ratio in INTENT_SETTINGS
    ]
    write_csv(sensitivity_rows, out_dir / "agentic_resource_sensitivity.csv")
    maybe_write_plots(rows, out_dir)

    print("Wrote outputs/agentic_resource_results.csv")
    print("Wrote outputs/agentic_resource_sensitivity.csv")
    if (out_dir / "agentic_resource_utilization.png").exists():
        print("Wrote outputs/agentic_resource_utilization.png")
        print("Wrote outputs/agentic_latency.png")


if __name__ == "__main__":
    main()
