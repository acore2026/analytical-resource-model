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


| Event                             | Default per user per hour | Derived request rate |           Base CPU | Base bandwidth |
| --------------------------------- | ------------------------: | -------------------: | -----------------: | -------------: |
| Initial registration              |      0.1 events/user/hour |       100 requests/s | 2.0 CPU-ms/request |  12 KB/request |
| Periodic registration             |      0.1 events/user/hour |       100 requests/s | 1.5 CPU-ms/request |  10 KB/request |
| Mobility registration             |      7.0 events/user/hour |     7,000 requests/s | 2.0 CPU-ms/request |  12 KB/request |
| Initial PDU session establishment |      1.0 events/user/hour |     1,000 requests/s | 2.5 CPU-ms/request |  16 KB/request |
| PDU session release               |      1.0 events/user/hour |     1,000 requests/s | 1.5 CPU-ms/request |  10 KB/request |
| PDU session modification          |      2.0 events/user/hour |     2,000 requests/s | 2.0 CPU-ms/request |  12 KB/request |
| Service request                   |     21.0 events/user/hour |    21,000 requests/s | 1.2 CPU-ms/request |   8 KB/request |
| AN release                        |     35.0 events/user/hour |    35,000 requests/s | 0.8 CPU-ms/request |   6 KB/request |
| Handover                          |     23.1 events/user/hour |    23,100 requests/s | 1.8 CPU-ms/request |  12 KB/request |
| Paging                            |     14.0 events/user/hour |    14,000 requests/s | 0.6 CPU-ms/request |   4 KB/request |

## 1.2 Resource Parameters


| Parameter                                |                                                   Value |
| ---------------------------------------- | ------------------------------------------------------: |
| Host CPU platform                        |                                             Kunpeng 920 |
| CPU cluster capacity                     |                        256 CPU cores = 256,000 CPU-ms/s |
| RAM capacity                             |                                                  256 GB |
| Inference runtime                        |                                      vLLM Ascend 0.11.0 |
| Intent inference model                   |                                           Qwen3-30B-A3B |
| Configured NPU cluster for Qwen3 serving |                                                128 NPUs |
| Qwen3 invocation ratio                   |                                  10% of intent requests |
| Qwen3 token profile                      | 128 input tokens + 4 output tokens = 132 tokens/request |
| Qwen3 token capacity                     |                                 15,040 tokens/s/replica |
| Qwen3 tensor parallel size               |                                          4 NPUs/replica |
| Network capacity                         |                                                100 Gbps |
| Nonlinear overhead model                 |          USL-inspired contention and coordination curve |
| Non-intent agent CPU cost                |                                      0.3 CPU-ms/request |
| Intent agent CPU cost                    |                                      2.0 CPU-ms/request |
| Intent extra bandwidth                   |                                           12 KB/request |

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

Intent-bearing requests add $12\ \mathrm{KB/request}$ of control-plane metadata for intent containers, task metadata, tool invocation wrappers, and inter-agent status/tracing metadata.

## 1.5 USL-Inspired Nonlinear Overhead Model

The model first calculates linear demand. The corresponding CPU, network, or Qwen3 serving load then passes through a nonlinear overhead function inspired by the Universal Scalability Law (USL). USL is a standard computer-systems scalability model that separates two effects: resource contention and coordination/coherency overhead. Those two effects match this architecture because agentic control-plane processing can introduce shared state access, scheduling, tool-wrapper coordination, and multi-replica inference serving overhead.

The classical USL throughput form is:

$$
C(N)=\frac{N}{1+\alpha(N-1)+\beta N(N-1)}
$$

Where: $C(N)$ is relative system throughput with $N$ parallel workers; $\alpha$ represents contention; $\beta$ represents coherency or coordination cost.

This paper uses a normalized demand-side form of the same idea:

$$
M_{\mathrm{USL}}(u)=1+\sigma u+\kappa u^2
$$

$$
F_{\mathrm{USL}}(u)=u \cdot M_{\mathrm{USL}}(u)
$$

Where: $u$ is the raw linear utilization before nonlinear overhead; $M_{\mathrm{USL}}(u)$ is the overhead multiplier; $F_{\mathrm{USL}}(u)$ is the effective utilization after nonlinear overhead; $\sigma$ is the contention coefficient; $\kappa$ is the coordination/coherency coefficient.

The default coefficients are:

$$
\sigma=0.05,\quad \kappa=0.10
$$

These coefficients are analytical sensitivity parameters, not deployment measurements. At $u=1.0$, the multiplier is $1.15$, meaning a fully loaded linear model is treated as $15\%$ higher effective demand after contention and coordination overhead. The values should be calibrated with measured CPU profiling, NPU serving throughput, and network telemetry after an implementation is available.

### 1.5.1 Why Nonlinear Overhead Appears

The nonlinear function represents the reduction of effective serving efficiency under high concurrency, not a change in the semantic workload of each request. Each additional unit of load also consumes capacity through contention, scheduling, memory movement, runtime coordination, and coherency effects.


| Resource area         | Nonlinear factor                                                                                                                        | Effect represented in the model                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CPU                   | Scheduler overhead, lock contention, cache misses, memory access delay, serialization/deserialization, and state-store pressure.        | Effective CPU-ms/request increases as CPU load grows.                                                                   |
| NPU serving for Qwen3 | Batching inefficiency, request routing, replica scheduling, runtime coordination, cross-replica overhead, and KV/cache memory pressure. | Raw token demand is converted into effective token demand before calculating utilization of the configured NPU cluster. |
| Network               | Buffering, congestion-control behavior, retransmission risk, and additional control-plane coordination.                                 | Effective bandwidth load increases as network utilization grows.                                                        |

KV/cache memory pressure is important for Qwen3 serving. During high concurrency, active requests keep key-value cache entries, runtime buffers, and scheduling state resident for longer periods. This reduces the effective throughput available for new requests even when the raw token profile per request is unchanged. Therefore, the model does not claim that Qwen3 produces more semantic tokens per request; it uses effective token demand to represent serving-system overhead around the model.

The nonlinear assumption is an analytical model derived from these serving-system effects. USL provides the general contention-plus-coordination structure. The LLM-serving references support applying such an overhead term to Qwen3/NPU serving because batching, scheduling, and KV/cache memory pressure reduce effective serving efficiency under concurrency.

The following subsections show how the model applies $F_{\mathrm{USL}}(\cdot)$ to CPU, Qwen3/NPU, and network utilization.

### 1.5.2 CPU Utilization

CPU utilization includes deterministic core-network procedure work and CPU-side agent work. The average linear CPU cost per request is calculated as the traffic-weighted deterministic core cost plus the agentic CPU cost. The intent share $s_I$ determines how much traffic uses intent-agent CPU work versus non-intent agent CPU work.

$$
C_{\mathrm{cpu,linear}} = \sum_i \frac{\lambda_i}{\lambda_{\mathrm{total}}} C_{\mathrm{base},i} + s_I C_{\mathrm{agent,intent}} + (1-s_I) C_{\mathrm{agent,nonintent}}
$$

Where: $C_{\mathrm{cpu,linear}}$ is average CPU cost per request before nonlinear overhead; $\lambda_i/\lambda_{\mathrm{total}}$ is the traffic share of event $i$; $C_{\mathrm{base},i}$ is the deterministic core-network CPU cost of event $i$; $s_I$ is the total intent share; $C_{\mathrm{agent,intent}}$ is intent-agent CPU cost; $C_{\mathrm{agent,nonintent}}$ is non-intent agent CPU cost.

The raw CPU utilization is then passed through $F_{\mathrm{USL}}(\cdot)$ to represent scheduling, contention, and memory-pressure overhead under high load.

$$
u_{\mathrm{cpu}} = F_{\mathrm{USL}}(u_{\mathrm{cpu,linear}})
$$

Where: $u_{\mathrm{cpu}}$ is effective CPU utilization after nonlinear overhead; $u_{\mathrm{cpu,linear}}$ is raw CPU utilization before overhead; $F_{\mathrm{USL}}(\cdot)$ is the USL-inspired overhead function.

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

The raw NPU utilization is also passed through $F_{\mathrm{USL}}(\cdot)$ to represent batching inefficiency, runtime scheduling, and KV/cache memory pressure.

$$
u_Q = F_{\mathrm{USL}}(u_{Q,\mathrm{linear}})
$$

Where: $u_Q$ is effective Qwen3/NPU utilization after nonlinear overhead; $u_{Q,\mathrm{linear}}$ is raw Qwen3/NPU utilization; $F_{\mathrm{USL}}(\cdot)$ is the USL-inspired overhead function.

The effective Qwen3 token demand is the token demand that would produce the same effective NPU utilization after nonlinear overhead.

$$
T_{Q,\mathrm{eff}} = C_Q \cdot u_Q
$$

Where: $T_{Q,\mathrm{eff}}$ is effective Qwen3 token demand in tokens/s after nonlinear overhead; $C_Q$ is configured Qwen3 token capacity; $u_Q$ is effective Qwen3/NPU utilization.

### 1.5.4 Network Utilization

Network utilization includes baseline control-plane message traffic plus additional intent metadata, tool-invocation wrappers, and inter-agent coordination messages. The same nonlinear adjustment is applied to network utilization so that buffering, congestion-control behavior, and coordination overhead are reflected in the effective bandwidth load.

$$
u_{\mathrm{net}} = F_{\mathrm{USL}}(u_{\mathrm{net,linear}})
$$

Where: $u_{\mathrm{net}}$ is effective network utilization after nonlinear overhead; $u_{\mathrm{net,linear}}$ is raw network utilization before overhead; $F_{\mathrm{USL}}(\cdot)$ is the USL-inspired overhead function.

## 1.6 Analytical Results

The table fixes the user population, event frequencies, and Qwen3 cluster size, then varies the percentage of all requests that carry intent in constant $10\%$ steps. The visible resource-utilization results use the USL-inspired nonlinear overhead model. The intent-sweep figure uses $1\%$ sampling for visual detail.


| Intent ratio | Total intent share | Intent rps | Qwen3 rps | Effective Qwen3 tokens/s | CPU cores | CPU util | Memory traffic | NPU util | Network bandwidth | Status    |
| -----------: | -----------------: | ---------: | --------: | -----------------------: | --------: | -------: | -------------: | -------: | ----------------: | --------- |
|           0% |               0.0% |          0 |         0 |                        0 |     167.5 |    65.4% |    53.402 Gbps |     0.0% |        6.805 Gbps | stable    |
|          10% |              10.0% |     10,430 |     1,043 |                  140,772 |     188.6 |    73.7% |    90.783 Gbps |    29.2% |        7.815 Gbps | degraded  |
|          20% |              20.0% |     20,860 |     2,086 |                  292,242 |     210.4 |    82.2% |   128.164 Gbps |    60.7% |        8.827 Gbps | degraded  |
|          30% |              30.0% |     31,290 |     3,129 |                  461,170 |     232.8 |    90.9% |   165.545 Gbps |    95.8% |        9.840 Gbps | high_risk |
|          40% |              40.0% |     41,720 |     4,172 |                  654,315 |     255.9 |   100.0% |   202.926 Gbps |   136.0% |       10.855 Gbps | unstable  |
|          50% |              50.0% |     52,150 |     5,215 |                  878,438 |     279.8 |   109.3% |   240.307 Gbps |   182.5% |       11.871 Gbps | unstable  |
|          60% |              60.0% |     62,580 |     6,258 |                1,140,298 |     304.6 |   119.0% |   277.688 Gbps |   236.9% |       12.890 Gbps | unstable  |
|          70% |              70.0% |     73,010 |     7,301 |                1,446,655 |     330.2 |   129.0% |   315.069 Gbps |   300.6% |       13.909 Gbps | unstable  |
|          80% |              80.0% |     83,440 |     8,344 |                1,804,268 |     356.7 |   139.4% |   352.451 Gbps |   374.9% |       14.931 Gbps | unstable  |
|          90% |              90.0% |     93,870 |     9,387 |                2,219,898 |     384.3 |   150.1% |   389.832 Gbps |   461.2% |       15.955 Gbps | unstable  |
|         100% |             100.0% |    104,300 |    10,430 |                2,700,304 |     412.9 |   161.3% |   427.213 Gbps |   561.1% |       16.980 Gbps | unstable  |

Generated results are available in `outputs/agentic_resource_results.csv`. The user-count sensitivity sweep is available in `outputs/agentic_resource_sensitivity.csv`. The Qwen3 sensitivity sweep is available in `outputs/agentic_qwen3_sizing_sensitivity.csv`.

![](outputs/agentic_resource_utilization.png)

The following user-count sensitivity figure fixes the intent ratio at $20\%$ and varies the user population from $0.5$ million to $4.0$ million users.

![](outputs/agentic_user_count_sensitivity.png)

## 1.7 Interpretation

With $128$ configured NPUs assigned to Qwen3 serving and $10\%$ Qwen3 invocation ratio, NPU utilization is $29.2\%$ at $10\%$ intent ratio, $60.7\%$ at $20\%$ intent ratio, and $95.8\%$ at $30\%$ intent ratio. At $40\%$ intent ratio, NPU utilization exceeds $100\%$, so the fixed NPU cluster is overloaded. Higher intent ratios require more NPU capacity, lower Qwen3 invocation ratio, shorter token profiles, faster serving, or admission control.

## 1.8 Model Boundary

The numerical values are analytical input parameters for capacity and sensitivity analysis. Actual deployment results depend on model size, batching behavior, inference hardware, NF implementation, database access behavior, message encoding, tool granularity, and operator policy logic. Measured deployment data can be used to calibrate CPU time, memory traffic, and message size.

## 1.9 References

1. [A General Theory of Computational Scalability Based on Rational Functions](https://arxiv.org/abs/0808.1431).
   This paper defines the Universal Scalability Law as a rational-function capacity model with contention and coherency terms. This document uses USL as the structural basis for the nonlinear overhead multiplier, while keeping the coefficients as analytical sensitivity parameters.
2. [Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities](https://www.cs.cmu.edu/~18742/papers/Amdahl1967.pdf).
   This classic paper motivates the general principle that shared serial work limits scalable capacity. It is background support for treating coordination and shared control-plane work as capacity overhead, not as free parallel work.
3. [Sarathi-Serve: Tackling User-Generated Request Variability in LLM Inference Serving](https://arxiv.org/abs/2403.02310), also published at OSDI 2024 ([PDF](https://www.usenix.org/system/files/osdi24-agrawal.pdf)).
   This paper shows that LLM serving performance depends on request scheduling and batching across prefill and decode phases. It supports applying a nonlinear capacity-overhead term to Qwen3 serving.
4. [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180).
   This paper explains why KV-cache memory management is central to LLM serving. KV cache is large and dynamic; inefficient memory management reduces batching efficiency and serving throughput. This supports the model term that converts raw Qwen3 token demand into effective token demand under KV/cache pressure.
5. [Online Scheduling for LLM Inference with KV Cache Constraints](https://www.microsoft.com/en-us/research/publication/online-scheduling-for-llm-inference-with-kv-cache-constraints/) and [arXiv:2502.07115](https://arxiv.org/abs/2502.07115).
   This work treats KV-cache capacity as a scheduling constraint for LLM inference. It supports the view that utilization and memory pressure are coupled under concurrency, so NPU serving demand should not be modeled only as raw tokens divided by peak token capacity.
6. [GPUStack Qwen3-30B-A3B on Ascend 910B benchmark](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/).
   This benchmark provides the reference token capacity used in the model: `15,040.15 total tokens/s` for Qwen3-30B-A3B with `128 input tokens` and `4 output tokens`.
7. [vLLM Ascend documentation](https://docs.vllm.ai/projects/ascend/en/v0.18.0/).
   This documentation provides implementation context for serving Qwen3-family models on Ascend through vLLM Ascend. It supports the tensor-parallel serving assumptions used for the configured NPU cluster.
