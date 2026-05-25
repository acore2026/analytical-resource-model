# Analytical Resource Model for Agentic 6G Core Control-Plane Procedures

[中文版本](agentic_core_resource_model_zh.md)

This document defines an analytical resource model for the proposed agentic 6G core architecture. It estimates deterministic core-network processing, NW-Agent overhead, intent handling, tool invocation, inter-agent cooperation, and Qwen3-30B-A3B inference capacity under high-concurrency control-plane workloads.

Roaming, AF-originated intent, and SRF routing cost are excluded. The model is an analytical capacity model, not a deployment measurement.

## Workload Model

Traffic is derived from user population and per-user event frequency. Let $N_{\mathrm{user}}$ be the number of registered users, and let $f_i$ be how many times one user triggers event $i$ per hour.

$$
\lambda_i = \frac{N_{\mathrm{user}} \cdot f_i}{3600}
$$

$$
\lambda_{\mathrm{total}} = \sum_i \lambda_i
$$

The baseline uses $N_{\mathrm{user}}=3.6\times10^6$ users and $2$ PDU sessions/user. The baseline total is $104,300$ requests/s. Any request type may carry intent, so the intent ratio $\rho_I$ is applied to the full request stream.

| Event | Default per user per hour | Derived request rate | Base latency | Base CPU | Base bandwidth |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial registration | 0.1 events/user/hour | 100 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request |
| Periodic registration | 0.1 events/user/hour | 100 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request |
| Mobility registration | 7.0 events/user/hour | 7,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request |
| Initial PDU session establishment | 1.0 events/user/hour | 1,000 requests/s | 40 ms | 2.5 CPU-ms/request | 16 KB/request |
| PDU session release | 1.0 events/user/hour | 1,000 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request |
| PDU session modification | 2.0 events/user/hour | 2,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request |
| Service request | 21.0 events/user/hour | 21,000 requests/s | 20 ms | 1.2 CPU-ms/request | 8 KB/request |
| AN release | 35.0 events/user/hour | 35,000 requests/s | 15 ms | 0.8 CPU-ms/request | 6 KB/request |
| Handover | 23.1 events/user/hour | 23,100 requests/s | 25 ms | 1.8 CPU-ms/request | 12 KB/request |
| Paging | 14.0 events/user/hour | 14,000 requests/s | 12 ms | 0.6 CPU-ms/request | 4 KB/request |

## Resource Parameters

| Parameter | Value |
| --- | ---: |
| Host CPU platform | Kunpeng 920 |
| CPU cluster capacity | 256 CPU cores = 256,000 CPU-ms/s |
| RAM capacity | 256 GB |
| Inference runtime | vLLM Ascend 0.11.0 |
| Intent inference model | Qwen3-30B-A3B |
| Production NPU sizing target | 70% Qwen3 token utilization |
| Qwen3 invocation ratio | 10% of intent requests |
| Qwen3 token profile | 128 input tokens + 4 output tokens = 132 tokens/request |
| Qwen3 token capacity | 15,040 tokens/s/replica |
| Qwen3 tensor parallel size | 4 NPUs/replica |
| Network capacity | 100 Gbps |
| Nonlinear contention knee | 60% utilization |
| Nonlinear contention overhead | 60% maximum overhead at full load |
| Nonlinear curve power | 2.0 |
| Non-intent agent CPU cost | 0.3 CPU-ms/request |
| Intent agent CPU cost | 2.0 CPU-ms/request |
| Non-intent agent latency | 1 ms/request |
| Intent fixed agent latency | 4 ms/request |
| Qwen3 service time for complex intent | 8 ms/request before queueing |
| Intent extra bandwidth | 12 KB/request |

$CPU\text{-}ms$ means one CPU core occupied for one millisecond. For example, $2\ CPU\text{-}ms/request$ at $100,000$ requests/s consumes $200$ CPU cores.

## Qwen3 Capacity Reference

[GPUStack's Qwen3-30B-A3B on Ascend 910B benchmark](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/) reports `15,040.15 total tokens/s` for `128 input tokens` and `4 output tokens`. The [vLLM-Ascend documentation](https://docs.vllm.ai/projects/ascend/en/v0.18.0/) includes Qwen3-30B-A3B guidance; for 32 GB NPU cards, the model uses tensor parallel size $TP_Q=4$.

$$
\lambda_I = \rho_I \cdot \lambda_{\mathrm{total}}
$$

$$
\lambda_Q = \lambda_I \cdot r_Q
$$

$$
T_Q = \lambda_Q \cdot \left(L_{\mathrm{in}} + L_{\mathrm{out}}\right)
$$

## Agentic Cost Model

For non-intent requests, incremental agentic CPU cost is $0.30\ CPU\text{-}ms/request$. For intent-bearing requests, CPU-side agent work is $2.00\ CPU\text{-}ms/request$, excluding Qwen3 inference.

$$
D_{\mathrm{intent,light}} = 4\ \mathrm{ms} + 2\ \mathrm{ms}
$$

$$
D_{Q,\mathrm{service}} = 8\ \mathrm{ms/request}
$$

Intent-bearing requests add $12\ \mathrm{KB/request}$ of control-plane metadata for intent containers, task metadata, tool invocation wrappers, and inter-agent status/tracing metadata.

## Nonlinear Saturation Model

The model uses a nonlinear contention multiplier by default. Linear demand is calculated first, then a saturation multiplier is applied after the utilization knee.

$$
F(u) = 1 + \alpha \cdot \left(\frac{\max(0, \min(u,1)-u_{\mathrm{knee}})}{1-u_{\mathrm{knee}}}\right)^p
$$

$$
u_{\mathrm{knee}} = 0.60, \quad \alpha = 0.60, \quad p = 2.0
$$

$$
C_{\mathrm{cpu,linear}} = \sum_i \frac{\lambda_i}{\lambda_{\mathrm{total}}} C_{\mathrm{base},i} + s_I C_{\mathrm{agent,intent}} + (1-s_I) C_{\mathrm{agent,nonintent}}
$$

$$
D_{\mathrm{cpu}} = \frac{\lambda_{\mathrm{total}} C_{\mathrm{cpu,linear}} F(u_{\mathrm{cpu,linear}})}{1000}
$$

$$
B_{\mathrm{net}} = \frac{\lambda_{\mathrm{total}} B_{\mathrm{req,linear}} \cdot 8}{1,000,000} \cdot F(u_{\mathrm{net,linear}})
$$

$$
T_{Q,\mathrm{eff}} = T_Q \cdot F(u_{Q,\mathrm{linear}})
$$

$$
R_Q = \left\lceil \frac{T_{Q,\mathrm{eff}}}{\mu_Q \cdot u_{\mathrm{target}}} \right\rceil
$$

$$
N_Q = R_Q \cdot TP_Q
$$

Queueing delay is represented by:

$$
D_{\mathrm{queue}} = \frac{S \cdot u}{1-u}, \quad 0 \le u < 1
$$

## Analytical Results

The table fixes the user population and event frequencies, then varies the percentage of all requests that carry intent. The visible results use the nonlinear saturation model.

| Intent ratio | Total intent share | Intent rps | Qwen3 rps | Effective Qwen3 tokens/s | CPU cores | CPU util | Memory traffic | Sized Qwen3 util | Required production NPUs | Network bandwidth | Mean latency | p95 latency | Status |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 156.9 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.3 ms | stable |
| 1% | 1.0% | 1,043 | 104 | 13,768 | 158.8 | 62.0% | 57.140 Gbps | 45.8% | 8 | 6.879 Gbps | 23.0 ms | 98.3 ms | stable |
| 5% | 5.0% | 5,215 | 522 | 69,587 | 167.1 | 65.3% | 72.092 Gbps | 66.1% | 28 | 7.280 Gbps | 23.8 ms | 116.5 ms | stable |
| 10% | 10.0% | 10,430 | 1,043 | 139,173 | 178.9 | 69.9% | 90.783 Gbps | 66.1% | 56 | 7.780 Gbps | 25.0 ms | 141.3 ms | stable |
| 20% | 20.0% | 20,860 | 2,086 | 281,646 | 208.7 | 81.5% | 128.164 Gbps | 69.4% | 108 | 8.782 Gbps | 30.5 ms | 299.8 ms | degraded |
| 50% | 50.0% | 52,150 | 5,215 | 710,940 | 364.0 | 142.2% | 240.307 Gbps | 69.5% | 272 | 11.786 Gbps | unstable | unstable | unstable |
| 100% | 100.0% | 104,300 | 10,430 | 1,427,134 | 534.6 | 208.8% | 427.213 Gbps | 69.8% | 544 | 16.792 Gbps | unstable | unstable | unstable |

Generated results are available in `outputs/agentic_resource_results.csv`. The user-count sensitivity sweep is available in `outputs/agentic_resource_sensitivity.csv`. The Qwen3 sizing sensitivity sweep is available in `outputs/agentic_qwen3_sizing_sensitivity.csv`.

Qwen3 production sizing at $100\%$ intent ratio with the optimized $15,040\ \mathrm{tokens/s/replica}$ reference:

| Qwen3 invocation ratio | Qwen3 rps | Effective token demand | Required replicas | Required NPUs | Sized Qwen3 util |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 5% | 5,215 | 710,940 tokens/s | 68 | 272 | 69.5% |
| 10% | 10,430 | 1,427,134 tokens/s | 136 | 544 | 69.8% |
| 20% | 20,860 | 2,854,268 tokens/s | 272 | 1,088 | 69.8% |
| 50% | 52,150 | 7,141,149 tokens/s | 679 | 2,716 | 69.9% |
| 100% | 104,300 | 14,282,299 tokens/s | 1,357 | 5,428 | 70.0% |

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

The following user-count sensitivity figure fixes the intent ratio at $20\%$ and varies the user population.

![](outputs/agentic_user_count_sensitivity.png)

## Interpretation

With the nonlinear saturation model and $10\%$ Qwen3 invocation ratio, $100\%$ intent traffic requires $136$ Qwen3 replicas, or $544$ NPUs. The full-load scenario is CPU-unstable unless more CPU capacity, lower intent ratio, faster CPU-side processing, or admission control is added.

## Model Boundary

The numerical values are analytical input parameters for capacity and sensitivity analysis. Actual deployment results depend on model size, batching behavior, inference hardware, NF implementation, database access latency, message encoding, tool granularity, and operator policy logic. Measured deployment data can be used to calibrate CPU time, inference latency, memory traffic, message size, and queueing behavior.
