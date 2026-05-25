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
| 生产 NPU 规划目标 | Qwen3 token 利用率 70% |
| Qwen3 调用比例 | 意图请求的 10% |
| Qwen3 token 配置 | 128 input tokens + 4 output tokens = 132 tokens/request |
| Qwen3 token 能力 | 15,040 tokens/s/replica |
| Qwen3 张量并行规模 | 4 NPUs/replica |
| 网络容量 | 100 Gbps |
| 非线性竞争拐点 | 60% utilization |
| 非线性竞争额外开销 | 满负载最大 60% 额外开销 |
| 非线性曲线指数 | 2.0 |
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

## Agentic 成本模型

对于非意图请求，增量 Agentic CPU 成本为 $0.30\ CPU\text{-}ms/request$。对于携带意图的请求，CPU 侧 Agent 工作量为 $2.00\ CPU\text{-}ms/request$，不包含 Qwen3 推理。

$$
D_{\mathrm{intent,light}} = 4\ \mathrm{ms} + 2\ \mathrm{ms}
$$

$$
D_{Q,\mathrm{service}} = 8\ \mathrm{ms/request}
$$

携带意图请求额外增加 $12\ \mathrm{KB/request}$ 控制面元数据，用于意图容器、任务元数据、工具调用封装以及 Agent 间状态/追踪元数据。

## 非线性饱和模型

模型默认使用非线性竞争乘子。先计算线性需求，再在利用率拐点之后应用饱和乘子。

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

排队延迟表示为：

$$
D_{\mathrm{queue}} = \frac{S \cdot u}{1-u}, \quad 0 \le u < 1
$$

## 分析结果

下表固定用户规模和事件频率，仅改变全部请求中携带意图的比例。可见结果使用非线性饱和模型。

| 意图比例 | 总意图占比 | 意图 rps | Qwen3 rps | 有效 Qwen3 tokens/s | CPU 核 | CPU 利用率 | 内存流量 | 规划后 Qwen3 利用率 | 所需生产 NPU | 网络带宽 | 平均时延 | p95 时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 156.9 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.3 ms | 稳定 |
| 1% | 1.0% | 1,043 | 104 | 13,768 | 158.8 | 62.0% | 57.140 Gbps | 45.8% | 8 | 6.879 Gbps | 23.0 ms | 98.3 ms | 稳定 |
| 5% | 5.0% | 5,215 | 522 | 69,587 | 167.1 | 65.3% | 72.092 Gbps | 66.1% | 28 | 7.280 Gbps | 23.8 ms | 116.5 ms | 稳定 |
| 10% | 10.0% | 10,430 | 1,043 | 139,173 | 178.9 | 69.9% | 90.783 Gbps | 66.1% | 56 | 7.780 Gbps | 25.0 ms | 141.3 ms | 稳定 |
| 20% | 20.0% | 20,860 | 2,086 | 281,646 | 208.7 | 81.5% | 128.164 Gbps | 69.4% | 108 | 8.782 Gbps | 30.5 ms | 299.8 ms | 退化 |
| 50% | 50.0% | 52,150 | 5,215 | 710,940 | 364.0 | 142.2% | 240.307 Gbps | 69.5% | 272 | 11.786 Gbps | 不稳定 | 不稳定 | 不稳定 |
| 100% | 100.0% | 104,300 | 10,430 | 1,427,134 | 534.6 | 208.8% | 427.213 Gbps | 69.8% | 544 | 16.792 Gbps | 不稳定 | 不稳定 | 不稳定 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。Qwen3 规划敏感性扫描位于 `outputs/agentic_qwen3_sizing_sensitivity.csv`。

在优化参考值 $15,040\ \mathrm{tokens/s/replica}$ 下， $100\%$ 意图比例的 Qwen3 生产规划如下：

| Qwen3 调用比例 | Qwen3 rps | 有效 token 需求 | 所需副本 | 所需 NPU | 规划后 Qwen3 利用率 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 5% | 5,215 | 710,940 tokens/s | 68 | 272 | 69.5% |
| 10% | 10,430 | 1,427,134 tokens/s | 136 | 544 | 69.8% |
| 20% | 20,860 | 2,854,268 tokens/s | 272 | 1,088 | 69.8% |
| 50% | 52,150 | 7,141,149 tokens/s | 679 | 2,716 | 69.9% |
| 100% | 104,300 | 14,282,299 tokens/s | 1,357 | 5,428 | 70.0% |

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

下列用户规模敏感性图固定意图比例为 $20\%$，并改变用户规模。

![](outputs/agentic_user_count_sensitivity.png)

## 结果解读

在非线性饱和模型和 $10\%$ Qwen3 调用比例下， $100\%$ 意图流量需要 $136$ 个 Qwen3 副本，即 $544$ 张 NPU。满负载场景会因 CPU 超载而失稳，除非增加 CPU 容量、降低意图比例、降低 CPU 侧处理成本或引入准入控制。

## 模型边界

所有数值均为容量和敏感性分析的分析型输入参数。实际部署结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。实测部署数据可用于校准 CPU 时间、推理时延、内存流量、消息大小和排队行为。
