# 面向 Agentic 6G 核心网控制面流程的分析型资源模型

[English version](agentic_core_resource_model.md)

本文档为所提出的 Agentic 6G 核心网架构提供理论资源模型。该模型不声称来自真实部署测量，目标是在高并发控制面负载下，估计 NW-Agent 推理、工具调用和 Agent 协作带来的额外成本是否可以被控制在可调度范围内。

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

基线采用 `3,600,000 users` 和 `2 PDU sessions/user`。PDU 会话数作为场景变量保留，但不会自动乘到事件速率上；若需要体现会话数量影响，应调整每用户每小时事件频率。

| 事件 | 默认每用户每小时次数 | 推导请求速率 | 基线时延 | 基线 CPU | 基线带宽 | 可携带意图 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 初始注册 | 0.1 events/user/hour | 100 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request | 否 |
| 周期注册 | 0.1 events/user/hour | 100 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request | 否 |
| 移动性注册 | 7.0 events/user/hour | 7,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request | 否 |
| 初始 PDU 会话建立 | 1.0 events/user/hour | 1,000 requests/s | 40 ms | 2.5 CPU-ms/request | 16 KB/request | 是 |
| PDU 会话释放 | 1.0 events/user/hour | 1,000 requests/s | 25 ms | 1.5 CPU-ms/request | 10 KB/request | 否 |
| PDU 会话修改 | 2.0 events/user/hour | 2,000 requests/s | 30 ms | 2.0 CPU-ms/request | 12 KB/request | 是 |
| 业务请求 | 21.0 events/user/hour | 21,000 requests/s | 20 ms | 1.2 CPU-ms/request | 8 KB/request | 是 |
| AN 释放 | 35.0 events/user/hour | 35,000 requests/s | 15 ms | 0.8 CPU-ms/request | 6 KB/request | 否 |
| 切换 | 23.1 events/user/hour | 23,100 requests/s | 25 ms | 1.8 CPU-ms/request | 12 KB/request | 否 |
| 寻呼 | 14.0 events/user/hour | 14,000 requests/s | 12 ms | 0.6 CPU-ms/request | 4 KB/request | 否 |

基线总速率为 `104,300 requests/s`。意图仅应用于初始 PDU 会话建立、PDU 会话修改和业务请求。因此，当可携带意图比例为 `100%` 时，总意图请求为 `24,000 requests/s`，占全部请求的 `23.0%`。

## 资源假设

| 参数 | 取值 |
| --- | ---: |
| 主机 CPU 平台 | Kunpeng 920 |
| CPU 集群容量 | 256 CPU cores = 256,000 CPU-ms/s |
| RAM 容量 | 256 GB |
| 推理运行时 | vLLM Ascend 0.11.0 |
| 意图推理模型 | Qwen3-30B-A3B |
| 实验室 NPU 参考配置 | 8 x Ascend 910B4，32 GB HBM/NPU |
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

`CPU-ms` 表示一个 CPU 核被占用一毫秒。例如，`2 CPU-ms/request` 在 `100,000 requests/s` 下消耗 `200 CPU cores`。在本版本中，CPU 成本表示 Kunpeng 920 CPU 核上的主机侧预算。Qwen3-30B-A3B 能力以 tokens/s 建模，再换算为所需生产 Ascend 910B4 NPU 数量。

`8 x Ascend 910B4` 服务器被视为实验室参考环境，而不是服务 `3.6M` 用户的生产部署规模。生产 NPU 数量是模型输出。默认 Qwen3 调用比例为意图请求的 `10%`，并报告 `5%`、`10%`、`20%`、`50%` 和 `100%` 的敏感性点。

## Qwen3 Token 能力依据

可用的 `npu-smi` 快照可以确定本文模型采用的实验室形态：系统中可见 8 张 `910B4` NPU，每张卡报告 `32,768 MB` HBM 容量。具体推理栈为 vLLM Ascend 0.11.0 服务 Qwen3-30B-A3B，Kunpeng 920 CPU 处理主机侧运行时和 Agent 逻辑。这可以定义参考平台，但不应被理解为足以支撑完整生产负载。

[GPUStack 的 Qwen3-30B-A3B on Ascend 910B 基准](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/)报告，在 `128 input tokens` 和 `4 output tokens` 的短提示配置下，优化结果为 `15,040.15 total tokens/s`。[vLLM-Ascend 文档](https://docs.vllm.ai/projects/ascend/en/v0.18.0/)包含 Qwen3-30B-A3B 指引；对于 32 GB NPU 卡，模型采用 tensor parallel size `4`，因此一个 Qwen3 副本视为 `4 NPUs`。该基准来自特定软硬件栈，应作为参考点，而不是本系统实测值。

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

在 `100%` 可携带意图比例下，默认生产场景为：

```text
lambda_I = 24,000 intent requests/s
r_Q = 10%
lambda_Q = 2,400 Qwen3 requests/s
T_Q = 2,400 * 132 = 316,800 tokens/s
R_Q = ceil(316,800 / (15,040 * 0.70)) = 31 replicas
N_Q = 31 * 4 = 124 NPUs
```

这种表述避免了不现实的假设：即每个意图请求都在 8-NPU 实验室服务器上执行完整 Qwen3 生成。

## Agentic 成本假设推导

提案中的若干架构行为会产生 Agentic 额外开销：UE NAS 请求无论是否携带意图都会被转发给 NW-Agent；NW-Agent 需要根据网络条件和约束检查请求是否可满足；意图请求需要进行意图理解、任务编排、工具选择和工具调用；Planning Agent 可能与 Connection Agent 等专用 Agent 交互；TRF/ARF 为工具或 Agent 的发现与选择提供元数据。在本基本流程模型中，假设 TRF/ARF 元数据已缓存在服务 Agent 进程内，因此仓库发现不会引入每请求网络往返。

因此，下列数值是根据提案流程步骤拆解得到的工程预算，不是部署测量常数。它们应被理解为名义假设，后续可以用原型测量值替换。

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

该值只表示增量 Agentic CPU 成本。注册、PDU 会话、业务请求、AN 释放、切换和寻呼等确定性工作已经由各事件的基线 CPU 值单独表示。

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

其中，`4 ms` 固定编排项覆盖解析、可行性检查、任务计划构造、工具封装创建和本地状态更新等墙钟时间。`2 ms` CPU 侧服务项对应 `2.0 CPU-ms/request` 的意图 CPU 预算，即假设其在一个 CPU 核上串行执行。`8 ms` Qwen3 项只应用于配置的复杂意图比例。随后，模型会根据 CPU、规划后的 Qwen3 生产 NPU 和网络利用率叠加排队延迟。

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

令 `rho_I` 表示可携带意图事件中的意图比例。若事件 `i` 可携带意图，则 `e_i` 为 1，否则为 0。

```text
lambda_eligible [requests/s] = sum_i(lambda_i * e_i)
lambda_I [requests/s] = rho_I * lambda_eligible
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

该项是分析近似，不是精确电信系统仿真。平均、p95 和 p99 时延由确定性流程时延、固定 Agent 时延、CPU 排队、Qwen3 生产 NPU 排队和网络排队组成。固定实验室 NPU 池可能超载，但生产规划结果会报告为了保持 Qwen3 token 利用率不超过目标值所需的 NPU 数量。

## 分析结果

下表固定用户规模和事件频率，仅改变可携带意图事件中的意图比例。

| 可携带意图比例 | 总意图占比 | 意图 rps | Qwen3 rps | Qwen3 tokens/s | CPU 核 | CPU 利用率 | 内存流量 | Qwen3 利用率 | 所需生产 NPU | 网络带宽 | 平均时延 | p95 时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 156.8 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.1 ms | 稳定 |
| 1% | 0.2% | 240 | 24 | 3,168 | 157.2 | 61.4% | 54.262 Gbps | 21.1% | 4 | 6.802 Gbps | 22.9 ms | 95.8 ms | 稳定 |
| 5% | 1.2% | 1,200 | 120 | 15,840 | 158.9 | 62.1% | 57.702 Gbps | 52.7% | 8 | 6.894 Gbps | 23.0 ms | 98.4 ms | 稳定 |
| 10% | 2.3% | 2,400 | 240 | 31,680 | 160.9 | 62.9% | 62.003 Gbps | 52.7% | 16 | 7.010 Gbps | 23.2 ms | 101.8 ms | 稳定 |
| 20% | 4.6% | 4,800 | 480 | 63,360 | 165.0 | 64.4% | 70.605 Gbps | 60.2% | 28 | 7.240 Gbps | 23.6 ms | 109.2 ms | 稳定 |
| 50% | 11.5% | 12,000 | 1,200 | 158,400 | 177.2 | 69.2% | 96.410 Gbps | 65.8% | 64 | 7.931 Gbps | 25.0 ms | 137.3 ms | 稳定 |
| 100% | 23.0% | 24,000 | 2,400 | 316,800 | 197.6 | 77.2% | 139.418 Gbps | 67.9% | 124 | 9.083 Gbps | 28.2 ms | 219.4 ms | 退化 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。Qwen3 规划敏感性扫描位于 `outputs/agentic_qwen3_sizing_sensitivity.csv`。

在优化参考值 `15,040 tokens/s/replica` 下，`100%` 可携带意图比例的 Qwen3 生产规划如下：

| Qwen3 调用比例 | Qwen3 rps | Token 需求 | 所需副本 | 所需 NPU | 规划后 Qwen3 利用率 | 8-NPU 实验室利用率 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5% | 1,200 | 158,400 tokens/s | 16 | 64 | 65.8% | 526.6% |
| 10% | 2,400 | 316,800 tokens/s | 31 | 124 | 67.9% | 1,053.2% |
| 20% | 4,800 | 633,600 tokens/s | 61 | 244 | 69.1% | 2,106.4% |
| 50% | 12,000 | 1,584,000 tokens/s | 151 | 604 | 69.7% | 5,266.0% |
| 100% | 24,000 | 3,168,000 tokens/s | 301 | 1,204 | 70.0% | 10,531.9% |

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

## 结果解读

事件速率模型表明，高并发主要由高频业务请求、AN 释放、切换和寻呼事件驱动。如果 `10%` 的意图请求调用 Qwen3，`8 x 910B4` 实验室服务器不足以支撑默认 `3.6M` 用户生产场景。按 tensor parallel size `4` 计算，8 张 NPU 只能提供两个 Qwen3 副本，而 `100%` 可携带意图流量下生产规划需要 `31` 个副本，即 `124` 张 NPU。

主要结论是：总用户/事件负载首先施压于确定性 CPU 处理，而提高意图流量会增加 CPU、内存流量、带宽和 Qwen3 token 需求。在生产 NPU 规划后，默认 `10%` Qwen3 调用场景需要 `124` 张 NPU，系统表现为 CPU 退化但不是 Qwen3 失稳：CPU 利用率为 `77.2%`，规划后的 Qwen3 利用率为 `67.9%`，控制面带宽为 `9.083 Gbps`。

## 局限性

所有数值均为分析假设。实际结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。因此，结果应表述为理论容量分析和敏感性研究。未来原型应使用实测 CPU 时间、推理时延、内存流量、消息大小和排队行为替代合成服务时间假设。
