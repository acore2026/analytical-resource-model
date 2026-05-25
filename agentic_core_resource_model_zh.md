# 面向 Agentic 6G 核心网控制面流程的分析型资源模型

[English version](agentic_core_resource_model.md)

本文定义所提 Agentic 6G 核心网架构的分析型资源模型，用于估算高并发控制面负载下的确定性核心网处理、NW-Agent 开销、意图处理、工具调用、Agent 协作以及 Qwen3-30B-A3B 推理容量。

模型不包含漫游、AF 发起意图和 SRF 路由成本。本文模型是分析型容量模型，不是部署实测结果。

## 负载模型

令 $N_{\mathrm{user}}$ 表示注册用户数， $f_i$ 表示单个用户每小时触发事件 $i$ 的次数。

$$
\lambda_i = \frac{N_{\mathrm{user}} \cdot f_i}{3600}
$$

$$
\lambda_{\mathrm{total}} = \sum_i \lambda_i
$$

基线采用 $N_{\mathrm{user}}=3.6\times10^6$ 用户和 $2$ PDU sessions/user。基线总速率为 $104,300$ requests/s。任意请求类型都可能携带意图，因此意图比例 $\rho_I$ 应用于完整请求流。

| 事件 | 默认每用户每小时次数 | 推导请求速率 | 基线时延 | 基线 CPU | 基线带宽 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 初始注册 | 0.1 events/user/hour | 100 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request |
| 周期注册 | 0.1 events/user/hour | 100 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request |
| 移动性注册 | 7.0 events/user/hour | 7,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request |
| 初始 PDU 会话建立 | 1.0 events/user/hour | 1,000 requests/s | 40 ms | 2.5 CPU-ms/request | 16 KB/request |
| PDU 会话释放 | 1.0 events/user/hour | 1,000 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request |
| PDU 会话修改 | 2.0 events/user/hour | 2,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request |
| 业务请求 | 21.0 events/user/hour | 21,000 requests/s | 20 ms | 1.2 CPU-ms/request | 8 KB/request |
| AN 释放 | 35.0 events/user/hour | 35,000 requests/s | 15 ms | 0.8 CPU-ms/request | 6 KB/request |
| 切换 | 23.1 events/user/hour | 23,100 requests/s | 25 ms | 1.8 CPU-ms/request | 12 KB/request |
| 寻呼 | 14.0 events/user/hour | 14,000 requests/s | 12 ms | 0.6 CPU-ms/request | 4 KB/request |

## 资源参数

| 参数 | 取值 |
| --- | ---: |
| 主机 CPU 平台 | Kunpeng 920 |
| CPU 集群容量 | 256 CPU cores = 256,000 CPU-ms/s |
| RAM 容量 | 256 GB |
| 推理运行时 | vLLM Ascend 0.11.0 |
| 意图推理模型 | Qwen3-30B-A3B |
| 用于 Qwen3 服务的 NPU 集群 | 128 NPUs |
| Qwen3 调用比例 | 意图请求的 10% |
| Qwen3 token 配置 | 128 input tokens + 4 output tokens = 132 tokens/request |
| Qwen3 token 能力 | 15,040 tokens/s/replica |
| Qwen3 张量并行规模 | 4 NPUs/replica |
| 网络容量 | 100 Gbps |
| 非线性开销模型 | 固定负载分档 |
| 非意图 Agent CPU 成本 | 0.3 CPU-ms/request |
| 意图 Agent CPU 成本 | 2.0 CPU-ms/request |
| 非意图 Agent 时延 | 1 ms/request |
| 意图固定 Agent 时延 | 4 ms/request |
| 复杂意图 Qwen3 服务时间 | 排队前 8 ms/request |
| 意图额外带宽 | 12 KB/request |

$CPU\text{-}ms$ 表示一个 CPU 核被占用一毫秒。例如， $2\ CPU\text{-}ms/request$ 在 $100,000$ requests/s 下消耗 $200$ CPU cores。

## Qwen3 能力参考

[GPUStack 的 Qwen3-30B-A3B on Ascend 910B 基准](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/)报告，在 `128 input tokens` 和 `4 output tokens` 配置下结果为 `15,040.15 total tokens/s`。[vLLM-Ascend 文档](https://docs.vllm.ai/projects/ascend/en/v0.18.0/)包含 Qwen3-30B-A3B 指引；对于 32 GB NPU 卡，模型采用 tensor parallel size $TP_Q=4$。

$$
\lambda_I = \rho_I \cdot \lambda_{\mathrm{total}}
$$

$$
\lambda_Q = \lambda_I \cdot r_Q
$$

$$
T_Q = \lambda_Q \cdot \left(L_{\mathrm{in}} + L_{\mathrm{out}}\right)
$$

用于 Qwen3 服务的 NPU 集群包含 $N_Q=128$ 张 NPU。可用 Qwen3 副本数和 token 容量为：

$$
R_{Q,\mathrm{avail}} = \left\lfloor \frac{N_Q}{TP_Q} \right\rfloor
$$

$$
C_Q = R_{Q,\mathrm{avail}} \cdot \mu_Q
$$

## Agentic 成本模型

对于非意图请求，增量 Agentic CPU 成本为 $0.30\ CPU\text{-}ms/request$。对于携带意图的请求，CPU 侧 Agent 工作量为 $2.00\ CPU\text{-}ms/request$，不包含 Qwen3 推理。

$$
D_{\mathrm{intent,light}} = 4\ \mathrm{ms} + 2\ \mathrm{ms}
$$

$$
D_{Q,\mathrm{service}} = 8\ \mathrm{ms/request}
$$

携带意图请求额外增加 $12\ \mathrm{KB/request}$ 控制面元数据，用于意图容器、任务元数据、工具调用封装以及 Agent 间状态/追踪元数据。

## 分段式非线性负载模型

模型使用固定运行分档表示高负载竞争。先计算线性需求，再根据对应的 CPU、网络或 Qwen3 服务负载，从下表选择乘子 $M(u)$。

| 线性负载区间 | 运行状态 | 乘子 $M(u)$ |
| ---: | --- | ---: |
| $0\% \le u < 60\%$ | 正常 | $1.00$ |
| $60\% \le u < 80\%$ | 繁忙 | $1.15$ |
| $80\% \le u < 90\%$ | 高负载 | $1.35$ |
| $90\% \le u$ | 临界 | $1.60$ |

该模型是非线性的，因为有效成本按照运行分档变化，而不是始终以同一个斜率增长。

### 为什么会出现非线性开销

非线性乘子用于表示高并发下有效服务效率下降，而不是表示单个请求的语义工作量发生变化。在正常运行状态下，模型等同于透明的线性基线；进入繁忙、高负载和临界状态后，每个请求还会消耗竞争、调度、内存搬移、排队和运行时协调等额外容量。

| 资源区域 | 非线性因素 | 模型中的含义 |
| --- | --- | --- |
| CPU | 调度开销、锁竞争、缓存未命中、内存访问延迟、序列化/反序列化和状态存储压力。 | CPU 进入更高负载分档后，有效 CPU-ms/request 上升。 |
| 用于 Qwen3 的 NPU 服务 | 批处理效率下降、请求路由、副本调度、运行时协调、跨副本开销，以及 KV/cache 内存压力。 | 将原始 token 需求转换为有效 token 需求，再计算配置 NPU 集群的利用率。 |
| 网络 | 排队、缓冲、拥塞控制、重传风险和额外控制面协调。 | 网络进入更高负载分档后，有效带宽和网络时延上升。 |
| 时延 | CPU 排队、NPU 排队、网络排队和尾时延放大。 | 利用率接近饱和时，平均、p95 和 p99 时延会更快上升。 |

KV/cache 内存压力对 Qwen3 服务尤其重要。在高并发场景下，活跃请求会更长时间占用 key-value cache、运行时缓冲区和调度状态。这会降低新请求可用的有效吞吐能力，即使每个请求的原始 token 配置没有变化。因此，模型并不表示 Qwen3 为单个请求生成了更多语义 token；模型使用有效 token 需求来表示模型服务系统周边的额外开销。

$$
C_{\mathrm{cpu,linear}} = \sum_i \frac{\lambda_i}{\lambda_{\mathrm{total}}} C_{\mathrm{base},i} + s_I C_{\mathrm{agent,intent}} + (1-s_I) C_{\mathrm{agent,nonintent}}
$$

$$
D_{\mathrm{cpu}} = \frac{\lambda_{\mathrm{total}} C_{\mathrm{cpu,linear}} M(u_{\mathrm{cpu,linear}})}{1000}
$$

$$
B_{\mathrm{net}} = \frac{\lambda_{\mathrm{total}} B_{\mathrm{req,linear}} \cdot 8}{1,000,000} \cdot M(u_{\mathrm{net,linear}})
$$

$$
u_{Q,\mathrm{linear}} = \frac{T_Q}{C_Q}
$$

$$
T_{Q,\mathrm{eff}} = T_Q \cdot M(u_{Q,\mathrm{linear}})
$$

$$
u_Q = \frac{T_{Q,\mathrm{eff}}}{C_Q}
$$

排队延迟表示为：

$$
D_{\mathrm{queue}} = \frac{S \cdot u}{1-u}, \quad 0 \le u < 1
$$

## 分析结果

下表固定用户规模、事件频率和 Qwen3 集群规模，仅以固定 $10\%$ 步长改变全部请求中携带意图的比例。可见结果使用分段式非线性负载模型。意图比例扫描图使用 $1\%$ 采样，以获得更平滑的可视化效果。

| 意图比例 | 总意图占比 | 意图 rps | Qwen3 rps | 有效 Qwen3 tokens/s | CPU 核 | CPU 利用率 | 内存流量 | NPU 利用率 | 网络带宽 | 平均时延 | p95 时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 180.3 | 70.4% | 53.402 Gbps | 0.0% | 6.779 Gbps | 24.6 ms | 141.9 ms | 退化 |
| 10% | 10.0% | 10,430 | 1,043 | 137,676 | 200.7 | 78.4% | 90.783 Gbps | 28.6% | 7.780 Gbps | 28.1 ms | 231.8 ms | 退化 |
| 20% | 20.0% | 20,860 | 2,086 | 275,352 | 221.1 | 86.4% | 128.164 Gbps | 57.2% | 8.782 Gbps | 35.1 ms | 350.8 ms | 高风险 |
| 30% | 30.0% | 31,290 | 3,129 | 557,588 | 283.5 | 110.7% | 165.545 Gbps | 115.9% | 9.783 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 40% | 40.0% | 41,720 | 4,172 | 881,126 | 307.5 | 120.1% | 202.926 Gbps | 183.1% | 10.784 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 50% | 50.0% | 52,150 | 5,215 | 1,101,408 | 392.8 | 153.4% | 240.307 Gbps | 228.8% | 11.786 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 60% | 60.0% | 62,580 | 6,258 | 1,321,690 | 421.1 | 164.5% | 277.688 Gbps | 274.6% | 12.787 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 70% | 70.0% | 73,010 | 7,301 | 1,541,971 | 449.5 | 175.6% | 315.069 Gbps | 320.4% | 13.788 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 80% | 80.0% | 83,440 | 8,344 | 1,762,253 | 477.9 | 186.7% | 352.451 Gbps | 366.2% | 14.789 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 90% | 90.0% | 93,870 | 9,387 | 1,982,534 | 506.2 | 197.7% | 389.832 Gbps | 411.9% | 15.791 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 100% | 100.0% | 104,300 | 10,430 | 2,202,816 | 534.6 | 208.8% | 427.213 Gbps | 457.7% | 16.792 Gbps | 不稳定 | 不稳定 | 不稳定 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。Qwen3 敏感性扫描位于 `outputs/agentic_qwen3_sizing_sensitivity.csv`。

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

下列用户规模敏感性图固定意图比例为 $20\%$，并将用户规模从 $0.5$ million 扫描到 $4.0$ million。

![](outputs/agentic_user_count_sensitivity.png)

## 结果解读

在配置 $128$ 张 NPU 用于 Qwen3 服务且 Qwen3 调用比例为 $10\%$ 的情况下，NPU 利用率在 $10\%$ 意图比例时为 $28.6\%$，在 $20\%$ 意图比例时为 $57.2\%$。当意图比例达到 $30\%$ 时，NPU 利用率超过 $100\%$，表示固定 NPU 集群已经过载。更高意图比例需要增加 NPU 容量、降低 Qwen3 调用比例、缩短 token 配置、提升服务吞吐或引入准入控制。

## 模型边界

所有数值均为容量和敏感性分析的分析型输入参数。实际部署结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。实测部署数据可用于校准 CPU 时间、推理时延、内存流量、消息大小和排队行为。
