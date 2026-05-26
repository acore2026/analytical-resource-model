"""Configuration and workload definitions for the agentic resource model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class EventType:
    name: str
    per_user_per_hour: float
    base_cpu_ms: float
    base_bandwidth_kb: float


@dataclass(frozen=True)
class ModelConfig:
    user_count: float = 3_600_000.0
    pdu_sessions_per_user: float = 2.0
    cpu_cores: float = 256.0
    nic_gbps: float = 100.0
    ram_gb: float = 256.0
    qwen3_npu_count: float = 128.0
    npu_hbm_per_npu_gb: float = 32.0
    cpu_degraded_util: float = 0.70
    cpu_high_risk_util: float = 0.85
    npu_degraded_util: float = 0.70
    npu_high_risk_util: float = 0.85
    base_ram_gb: float = 32.0
    fixed_model_hbm_gb: float = 16.0
    non_intent_agent_cpu_ms: float = 0.3
    non_intent_mem_traffic_kb: float = 64.0
    intent_agent_cpu_ms: float = 2.0
    intent_agent_bandwidth_kb: float = 12.0
    intent_mem_traffic_kb: float = 512.0
    qwen3_invocation_ratio: float = 0.10
    qwen3_input_tokens_per_request: float = 128.0
    qwen3_output_tokens_per_request: float = 4.0
    qwen3_token_capacity_per_replica: float = 15_040.0
    qwen3_tensor_parallel_size: float = 4.0
    qwen3_request_hbm_mb_per_rps: float = 0.032
    request_state_ram_kb_per_rps: float = 128.0


EVENTS: List[EventType] = [
    EventType("initial_registration", 0.1, 2.0, 12.0),
    EventType("periodic_registration", 0.1, 1.5, 10.0),
    EventType("mobility_registration", 7.0, 2.0, 12.0),
    EventType("initial_pdu_session_establishment", 1.0, 2.5, 16.0),
    EventType("pdu_session_release", 1.0, 1.5, 10.0),
    EventType("pdu_session_modification", 2.0, 2.0, 12.0),
    EventType("service_request", 21.0, 1.2, 8.0),
    EventType("an_release", 35.0, 0.8, 6.0),
    EventType("handover", 23.1, 1.8, 12.0),
    EventType("paging", 14.0, 0.6, 4.0),
]

INTENT_TABLE_SETTINGS = [step / 100.0 for step in range(0, 101, 10)]
INTENT_PLOT_SETTINGS = [step / 100.0 for step in range(0, 101)]
INTENT_SETTINGS = INTENT_TABLE_SETTINGS
SENSITIVITY_USERS = [
    500_000.0,
    1_000_000.0,
    1_500_000.0,
    2_000_000.0,
    2_500_000.0,
    3_000_000.0,
    3_500_000.0,
    4_000_000.0,
]
USER_COUNT_PLOT_INTENT_RATIO = 0.20
QWEN3_INVOCATION_SETTINGS = [0.05, 0.10, 0.20, 0.50, 1.00]
QWEN3_TOKEN_CAPACITY_SETTINGS = [4_712.0, 5_340.0, 15_040.0]
