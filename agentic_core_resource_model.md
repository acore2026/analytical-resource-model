# Analytical Resource Model for Agentic 6G Core Control-Plane Procedures

This section provides a model-based resource analysis for the proposed agentic 6G core architecture. The objective is not to report measured deployment data, but to estimate whether the additional cost introduced by NW-Agent reasoning, tool invocation, and agent cooperation can be bounded under high-concurrency control-plane workloads.

The model compares a traditional deterministic core-network procedure path with an agentic path. The agentic path keeps the deterministic NF execution model for network state changes, while adding NW-Agent decision logic, cached tool metadata lookup, tool invocation wrappers, and, for intent-bearing requests, accelerator-backed AI inference.

## Scope and Assumptions

The modeled UE-originated procedures are registration, PDU session establishment, and service request. Roaming and AF-originated intent are excluded. SRF routing cost is also excluded. The total offered load is fixed, and the experiment varies the proportion of intent-bearing messages among intent-eligible procedures.

Registration is treated as non-intent in the baseline. PDU session establishment and service request are intent-eligible. Therefore, an intent setting of 100% means all intent-eligible requests carry intent, not that every control-plane request carries intent. With the adopted procedure mix, the maximum total intent-bearing share is 80%.

Baseline workload:

| Parameter | Value |
| --- | ---: |
| Total request rate | 10,000 requests/s |
| Procedure mix | 20% registration, 30% PDU session establishment, 50% service request |
| Intent setting sweep | 0%, 1%, 5%, 10%, 20%, 50%, 100% of intent-eligible requests |
| CPU cluster capacity | 64 cores = 64,000 CPU-ms/s |
| RAM capacity | 256 GB |
| Accelerator capacity | 2,000 intent inferences/s |
| Accelerator VRAM capacity | 24 GB |
| Network capacity | 100 Gbps |

Per-procedure deterministic baseline:

| Procedure | Base latency | CPU cost | Control-plane bandwidth | Intent-eligible |
| --- | ---: | ---: | ---: | --- |
| Registration | 30 ms | 2.0 CPU-ms | 12 KB | No |
| PDU session establishment | 40 ms | 2.5 CPU-ms | 16 KB | Yes |
| Service request | 20 ms | 1.2 CPU-ms | 8 KB | Yes |

Agentic overhead assumptions:

| Component | Non-intent request | Intent request |
| --- | ---: | ---: |
| Agent CPU cost | 0.3 CPU-ms | 2.0 CPU-ms |
| Agent latency before queueing | 1 ms | 4 ms fixed + 2 ms CPU + 8 ms AI inference |
| Memory traffic | 64 KB/request | 512 KB/request |
| Additional control-plane bandwidth | 0 KB/request | 12 KB/request |
| Accelerator active memory | 0 | 4 MB/active intent request |
| Fixed model memory | 0 | 16 GB VRAM when intent inference is enabled |

## Model

Let `lambda` be the total request rate and let `rho_I` be the intent ratio among intent-eligible procedures. Let `m_i` be the procedure mix for procedure `i`, and let `e_i` be 1 if the procedure is intent-eligible and 0 otherwise.

The actual total intent-bearing share is:

```text
s_I = rho_I * sum_i(m_i * e_i)
```

The intent arrival rate is:

```text
lambda_I = lambda * s_I
```

The average CPU cost per request is:

```text
C_cpu = sum_i(m_i * C_base,i) + s_I * C_agent,intent + (1 - s_I) * C_agent,nonintent
```

The CPU core demand is:

```text
U_cpu_cores = lambda * C_cpu / 1000
```

and CPU utilization is:

```text
u_cpu = U_cpu_cores / N_cpu
```

The average control-plane bandwidth per request is:

```text
B_req = sum_i(m_i * B_base,i) + s_I * B_agent,intent
```

Network bandwidth is:

```text
B_net = lambda * B_req * 8 / 1,000,000
```

where `B_req` is in KB/request and `B_net` is in Gbps.

Accelerator utilization is modeled as:

```text
u_gpu = lambda_I / mu_gpu
```

where `mu_gpu` is the intent inference service capacity of one accelerator. If `u_gpu >= 1`, the inference queue is unstable. The number of accelerators required to keep utilization below 70% is:

```text
N_gpu,70 = ceil(lambda_I / (0.7 * mu_gpu))
```

Queueing delay is approximated with a simple M/M/1-inspired sensitivity term for each resource:

```text
D_queue = S * u / (1 - u), for u < 1
```

This is used as an analytical approximation, not as an exact telecom simulator. End-to-end latency is calculated as deterministic procedure latency plus agentic fixed latency plus the dominant queueing effects from CPU, accelerator, and network resources. Mean, p95, and p99 latency are reported. When any critical utilization is above 100%, latency is marked unstable.

## Analytical Results

At a fixed offered load of 10,000 requests/s, increasing the share of intent-bearing requests mainly increases accelerator utilization and accelerator queueing delay. CPU demand also increases, but remains below 64-core capacity in this baseline. Control-plane network bandwidth remains well below 100 Gbps.

| Eligible intent ratio | Total intent share | Intent rps | CPU cores | RAM | Memory traffic | GPU util | Required GPUs at <=70% | Network bandwidth | Mean latency | p95 latency | Status |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 20.5 | 32.0 GB | 5.120 Gbps | 0.0% | 0 | 0.896 Gbps | 30.0 ms | 58.2 ms | stable |
| 1% | 0.8% | 80 | 20.6 | 32.0 GB | 5.407 Gbps | 4.0% | 1 | 0.904 Gbps | 30.1 ms | 58.7 ms | stable |
| 5% | 4.0% | 400 | 21.2 | 32.0 GB | 6.554 Gbps | 20.0% | 1 | 0.934 Gbps | 30.6 ms | 60.8 ms | stable |
| 10% | 8.0% | 800 | 21.9 | 32.0 GB | 7.987 Gbps | 40.0% | 1 | 0.973 Gbps | 31.2 ms | 72.8 ms | stable |
| 20% | 16.0% | 1,600 | 23.2 | 32.0 GB | 10.854 Gbps | 80.0% | 2 | 1.050 Gbps | 32.7 ms | 294.5 ms | degraded |
| 50% | 40.0% | 4,000 | 27.3 | 32.0 GB | 19.456 Gbps | 200.0% | 3 | 1.280 Gbps | unstable | unstable | unstable |
| 100% | 80.0% | 8,000 | 34.1 | 32.0 GB | 33.792 Gbps | 400.0% | 6 | 1.664 Gbps | unstable | unstable | unstable |

The generated main-case raw results are available in `outputs/agentic_resource_results.csv`. The sensitivity sweep across 1,000, 10,000, 50,000, and 100,000 requests/s is available in `outputs/agentic_resource_sensitivity.csv`. The generated plots are:

- `outputs/agentic_resource_utilization.png`
- `outputs/agentic_latency.png`

## Interpretation

The analysis indicates that the agentic control-plane overhead is bounded when most traffic follows the non-intent path and intent inference is applied selectively. At 10,000 requests/s, the CPU cluster remains below 54% utilization even when all intent-eligible requests carry intent. RAM and control-plane bandwidth are also not limiting in the baseline.

The limiting factor is accelerator-backed inference. With one accelerator capable of 2,000 intent inferences/s, the system remains stable up to 10% eligible-intent traffic and enters a degraded region at 20%. Beyond that, the inference queue is unstable unless the operator adds accelerators, reduces model cost, applies stronger batching, caches repeated decisions, or routes simple intents to lightweight CPU-side classifiers.

The sensitivity CSV shows that at 1,000 requests/s the baseline cluster remains stable across the full intent sweep. At 50,000 and 100,000 requests/s, the 64-core CPU baseline is already insufficient even without intent traffic, so those loads require horizontal scaling of deterministic control-plane capacity before agentic inference capacity becomes meaningful. This distinction is important: intent ratio primarily stresses the accelerator, while total request rate stresses CPU-side deterministic processing first.

This supports the paper claim that agentic handling is feasible under high concurrency when the architecture uses:

- cached ARF/TRF metadata rather than per-request repository discovery;
- a lightweight non-intent path through the Connection Agent;
- accelerator-backed inference only for intent-bearing requests;
- admission control or elastic scaling when intent traffic increases;
- model-size and batching policies that keep accelerator utilization below the target threshold.

## Limitations

The numerical values are analytical assumptions, not measurements from a deployed 6G core. Actual results depend on model size, batching behavior, tool granularity, NF implementation, database access latency, accelerator type, and operator policy logic. The model should therefore be presented as a theoretical capacity analysis and sensitivity study. A future prototype should replace the synthetic service-time assumptions with measured per-component CPU time, inference latency, memory traffic, and message sizes.
