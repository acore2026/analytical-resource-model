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
| CPU cluster capacity | 256 CPU cores = 256,000 CPU-ms/s |
| RAM capacity | 256 GB |
| GPU count | 20 GPUs |
| GPU capacity | 2,000 intent inferences/s/GPU |
| Total GPU inference capacity | 40,000 intent inferences/s |
| VRAM capacity | 24 GB/GPU, 480 GB total |
| Network capacity | 100 Gbps |
| Non-intent agent CPU cost | 0.3 CPU-ms/request |
| Intent agent CPU cost | 2.0 CPU-ms/request |
| Non-intent agent latency | 1 ms/request |
| Intent fixed agent latency | 4 ms/request |
| Intent GPU inference service time | 8 ms/request |
| Non-intent memory traffic | 64 KB/request |
| Intent memory traffic | 512 KB/request |
| Intent extra bandwidth | 12 KB/request |
| Fixed inference model memory | 16 GB VRAM per active GPU |
| Active intent VRAM | 4 MB/active intent request |

`CPU-ms` means one CPU core occupied for one millisecond. For example, `2 CPU-ms/request` at `100,000 requests/s` consumes `200 CPU cores`.

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

GPU utilization is:

```text
u_gpu [unitless] = lambda_I / (N_gpu * mu_gpu)
N_gpu,70 [GPUs] = ceil(lambda_I / (0.7 * mu_gpu))
```

Queueing delay uses a simple M/M/1-inspired sensitivity term:

```text
D_queue [ms] = S [ms] * u / (1 - u), for u < 1
```

This is an analytical approximation, not a telecom simulator. Mean, p95, and p99 latency are calculated from deterministic procedure latency, fixed agent latency, CPU queueing, GPU inference queueing, and network queueing. A resource is unstable when utilization is at or above 100%.

## Analytical Results

The table below fixes the user population and event frequencies, then varies only the percentage of intent among intent-eligible events.

| Eligible intent ratio | Total intent share | Intent rps | CPU cores | CPU util | Memory traffic | GPU util | GPUs for <=70% | Network bandwidth | Mean latency | p95 latency | Status |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 156.8 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.1 ms | stable |
| 1% | 0.2% | 240 | 157.2 | 61.4% | 54.262 Gbps | 0.6% | 1 | 6.802 Gbps | 22.9 ms | 95.8 ms | stable |
| 5% | 1.2% | 1,200 | 158.9 | 62.1% | 57.702 Gbps | 3.0% | 1 | 6.894 Gbps | 23.1 ms | 98.7 ms | stable |
| 10% | 2.3% | 2,400 | 160.9 | 62.9% | 62.003 Gbps | 6.0% | 2 | 7.010 Gbps | 23.4 ms | 102.5 ms | stable |
| 20% | 4.6% | 4,800 | 165.0 | 64.4% | 70.605 Gbps | 12.0% | 4 | 7.240 Gbps | 23.9 ms | 110.8 ms | stable |
| 50% | 11.5% | 12,000 | 177.2 | 69.2% | 96.410 Gbps | 30.0% | 9 | 7.931 Gbps | 25.8 ms | 141.9 ms | stable |
| 100% | 23.0% | 24,000 | 197.6 | 77.2% | 139.418 Gbps | 60.0% | 18 | 9.083 Gbps | 29.9 ms | 232.3 ms | degraded |

Generated results are available in `outputs/agentic_resource_results.csv`. The user-count sensitivity sweep is available in `outputs/agentic_resource_sensitivity.csv`.

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

## Interpretation

The event-rate model shows that high concurrency is dominated by frequent service request, AN release, handover, and paging events. With the provisioned 256-core CPU cluster and 20-GPU inference pool, the system remains stable across the full intent sweep. At `100%` eligible-intent traffic, the model becomes CPU-degraded but not unstable: CPU utilization is `77.2%`, GPU utilization is `60.0%`, and control-plane bandwidth is `9.083 Gbps`.

The main conclusion is that total user/event load stresses deterministic CPU processing first, while increasing the intent ratio primarily increases GPU utilization, VRAM use, memory traffic, and tail latency. The architecture remains feasible when intent inference is applied selectively, metadata lookup is cached, non-intent paths stay lightweight, and GPU capacity scales with the eligible intent arrival rate.

## Limitations

All numerical values are analytical assumptions. Actual results depend on model size, batching behavior, inference hardware, NF implementation, database access latency, message encoding, tool granularity, and operator policy logic. The results should be presented as theoretical capacity and sensitivity analysis. A future prototype should replace the synthetic service-time assumptions with measured CPU time, inference latency, memory traffic, message size, and queueing behavior.
