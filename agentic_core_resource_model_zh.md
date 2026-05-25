# 面向 Agentic 6G 核心网控制面流程的分析型资源模型

[English version](agentic_core_resource_model.md)

本文档为所提出的 Agentic 6G 核心网架构提供分析型资源模型，用于估算高并发控制面负载下 NW-Agent 推理、工具调用和 Agent 协作带来的资源成本。

模型将传统确定性 NF 工作与 Agentic 额外开销分开建模。确定性路径执行普通控制面状态变更；Agentic 路径增加 Connection Agent 处理、缓存的 ARF/TRF 元数据查询、工具调用封装、Agent 间消息，以及面向携带意图请求的加速器推理。不包含漫游、AF 发起的意图和 SRF 路由成本。

## 负载模型

流量由用户规模推导，而不是由固定百分比混合直接给出。令 `N_user` 表示用户数，`f_i` 表示单个用户每小时触发事件 `i` 的次数。事件 `i` 的到达率为：

```text
lambda_i [requests/s] = N_user [users] * f_i [events/user/hour] / 3600 [s/hour]
```

总控制面请求速率为：

```text
lambda_total [requests/s] = sum_i(lambda_i)
```

基线采用 `3,600,000 users` 和 `2 PDU sessions/user`。PDU 会话数作为场景变量保留，但不会自动乘到事件速率上；会话数量影响通过调整每用户每小时事件频率体现。

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

基线总速率为 `104,300 requests/s`。任意请求类型都可能携带意图，因此意图比例应用于完整控制面请求流。当意图比例为 `100%` 时，总意图请求为 `104,300 requests/s`。

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
| 非意图 Agent CPU 成本 | 0.3 CPU-ms/request |
| 意图 Agent CPU 成本 | 2.0 CPU-ms/request |
| 非意图 Agent 时延 | 1 ms/request |
| 意图固定 Agent 时延 | 4 ms/request |
| 复杂意图 Qwen3 服务时间 | 排队前 8 ms/request |
| 非意图内存流量 | 64 KB/request |
| 意图内存流量 | 512 KB/request |
| 意图额外带宽 | 12 KB/request |
| 固定推理模型内存 | 每个活跃 NPU 占用 16 GB HBM |
| 活跃 Qwen3 HBM | 4 MB/active Qwen3 request |

`CPU-ms` 表示一个 CPU 核被占用一毫秒。例如，`2 CPU-ms/request` 在 `100,000 requests/s` 下消耗 `200 CPU cores`。在本版本中，CPU 成本表示 Kunpeng 920 CPU 核上的主机侧预算。Qwen3-30B-A3B 能力以 tokens/s 建模，再换算为所需生产 Ascend NPU 数量。默认 Qwen3 调用比例为意图请求的 `10%`，并报告 `5%`、`10%`、`20%`、`50%` 和 `100%` 的敏感性点。

## Qwen3 能力参考

[GPUStack 的 Qwen3-30B-A3B on Ascend 910B 基准](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/)报告，在 `128 input tokens` 和 `4 output tokens` 的短提示配置下，优化结果为 `15,040.15 total tokens/s`。[vLLM-Ascend 文档](https://docs.vllm.ai/projects/ascend/en/v0.18.0/)包含 Qwen3-30B-A3B 指引；对于 32 GB NPU 卡，模型采用 tensor parallel size `4`，因此一个 Qwen3 副本视为 `4 NPUs`。该基准作为本文分析的外部能力参考。

模型采用两级推理路径。所有意图请求都经过轻量解析、约束提取和工具选择；只有复杂或模糊意图请求调用 Qwen3-30B-A3B：

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

在 `100%` 意图比例下，默认生产场景为：

```text
lambda_I = 104,300 intent requests/s
r_Q = 10%
lambda_Q = 10,430 Qwen3 requests/s
T_Q = 10,430 * 132 = 1,376,760 tokens/s
R_Q = ceil(1,376,760 / (15,040 * 0.70)) = 131 replicas
N_Q = 131 * 4 = 524 NPUs
```

模型将总意图流量与需要 Qwen3 生成的请求子集分开计算。

## Agentic 成本模型

提案中的若干架构行为会产生 Agentic 额外开销：UE NAS 请求无论是否携带意图都会被转发给 NW-Agent；NW-Agent 需要根据网络条件和约束检查请求是否可满足；意图请求需要进行意图理解、任务编排、工具选择和工具调用；Planning Agent 可能与 Connection Agent 等专用 Agent 交互；TRF/ARF 为工具或 Agent 的发现与选择提供元数据。在本基本流程模型中，TRF/ARF 元数据按已缓存在服务 Agent 进程内建模，因此仓库发现不会引入每请求网络往返。

下列 CPU、时延和带宽参数按照提案流程分解进行分配，用作容量估算的分析型输入参数。实测部署数据可用于后续校准这些参数。

### 非意图 Agent CPU 成本

对于不携带意图的请求，提案仍要求请求经过 NW-Agent。Agent 不需要语义意图推理或任务分解，但仍需要执行请求分类、快速约束检查、缓存元数据查询和工具封装准备，然后再进入确定性 NF 执行。

| 组件 | 架构依据 | CPU 预算 |
| --- | --- | ---: |
| NAS/请求归一化 | 将 UE 请求转换为 Agent 内部请求对象。 | 0.05 CPU-ms/request |
| 无意图检测和流程分类 | 判断请求不携带意图，并选择确定性流程路径。 | 0.05 CPU-ms/request |
| 缓存 ARF/TRF 元数据查询 | 查询本地缓存的 Agent/工具描述信息，确定相关连接服务路径。 | 0.05 CPU-ms/request |
| 策略、签约和资源快速检查 | 在调用确定性工具前执行轻量可行性检查。 | 0.08 CPU-ms/request |
| 工具封装、状态更新和追踪 | 准备工具调用上下文并记录请求状态和进度。 | 0.07 CPU-ms/request |
| **合计** |  | **0.30 CPU-ms/request** |

该值表示增量 Agentic CPU 成本。注册、PDU 会话、业务请求、AN 释放、切换和寻呼等确定性工作已经由各事件的基线 CPU 值单独表示。

### 意图 Agent CPU 成本

对于携带意图的请求，提案额外引入半结构化意图处理、约束解释、动态任务编排、工具选择，以及可能的 Planning Agent 与 Connection Agent 协作。模型将这些 CPU 侧 Agent 工作设为 `2.0 CPU-ms/request`，不包含加速器推理。

| 组件 | 架构依据 | CPU 预算 |
| --- | --- | ---: |
| 意图容器解析 | 解码 NAS 携带的意图并提取标准字段。 | 0.25 CPU-ms/request |
| 意图归一化和约束提取 | 解释描述、目标、条件、指南和额外信息。 | 0.20 CPU-ms/request |
| UE/会话/网络上下文查询 | 获取 Agent 所需的签约、会话、位置和缓存工具上下文。 | 0.25 CPU-ms/request |
| 策略、签约和资源可行性检查 | 检查意图在运营商约束和网络约束下是否可满足。 | 0.35 CPU-ms/request |
| 任务分解和工具选择 | 生成有序任务计划，并选择 SMC、PCC、SMAU、Analytics、Traffic Treatment 或 UP Configuration 等工具。 | 0.45 CPU-ms/request |
| Agent 间任务封装处理 | 在需要协作时准备 Planning Agent 到专用 Agent 的任务请求。 | 0.25 CPU-ms/request |
| 状态更新、进度跟踪和追踪 | 保存请求状态、工具结果和可观测性元数据。 | 0.25 CPU-ms/request |
| **合计** |  | **2.00 CPU-ms/request** |

### 意图时延

时延被拆分为确定性流程时延、CPU 排队、固定 Agent 编排时延和可选 Qwen3 推理时延。轻量意图路径使用固定编排和 CPU 侧 Agent 工作；可配置比例的意图请求会额外调用 Qwen3：

```text
Lightweight intent latency [ms/request] =
  4 ms fixed orchestration
+ 2 ms CPU-side agent service

Complex intent Qwen3 add-on [ms/request] =
  8 ms Qwen3 service time before queueing
```

其中，`4 ms` 固定编排项覆盖解析、可行性检查、任务计划构造、工具封装创建和本地状态更新等墙钟时间。`2 ms` CPU 侧服务项对应 `2.0 CPU-ms/request` 的意图 CPU 预算，等价于其在一个 CPU 核上串行执行。`8 ms` Qwen3 项只应用于配置的复杂意图比例。随后，模型会根据 CPU、规划后的 Qwen3 生产 NPU 和网络利用率叠加排队延迟。

对于非意图请求，模型使用 `1 ms/request` 固定 Agent 时延，因为该请求走快速路径：分类、检查缓存元数据，并调用确定性工具路径，不执行语义推理。

### 意图额外带宽

基线事件带宽已经表示传统流程的普通控制面信令。模型只对携带意图的请求额外增加 `12 KB/request`，用于表示 Agentic 架构引入的附加字节。

| 组件 | 架构依据 | 带宽预算 |
| --- | --- | ---: |
| 意图 NAS 容器和归一化请求负载 | 将半结构化意图字段从 UE 传递给 Agent，并转换为内部 Agent 请求。 | 2 KB/request |
| 计划/任务元数据 | 编码任务描述、目标能力、约束和所选流程上下文。 | 3 KB/request |
| 工具调用封装元数据 | 为若干工具调用携带工具名称、输入、前置/后置条件标识和结果元数据。 | 5 KB/request |
| Agent 间状态和追踪元数据 | 记录 Planning Agent、专用 Agent 和工具承载 NF 之间的进度/结果上报。 | 2 KB/request |
| **合计** |  | **12 KB/request** |

对于非意图请求，额外 Agentic 带宽建模为 `0 KB/request`，因为现有 NAS/NF 信令已经包含在基线事件带宽中，且本地缓存元数据查询不会产生每请求仓库流量。

## 模型

令 `rho_I` 表示全部控制面请求中的意图比例。

```text
lambda_candidate [requests/s] = lambda_total
lambda_I [requests/s] = rho_I * lambda_candidate
s_I [unitless] = lambda_I / lambda_total
```

平均 CPU 成本为：

```text
C_cpu [CPU-ms/request] =
  sum_i((lambda_i / lambda_total) * C_base,i)
  + s_I * C_agent,intent
  + (1 - s_I) * C_agent,nonintent
```

CPU 需求和利用率为：

```text
D_cpu [CPU cores] = lambda_total * C_cpu / 1000
u_cpu [unitless] = D_cpu / N_cpu
```

控制面带宽为：

```text
B_req [KB/request] =
  sum_i((lambda_i / lambda_total) * B_base,i)
  + s_I * B_agent,intent

B_net [Gbps] = lambda_total * B_req * 8 / 1,000,000
u_net [unitless] = B_net / C_net
```

Qwen3 生产 NPU 规划为：

```text
lambda_Q [requests/s] = lambda_I * r_Q
T_Q [tokens/s] = lambda_Q * L_Q
R_Q [replicas] = ceil(T_Q / (mu_Q * u_target))
N_Q [NPUs] = R_Q * TP_Q
u_npu [unitless] = T_Q / (R_Q * mu_Q)
```

排队延迟采用简单的 M/M/1 启发式敏感性项：

```text
D_queue [ms] = S [ms] * u / (1 - u), for u < 1
```

排队延迟采用分析型敏感性近似。平均、p95 和 p99 时延由确定性流程时延、固定 Agent 时延、CPU 排队、Qwen3 生产 NPU 排队和网络排队组成。生产规划结果会报告为了保持 Qwen3 token 利用率不超过目标值所需的 NPU 数量。

## 分析结果

下表固定用户规模和事件频率，仅改变全部请求中携带意图的比例。

对于 Qwen3，主要扩展指标是所需生产 NPU 数量。Qwen3 利用率由生产规划控制在目标值附近，因此不应被解释为固定 NPU 池的压力。资源图中左纵轴表示 CPU 和网络利用率，右纵轴表示所需 Qwen3 NPU 数量。

| 意图比例 | 总意图占比 | 意图 rps | Qwen3 rps | Qwen3 tokens/s | CPU 核 | CPU 利用率 | 内存流量 | 规划后 Qwen3 利用率 | 所需生产 NPU | 网络带宽 | 平均时延 | p95 时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 156.8 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.1 ms | 稳定 |
| 1% | 1.0% | 1,043 | 104 | 13,768 | 158.6 | 62.0% | 57.140 Gbps | 45.8% | 8 | 6.879 Gbps | 23.0 ms | 98.0 ms | 稳定 |
| 5% | 5.0% | 5,215 | 522 | 68,838 | 165.7 | 64.7% | 72.092 Gbps | 65.4% | 28 | 7.280 Gbps | 23.7 ms | 113.2 ms | 稳定 |
| 10% | 10.0% | 10,430 | 1,043 | 137,676 | 174.6 | 68.2% | 90.783 Gbps | 65.4% | 56 | 7.780 Gbps | 24.6 ms | 130.3 ms | 稳定 |
| 20% | 20.0% | 20,860 | 2,086 | 275,352 | 192.3 | 75.1% | 128.164 Gbps | 67.8% | 108 | 8.782 Gbps | 27.2 ms | 191.4 ms | 退化 |
| 50% | 50.0% | 52,150 | 5,215 | 688,380 | 245.5 | 95.9% | 240.307 Gbps | 69.3% | 264 | 11.786 Gbps | 78.3 ms | 782.8 ms | 高风险 |
| 100% | 100.0% | 104,300 | 10,430 | 1,376,760 | 334.1 | 130.5% | 427.213 Gbps | 69.9% | 524 | 16.792 Gbps | 不稳定 | 不稳定 | 不稳定 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。Qwen3 规划敏感性扫描位于 `outputs/agentic_qwen3_sizing_sensitivity.csv`。

在优化参考值 `15,040 tokens/s/replica` 下，`100%` 意图比例的 Qwen3 生产规划如下：

| Qwen3 调用比例 | Qwen3 rps | Token 需求 | 所需副本 | 所需 NPU | 规划后 Qwen3 利用率 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 5% | 5,215 | 688,380 tokens/s | 66 | 264 | 69.3% |
| 10% | 10,430 | 1,376,760 tokens/s | 131 | 524 | 69.9% |
| 20% | 20,860 | 2,753,520 tokens/s | 262 | 1,048 | 69.9% |
| 50% | 52,150 | 6,883,800 tokens/s | 654 | 2,616 | 70.0% |
| 100% | 104,300 | 13,767,600 tokens/s | 1,308 | 5,232 | 70.0% |

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

下列用户规模敏感性图固定意图比例为 `20%`，并改变用户规模。CPU 和网络利用率随总控制面请求量增加而上升。所需 Qwen3 NPU 数量随更大用户规模带来的 Qwen3 token 需求增加而上升。

![](outputs/agentic_user_count_sensitivity.png)

## 结果解读

事件速率模型表明，高并发主要由高频业务请求、AN 释放、切换和寻呼事件驱动。如果 `10%` 的意图请求调用 Qwen3，则 `100%` 意图流量下生产规划需要 `131` 个副本，即 `524` 张 NPU。

分析结果表明：总用户/事件负载首先施压于确定性 CPU 处理，而提高意图流量或用户规模会增加 CPU、内存流量、带宽和 Qwen3 token 需求。在生产 NPU 规划后，默认 `10%` Qwen3 调用场景在 `100%` 意图流量下需要 `524` 张 NPU，但满负载场景会因 CPU 超载而失稳，除非增加 CPU 容量、降低意图比例、降低 CPU 侧处理成本或引入准入控制。

## 模型边界

所有数值均为容量和敏感性分析的分析型输入参数。实际部署结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。实测部署数据可用于校准 CPU 时间、推理时延、内存流量、消息大小和排队行为。
