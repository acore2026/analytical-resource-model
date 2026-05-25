# Agentic Core 资源模型简明说明

[English version](agentic_core_easy_explanation.md)

本文用更简单的方式解释资源模型的主要计算逻辑。

## 一句话

我们先从用户数计算请求量，再为意图请求增加 Agent 成本；对于复杂意图请求，将其换算成 Qwen3 token，叠加高负载非线性开销，最后计算分配给 Qwen3 服务的 NPU 集群利用率。

## 第一步：从用户数开始

$$
\mathrm{request\ rate} = \frac{\mathrm{users} \cdot \mathrm{events/user/hour}}{3600}
$$

基线有 $3.6$ 百万用户，产生 $104,300$ total requests/s。

## 第二步：找出意图请求

任意请求类型都可能携带意图。当意图比例为 $100\%$ 时：

$$
\lambda_I = 104,300\ \mathrm{requests/s}
$$

## 第三步：增加 Agent 成本

$$
\mathrm{intent\ request} = \mathrm{normal\ core\ work} + \mathrm{Agent\ parsing/planning/tool\ cost}
$$

这会影响 CPU、内存、带宽和时延。

## 第四步：把 Qwen3 请求换算成 Token

默认情况下， $10\%$ 的意图请求调用 Qwen3：

$$
\lambda_Q = 104,300 \cdot 10\% = 10,430\ \mathrm{requests/s}
$$

token 配置为：

$$
L_Q = 128 + 4 = 132\ \mathrm{tokens/request}
$$

原始 token 需求为：

$$
T_Q = 10,430 \cdot 132 = 1,376,760\ \mathrm{tokens/s}
$$

## 第五步：加入连续式高负载非线性开销

模型使用容易解释的运行分档，并让更高分档具有更高边际斜率：

| 负载区间 | 状态 | 边际斜率 |
| ---: | --- | ---: |
| $0\% \le u < 60\%$ | 正常 | $1.00$ |
| $60\% \le u < 80\%$ | 繁忙 | $1.15$ |
| $80\% \le u < 90\%$ | 高负载 | $1.35$ |
| $90\% \le u$ | 临界 | $1.60$ |

对于默认满意图 Qwen3 场景，且用于推理的 NPU 集群固定为 128 张 NPU：

$$
T_{Q,\mathrm{eff}} = 1,974,208\ \mathrm{tokens/s}
$$

## 第六步：计算 NPU 利用率

用于 Qwen3 服务的 NPU 集群为：

$$
N_Q = 128\ \mathrm{NPUs}, \quad TP_Q = 4\ \mathrm{NPUs/replica}
$$

可用副本数和 token 容量为：

$$
R_{Q,\mathrm{avail}} = \left\lfloor \frac{128}{4} \right\rfloor = 32
$$

$$
C_Q = 32 \cdot 15,040 = 481,280\ \mathrm{tokens/s}
$$

NPU 利用率为：

$$
u_Q = \frac{1,974,208}{481,280} = 410.2\%
$$

## 核心结论

在基线生产场景下：

- 用户数为 $3.6$ million。
- 当意图比例为 $100\%$ 时，意图请求速率为 $104,300$ requests/s。
- $10\%$ 的意图请求调用 Qwen3。
- 用于 Qwen3 服务的 NPU 集群为 $128$ 张 NPU。
- 当意图比例为 $20\%$ 时，NPU 利用率为 $57.2\%$。
- 当意图比例为 $30\%$ 时，NPU 利用率为 $90.9\%$，说明配置的 NPU 集群处于高风险状态但尚未过载。
- 当意图比例为 $40\%$ 时，NPU 利用率为 $135.6\%$，说明配置的 NPU 集群已经过载。

这就是本分析的核心逻辑。
