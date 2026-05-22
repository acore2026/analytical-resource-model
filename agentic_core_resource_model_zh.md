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
| CPU 集群容量 | 256 CPU cores = 256,000 CPU-ms/s |
| RAM 容量 | 256 GB |
| NPU 数量 | 8 NPUs |
| NPU 推理能力 | 4,300 intent inferences/s/NPU |
| NPU 总推理能力 | 34,400 intent inferences/s |
| HBM 容量 | 32 GB/NPU，总计 256 GB |
| 网络容量 | 100 Gbps |
| 非意图 Agent CPU 成本 | 0.3 CPU-ms/request |
| 意图 Agent CPU 成本 | 2.0 CPU-ms/request |
| 非意图 Agent 时延 | 1 ms/request |
| 意图固定 Agent 时延 | 4 ms/request |
| 意图 NPU 推理服务时间 | 8 ms/request |
| 非意图内存流量 | 64 KB/request |
| 意图内存流量 | 512 KB/request |
| 意图额外带宽 | 12 KB/request |
| 固定推理模型内存 | 每个活跃 NPU 占用 16 GB HBM |
| 活跃意图 HBM | 4 MB/active intent request |

`CPU-ms` 表示一个 CPU 核被占用一毫秒。例如，`2 CPU-ms/request` 在 `100,000 requests/s` 下消耗 `200 CPU cores`。

NPU 参考配置基于可用的 `8 x Ascend 910B4` 部署，每张 NPU 具有 `32 GB HBM`。`4,300 intent inferences/s/NPU` 不是 910B4 的实测结果，而是该工作负载下的分析阈值：在模型峰值意图速率 `24,000 requests/s` 下，8 张 NPU 若要保持不超过 70% 利用率，每张 NPU 需要约 `24,000 / (8 * 0.70) = 4,286 intent inferences/s/NPU`。因此，模型将单 NPU 推理能力作为可调假设，并报告敏感性扫描。

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

时延被拆分为确定性流程时延、CPU 排队、固定 Agent 编排时延和 NPU 推理时延。意图路径采用如下排队前服务时间预算：

```text
Intent agent latency [ms/request] =
  4 ms fixed orchestration
+ 2 ms CPU-side agent service
+ 8 ms NPU inference service
= 14 ms/request before queueing
```

其中，`4 ms` 固定编排项覆盖解析、可行性检查、任务计划构造、工具封装创建和本地状态更新等墙钟时间。`2 ms` CPU 侧服务项对应 `2.0 CPU-ms/request` 的意图 CPU 预算，即假设其在一个 CPU 核上串行执行。`8 ms` NPU 项表示用于意图理解和计划生成的名义模型推理服务时间。随后，模型会根据 CPU/NPU/网络利用率叠加排队延迟。

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

NPU 利用率为：

```text
u_npu [unitless] = lambda_I / (N_npu * mu_npu)
N_npu,70 [NPUs] = ceil(lambda_I / (0.7 * mu_npu))
```

排队延迟采用简单的 M/M/1 启发式敏感性项：

```text
D_queue [ms] = S [ms] * u / (1 - u), for u < 1
```

该项是分析近似，不是精确电信系统仿真。平均、p95 和 p99 时延由确定性流程时延、固定 Agent 时延、CPU 排队、NPU 推理排队和网络排队组成。当任一资源利用率达到或超过 100% 时，该资源被标记为不稳定。

## 分析结果

下表固定用户规模和事件频率，仅改变可携带意图事件中的意图比例。

| 可携带意图比例 | 总意图占比 | 意图 rps | CPU 核 | CPU 利用率 | 内存流量 | NPU 利用率 | 保持 <=70% 所需 NPU | 网络带宽 | 平均时延 | p95 时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 156.8 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.1 ms | 稳定 |
| 1% | 0.2% | 240 | 157.2 | 61.4% | 54.262 Gbps | 0.7% | 1 | 6.802 Gbps | 22.9 ms | 95.8 ms | 稳定 |
| 5% | 1.2% | 1,200 | 158.9 | 62.1% | 57.702 Gbps | 3.5% | 1 | 6.894 Gbps | 23.1 ms | 98.7 ms | 稳定 |
| 10% | 2.3% | 2,400 | 160.9 | 62.9% | 62.003 Gbps | 7.0% | 1 | 7.010 Gbps | 23.4 ms | 102.5 ms | 稳定 |
| 20% | 4.6% | 4,800 | 165.0 | 64.4% | 70.605 Gbps | 14.0% | 2 | 7.240 Gbps | 23.9 ms | 110.8 ms | 稳定 |
| 50% | 11.5% | 12,000 | 177.2 | 69.2% | 96.410 Gbps | 34.9% | 4 | 7.931 Gbps | 25.8 ms | 141.9 ms | 稳定 |
| 100% | 23.0% | 24,000 | 197.6 | 77.2% | 139.418 Gbps | 69.8% | 8 | 9.083 Gbps | 29.9 ms | 232.4 ms | 退化 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。NPU 能力敏感性扫描位于 `outputs/agentic_npu_capacity_sensitivity.csv`。

`100%` 可携带意图比例下的 NPU 能力敏感性如下：

| 单 NPU 能力 | NPU 总能力 | NPU 利用率 | 保持 <=70% 所需 NPU | 平均时延 | 系统状态 |
| ---: | ---: | ---: | ---: | ---: | --- |
| 2,000 intent/s/NPU | 16,000 intent/s | 150.0% | 18 | 不稳定 | 不稳定 |
| 3,000 intent/s/NPU | 24,000 intent/s | 100.0% | 12 | 不稳定 | 不稳定 |
| 4,300 intent/s/NPU | 34,400 intent/s | 69.8% | 8 | 29.9 ms | 退化 |
| 5,000 intent/s/NPU | 40,000 intent/s | 60.0% | 7 | 29.9 ms | 退化 |
| 8,000 intent/s/NPU | 64,000 intent/s | 37.5% | 5 | 29.9 ms | 退化 |

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

## 结果解读

事件速率模型表明，高并发主要由高频业务请求、AN 释放、切换和寻呼事件驱动。在配置 256 核 CPU 集群和 `8 x 910B4` NPU 推理池后，若每张 NPU 可以达到假设的 `4,300 intent inferences/s/NPU`，系统在完整意图比例扫描范围内保持稳定。在 `100%` 可携带意图流量下，模型进入 CPU 退化区但不失稳：CPU 利用率为 `77.2%`，NPU 利用率为 `69.8%`，控制面带宽为 `9.083 Gbps`。

主要结论是：总用户/事件负载首先施压于确定性 CPU 处理，而提高意图比例主要增加 NPU 利用率、HBM 使用、内存流量和尾时延。对于本模型峰值意图负载，8 张 NPU 是否足够取决于所选模型、提示长度、批处理策略和并发目标下的实测单 NPU 服务速率是否达到约 `4.3k intent inferences/s/NPU`。若实测吞吐量接近 `2k` 或 `3k intent inferences/s/NPU`，高意图比例下 NPU 推理会失稳，需要更多 NPU、更小模型、更强批处理、缓存或准入控制。

## 局限性

所有数值均为分析假设。实际结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。因此，结果应表述为理论容量分析和敏感性研究。未来原型应使用实测 CPU 时间、推理时延、内存流量、消息大小和排队行为替代合成服务时间假设。
