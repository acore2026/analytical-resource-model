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
| GPU 数量 | 20 GPUs |
| GPU 推理能力 | 2,000 intent inferences/s/GPU |
| GPU 总推理能力 | 40,000 intent inferences/s |
| VRAM 容量 | 24 GB/GPU，总计 480 GB |
| 网络容量 | 100 Gbps |
| 非意图 Agent CPU 成本 | 0.3 CPU-ms/request |
| 意图 Agent CPU 成本 | 2.0 CPU-ms/request |
| 非意图 Agent 时延 | 1 ms/request |
| 意图固定 Agent 时延 | 4 ms/request |
| 意图 GPU 推理服务时间 | 8 ms/request |
| 非意图内存流量 | 64 KB/request |
| 意图内存流量 | 512 KB/request |
| 意图额外带宽 | 12 KB/request |
| 固定推理模型内存 | 每个活跃 GPU 占用 16 GB VRAM |
| 活跃意图 VRAM | 4 MB/active intent request |

`CPU-ms` 表示一个 CPU 核被占用一毫秒。例如，`2 CPU-ms/request` 在 `100,000 requests/s` 下消耗 `200 CPU cores`。

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

GPU 利用率为：

```text
u_gpu [unitless] = lambda_I / (N_gpu * mu_gpu)
N_gpu,70 [GPUs] = ceil(lambda_I / (0.7 * mu_gpu))
```

排队延迟采用简单的 M/M/1 启发式敏感性项：

```text
D_queue [ms] = S [ms] * u / (1 - u), for u < 1
```

该项是分析近似，不是精确电信系统仿真。平均、p95 和 p99 时延由确定性流程时延、固定 Agent 时延、CPU 排队、GPU 推理排队和网络排队组成。当任一资源利用率达到或超过 100% 时，该资源被标记为不稳定。

## 分析结果

下表固定用户规模和事件频率，仅改变可携带意图事件中的意图比例。

| 可携带意图比例 | 总意图占比 | 意图 rps | CPU 核 | CPU 利用率 | 内存流量 | GPU 利用率 | 保持 <=70% 所需 GPU | 网络带宽 | 平均时延 | p95 时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 156.8 | 61.3% | 53.402 Gbps | 0.0% | 0 | 6.779 Gbps | 22.9 ms | 95.1 ms | 稳定 |
| 1% | 0.2% | 240 | 157.2 | 61.4% | 54.262 Gbps | 0.6% | 1 | 6.802 Gbps | 22.9 ms | 95.8 ms | 稳定 |
| 5% | 1.2% | 1,200 | 158.9 | 62.1% | 57.702 Gbps | 3.0% | 1 | 6.894 Gbps | 23.1 ms | 98.7 ms | 稳定 |
| 10% | 2.3% | 2,400 | 160.9 | 62.9% | 62.003 Gbps | 6.0% | 2 | 7.010 Gbps | 23.4 ms | 102.5 ms | 稳定 |
| 20% | 4.6% | 4,800 | 165.0 | 64.4% | 70.605 Gbps | 12.0% | 4 | 7.240 Gbps | 23.9 ms | 110.8 ms | 稳定 |
| 50% | 11.5% | 12,000 | 177.2 | 69.2% | 96.410 Gbps | 30.0% | 9 | 7.931 Gbps | 25.8 ms | 141.9 ms | 稳定 |
| 100% | 23.0% | 24,000 | 197.6 | 77.2% | 139.418 Gbps | 60.0% | 18 | 9.083 Gbps | 29.9 ms | 232.3 ms | 退化 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

## 结果解读

事件速率模型表明，高并发主要由高频业务请求、AN 释放、切换和寻呼事件驱动。在配置 256 核 CPU 集群和 20 GPU 推理池后，系统在完整意图比例扫描范围内保持稳定。在 `100%` 可携带意图流量下，模型进入 CPU 退化区但不失稳：CPU 利用率为 `77.2%`，GPU 利用率为 `60.0%`，控制面带宽为 `9.083 Gbps`。

主要结论是：总用户/事件负载首先施压于确定性 CPU 处理，而提高意图比例主要增加 GPU 利用率、VRAM 使用、内存流量和尾时延。当意图推理被选择性应用、元数据查询被缓存、非意图路径保持轻量，并且 GPU 容量按可携带意图到达率扩展时，该架构在高并发下是可行的。

## 局限性

所有数值均为分析假设。实际结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。因此，结果应表述为理论容量分析和敏感性研究。未来原型应使用实测 CPU 时间、推理时延、内存流量、消息大小和排队行为替代合成服务时间假设。
