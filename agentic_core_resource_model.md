# Analytical Resource Model for Agentic 6G Core Control-Plane Procedures

[中文版本](agentic_core_resource_model_zh.md)

This document provides a theoretical resource model for the proposed agentic 6G core architecture. It does not claim deployment measurements. The goal is to estimate whether NW-Agent reasoning, tool invocation, and agent cooperation can remain bounded under high-concurrency control-plane workloads.

The model separates traditional deterministic NF work from agentic overhead. The deterministic path performs the ordinary control-plane state changes. The agentic path adds Connection Agent processing, cached ARF/TRF metadata lookup, tool invocation wrappers, inter-agent messages, and accelerator-backed inference for intent-bearing requests. Roaming, AF-originated intent, and SRF routing cost are excluded.

## Workload Model

Traffic is derived from a user population instead of a fixed percentage mix. Let `N_user` be the number of registered users, and let `f_i` be the number of times one user triggers event `i` per hour. The arrival rate of event `i` is:

```text
lambda_i [requests/s] = N_user [users] * f_i [events/user/hour] / 3600 [s/hour]
```

The total control-plane request rate is:

```text
lambda_total [requests/s] = sum_i(lambda_i)
```

The baseline uses `3,600,000 users` and `2 PDU sessions/user`. The PDU session count is retained as a scenario variable and does not multiply event rates automatically; session effects should be represented by changing the per-user/hour event frequencies.

| Event | Default per user per hour | Derived request rate | Base latency | Base CPU | Base bandwidth | Intent-eligible |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Initial registration | 0.1 events/user/hour | 100 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request | No |
| Periodic registration | 0.1 events/user/hour | 100 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request | No |
| Mobility registration | 7.0 events/user/hour | 7,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request | No |
| Initial PDU session establishment | 1.0 events/user/hour | 1,000 requests/s | 40 ms | 2.5 CPU-ms/request | 16 KB/request | Yes |
| PDU session release | 1.0 events/user/hour | 1,000 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request | No |
| PDU session modification | 2.0 events/user/hour | 2,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request | Yes |
| Service request | 21.0 events/user/hour | 21,000 requests/s | 20 ms | 1.2 CPU-ms/request | 8 KB/request | Yes |
| AN release | 35.0 events/user/hour | 35,000 requests/s | 15 ms | 0.8 CPU-ms/request | 6 KB/request | No |
| Handover | 23.1 events/user/hour | 23,100 requests/s | 25 ms | 1.8 CPU-ms/request | 12 KB/request | No |
| Paging | 14.0 events/user/hour | 14,000 requests/s | 12 ms | 0.6 CPU-ms/request | 4 KB/request | No |

The baseline total is `104,300 requests/s`. Intent is only applied to initial PDU session establishment, PDU session modification, and service request. Therefore, at `100%` eligible-intent ratio, the total intent-bearing traffic is `24,000 requests/s`, or `23.0%` of all requests.

## Resource Assumptions

| Parameter | Value |
| --- | ---: |
| Host CPU platform | Kunpeng 920 |
| CPU cluster capacity | 256 CPU cores = 256,000 CPU-ms/s |
| RAM capacity | 256 GB |
| Inference runtime | vLLM Ascend 0.11.0 |
| Intent inference model | Qwen3-30B-A3B |
| Lab NPU profile | 8 x Ascend 910B4, 32 GB HBM/NPU |
| Production NPU sizing target | 70% Qwen3 token utilization |
| Qwen3 invocation ratio | 10% of intent requests |
| Qwen3 token profile | 128 input tokens + 4 output tokens = 132 tokens/request |
| Qwen3 token capacity | 15,040 tokens/s/replica |
| Qwen3 tensor parallel size | 4 NPUs/replica |
| Network capacity | 100 Gbps |
| Non-intent agent CPU cost | 0.3 CPU-ms/request |
| Intent agent CPU cost | 2.0 CPU-ms/request |
| Non-intent agent latency | 1 ms/request |
| Intent fixed agent latency | 4 ms/request |
| Qwen3 service time for complex intent | 8 ms/request before queueing |
| Non-intent memory traffic | 64 KB/request |
| Intent memory traffic | 512 KB/request |
| Intent extra bandwidth | 12 KB/request |
| Fixed inference model memory | 16 GB HBM per active NPU |
| Active Qwen3 HBM | 4 MB/active Qwen3 request |

`CPU-ms` means one CPU core occupied for one millisecond. For example, `2 CPU-ms/request` at `100,000 requests/s` consumes `200 CPU cores`. In this version, CPU costs are interpreted as host-side budgets on Kunpeng 920 CPU cores. Qwen3-30B-A3B capacity is modeled in tokens/s, then converted into the number of production Ascend 910B4 NPUs required.

The `8 x Ascend 910B4` server is treated as a lab reference, not as the production deployment size for `3.6M` users. Production NPU count is an output of the model. The default Qwen3 invocation ratio is `10%` of intent requests, and the model also reports `5%`, `10%`, `20%`, `50%`, and `100%` sensitivity points.

## Qwen3 Token-Capacity Rationale

The available `npu-smi` snapshot establishes the lab shape used by the model: eight `910B4` NPUs are visible and each card reports `32,768 MB` of HBM capacity. The concrete inference stack is vLLM Ascend 0.11.0 serving Qwen3-30B-A3B, with Kunpeng 920 CPUs handling host-side runtime and agent logic. This is useful for defining the reference platform, but it should not be interpreted as enough capacity for the full production workload.

[GPUStack's Qwen3-30B-A3B on Ascend 910B benchmark](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/) reports an optimized short-prompt result of `15,040.15 total tokens/s` for `128 input tokens` and `4 output tokens`. [vLLM-Ascend's Qwen3-30B-A3B tutorial](https://docs.vllm.ai/projects/ascend/en/v0.11.0-dev/tutorials/multi_npu_qwen3_moe.html) states that 32 GB NPU cards should use tensor parallel size at least `4`, so the model treats one Qwen3 replica as `4 NPUs`. The benchmark uses a specific software stack and should be treated as a reference point, not a measurement from this system.

The model uses a two-tier inference path. Lightweight parsing, constraint extraction, and tool selection are applied to all intent requests. Qwen3-30B-A3B is invoked only for complex or ambiguous intent requests:

```text
lambda_Q [requests/s] =
  lambda_I [intent requests/s] * r_Q [Qwen3 invocation ratio]

T_Q [tokens/s] =
  lambda_Q * (tokens_input + tokens_output)

R_Q [replicas] =
  ceil(T_Q / (capacity_tokens_per_replica * target_utilization))

N_Q [NPUs] =
  R_Q * tensor_parallel_size
```

For the default production scenario at `100%` eligible intent:

```text
lambda_I = 24,000 intent requests/s
r_Q = 10%
lambda_Q = 2,400 Qwen3 requests/s
T_Q = 2,400 * 132 = 316,800 tokens/s
R_Q = ceil(316,800 / (15,040 * 0.70)) = 31 replicas
N_Q = 31 * 4 = 124 NPUs
```

This framing avoids the unrealistic assumption that every intent request performs a full Qwen3 generation on the 8-NPU lab server.

## Derivation of Agentic Cost Assumptions

The proposal defines several architecture behaviors that create agentic overhead: UE NAS requests are forwarded to NW-Agents with or without intent; NW-Agents check whether the request can be fulfilled under network conditions and constraints; intent requests require understanding, task composition, tool selection, and tool invocation; the Planning Agent may interact with specialized agents such as the Connection Agent; and TRF/ARF provide tool or agent metadata for discovery and selection. In the basic-procedure model, TRF/ARF metadata is assumed to be cached in the serving agent process, so repository discovery does not add a per-request network round trip.

The values below are therefore engineering budgets derived from the proposal procedure steps, not measured deployment constants. They should be interpreted as nominal assumptions that can be replaced by prototype measurements.

### Non-Intent Agent CPU Cost

For a request without intent, the proposal still routes the request through an NW-Agent. The agent does not need semantic intent inference or task decomposition, but it still performs request classification, fast-path constraint checks, cached metadata lookup, and tool wrapper preparation before deterministic NF execution.

| Component | Rationale from architecture | CPU budget |
| --- | --- | ---: |
| NAS/request normalization | Convert the UE request into an internal agent request object. | 0.05 CPU-ms/request |
| Intent absence detection and procedure classification | Determine that no intent payload is present and select the deterministic procedure path. | 0.05 CPU-ms/request |
| Cached ARF/TRF metadata lookup | Check locally cached agent/tool descriptors for the relevant connection-service path. | 0.05 CPU-ms/request |
| Policy, subscription, and resource fast-path checks | Apply lightweight feasibility checks before invoking deterministic tools. | 0.08 CPU-ms/request |
| Tool wrapper, state update, and tracing | Prepare tool invocation context and record request state/progress. | 0.07 CPU-ms/request |
| **Total** |  | **0.30 CPU-ms/request** |

This is the incremental agentic CPU cost only. The deterministic registration, PDU session, service request, AN release, handover, and paging work is captured separately in the per-event base CPU values.

### Intent Agent CPU Cost

For intent-bearing requests, the proposal adds semi-structured intent processing, constraint interpretation, dynamic task composition, tool selection, and possible Planning Agent to Connection Agent cooperation. The model assigns `2.0 CPU-ms/request` to this CPU-side agent work, excluding accelerator inference.

| Component | Rationale from architecture | CPU budget |
| --- | --- | ---: |
| Intent container parsing | Decode the NAS-carried intent and extract standardized fields. | 0.25 CPU-ms/request |
| Intent normalization and constraint extraction | Interpret description, goals, conditions, guidelines, and extra information. | 0.20 CPU-ms/request |
| UE/session/network context lookup | Gather subscription, session, location, and cached tool context needed by the agent. | 0.25 CPU-ms/request |
| Policy, subscription, and resource feasibility checks | Check whether the intent can be fulfilled under operator and network constraints. | 0.35 CPU-ms/request |
| Task decomposition and tool selection | Compose the ordered task plan and select tools such as SMC, PCC, SMAU, analytics, traffic treatment, or UP configuration tools. | 0.45 CPU-ms/request |
| Inter-agent task envelope handling | Prepare Planning Agent to specialized-agent task requests when cooperation is needed. | 0.25 CPU-ms/request |
| State update, progress tracking, and tracing | Store request state, tool results, and observability metadata. | 0.25 CPU-ms/request |
| **Total** |  | **2.00 CPU-ms/request** |

### Intent Latency

Latency is split into deterministic procedure latency, CPU queueing, fixed agent orchestration latency, and optional Qwen3 inference latency. The lightweight intent path uses fixed orchestration and CPU-side agent work. A configurable fraction of intent requests also invokes Qwen3:

```text
Lightweight intent latency [ms/request] =
  4 ms fixed orchestration
+ 2 ms CPU-side agent service

Complex intent Qwen3 add-on [ms/request] =
  8 ms Qwen3 service time before queueing
```

The `4 ms` fixed orchestration term covers wall-clock processing around parsing, feasibility checking, task-plan construction, tool wrapper creation, and local state update. The `2 ms` CPU-side service term corresponds to the `2.0 CPU-ms/request` intent CPU budget when it is serialized on one core. The `8 ms` Qwen3 term applies only to the configured complex-intent share. Queueing delay is then added based on CPU, sized Qwen3 production-NPU, and network utilization.

For non-intent requests, the model uses `1 ms/request` of fixed agent latency because the request follows a fast path: classify, check cached metadata, and invoke the deterministic tool path without semantic inference.

### Intent Extra Bandwidth

Base event bandwidth already represents ordinary control-plane signaling for the traditional procedure. The model adds `12 KB/request` only for intent-bearing requests to represent extra bytes introduced by the agentic architecture.

| Component | Rationale from architecture | Bandwidth budget |
| --- | --- | ---: |
| Intent NAS container and normalized request payload | Carries semi-structured intent fields from UE to the agent and into the internal agent request. | 2 KB/request |
| Planning/task metadata | Encodes task description, target ability, constraints, and selected procedure context. | 3 KB/request |
| Tool invocation wrapper metadata | Carries selected tool names, inputs, pre/post-condition identifiers, and result metadata for several tool calls. | 5 KB/request |
| Inter-agent status and tracing metadata | Captures progress/result reporting between Planning Agent, specialized agents, and tool-hosting NFs. | 2 KB/request |
| **Total** |  | **12 KB/request** |

For non-intent requests, extra agentic bandwidth is modeled as `0 KB/request` because the existing NAS/NF signaling is already included in the base event bandwidth and cached local metadata lookup does not require per-request repository traffic.

## Model

Let `rho_I` be the intent ratio among intent-eligible events. Let `e_i` be 1 if event `i` is intent-eligible and 0 otherwise.

```text
lambda_eligible [requests/s] = sum_i(lambda_i * e_i)
lambda_I [requests/s] = rho_I * lambda_eligible
s_I [unitless] = lambda_I / lambda_total
```

Average CPU cost is:

```text
C_cpu [CPU-ms/request] =
  sum_i((lambda_i / lambda_total) * C_base,i)
  + s_I * C_agent,intent
  + (1 - s_I) * C_agent,nonintent
```

CPU demand and utilization are:

```text
D_cpu [CPU cores] = lambda_total * C_cpu / 1000
u_cpu [unitless] = D_cpu / N_cpu
```

Control-plane bandwidth is:

```text
B_req [KB/request] =
  sum_i((lambda_i / lambda_total) * B_base,i)
  + s_I * B_agent,intent

B_net [Gbps] = lambda_total * B_req * 8 / 1,000,000
u_net [unitless] = B_net / C_net
```

Qwen3 production NPU sizing is:

```text
lambda_Q [requests/s] = lambda_I * r_Q
T_Q [tokens/s] = lambda_Q * L_Q
R_Q [replicas] = ceil(T_Q / (mu_Q * u_target))
N_Q [NPUs] = R_Q * TP_Q
u_npu [unitless] = T_Q / (R_Q * mu_Q)
```

Queueing delay uses a simple M/M/1-inspired sensitivity term:

```text
D_queue [ms] = S [ms] * u / (1 - u), for u < 1
```

This is an analytical approximation, not a telecom simulator. Mean, p95, and p99 latency are calculated from deterministic procedure latency, fixed agent latency, CPU queueing, Qwen3 production-NPU queueing, and network queueing. A fixed lab NPU pool may be over capacity, but the production sizing result reports how many NPUs are required to keep Qwen3 token utilization at or below the target.

## Analytical Results

The table below fixes the user population and event frequencies, then varies only the percentage of intent among intent-eligible events.

| Eligible intent ratio | Total intent share | Intent rps | Qwen3 rps | Qwen3 tokens/s | CPU cores | CPU util | Memory traffic | Qwen3 util | Required production NPUs | Network bandwidth | Mean latency | p95 latency | Status |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 156.8 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.1 ms | stable |
| 1% | 0.2% | 240 | 24 | 3,168 | 157.2 | 61.4% | 54.262 Gbps | 21.1% | 4 | 6.802 Gbps | 22.9 ms | 95.8 ms | stable |
| 5% | 1.2% | 1,200 | 120 | 15,840 | 158.9 | 62.1% | 57.702 Gbps | 52.7% | 8 | 6.894 Gbps | 23.0 ms | 98.4 ms | stable |
| 10% | 2.3% | 2,400 | 240 | 31,680 | 160.9 | 62.9% | 62.003 Gbps | 52.7% | 16 | 7.010 Gbps | 23.2 ms | 101.8 ms | stable |
| 20% | 4.6% | 4,800 | 480 | 63,360 | 165.0 | 64.4% | 70.605 Gbps | 60.2% | 28 | 7.240 Gbps | 23.6 ms | 109.2 ms | stable |
| 50% | 11.5% | 12,000 | 1,200 | 158,400 | 177.2 | 69.2% | 96.410 Gbps | 65.8% | 64 | 7.931 Gbps | 25.0 ms | 137.3 ms | stable |
| 100% | 23.0% | 24,000 | 2,400 | 316,800 | 197.6 | 77.2% | 139.418 Gbps | 67.9% | 124 | 9.083 Gbps | 28.2 ms | 219.4 ms | degraded |

Generated results are available in `outputs/agentic_resource_results.csv`. The user-count sensitivity sweep is available in `outputs/agentic_resource_sensitivity.csv`. The Qwen3 sizing sensitivity sweep is available in `outputs/agentic_qwen3_sizing_sensitivity.csv`.

Qwen3 production sizing at `100%` eligible intent with the optimized `15,040 tokens/s/replica` reference:

| Qwen3 invocation ratio | Qwen3 rps | Token demand | Required replicas | Required NPUs | Sized Qwen3 util | 8-NPU lab util |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5% | 1,200 | 158,400 tokens/s | 16 | 64 | 65.8% | 526.6% |
| 10% | 2,400 | 316,800 tokens/s | 31 | 124 | 67.9% | 1,053.2% |
| 20% | 4,800 | 633,600 tokens/s | 61 | 244 | 69.1% | 2,106.4% |
| 50% | 12,000 | 1,584,000 tokens/s | 151 | 604 | 69.7% | 5,266.0% |
| 100% | 24,000 | 3,168,000 tokens/s | 301 | 1,204 | 70.0% | 10,531.9% |

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

## Interpretation

The event-rate model shows that high concurrency is dominated by frequent service request, AN release, handover, and paging events. The `8 x 910B4` lab server is not large enough for the default `3.6M`-user production scenario if Qwen3 is used for `10%` of intent requests. It provides only two Qwen3 replicas at tensor parallel size `4`, while the production model needs `31` replicas, or `124` NPUs, at `100%` eligible-intent traffic.

The main conclusion is that total user/event load stresses deterministic CPU processing first, while increasing intent traffic increases CPU, memory traffic, bandwidth, and Qwen3 token demand. With production NPU sizing, the default `10%` Qwen3 invocation case requires `124` NPUs and remains CPU-degraded but not Qwen3-unstable: CPU utilization is `77.2%`, sized Qwen3 utilization is `67.9%`, and control-plane bandwidth is `9.083 Gbps`.

## Limitations

All numerical values are analytical assumptions. Actual results depend on model size, batching behavior, inference hardware, NF implementation, database access latency, message encoding, tool granularity, and operator policy logic. The results should be presented as theoretical capacity and sensitivity analysis. A future prototype should replace the synthetic service-time assumptions with measured CPU time, inference latency, memory traffic, message size, and queueing behavior.
