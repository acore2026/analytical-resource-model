# Agentic Core 资源模型简明说明

[English version](agentic_core_easy_explanation.md)

本文用更简单的方式解释资源模型的主要计算逻辑。

## 一句话

我们先从用户数计算请求量，再为意图请求增加 Agent 成本；对于复杂意图请求，将其换算成 Qwen3 token，叠加高负载非线性开销，最后计算所需生产 NPU 数量。

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

## 第五步：加入高负载非线性开销

模型在 $60\%$ 利用率之后应用饱和乘子：

$$
F(u) = 1 + 0.60 \cdot \left(\frac{\max(0, \min(u,1)-0.60)}{0.40}\right)^2
$$

对于默认满意图 Qwen3 场景：

$$
T_{Q,\mathrm{eff}} = 1,427,134\ \mathrm{tokens/s}
$$

## 第六步：计算生产 NPU 数量

参考能力为：

$$
\mu_Q = 15,040\ \mathrm{tokens/s/replica}, \quad TP_Q = 4\ \mathrm{NPUs/replica}, \quad u_{\mathrm{target}} = 70\%
$$

所需副本和 NPU 数量为：

$$
R_Q = \left\lceil \frac{1,427,134}{15,040 \cdot 70\%} \right\rceil = 136
$$

$$
N_Q = 136 \cdot 4 = 544\ \mathrm{NPUs}
$$

## 核心结论

在基线生产场景下：

- 用户数为 $3.6$ million。
- 当意图比例为 $100\%$ 时，意图请求速率为 $104,300$ requests/s。
- $10\%$ 的意图请求调用 Qwen3。
- 非线性开销后的有效 Qwen3 需求为 $1,427,134$ tokens/s。
- 需要 $544$ 张生产 NPU。

这就是本分析的核心逻辑。
