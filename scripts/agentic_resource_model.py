#!/usr/bin/env python3
"""Analytical resource model for an agentic 6G core control plane.

The numbers are synthetic and intended for paper sensitivity analysis, not as
deployment measurements. Traffic is derived from user population and per-user
per-hour control-plane event frequencies.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Dict, Iterable, List


@dataclass(frozen=True)
class EventType:
    name: str
    per_user_per_hour: float
    base_latency_ms: float
    base_cpu_ms: float
    base_bandwidth_kb: float


@dataclass(frozen=True)
class ModelConfig:
    user_count: float = 3_600_000.0
    pdu_sessions_per_user: float = 2.0
    cpu_cores: float = 256.0
    nic_gbps: float = 100.0
    ram_gb: float = 256.0
    npu_hbm_per_npu_gb: float = 32.0
    cpu_degraded_util: float = 0.70
    cpu_high_risk_util: float = 0.85
    npu_degraded_util: float = 0.70
    npu_high_risk_util: float = 0.85
    base_ram_gb: float = 32.0
    fixed_model_hbm_gb: float = 16.0
    non_intent_agent_cpu_ms: float = 0.3
    non_intent_agent_latency_ms: float = 1.0
    non_intent_mem_traffic_kb: float = 64.0
    intent_agent_cpu_ms: float = 2.0
    intent_agent_fixed_latency_ms: float = 4.0
    intent_agent_bandwidth_kb: float = 12.0
    intent_mem_traffic_kb: float = 512.0
    qwen3_invocation_ratio: float = 0.10
    qwen3_input_tokens_per_request: float = 128.0
    qwen3_output_tokens_per_request: float = 4.0
    qwen3_token_capacity_per_replica: float = 15_040.0
    qwen3_tensor_parallel_size: float = 4.0
    qwen3_target_util: float = 0.70
    qwen3_latency_ms: float = 8.0
    qwen3_active_hbm_mb: float = 4.0
    active_context_ram_kb: float = 128.0


EVENTS: List[EventType] = [
    EventType("initial_registration", 0.1, 30.0, 2.0, 12.0),
    EventType("periodic_registration", 0.1, 25.0, 1.5, 10.0),
    EventType("mobility_registration", 7.0, 30.0, 2.0, 12.0),
    EventType("initial_pdu_session_establishment", 1.0, 40.0, 2.5, 16.0),
    EventType("pdu_session_release", 1.0, 25.0, 1.5, 10.0),
    EventType("pdu_session_modification", 2.0, 30.0, 2.0, 12.0),
    EventType("service_request", 21.0, 20.0, 1.2, 8.0),
    EventType("an_release", 35.0, 15.0, 0.8, 6.0),
    EventType("handover", 23.1, 25.0, 1.8, 12.0),
    EventType("paging", 14.0, 12.0, 0.6, 4.0),
]

INTENT_SETTINGS = [0.00, 0.01, 0.05, 0.10, 0.20, 0.50, 1.00]
SENSITIVITY_USERS = [100_000.0, 1_000_000.0, 3_600_000.0, 10_000_000.0]
QWEN3_INVOCATION_SETTINGS = [0.05, 0.10, 0.20, 0.50, 1.00]
QWEN3_TOKEN_CAPACITY_SETTINGS = [4_712.0, 5_340.0, 15_040.0]


def event_rps(config: ModelConfig, event: EventType) -> float:
    return config.user_count * event.per_user_per_hour / 3600.0


def total_rps(config: ModelConfig) -> float:
    return sum(event_rps(config, event) for event in EVENTS)


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


def weighted_average(config: ModelConfig, attr: str) -> float:
    total = total_rps(config)
    if total <= 0:
        return 0.0
    return sum(event_rps(config, event) * getattr(event, attr) for event in EVENTS) / total


def fmt(value: float) -> str:
    if math.isinf(value):
        return "inf"
    return f"{value:.3f}"


def evaluate(config: ModelConfig, intent_ratio: float) -> Dict[str, float | str]:
    rps_total = total_rps(config)
    intent_candidate_rps = rps_total
    intent_rps = intent_candidate_rps * intent_ratio
    actual_intent_share = intent_rps / rps_total if rps_total > 0 else 0.0
    qwen3_tokens_per_request = (
        config.qwen3_input_tokens_per_request
        + config.qwen3_output_tokens_per_request
    )
    qwen3_request_rps = intent_rps * config.qwen3_invocation_ratio
    qwen3_token_demand_tps = qwen3_request_rps * qwen3_tokens_per_request
    required_qwen3_replicas = (
        math.ceil(qwen3_token_demand_tps / (
            config.qwen3_token_capacity_per_replica * config.qwen3_target_util
        ))
        if qwen3_token_demand_tps > 0
        else 0
    )
    required_production_npus = required_qwen3_replicas * math.ceil(config.qwen3_tensor_parallel_size)
    qwen3_production_token_capacity_tps = required_qwen3_replicas * config.qwen3_token_capacity_per_replica

    base_cpu_ms_avg = weighted_average(config, "base_cpu_ms")
    agent_cpu_ms_avg = (
        actual_intent_share * config.intent_agent_cpu_ms
        + (1.0 - actual_intent_share) * config.non_intent_agent_cpu_ms
    )
    cpu_ms_per_request = base_cpu_ms_avg + agent_cpu_ms_avg
    cpu_core_demand = rps_total * cpu_ms_per_request / 1000.0
    cpu_util = cpu_core_demand / config.cpu_cores
    cpu_delay = queue_delay_ms(cpu_util, cpu_ms_per_request)

    base_bandwidth_kb_avg = weighted_average(config, "base_bandwidth_kb")
    bandwidth_kb_per_request = (
        base_bandwidth_kb_avg
        + actual_intent_share * config.intent_agent_bandwidth_kb
    )
    bandwidth_gbps = rps_total * bandwidth_kb_per_request * 8.0 / 1_000_000.0
    network_util = bandwidth_gbps / config.nic_gbps
    network_delay = queue_delay_ms(network_util, 0.1)

    npu_util = (
        qwen3_token_demand_tps / qwen3_production_token_capacity_tps
        if qwen3_production_token_capacity_tps
        else 0.0
    )
    npu_queue_delay = (
        queue_delay_ms(npu_util, 1_000.0 / qwen3_production_token_capacity_tps)
        if qwen3_production_token_capacity_tps
        else 0.0
    )
    qwen3_inference_latency = config.qwen3_latency_ms + npu_queue_delay

    active_qwen3_requests = qwen3_request_rps * config.qwen3_latency_ms / 1000.0
    npu_hbm_gb = 0.0
    if qwen3_request_rps > 0:
        active_npu_count = required_qwen3_replicas * config.qwen3_tensor_parallel_size
        npu_hbm_gb = (
            active_npu_count * config.fixed_model_hbm_gb
            + active_qwen3_requests * config.qwen3_active_hbm_mb / 1024.0
        )
    production_npu_total_hbm_gb = required_production_npus * config.npu_hbm_per_npu_gb

    active_requests = rps_total * (weighted_average(config, "base_latency_ms") / 1000.0)
    ram_gb = (
        config.base_ram_gb
        + active_requests * config.active_context_ram_kb / 1024.0 / 1024.0
    )
    memory_traffic_kb_per_request = (
        (1.0 - actual_intent_share) * config.non_intent_mem_traffic_kb
        + actual_intent_share * config.intent_mem_traffic_kb
    )
    memory_traffic_gbps = rps_total * memory_traffic_kb_per_request * 8.0 / 1_000_000.0

    mean_latency = 0.0
    unstable = cpu_util >= 1.0 or npu_util >= 1.0 or network_util >= 1.0
    for event in EVENTS:
        event_share = event_rps(config, event) / rps_total if rps_total > 0 else 0.0
        event_intent_share = intent_ratio
        non_intent_latency = (
            event.base_latency_ms
            + config.non_intent_agent_latency_ms
            + cpu_delay
            + network_delay
        )
        intent_latency = (
            event.base_latency_ms
            + config.intent_agent_fixed_latency_ms
            + config.intent_agent_cpu_ms
            + config.qwen3_invocation_ratio * qwen3_inference_latency
            + cpu_delay
            + network_delay
        )
        if math.isinf(intent_latency):
            unstable = True

        mean_latency += event_share * (
            (1.0 - event_intent_share) * non_intent_latency
            + event_intent_share * intent_latency
        )

    bottleneck_util = max(cpu_util, npu_util, network_util)
    if unstable:
        mean_latency = math.inf
        p95_latency = math.inf
        p99_latency = math.inf
    else:
        tail_amplifier = 1.0 + 2.0 * bottleneck_util / max(0.001, 1.0 - bottleneck_util)
        p95_latency = mean_latency * min(tail_amplifier, 10.0)
        p99_latency = mean_latency * min(tail_amplifier * 1.35, 15.0)

    result: Dict[str, float | str] = {
        "user_count": config.user_count,
        "pdu_sessions_per_user": config.pdu_sessions_per_user,
        "npu_hbm_per_npu_gb": config.npu_hbm_per_npu_gb,
        "qwen3_invocation_ratio": config.qwen3_invocation_ratio,
        "qwen3_input_tokens_per_request": config.qwen3_input_tokens_per_request,
        "qwen3_output_tokens_per_request": config.qwen3_output_tokens_per_request,
        "qwen3_tokens_per_request": qwen3_tokens_per_request,
        "qwen3_token_capacity_per_replica": config.qwen3_token_capacity_per_replica,
        "qwen3_tensor_parallel_size": config.qwen3_tensor_parallel_size,
        "qwen3_target_utilization": config.qwen3_target_util,
        "qwen3_request_rps": qwen3_request_rps,
        "qwen3_token_demand_tps": qwen3_token_demand_tps,
        "qwen3_production_token_capacity_tps": qwen3_production_token_capacity_tps,
        "required_qwen3_replicas": required_qwen3_replicas,
        "required_production_npus": required_production_npus,
        "production_npu_total_hbm_gb": production_npu_total_hbm_gb,
        "total_rps": rps_total,
        "intent_ratio": intent_ratio,
        "intent_candidate_rps": intent_candidate_rps,
        "actual_total_intent_share": actual_intent_share,
        "intent_rps": intent_rps,
        "cpu_ms_per_request": cpu_ms_per_request,
        "cpu_core_demand": cpu_core_demand,
        "cpu_utilization": cpu_util,
        "cpu_status": status(cpu_util, config.cpu_degraded_util, config.cpu_high_risk_util),
        "ram_gb": ram_gb,
        "ram_utilization": ram_gb / config.ram_gb,
        "memory_traffic_gbps": memory_traffic_gbps,
        "npu_utilization": npu_util,
        "npu_status": status(npu_util, config.npu_degraded_util, config.npu_high_risk_util),
        "npu_hbm_gb": npu_hbm_gb,
        "npu_hbm_utilization": npu_hbm_gb / production_npu_total_hbm_gb if production_npu_total_hbm_gb else 0.0,
        "required_npus_for_70pct_util": required_production_npus,
        "network_bandwidth_gbps": bandwidth_gbps,
        "network_utilization": network_util,
        "network_status": status(network_util, 0.70, 0.85),
        "mean_latency_ms": mean_latency,
        "p95_latency_ms": p95_latency,
        "p99_latency_ms": p99_latency,
        "system_status": "unstable" if unstable else status(bottleneck_util, 0.70, 0.85),
    }
    for event in EVENTS:
        result[f"{event.name}_per_user_per_hour"] = event.per_user_per_hour
        result[f"{event.name}_rps"] = event_rps(config, event)
    return result


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

    plt.figure(figsize=(7, 4.2))
    plt.plot(x, [float(r["cpu_utilization"]) * 100.0 for r in rows], marker="o", label="CPU")
    plt.plot(x, [float(r["npu_utilization"]) * 100.0 for r in rows], marker="o", label="Qwen3 NPU")
    plt.plot(x, [float(r["network_utilization"]) * 100.0 for r in rows], marker="o", label="Network")
    plt.axhline(70, color="tab:orange", linestyle="--", linewidth=1, label="70% threshold")
    plt.axhline(100, color="tab:red", linestyle="--", linewidth=1, label="100% capacity")
    plt.xlabel("Intent ratio across all requests (%)")
    plt.ylabel("Resource utilization (%)")
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
    plt.xlabel("Intent ratio across all requests (%)")
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

    print("Wrote outputs/agentic_resource_results.csv")
    print("Wrote outputs/agentic_resource_sensitivity.csv")
    print("Wrote outputs/agentic_qwen3_sizing_sensitivity.csv")
    if (out_dir / "agentic_resource_utilization.png").exists():
        print("Wrote outputs/agentic_resource_utilization.png")
        print("Wrote outputs/agentic_latency.png")


if __name__ == "__main__":
    main()
