# 1. 面向 Agentic 6G 核心网控制面流程的分析型资源模型

[English version](agentic_core_resource_model.md)

本文定义所提 Agentic 6G 核心网架构的分析型资源模型，用于估算高并发控制面负载下的确定性核心网处理、NW-Agent 开销、意图处理、工具调用、Agent 协作以及 Qwen3-30B-A3B 推理容量。

模型不包含漫游、AF 发起意图和 SRF 路由成本。本文模型是分析型容量模型，不是部署实测结果。

## 1.1 负载模型

令 $N_{\mathrm{user}}$ 表示注册用户数， $f_i$ 表示单个用户每小时触发事件 $i$ 的次数。

单类事件的请求速率由用户数乘以单用户每小时事件频率得到，再从每小时换算为每秒。

$$
\lambda_i = \frac{N_{\mathrm{user}} \cdot f_i}{3600}
$$

其中： $\lambda_i$ 表示事件 $i$ 的请求速率，单位为 requests/s； $N_{\mathrm{user}}$ 表示用户数； $f_i$ 表示单用户每小时事件频率，单位为 events/user/hour； $3600$ 用于将一小时换算为秒。

总控制面请求速率是所有建模流程请求速率的总和。

$$
\lambda_{\mathrm{total}} = \sum_i \lambda_i
$$

其中： $\lambda_{\mathrm{total}}$ 表示所有建模流程的总请求速率； $\sum_i$ 表示对负载表中的所有事件类型求和； $\lambda_i$ 表示每类事件的请求速率。

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

## 1.2 资源参数

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
| 非线性开销模型 | 基于 USL 的竞争与协调开销曲线 |
| 非意图 Agent CPU 成本 | 0.3 CPU-ms/request |
| 意图 Agent CPU 成本 | 2.0 CPU-ms/request |
| 非意图 Agent 时延 | 1 ms/request |
| 意图固定 Agent 时延 | 4 ms/request |
| 复杂意图 Qwen3 服务时间 | 8 ms/request |
| 意图额外带宽 | 12 KB/request |

$CPU\text{-}ms$ 表示一个 CPU 核被占用一毫秒。例如， $2\ CPU\text{-}ms/request$ 在 $100,000$ requests/s 下消耗 $200$ CPU cores。

## 1.3 Qwen3 能力参考

[GPUStack 的 Qwen3-30B-A3B on Ascend 910B 基准](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/) 报告，在 `128 input tokens` 和 `4 output tokens` 配置下结果为 `15,040.15 total tokens/s`。[vLLM-Ascend 文档](https://docs.vllm.ai/projects/ascend/en/v0.18.0/) 包含 Qwen3-30B-A3B 指引；对于 32 GB NPU 卡，模型采用 tensor parallel size $TP_Q=4$ 。

意图请求速率等于总请求速率乘以意图比例。

$$
\lambda_I = \rho_I \cdot \lambda_{\mathrm{total}}
$$

其中： $\lambda_I$ 表示携带意图的请求速率； $\rho_I$ 表示全部请求中的意图比例； $\lambda_{\mathrm{total}}$ 表示总控制面请求速率。

只有配置比例的意图请求会调用 Qwen3，该比例记为 $r_Q$ 。

$$
\lambda_Q = \lambda_I \cdot r_Q
$$

其中： $\lambda_Q$ 表示 Qwen3 请求速率； $\lambda_I$ 表示携带意图的请求速率； $r_Q$ 表示调用 Qwen3 的意图请求比例。

原始 Qwen3 token 需求等于 Qwen3 请求速率乘以输入和输出 token 配置之和。

$$
T_Q = \lambda_Q \cdot \left(L_{\mathrm{in}} + L_{\mathrm{out}}\right)
$$

其中： $T_Q$ 表示原始 Qwen3 token 需求，单位为 tokens/s； $\lambda_Q$ 表示 Qwen3 请求速率； $L_{\mathrm{in}}$ 表示每请求输入 token 数； $L_{\mathrm{out}}$ 表示每请求输出 token 数。

用于 Qwen3 服务的 NPU 集群包含 $N_Q=128$ 张 NPU。可用 Qwen3 副本数和 token 容量为：

可用 Qwen3 服务副本数受张量并行规模限制，因为一个副本需要占用 $TP_Q$ 张 NPU。

$$
R_{Q,\mathrm{avail}} = \left\lfloor \frac{N_Q}{TP_Q} \right\rfloor
$$

其中： $R_{Q,\mathrm{avail}}$ 表示可用 Qwen3 服务副本数； $N_Q$ 表示配置的 NPU 数； $TP_Q$ 表示张量并行规模，单位为 NPUs/replica； $\lfloor\cdot\rfloor$ 表示向下取整到完整副本数。

总 Qwen3 token 能力等于可用副本数乘以单副本 token 能力 $\mu_Q$ 。

$$
C_Q = R_{Q,\mathrm{avail}} \cdot \mu_Q
$$

其中： $C_Q$ 表示 Qwen3 总服务能力，单位为 tokens/s； $R_{Q,\mathrm{avail}}$ 表示可用副本数； $\mu_Q$ 表示单个 Qwen3 副本的 token 能力，单位为 tokens/s/replica。

## 1.4 Agentic 成本模型

对于非意图请求，增量 Agentic CPU 成本为 $0.30\ CPU\text{-}ms/request$ 。对于携带意图的请求，CPU 侧 Agent 工作量为 $2.00\ CPU\text{-}ms/request$ ，不包含 Qwen3 推理。

在本文中，“增量”表示 NW-Agent 层在传统核心网确定性流程 CPU 成本之外新增的 CPU 工作量。提案说明 NW-Agent 处理携带意图和不携带意图的请求，并且不携带意图的 legacy NAS 消息也可以路由到对应 Agent。因此，非意图请求虽然不需要意图理解、复杂任务规划或 Qwen3 推理，仍然会经过轻量级 Agent 处理路径。

对于流程类型 $i$ ，非意图请求的 CPU 成本建模为：

$$
C_{\mathrm{nonintent,total},i} = C_{\mathrm{base},i} + C_{\mathrm{agent,nonintent}}
$$

其中： $C_{\mathrm{nonintent,total},i}$ 表示类型 $i$ 的非意图请求总 CPU 成本； $C_{\mathrm{base},i}$ 表示同一流程的确定性核心网 CPU 成本； $C_{\mathrm{agent,nonintent}}$ 表示轻量级 NW-Agent 额外开销。

轻量级 NW-Agent 额外开销包括请求归一化、识别请求不包含意图容器、请求类型分类、绑定到对应的服务 Agent 或工具路径、基础策略/上下文检查、确定性流程触发准备，以及 Agent 侧状态和追踪信息更新。该开销不包含 Qwen3/NPU 推理、自然语言意图理解、复杂任务拆解或多 Agent 协作。

对于不调用 Qwen3、只使用轻量 Agent 逻辑处理的意图请求，模型将 Agent 侧时延表示为固定意图 Agent 时延加上请求路径中的 CPU 侧 Agent 工作量。

$$
D_{\mathrm{intent,light}} = 4\ \mathrm{ms} + 2\ \mathrm{ms}
$$

其中： $D_{\mathrm{intent,light}}$ 表示轻量意图处理带来的时延； $4\ \mathrm{ms}$ 表示固定意图 Agent 时延； $2\ \mathrm{ms}$ 表示请求路径中的 CPU 侧 Agent 工作量。

对于调用 Qwen3 的意图请求，Qwen3 服务时间建模为 $8\ \mathrm{ms/request}$ 。主模型不包含排队时延，以便让分析更容易解释。当利用率升高时，模型通过退化、高风险或不稳定状态表示容量风险，而不是额外计算等待时间。

$$
D_{Q,\mathrm{service}} = 8\ \mathrm{ms/request}
$$

其中： $D_{Q,\mathrm{service}}$ 表示每请求 Qwen3 推理服务时间； $8\ \mathrm{ms/request}$ 是复杂意图请求使用的分析型服务时间假设。

携带意图请求额外增加 $12\ \mathrm{KB/request}$ 控制面元数据，用于意图容器、任务元数据、工具调用封装以及 Agent 间状态/追踪元数据。

## 1.5 基于 USL 的非线性开销模型

模型先计算线性需求，再将对应的 CPU、网络或 Qwen3 服务负载输入基于 Universal Scalability Law（USL）的非线性开销函数。USL 是计算机系统中常用的可扩展性模型，它将扩展损失拆分为两类：资源竞争，以及协调/一致性开销。该结构适合本文架构，因为 Agentic 控制面处理会引入共享状态访问、调度、工具封装协调和多副本推理服务开销。

经典 USL 吞吐形式如下：

$$
C(N)=\frac{N}{1+\alpha(N-1)+\beta N(N-1)}
$$

其中： $C(N)$ 表示 $N$ 个并行 worker 下的相对系统吞吐； $\alpha$ 表示竞争； $\beta$ 表示一致性或协调成本。

本文使用相同思想的归一化需求侧表达：

$$
M_{\mathrm{USL}}(u)=1+\sigma u+\kappa u^2
$$

$$
F_{\mathrm{USL}}(u)=u \cdot M_{\mathrm{USL}}(u)
$$

其中： $u$ 表示加入非线性开销前的原始线性利用率； $M_{\mathrm{USL}}(u)$ 表示开销倍率； $F_{\mathrm{USL}}(u)$ 表示加入非线性开销后的有效利用率； $\sigma$ 表示竞争系数； $\kappa$ 表示协调/一致性系数。

默认系数如下：

$$
\sigma=0.05,\quad \kappa=0.10
$$

这些系数是分析型敏感性参数，不是部署实测值。当 $u=1.0$ 时，开销倍率为 $1.15$ ，表示线性模型中的满载需求在考虑竞争和协调开销后被视为高出 $15\%$ 的有效需求。具体取值应在系统实现后，使用 CPU profiling、NPU 服务吞吐和网络遥测数据进行校准。

### 1.5.1 为什么会出现非线性开销

非线性函数用于表示高并发下有效服务效率下降，而不是表示单个请求的语义工作量发生变化。每增加一单位负载，系统还会额外消耗竞争、调度、内存搬移、运行时协调和一致性相关容量。

| 资源区域 | 非线性因素 | 模型中的含义 |
| --- | --- | --- |
| CPU | 调度开销、锁竞争、缓存未命中、内存访问延迟、序列化/反序列化和状态存储压力。 | CPU 负载升高时，有效 CPU-ms/request 上升。 |
| 用于 Qwen3 的 NPU 服务 | 批处理效率下降、请求路由、副本调度、运行时协调、跨副本开销，以及 KV/cache 内存压力。 | 将原始 token 需求转换为有效 token 需求，再计算配置 NPU 集群的利用率。 |
| 网络 | 缓冲、拥塞控制、重传风险和额外控制面协调。 | 网络利用率升高时，有效带宽负载上升。 |
| 时延 | 直接流程时延、固定 Agent 时延、CPU 侧意图工作量和可选 Qwen3 服务时间。 | 主时延估算不包含排队；高利用率通过容量风险状态表示。 |

KV/cache 内存压力对 Qwen3 服务尤其重要。在高并发场景下，活跃请求会更长时间占用 key-value cache、运行时缓冲区和调度状态。这会降低新请求可用的有效吞吐能力，即使每个请求的原始 token 配置没有变化。因此，模型并不表示 Qwen3 为单个请求生成了更多语义 token；模型使用有效 token 需求来表示模型服务系统周边的额外开销。

本文的非线性假设是基于上述服务系统效应形成的分析模型。USL 提供竞争加协调的通用结构。LLM 服务相关参考文献支持将该类开销项应用到 Qwen3/NPU 服务，因为批处理、调度和 KV/cache 内存压力会在并发场景下降低有效服务效率。

以下小节说明模型如何将 $F_{\mathrm{USL}}(\cdot)$ 分别应用到 CPU、Qwen3/NPU 和网络利用率。时延随后按不含排队的直接处理时间计算。

### 1.5.2 CPU 利用率

CPU 利用率包含确定性核心网流程工作量和 CPU 侧 Agent 工作量。平均线性 CPU 成本由按流量加权的确定性核心网基础成本和 Agentic CPU 成本组成。意图占比 $s_I$ 决定有多少流量使用意图 Agent CPU 工作量，以及有多少流量使用非意图 Agent CPU 工作量。

$$
C_{\mathrm{cpu,linear}} = \sum_i \frac{\lambda_i}{\lambda_{\mathrm{total}}} C_{\mathrm{base},i} + s_I C_{\mathrm{agent,intent}} + (1-s_I) C_{\mathrm{agent,nonintent}}
$$

其中： $C_{\mathrm{cpu,linear}}$ 表示加入非线性开销前的平均 CPU 成本； $\lambda_i/\lambda_{\mathrm{total}}$ 表示事件 $i$ 的流量占比； $C_{\mathrm{base},i}$ 表示事件 $i$ 的确定性核心网 CPU 成本； $s_I$ 表示总意图占比； $C_{\mathrm{agent,intent}}$ 表示意图 Agent CPU 成本； $C_{\mathrm{agent,nonintent}}$ 表示非意图 Agent CPU 成本。

然后，将原始 CPU 利用率输入 $F_{\mathrm{USL}}(\cdot)$ ，用于表示高负载下的调度、竞争和内存压力开销。

$$
u_{\mathrm{cpu}} = F_{\mathrm{USL}}(u_{\mathrm{cpu,linear}})
$$

其中： $u_{\mathrm{cpu}}$ 表示加入非线性开销后的有效 CPU 利用率； $u_{\mathrm{cpu,linear}}$ 表示加入开销前的原始 CPU 利用率； $F_{\mathrm{USL}}(\cdot)$ 表示基于 USL 的开销函数。

有效 CPU 需求由 CPU 容量乘以有效 CPU 利用率得到。

$$
D_{\mathrm{cpu}} = C_{\mathrm{cpu,capacity}} \cdot u_{\mathrm{cpu}}
$$

其中： $D_{\mathrm{cpu}}$ 表示加入非线性开销后的有效 CPU 需求，单位为 CPU cores； $C_{\mathrm{cpu,capacity}}$ 表示总 CPU 容量，单位为 CPU cores； $u_{\mathrm{cpu}}$ 表示有效 CPU 利用率。

### 1.5.3 Qwen3/NPU 利用率

NPU 利用率由调用 Qwen3 的那部分意图请求驱动。这些请求会先转换为 token 需求，然后与配置的 Qwen3 服务能力进行比较。

$$
u_{Q,\mathrm{linear}} = \frac{T_Q}{C_Q}
$$

其中： $u_{Q,\mathrm{linear}}$ 表示加入非线性开销前的原始 Qwen3/NPU 利用率； $T_Q$ 表示原始 Qwen3 token 需求； $C_Q$ 表示配置的 Qwen3 token 能力。

原始 NPU 利用率同样输入 $F_{\mathrm{USL}}(\cdot)$ ，用于表示批处理效率下降、运行时调度和 KV/cache 内存压力。

$$
u_Q = F_{\mathrm{USL}}(u_{Q,\mathrm{linear}})
$$

其中： $u_Q$ 表示加入非线性开销后的有效 Qwen3/NPU 利用率； $u_{Q,\mathrm{linear}}$ 表示原始 Qwen3/NPU 利用率； $F_{\mathrm{USL}}(\cdot)$ 表示基于 USL 的开销函数。

有效 Qwen3 token 需求表示：在考虑非线性开销后，会产生相同有效 NPU 利用率的 token 需求。

$$
T_{Q,\mathrm{eff}} = C_Q \cdot u_Q
$$

其中： $T_{Q,\mathrm{eff}}$ 表示加入非线性开销后的有效 Qwen3 token 需求，单位为 tokens/s； $C_Q$ 表示配置的 Qwen3 token 能力； $u_Q$ 表示有效 Qwen3/NPU 利用率。

### 1.5.4 网络利用率

网络利用率包含基础控制面消息流量，以及意图元数据、工具调用封装和 Agent 间协作消息带来的额外流量。网络利用率也使用相同的非线性修正，使缓冲、拥塞控制和协调开销反映到有效带宽负载中。

$$
u_{\mathrm{net}} = F_{\mathrm{USL}}(u_{\mathrm{net,linear}})
$$

其中： $u_{\mathrm{net}}$ 表示加入非线性开销后的有效网络利用率； $u_{\mathrm{net,linear}}$ 表示加入开销前的原始网络利用率； $F_{\mathrm{USL}}(\cdot)$ 表示基于 USL 的开销函数。

### 1.5.5 不含排队的时延

主时延模型有意不包含排队时延。这样可以让论文模型聚焦于单请求处理成本和资源容量。如果利用率较高，结果应理解为容量风险，而不是精确的时延预测。

$$
D_{\mathrm{nonintent},i} = D_{\mathrm{base},i} + D_{\mathrm{agent,nonintent}}
$$

其中： $D_{\mathrm{nonintent},i}$ 表示类型 $i$ 的非意图请求不含排队时延； $D_{\mathrm{base},i}$ 表示基础确定性流程时延； $D_{\mathrm{agent,nonintent}}$ 表示轻量级非意图 Agent 时延。

对于意图请求，不含排队时延由固定 Agent 时延、CPU 侧意图工作量和配置比例的 Qwen3 服务时间组成：

$$
D_{\mathrm{intent},i} = D_{\mathrm{base},i} + D_{\mathrm{agent,intent}} + C_{\mathrm{agent,intent}} + r_Q D_{Q,\mathrm{service}}
$$

其中： $D_{\mathrm{intent},i}$ 表示类型 $i$ 的意图请求不含排队时延； $D_{\mathrm{agent,intent}}$ 表示固定意图 Agent 时延； $C_{\mathrm{agent,intent}}$ 表示按请求路径毫秒数表达的 CPU 侧意图 Agent 工作量； $r_Q$ 表示 Qwen3 调用比例； $D_{Q,\mathrm{service}}$ 表示 Qwen3 服务时间。排队时延不属于主模型。

## 1.6 分析结果

下表固定用户规模、事件频率和 Qwen3 集群规模，仅以固定 $10\%$ 步长改变全部请求中携带意图的比例。可见资源利用率结果使用基于 USL 的非线性开销模型。时延列是不含排队的处理时间估算。意图比例扫描图使用 $1\%$ 采样展示细节。

| 意图比例 | 总意图占比 | 意图 rps | Qwen3 rps | 有效 Qwen3 tokens/s | CPU 核 | CPU 利用率 | 内存流量 | NPU 利用率 | 网络带宽 | 平均时延 | 状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0% | 0.0% | 0 | 0 | 0 | 167.5 | 65.4% | 53.402 Gbps | 0.0% | 6.805 Gbps | 20.5 ms | 稳定 |
| 10% | 10.0% | 10,430 | 1,043 | 140,772 | 188.6 | 73.7% | 90.783 Gbps | 29.2% | 7.815 Gbps | 21.1 ms | 退化 |
| 20% | 20.0% | 20,860 | 2,086 | 292,242 | 210.4 | 82.2% | 128.164 Gbps | 60.7% | 8.827 Gbps | 21.6 ms | 退化 |
| 30% | 30.0% | 31,290 | 3,129 | 461,170 | 232.8 | 90.9% | 165.545 Gbps | 95.8% | 9.840 Gbps | 22.2 ms | 高风险 |
| 40% | 40.0% | 41,720 | 4,172 | 654,315 | 255.9 | 100.0% | 202.926 Gbps | 136.0% | 10.855 Gbps | 22.8 ms | 不稳定 |
| 50% | 50.0% | 52,150 | 5,215 | 878,438 | 279.8 | 109.3% | 240.307 Gbps | 182.5% | 11.871 Gbps | 23.4 ms | 不稳定 |
| 60% | 60.0% | 62,580 | 6,258 | 1,140,298 | 304.6 | 119.0% | 277.688 Gbps | 236.9% | 12.890 Gbps | 24.0 ms | 不稳定 |
| 70% | 70.0% | 73,010 | 7,301 | 1,446,655 | 330.2 | 129.0% | 315.069 Gbps | 300.6% | 13.909 Gbps | 24.5 ms | 不稳定 |
| 80% | 80.0% | 83,440 | 8,344 | 1,804,268 | 356.7 | 139.4% | 352.451 Gbps | 374.9% | 14.931 Gbps | 25.1 ms | 不稳定 |
| 90% | 90.0% | 93,870 | 9,387 | 2,219,898 | 384.3 | 150.1% | 389.832 Gbps | 461.2% | 15.955 Gbps | 25.7 ms | 不稳定 |
| 100% | 100.0% | 104,300 | 10,430 | 2,700,304 | 412.9 | 161.3% | 427.213 Gbps | 561.1% | 16.980 Gbps | 26.3 ms | 不稳定 |

生成结果位于 `outputs/agentic_resource_results.csv`。用户规模敏感性扫描位于 `outputs/agentic_resource_sensitivity.csv`。Qwen3 敏感性扫描位于 `outputs/agentic_qwen3_sizing_sensitivity.csv`。

![](outputs/agentic_resource_utilization.png)
![](outputs/agentic_latency.png)

下列用户规模敏感性图固定意图比例为 $20\%$ ，并将用户规模从 $0.5$ million 扫描到 $4.0$ million。

![](outputs/agentic_user_count_sensitivity.png)

## 1.7 结果解读

在配置 $128$ 张 NPU 用于 Qwen3 服务且 Qwen3 调用比例为 $10\%$ 的情况下，NPU 利用率在 $10\%$ 意图比例时为 $29.2\%$ ，在 $20\%$ 意图比例时为 $60.7\%$ ，在 $30\%$ 意图比例时为 $95.8\%$ 。当意图比例达到 $40\%$ 时，NPU 利用率超过 $100\%$ ，表示固定 NPU 集群已经过载。更高意图比例需要增加 NPU 容量、降低 Qwen3 调用比例、缩短 token 配置、提升服务吞吐或引入准入控制。

## 1.8 模型边界

所有数值均为容量和敏感性分析的分析型输入参数。实际部署结果取决于模型大小、批处理行为、推理硬件、NF 实现、数据库访问时延、消息编码、工具粒度和运营商策略逻辑。实测部署数据可用于校准 CPU 时间、推理时延、内存流量、消息大小以及未来可能加入的排队扩展。主模型有意不包含排队时延。

## 1.9 参考文献

1. [A General Theory of Computational Scalability Based on Rational Functions](https://arxiv.org/abs/0808.1431)。
   该论文定义 Universal Scalability Law，将系统容量建模为包含竞争项和一致性项的有理函数。本文使用 USL 作为非线性开销倍率的结构依据，但系数仍作为分析型敏感性参数。

2. [Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities](https://www.cs.cmu.edu/~18742/papers/Amdahl1967.pdf)。
   该经典论文说明共享串行工作会限制可扩展容量。本文将其作为背景依据，用于说明协调和共享控制面工作不应被视为免费的并行能力。

3. [Sarathi-Serve: Tackling User-Generated Request Variability in LLM Inference Serving](https://arxiv.org/abs/2403.02310)，OSDI 2024 版本见 [PDF](https://www.usenix.org/system/files/osdi24-agrawal.pdf)。
   该论文说明 LLM 服务性能受 prefill 和 decode 阶段之间的调度与批处理影响。本文使用该证据支撑对 Qwen3 服务应用非线性容量开销项；排队时延本身不属于主时延计算。

4. [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)。
   该论文说明 KV-cache 内存管理是 LLM 服务的关键问题。KV cache 规模大且动态变化；低效内存管理会降低批处理效率和服务吞吐。因此，本文将原始 Qwen3 token 需求转换为考虑 KV/cache 压力后的有效 token 需求。

5. [Online Scheduling for LLM Inference with KV Cache Constraints](https://www.microsoft.com/en-us/research/publication/online-scheduling-for-llm-inference-with-kv-cache-constraints/) 和 [arXiv:2502.07115](https://arxiv.org/abs/2502.07115)。
   该工作将 KV-cache 容量作为 LLM 推理调度约束，说明并发场景下利用率和内存压力是耦合的。因此，NPU 服务需求不应只用原始 tokens 除以峰值 token 能力来表示。

6. [GPUStack Qwen3-30B-A3B on Ascend 910B benchmark](https://docs.gpustack.ai/2.0/performance-lab/qwen3-30b-a3b/910b/)。
   该基准提供本文使用的参考 token 能力：Qwen3-30B-A3B 在 `128 input tokens` 和 `4 output tokens` 配置下达到 `15,040.15 total tokens/s`。

7. [vLLM Ascend documentation](https://docs.vllm.ai/projects/ascend/en/v0.18.0/)。
   该文档提供在 Ascend 上通过 vLLM Ascend 服务 Qwen3 系列模型的实现背景，支撑本文对配置 NPU 集群和张量并行服务的假设。
