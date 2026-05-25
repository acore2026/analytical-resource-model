# 1. Analytical Resource Model for Agentic 6G Core Control-Plane Procedures

[中文版本](agentic_core_resource_model_zh.md)

This document defines an analytical resource model for the proposed agentic 6G core architecture. It estimates deterministic core-network processing, NW-Agent overhead, intent handling, tool invocation, inter-agent cooperation, and Qwen3-30B-A3B inference capacity under high-concurrency control-plane workloads.

Roaming, AF-originated intent, and SRF routing cost are excluded. The model is an analytical capacity model, not a deployment measurement.

## 1.1 Workload Model

Traffic is derived from user population and per-user event frequency. Let $N_{\mathrm{user}}$ be the number of registered users, and let $f_i$ be how many times one user triggers event $i$ per hour.

The per-event request rate is calculated by multiplying the user population by the per-user hourly event frequency, then converting from per hour to per second.

$$
\lambda_i = \frac{N_{\mathrm{user}} \cdot f_i}{3600}
$$

Where: $\lambda_i$ is the request rate of event $i$ in requests/s; $N_{\mathrm{user}}$ is the user count; $f_i$ is the per-user event frequency in events/user/hour; $3600$ converts one hour to seconds.

The total control-plane request rate is the sum of all modeled procedure rates.

$$
\lambda_{\mathrm{total}} = \sum_i \lambda_i
$$

Where: $\lambda_{\mathrm{total}}$ is the total request rate across all modeled procedures; $\sum_i$ means summing over every event type in the workload table; $\lambda_i$ is the request rate of each event type.

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

## 1.2 Resource Parameters

| Parameter | Value |
| --- | ---: |
| Host CPU platform | Kunpeng 920 |
| CPU cluster capacity | 256 CPU cores = 256,000 CPU-ms/s |
| RAM capacity | 256 GB |
| Inference runtime | vLLM Ascend 0.11.0 |
| Intent inference model | Qwen3-30B-A3B |
| Configured NPU cluster for Qwen3 serving | 128 NPUs |
| Qwen3 invocation ratio | 10% of intent requests |
| Qwen3 token profile | 128 input tokens + 4 output tokens = 132 tokens/request |
| Qwen3 token capacity | 15,040 tokens/s/replica |
| Qwen3 tensor parallel size | 4 NPUs/replica |
| Network capacity | 100 Gbps |
| Nonlinear overhead model | Smooth convex overhead curve |
| Non-intent agent CPU cost | 0.3 CPU-ms/request |
| Intent agent CPU cost | 2.0 CPU-ms/request |
| Non-intent agent latency | 1 ms/request |
| Intent fixed agent latency | 4 ms/request |
| Qwen3 service time for complex intent | 8 ms/request before queueing |
| Intent extra bandwidth | 12 KB/request |

$CPU\text{-}ms$ means one CPU core occupied for one millisecond. For example, $2\ CPU\text{-}ms/request$ at $100,000$ requests/s consumes $200$ CPU cores.

## 1.3 Qwen3 Capacity Reference

[GPUStack's Qwen3-30B-A3B on Ascend 910B benchmark](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/) reports `15,040.15 total tokens/s` for `128 input tokens` and `4 output tokens`. The [vLLM-Ascend documentation](https://docs.vllm.ai/projects/ascend/en/v0.18.0/) includes Qwen3-30B-A3B guidance; for 32 GB NPU cards, the model uses tensor parallel size $TP_Q=4$.

The intent request rate is the total request rate multiplied by the intent ratio.

$$
\lambda_I = \rho_I \cdot \lambda_{\mathrm{total}}
$$

Where: $\lambda_I$ is the intent-bearing request rate; $\rho_I$ is the intent ratio across all requests; $\lambda_{\mathrm{total}}$ is the total control-plane request rate.

Only a configured fraction of intent requests invoke Qwen3. That fraction is denoted by $r_Q$.

$$
\lambda_Q = \lambda_I \cdot r_Q
$$

Where: $\lambda_Q$ is the Qwen3 request rate; $\lambda_I$ is the intent-bearing request rate; $r_Q$ is the percentage of intent requests that invoke Qwen3.

The raw Qwen3 token demand equals the Qwen3 request rate multiplied by the input-plus-output token profile.

$$
T_Q = \lambda_Q \cdot \left(L_{\mathrm{in}} + L_{\mathrm{out}}\right)
$$

Where: $T_Q$ is the raw Qwen3 token demand in tokens/s; $\lambda_Q$ is the Qwen3 request rate; $L_{\mathrm{in}}$ is input tokens/request; $L_{\mathrm{out}}$ is output tokens/request.

The configured NPU cluster for Qwen3 serving has $N_Q=128$ NPUs. The number of available Qwen3 replicas and token capacity are:

The number of available Qwen3 serving replicas is limited by tensor parallelism, because one replica consumes $TP_Q$ NPUs.

$$
R_{Q,\mathrm{avail}} = \left\lfloor \frac{N_Q}{TP_Q} \right\rfloor
$$

Where: $R_{Q,\mathrm{avail}}$ is the number of available Qwen3 serving replicas; $N_Q$ is the configured NPU count; $TP_Q$ is the tensor parallel size in NPUs/replica; $\lfloor\cdot\rfloor$ means rounding down to a whole replica count.

The total Qwen3 token capacity is the number of available replicas multiplied by the per-replica token capacity $\mu_Q$.

$$
C_Q = R_{Q,\mathrm{avail}} \cdot \mu_Q
$$

Where: $C_Q$ is total Qwen3 serving capacity in tokens/s; $R_{Q,\mathrm{avail}}$ is the available replica count; $\mu_Q$ is the token capacity of one Qwen3 replica in tokens/s/replica.

## 1.4 Agentic Cost Model

For non-intent requests, incremental agentic CPU cost is $0.30\ CPU\text{-}ms/request$. For intent-bearing requests, CPU-side agent work is $2.00\ CPU\text{-}ms/request$, excluding Qwen3 inference.

In this context, "incremental" means additional CPU work introduced by the NW-Agent layer, beyond the deterministic CPU cost of the normal core-network procedure. The proposal states that NW-Agents handle requests with or without intent, and that legacy NAS messages without intent can still be routed to corresponding agents. Therefore, a non-intent request still has lightweight agent-side processing even though it does not require intent understanding, complex task planning, or Qwen3 inference.

For procedure type $i$, the non-intent CPU cost is modeled as:

$$
C_{\mathrm{nonintent,total},i} = C_{\mathrm{base},i} + C_{\mathrm{agent,nonintent}}
$$

Where: $C_{\mathrm{nonintent,total},i}$ is the total CPU cost of a non-intent request of type $i$; $C_{\mathrm{base},i}$ is the deterministic core-network CPU cost of the same procedure; $C_{\mathrm{agent,nonintent}}$ is the lightweight NW-Agent overhead.

The lightweight NW-Agent overhead covers request normalization, detection that no intent container is present, request-type classification, binding to the corresponding service agent or tool path, basic policy/context checks, deterministic procedure trigger preparation, and agent-side state/tracing updates. It does not include Qwen3/NPU inference, natural-language intent interpretation, complex task decomposition, or multi-agent collaboration.

For intent requests handled by lightweight agent logic without Qwen3, the modeled agent-side delay is the fixed intent-agent delay plus CPU-side agent work converted to milliseconds in the request path.

$$
D_{\mathrm{intent,light}} = 4\ \mathrm{ms} + 2\ \mathrm{ms}
$$

Where: $D_{\mathrm{intent,light}}$ is the latency contribution of lightweight intent handling; $4\ \mathrm{ms}$ is the fixed intent-agent delay; $2\ \mathrm{ms}$ is the CPU-side agent work on the request path.

For intent requests that invoke Qwen3, the base Qwen3 serving time is modeled as $8\ \mathrm{ms/request}$ before queueing. Queueing delay is added later by the latency model when NPU utilization increases.

$$
D_{Q,\mathrm{service}} = 8\ \mathrm{ms/request}
$$

Where: $D_{Q,\mathrm{service}}$ is the base Qwen3 inference service time per request before queueing; $8\ \mathrm{ms/request}$ is the analytical service-time assumption used for complex intent requests.

Intent-bearing requests add $12\ \mathrm{KB/request}$ of control-plane metadata for intent containers, task metadata, tool invocation wrappers, and inter-agent status/tracing metadata.

## 1.5 Convex Nonlinear Overhead Model

The model first calculates linear demand. The corresponding CPU, network, or Qwen3 serving load then passes through a smooth convex overhead function. This represents the reduction of effective serving efficiency under high concurrency.

Let $u$ be the raw linear utilization, and let $F(u)$ be the effective utilization after contention overhead:

$$
F(u)=u+\alpha u^2,\quad \alpha=0.15
$$

Where: $F(u)$ is the effective utilization after nonlinear overhead; $u$ is the raw linear utilization before overhead; $\alpha$ is the nonlinear overhead coefficient; $\alpha=0.15$ is the default moderate-overhead assumption.

The coefficient $\alpha=0.15$ is an analytical sensitivity parameter. It is not a deployment measurement and is not claimed as a universal value from literature. The references at the end of this document support the need for nonlinear overhead terms in high-concurrency LLM serving, especially from scheduling, batching, queueing, and KV/cache pressure. The exact value of $\alpha$ should be calibrated with measured CPU profiling, NPU serving throughput, and network telemetry after an implementation is available. The selected default represents a moderate overhead case for sensitivity analysis.

### 1.5.1 Why Nonlinear Overhead Appears

The nonlinear function represents the reduction of effective serving efficiency under high concurrency, not a change in the semantic workload of each request. Each additional unit of load also consumes capacity through contention, scheduling, memory movement, queueing, and runtime coordination.

| Resource area | Nonlinear factor | Effect represented in the model |
| --- | --- | --- |
| CPU | Scheduler overhead, lock contention, cache misses, memory access delay, serialization/deserialization, and state-store pressure. | Effective CPU-ms/request increases as CPU load grows. |
| NPU serving for Qwen3 | Batching inefficiency, request routing, replica scheduling, runtime coordination, cross-replica overhead, and KV/cache memory pressure. | Raw token demand is converted into effective token demand before calculating utilization of the configured NPU cluster. |
| Network | Queueing, buffering, congestion-control behavior, retransmission risk, and additional control-plane coordination. | Effective bandwidth and network delay increase as network load grows. |
| Latency | CPU queueing, NPU queueing, network queueing, and tail-latency amplification. | Mean, p95, and p99 latency rise faster as utilization approaches saturation. |

KV/cache memory pressure is important for Qwen3 serving. During high concurrency, active requests keep key-value cache entries, runtime buffers, and scheduling state resident for longer periods. This reduces the effective throughput available for new requests even when the raw token profile per request is unchanged. Therefore, the model does not claim that Qwen3 produces more semantic tokens per request; it uses effective token demand to represent serving-system overhead around the model.

The nonlinear assumption is an engineering model derived from these serving-system effects. The cited papers do not define the exact function $F(u)=u+\alpha u^2$ or the coefficient $\alpha=0.15$; they justify why a purely linear model can understate high-load overhead.

The following subsections show how the model applies the convex overhead function to CPU, Qwen3/NPU, network, and latency.

### 1.5.2 CPU Utilization

CPU utilization includes deterministic core-network procedure work and CPU-side agent work. The average linear CPU cost per request is calculated as the traffic-weighted deterministic core cost plus the agentic CPU cost. The intent share $s_I$ determines how much traffic uses intent-agent CPU work versus non-intent agent CPU work.

$$
C_{\mathrm{cpu,linear}} = \sum_i \frac{\lambda_i}{\lambda_{\mathrm{total}}} C_{\mathrm{base},i} + s_I C_{\mathrm{agent,intent}} + (1-s_I) C_{\mathrm{agent,nonintent}}
$$

Where: $C_{\mathrm{cpu,linear}}$ is average CPU cost per request before nonlinear overhead; $\lambda_i/\lambda_{\mathrm{total}}$ is the traffic share of event $i$; $C_{\mathrm{base},i}$ is the deterministic core-network CPU cost of event $i$; $s_I$ is the total intent share; $C_{\mathrm{agent,intent}}$ is intent-agent CPU cost; $C_{\mathrm{agent,nonintent}}$ is non-intent agent CPU cost.

The raw CPU utilization is then passed through the convex function $F(\cdot)$ to represent scheduling, contention, and memory-pressure overhead under high load.

$$
u_{\mathrm{cpu}} = F(u_{\mathrm{cpu,linear}})
$$

Where: $u_{\mathrm{cpu}}$ is effective CPU utilization after nonlinear overhead; $u_{\mathrm{cpu,linear}}$ is raw CPU utilization before overhead; $F(\cdot)$ is the convex overhead function.

The effective CPU demand is obtained by multiplying CPU capacity by the effective CPU utilization.

$$
D_{\mathrm{cpu}} = C_{\mathrm{cpu,capacity}} \cdot u_{\mathrm{cpu}}
$$

Where: $D_{\mathrm{cpu}}$ is effective CPU demand in CPU cores after nonlinear overhead; $C_{\mathrm{cpu,capacity}}$ is total CPU capacity in CPU cores; $u_{\mathrm{cpu}}$ is effective CPU utilization.

### 1.5.3 Qwen3/NPU Utilization

NPU utilization is driven by the subset of intent requests that invoke Qwen3. Those requests are converted into token demand and then compared with the configured Qwen3 serving capacity.

$$
u_{Q,\mathrm{linear}} = \frac{T_Q}{C_Q}
$$

Where: $u_{Q,\mathrm{linear}}$ is raw Qwen3/NPU utilization before nonlinear overhead; $T_Q$ is raw Qwen3 token demand; $C_Q$ is configured Qwen3 token capacity.

The raw NPU utilization is also passed through $F(\cdot)$ to represent batching inefficiency, runtime scheduling, and KV/cache memory pressure.

$$
u_Q = F(u_{Q,\mathrm{linear}})
$$

Where: $u_Q$ is effective Qwen3/NPU utilization after nonlinear overhead; $u_{Q,\mathrm{linear}}$ is raw Qwen3/NPU utilization; $F(\cdot)$ is the convex overhead function.

The effective Qwen3 token demand is the token demand that would produce the same effective NPU utilization after nonlinear overhead.

$$
T_{Q,\mathrm{eff}} = C_Q \cdot u_Q
$$

Where: $T_{Q,\mathrm{eff}}$ is effective Qwen3 token demand in tokens/s after nonlinear overhead; $C_Q$ is configured Qwen3 token capacity; $u_Q$ is effective Qwen3/NPU utilization.

### 1.5.4 Network Utilization

Network utilization includes baseline control-plane message traffic plus additional intent metadata, tool-invocation wrappers, and inter-agent coordination messages. The same nonlinear adjustment is applied to network utilization so that queueing, buffering, and coordination overhead are reflected in the effective bandwidth load.

$$
u_{\mathrm{net}} = F(u_{\mathrm{net,linear}})
$$

Where: $u_{\mathrm{net}}$ is effective network utilization after nonlinear overhead; $u_{\mathrm{net,linear}}$ is raw network utilization before overhead; $F(\cdot)$ is the convex overhead function.

### 1.5.5 Latency and Queueing

Queueing delay is represented by an M/M/1-style approximation. $S$ is the service time and $u$ is the effective utilization of the bottleneck resource. The delay grows quickly as $u$ approaches $1$, which is why latency becomes unstable near saturation.

$$
D_{\mathrm{queue}} = \frac{S \cdot u}{1-u}, \quad 0 \le u < 1
$$

Where: $D_{\mathrm{queue}}$ is queueing delay; $S$ is service time; $u$ is effective utilization of the bottleneck resource; $0 \le u < 1$ means the approximation is used only before the resource reaches full saturation.

## 1.6 Analytical Results

The table fixes the user population, event frequencies, and Qwen3 cluster size, then varies the percentage of all requests that carry intent in constant $10\%$ steps. The visible results use the convex nonlinear overhead model. The intent-sweep figure uses $1\%$ sampling for visual detail.

| Intent ratio | Total intent share | Intent rps | Qwen3 rps | Effective Qwen3 tokens/s | CPU cores | CPU util | Memory traffic | NPU util | Network bandwidth | Mean latency | p95 latency | Status |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 171.2 | 66.9% | 53.402 Gbps | 0.0% | 6.848 Gbps | 23.8 ms | 119.9 ms | stable |
| 10% | 10.0% | 10,430 | 1,043 | 143,584 | 192.4 | 75.2% | 90.783 Gbps | 29.8% | 7.871 Gbps | 26.6 ms | 187.8 ms | degraded |
| 20% | 20.0% | 20,860 | 2,086 | 298,982 | 213.9 | 83.6% | 128.164 Gbps | 62.1% | 8.897 Gbps | 32.1 ms | 320.8 ms | degraded |
| 30% | 30.0% | 31,290 | 3,129 | 466,196 | 235.9 | 92.1% | 165.545 Gbps | 96.9% | 9.927 Gbps | 48.7 ms | 487.0 ms | high_risk |
| 40% | 40.0% | 41,720 | 4,172 | 645,225 | 258.1 | 100.8% | 202.926 Gbps | 134.1% | 10.959 Gbps | unstable | unstable | unstable |
| 50% | 50.0% | 52,150 | 5,215 | 836,070 | 280.8 | 109.7% | 240.307 Gbps | 173.7% | 11.994 Gbps | unstable | unstable | unstable |
| 60% | 60.0% | 62,580 | 6,258 | 1,038,729 | 303.8 | 118.7% | 277.688 Gbps | 215.8% | 13.032 Gbps | unstable | unstable | unstable |
| 70% | 70.0% | 73,010 | 7,301 | 1,253,204 | 327.2 | 127.8% | 315.069 Gbps | 260.4% | 14.073 Gbps | unstable | unstable | unstable |
| 80% | 80.0% | 83,440 | 8,344 | 1,479,493 | 350.9 | 137.1% | 352.451 Gbps | 307.4% | 15.118 Gbps | unstable | unstable | unstable |
| 90% | 90.0% | 93,870 | 9,387 | 1,717,598 | 375.1 | 146.5% | 389.832 Gbps | 356.9% | 16.165 Gbps | unstable | unstable | unstable |
| 100% | 100.0% | 104,300 | 10,430 | 1,967,518 | 399.5 | 156.1% | 427.213 Gbps | 408.8% | 17.215 Gbps | unstable | unstable | unstable |

Generated results are available in `outputs/agentic_resource_results.csv`. The user-count sensitivity sweep is available in `outputs/agentic_resource_sensitivity.csv`. The Qwen3 sensitivity sweep is available in `outputs/agentic_qwen3_sizing_sensitivity.csv`.

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

The following user-count sensitivity figure fixes the intent ratio at $20\%$ and varies the user population from $0.5$ million to $4.0$ million users.

![](outputs/agentic_user_count_sensitivity.png)

## 1.7 Interpretation

With $128$ configured NPUs assigned to Qwen3 serving and $10\%$ Qwen3 invocation ratio, NPU utilization is $29.8\%$ at $10\%$ intent ratio, $62.1\%$ at $20\%$ intent ratio, and $96.9\%$ at $30\%$ intent ratio. At $40\%$ intent ratio, NPU utilization exceeds $100\%$, so the fixed NPU cluster is overloaded. Higher intent ratios require more NPU capacity, lower Qwen3 invocation ratio, shorter token profiles, faster serving, or admission control.

## 1.8 Model Boundary

The numerical values are analytical input parameters for capacity and sensitivity analysis. Actual deployment results depend on model size, batching behavior, inference hardware, NF implementation, database access latency, message encoding, tool granularity, and operator policy logic. Measured deployment data can be used to calibrate CPU time, inference latency, memory traffic, message size, and queueing behavior.

## 1.9 References

1. [Sarathi-Serve: Tackling User-Generated Request Variability in LLM Inference Serving](https://arxiv.org/abs/2403.02310), also published at OSDI 2024 ([PDF](https://www.usenix.org/system/files/osdi24-agrawal.pdf)).
   This paper does not define our convex function or $\alpha=0.15$. Its useful evidence is that LLM serving performance depends on request scheduling and batching across prefill and decode phases. It reports that tail latency rises as request rate increases, which supports modeling high-load serving overhead as nonlinear instead of purely linear.

2. [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180).
   This paper explains why KV-cache memory management is central to LLM serving. KV cache is large and dynamic; inefficient memory management reduces batching efficiency and serving throughput. This supports the model term that converts raw Qwen3 token demand into effective token demand under KV/cache pressure.

3. [Online Scheduling for LLM Inference with KV Cache Constraints](https://www.microsoft.com/en-us/research/publication/online-scheduling-for-llm-inference-with-kv-cache-constraints/) and [arXiv:2502.07115](https://arxiv.org/abs/2502.07115).
   This work treats KV-cache capacity as a scheduling constraint for LLM inference. It supports the view that utilization, latency, and memory pressure are coupled under concurrency, so NPU serving demand should not be modeled only as raw tokens divided by peak token capacity.

4. [GPUStack Qwen3-30B-A3B on Ascend 910B benchmark](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/).
   This benchmark provides the reference token capacity used in the model: `15,040.15 total tokens/s` for Qwen3-30B-A3B with `128 input tokens` and `4 output tokens`.

5. [vLLM Ascend documentation](https://docs.vllm.ai/projects/ascend/en/v0.18.0/).
   This documentation provides implementation context for serving Qwen3-family models on Ascend through vLLM Ascend. It supports the tensor-parallel serving assumptions used for the configured NPU cluster.
