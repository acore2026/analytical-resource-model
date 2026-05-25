"""Core equations for the agentic resource model."""

from __future__ import annotations

import math
from typing import Dict

from agentic_model_config import EVENTS, EventType, ModelConfig

LOAD_BANDS = (
    (0.60, 1.00),
    (0.80, 1.15),
    (0.90, 1.35),
    (float("inf"), 1.60),
)

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


def load_band(load: float) -> int:
    bounded_load = max(0.0, load)
    for index, (upper_bound, _) in enumerate(LOAD_BANDS):
        if bounded_load < upper_bound:
            return index
    return len(LOAD_BANDS) - 1


def continuous_effective_load(load: float) -> float:
    """Continuous load-band overhead with non-decreasing marginal slope."""
    bounded_load = max(0.0, load)
    effective = 0.0
    lower_bound = 0.0
    for upper_bound, slope in LOAD_BANDS:
        segment_upper = min(bounded_load, upper_bound)
        if segment_upper > lower_bound:
            effective += (segment_upper - lower_bound) * slope
        if bounded_load < upper_bound:
            break
        lower_bound = upper_bound
    return effective


def continuous_multiplier(load: float) -> float:
    """Effective multiplier implied by the continuous load-band function."""
    bounded_load = max(0.0, load)
    if bounded_load == 0.0:
        return 1.0
    return continuous_effective_load(bounded_load) / bounded_load


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
    qwen3_tensor_parallel_size = max(1, math.ceil(config.qwen3_tensor_parallel_size))
    qwen3_cluster_npus = max(0, math.floor(config.qwen3_npu_count))
    qwen3_available_replicas = qwen3_cluster_npus // qwen3_tensor_parallel_size
    qwen3_cluster_token_capacity_tps = (
        qwen3_available_replicas * config.qwen3_token_capacity_per_replica
    )
    qwen3_raw_util = (
        qwen3_token_demand_tps / qwen3_cluster_token_capacity_tps
        if qwen3_cluster_token_capacity_tps
        else 0.0
    )
    qwen3_load_band = load_band(qwen3_raw_util)
    qwen3_nonlinear_multiplier = continuous_multiplier(qwen3_raw_util)
    qwen3_effective_token_demand_tps = qwen3_token_demand_tps * qwen3_nonlinear_multiplier

    base_cpu_ms_avg = weighted_average(config, "base_cpu_ms")
    agent_cpu_ms_avg = (
        actual_intent_share * config.intent_agent_cpu_ms
        + (1.0 - actual_intent_share) * config.non_intent_agent_cpu_ms
    )
    linear_cpu_ms_per_request = base_cpu_ms_avg + agent_cpu_ms_avg
    linear_cpu_core_demand = rps_total * linear_cpu_ms_per_request / 1000.0
    linear_cpu_util = linear_cpu_core_demand / config.cpu_cores
    cpu_load_band = load_band(linear_cpu_util)
    cpu_nonlinear_multiplier = continuous_multiplier(linear_cpu_util)
    cpu_ms_per_request = linear_cpu_ms_per_request * cpu_nonlinear_multiplier
    cpu_core_demand = rps_total * cpu_ms_per_request / 1000.0
    cpu_util = cpu_core_demand / config.cpu_cores
    cpu_delay = queue_delay_ms(cpu_util, cpu_ms_per_request)

    base_bandwidth_kb_avg = weighted_average(config, "base_bandwidth_kb")
    bandwidth_kb_per_request = (
        base_bandwidth_kb_avg
        + actual_intent_share * config.intent_agent_bandwidth_kb
    )
    linear_bandwidth_gbps = rps_total * bandwidth_kb_per_request * 8.0 / 1_000_000.0
    linear_network_util = linear_bandwidth_gbps / config.nic_gbps
    network_load_band = load_band(linear_network_util)
    network_nonlinear_multiplier = continuous_multiplier(linear_network_util)
    bandwidth_gbps = linear_bandwidth_gbps * network_nonlinear_multiplier
    network_util = bandwidth_gbps / config.nic_gbps
    network_delay = queue_delay_ms(network_util, 0.1)

    npu_util = (
        qwen3_effective_token_demand_tps / qwen3_cluster_token_capacity_tps
        if qwen3_cluster_token_capacity_tps
        else 0.0
    )
    npu_queue_delay = (
        queue_delay_ms(npu_util, 1_000.0 / qwen3_cluster_token_capacity_tps)
        if qwen3_cluster_token_capacity_tps
        else 0.0
    )
    qwen3_inference_latency = config.qwen3_latency_ms + npu_queue_delay

    active_qwen3_requests = qwen3_request_rps * config.qwen3_latency_ms / 1000.0
    npu_hbm_gb = 0.0
    if qwen3_request_rps > 0:
        active_npu_count = qwen3_available_replicas * qwen3_tensor_parallel_size
        npu_hbm_gb = (
            active_npu_count * config.fixed_model_hbm_gb
            + active_qwen3_requests * config.qwen3_active_hbm_mb / 1024.0
        )
    production_npu_total_hbm_gb = qwen3_cluster_npus * config.npu_hbm_per_npu_gb

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
        "qwen3_npu_count": qwen3_cluster_npus,
        "npu_hbm_per_npu_gb": config.npu_hbm_per_npu_gb,
        "qwen3_invocation_ratio": config.qwen3_invocation_ratio,
        "qwen3_input_tokens_per_request": config.qwen3_input_tokens_per_request,
        "qwen3_output_tokens_per_request": config.qwen3_output_tokens_per_request,
        "qwen3_tokens_per_request": qwen3_tokens_per_request,
        "qwen3_token_capacity_per_replica": config.qwen3_token_capacity_per_replica,
        "qwen3_tensor_parallel_size": qwen3_tensor_parallel_size,
        "qwen3_available_replicas": qwen3_available_replicas,
        "qwen3_request_rps": qwen3_request_rps,
        "qwen3_token_demand_tps": qwen3_token_demand_tps,
        "qwen3_raw_utilization": qwen3_raw_util,
        "qwen3_load_band": qwen3_load_band,
        "qwen3_effective_token_demand_tps": qwen3_effective_token_demand_tps,
        "qwen3_nonlinear_multiplier": qwen3_nonlinear_multiplier,
        "qwen3_cluster_token_capacity_tps": qwen3_cluster_token_capacity_tps,
        "production_npu_total_hbm_gb": production_npu_total_hbm_gb,
        "total_rps": rps_total,
        "intent_ratio": intent_ratio,
        "intent_candidate_rps": intent_candidate_rps,
        "actual_total_intent_share": actual_intent_share,
        "intent_rps": intent_rps,
        "linear_cpu_ms_per_request": linear_cpu_ms_per_request,
        "linear_cpu_utilization": linear_cpu_util,
        "cpu_load_band": cpu_load_band,
        "cpu_nonlinear_multiplier": cpu_nonlinear_multiplier,
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
        "linear_network_utilization": linear_network_util,
        "network_load_band": network_load_band,
        "network_nonlinear_multiplier": network_nonlinear_multiplier,
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
