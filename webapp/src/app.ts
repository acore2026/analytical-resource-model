type EventKey =
  | "initialRegistration"
  | "periodicRegistration"
  | "mobilityRegistration"
  | "initialPdu"
  | "pduRelease"
  | "pduModification"
  | "serviceRequest"
  | "anRelease"
  | "handover"
  | "paging";
type SystemStatus = "stable" | "degraded" | "high_risk" | "unstable";
type Lang = "en" | "zh";

interface Baseline {
  userCount: number;
  pduSessionsPerUser: number;
  intentRatio: number;
  cpuCores: number;
  nicGbps: number;
  ramGb: number;
  npuCount: number;
  npuHbmPerNpuGb: number;
  npuCapacityPerNpu: number;
  nonIntentCpu: number;
  intentCpu: number;
  intentNpuMs: number;
  intentBandwidthKb: number;
}

interface EventDefinition {
  key: EventKey;
  inputId: string;
  labelKey: string;
  tipKey: string;
  perUserPerHour: number;
  baseLatencyMs: number;
  baseCpuMs: number;
  baseBandwidthKb: number;
  intentEligible: boolean;
}

interface EventLoad extends EventDefinition {
  rps: number;
}

interface Result {
  totalRps: number;
  eligibleRps: number;
  intentRatio: number;
  actualIntentShare: number;
  intentRps: number;
  cpuMsPerRequest: number;
  cpuCoreDemand: number;
  cpuUtil: number;
  ramGb: number;
  ramUtil: number;
  memoryTrafficGbps: number;
  npuUtil: number;
  npuHbmGb: number;
  npuHbmUtil: number;
  requiredNpus70: number;
  networkGbps: number;
  networkUtil: number;
  meanLatency: number;
  p95Latency: number;
  p99Latency: number;
  systemStatus: SystemStatus;
  cpuStatus: SystemStatus;
  npuStatus: SystemStatus;
  netStatus: SystemStatus;
  events: EventLoad[];
}

const BASELINE: Baseline = {
  userCount: 3600000,
  pduSessionsPerUser: 2,
  intentRatio: 10,
  cpuCores: 256,
  nicGbps: 100,
  ramGb: 256,
  npuCount: 8,
  npuHbmPerNpuGb: 32,
  npuCapacityPerNpu: 4300,
  nonIntentCpu: 0.3,
  intentCpu: 2.0,
  intentNpuMs: 8,
  intentBandwidthKb: 12
};

const EVENTS: EventDefinition[] = [
  { key: "initialRegistration", inputId: "eventInitialRegistration", labelKey: "initialRegistration", tipKey: "initialRegistrationTip", perUserPerHour: 0.1, baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12, intentEligible: false },
  { key: "periodicRegistration", inputId: "eventPeriodicRegistration", labelKey: "periodicRegistration", tipKey: "periodicRegistrationTip", perUserPerHour: 0.1, baseLatencyMs: 25, baseCpuMs: 1.5, baseBandwidthKb: 10, intentEligible: false },
  { key: "mobilityRegistration", inputId: "eventMobilityRegistration", labelKey: "mobilityRegistration", tipKey: "mobilityRegistrationTip", perUserPerHour: 7.0, baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12, intentEligible: false },
  { key: "initialPdu", inputId: "eventInitialPdu", labelKey: "initialPdu", tipKey: "initialPduTip", perUserPerHour: 1.0, baseLatencyMs: 40, baseCpuMs: 2.5, baseBandwidthKb: 16, intentEligible: true },
  { key: "pduRelease", inputId: "eventPduRelease", labelKey: "pduRelease", tipKey: "pduReleaseTip", perUserPerHour: 1.0, baseLatencyMs: 25, baseCpuMs: 1.5, baseBandwidthKb: 10, intentEligible: false },
  { key: "pduModification", inputId: "eventPduModification", labelKey: "pduModification", tipKey: "pduModificationTip", perUserPerHour: 2.0, baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12, intentEligible: true },
  { key: "serviceRequest", inputId: "eventServiceRequest", labelKey: "serviceRequest", tipKey: "serviceRequestTip", perUserPerHour: 21.0, baseLatencyMs: 20, baseCpuMs: 1.2, baseBandwidthKb: 8, intentEligible: true },
  { key: "anRelease", inputId: "eventAnRelease", labelKey: "anRelease", tipKey: "anReleaseTip", perUserPerHour: 35.0, baseLatencyMs: 15, baseCpuMs: 0.8, baseBandwidthKb: 6, intentEligible: false },
  { key: "handover", inputId: "eventHandover", labelKey: "handover", tipKey: "handoverTip", perUserPerHour: 23.1, baseLatencyMs: 25, baseCpuMs: 1.8, baseBandwidthKb: 12, intentEligible: false },
  { key: "paging", inputId: "eventPaging", labelKey: "paging", tipKey: "pagingTip", perUserPerHour: 14.0, baseLatencyMs: 12, baseCpuMs: 0.6, baseBandwidthKb: 4, intentEligible: false }
];

const SWEEP = [0, 1, 5, 10, 20, 50, 100];
const MODEL_INPUT_IDS = [
  "userCount",
  "pduSessionsPerUser",
  "intentRatio",
  "cpuCores",
  "nicGbps",
  "ramGb",
  "npuCount",
  "npuHbmPerNpuGb",
  "npuCapacityPerNpu",
  "nonIntentCpu",
  "intentCpu",
  "intentNpuMs",
  "intentBandwidthKb"
] as const;
const INPUT_IDS = [...MODEL_INPUT_IDS, ...EVENTS.map((event) => event.inputId)] as const;

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    modelMarkdown: "Model markdown",
    open: "OPEN",
    userModel: "User Model",
    eventRates: "Event Rates",
    cluster: "Cluster",
    agentCost: "Agent Cost",
    userCount: "User count",
    pduSessionsPerUser: "PDU sessions per user",
    intentRatio: "Intent ratio among eligible events",
    initialRegistration: "Initial registration",
    periodicRegistration: "Periodic registration",
    mobilityRegistration: "Mobility registration",
    initialPdu: "Initial PDU establishment",
    pduRelease: "PDU session release",
    pduModification: "PDU session modification",
    serviceRequest: "Service request",
    anRelease: "AN release",
    handover: "Handover",
    paging: "Paging",
    derivedTraffic: "Derived Traffic",
    eventName: "Event",
    perUserHour: "Per user/hour",
    derivedRps: "Request/s",
    eligible: "Intent",
    yes: "Yes",
    no: "No",
    cpuCores: "CPU cores",
    nicCapacity: "NIC capacity",
    ramCapacity: "RAM capacity",
    npuCount: "NPU count",
    hbmPerNpu: "HBM per NPU",
    npuIntentCapacity: "NPU capacity per NPU",
    nonIntentCpuCost: "Non-intent CPU cost",
    intentCpuCost: "Intent CPU cost",
    intentInferenceLatency: "Intent inference latency",
    intentExtraBandwidth: "Intent extra bandwidth",
    resetBaseline: "Reset baseline",
    cpuDemandMetric: "CPU demand (cores)",
    memoryMetric: "Memory (GB)",
    npuLoadMetric: "NPU load (%)",
    bandwidthMetric: "Bandwidth (Gbps)",
    meanLatencyMetric: "Mean latency (ms)",
    p95LatencyMetric: "p95 latency (ms)",
    p99LatencyMetric: "p99 latency (ms)",
    intentSweep: "Intent Sweep",
    intentSweepDescription: "X-axis: intent-bearing share within eligible events. Y-axis: CPU, NPU, and network utilization. The total request rate is derived from users and event frequencies, so it stays fixed during this sweep.",
    xAxisLabel: "Eligible intent ratio (%)",
    yAxisLabel: "Resource utilization (%)",
    intentSweepAria: "Line chart showing CPU, NPU, and network utilization by eligible intent ratio.",
    calculatedSweep: "Calculated Sweep",
    tableEligibleIntent: "Eligible intent (%)",
    tableTotalIntent: "Total intent (%)",
    tableIntentRate: "Intent rate (req/s)",
    tableCpuUtil: "CPU util (%)",
    tableNpuUtil: "NPU util (%)",
    tableBw: "BW (Gbps)",
    tableMean: "Mean (ms)",
    tableStatus: "Status",
    userCountTip: "Number of users represented by the model. Event request rates scale linearly with this value.",
    pduSessionsPerUserTip: "Average PDU sessions per user. It is a scenario descriptor; change event frequencies to model session-driven traffic changes.",
    intentRatioTip: "Share of initial PDU establishment, PDU modification, and service request events that carry user intent.",
    initialRegistrationTip: "How often one user triggers initial registration in one hour.",
    periodicRegistrationTip: "How often one user triggers periodic registration update in one hour.",
    mobilityRegistrationTip: "How often one user triggers mobility registration update in one hour.",
    initialPduTip: "How often one user establishes an initial PDU session in one hour. This event is intent-eligible.",
    pduReleaseTip: "How often one user releases a PDU session in one hour.",
    pduModificationTip: "How often one user modifies a PDU session in one hour. This event is intent-eligible.",
    serviceRequestTip: "How often one user triggers service request in one hour. This event is intent-eligible.",
    anReleaseTip: "How often one user triggers access-network release in one hour.",
    handoverTip: "How often one user performs handover in one hour.",
    pagingTip: "How often one user receives paging in one hour.",
    cpuCoresTip: "Total CPU core capacity available to deterministic procedure handling and CPU-side agent logic.",
    nicCapacityTip: "Network interface capacity available for control-plane message traffic.",
    ramCapacityTip: "Host memory capacity for agent/NF processes, active request contexts, and runtime state.",
    npuCountTip: "Number of NPUs in the inference pool. The reference profile uses 8 Ascend 910B4 NPUs.",
    hbmPerNpuTip: "High-bandwidth memory available on each NPU. The reference profile uses 32 GB HBM per NPU.",
    npuIntentCapacityTip: "Assumed intent inference throughput per NPU. With 8 NPUs and 24,000 peak intent req/s, the 70% target requires about 4,286 intent/s/NPU.",
    nonIntentCpuCostTip: "CPU-ms means one CPU core occupied for one millisecond. 0.3 CPU-ms is 0.3 ms on one core, or equivalent parallel CPU work.",
    intentCpuCostTip: "CPU-side agent work for intent parsing, constraints, planning, and tool-wrapper handling outside NPU inference.",
    intentInferenceLatencyTip: "Per-request NPU inference service time before queueing delay.",
    intentExtraBandwidthTip: "Additional control-plane message bytes caused by agent-tool wrappers and inter-agent task messages.",
    allRequests: "of all requests",
    totalTraffic: "Total traffic",
    eligibleTraffic: "eligible for intent",
    users: "users",
    sessionsPerUser: "PDU sessions/user",
    bottleneck: "Bottleneck",
    intentTraffic: "Intent traffic is",
    npu70: "keeping NPU utilization at or below 70% requires",
    accelerator: "NPU",
    accelerators: "NPUs",
    stable: "stable",
    degraded: "degraded",
    high_risk: "high risk",
    unstable: "unstable",
    cpu: "CPU",
    npu: "NPU",
    network: "Network",
    npuInference: "NPU inference",
    ram: "RAM",
    coresUnit: "cores"
  },
  zh: {
    modelMarkdown: "模型说明文档",
    open: "打开",
    userModel: "用户模型",
    eventRates: "事件速率",
    cluster: "集群",
    agentCost: "Agent 成本",
    userCount: "用户数",
    pduSessionsPerUser: "每用户 PDU 会话数",
    intentRatio: "可携带意图事件中的意图比例",
    initialRegistration: "初始注册",
    periodicRegistration: "周期注册",
    mobilityRegistration: "移动性注册",
    initialPdu: "初始 PDU 建立",
    pduRelease: "PDU 会话释放",
    pduModification: "PDU 会话修改",
    serviceRequest: "业务请求",
    anRelease: "AN 释放",
    handover: "切换",
    paging: "寻呼",
    derivedTraffic: "推导流量",
    eventName: "事件",
    perUserHour: "每用户每小时",
    derivedRps: "请求/秒",
    eligible: "意图",
    yes: "是",
    no: "否",
    cpuCores: "CPU 核数",
    nicCapacity: "网卡容量",
    ramCapacity: "内存容量",
    npuCount: "NPU 数量",
    hbmPerNpu: "每 NPU HBM",
    npuIntentCapacity: "单 NPU 推理能力",
    nonIntentCpuCost: "非意图 CPU 成本",
    intentCpuCost: "意图 CPU 成本",
    intentInferenceLatency: "意图推理时延",
    intentExtraBandwidth: "意图额外带宽",
    resetBaseline: "重置基线",
    cpuDemandMetric: "CPU 需求（核）",
    memoryMetric: "内存（GB）",
    npuLoadMetric: "NPU 负载（%）",
    bandwidthMetric: "带宽（Gbps）",
    meanLatencyMetric: "平均时延（ms）",
    p95LatencyMetric: "p95 时延（ms）",
    p99LatencyMetric: "p99 时延（ms）",
    intentSweep: "意图比例扫描",
    intentSweepDescription: "横轴表示可携带意图事件中真正携带意图的比例。纵轴表示 CPU、NPU 和网络利用率。总请求速率由用户数和事件频率推导，因此在该扫描中保持不变。",
    xAxisLabel: "可携带意图比例（%）",
    yAxisLabel: "资源利用率（%）",
    intentSweepAria: "折线图，展示不同可携带意图比例下的 CPU、NPU 和网络利用率。",
    calculatedSweep: "计算结果扫描",
    tableEligibleIntent: "可携带意图比例（%）",
    tableTotalIntent: "总意图比例（%）",
    tableIntentRate: "意图速率（req/s）",
    tableCpuUtil: "CPU 利用率（%）",
    tableNpuUtil: "NPU 利用率（%）",
    tableBw: "带宽（Gbps）",
    tableMean: "平均值（ms）",
    tableStatus: "状态",
    userCountTip: "模型中的用户数量。事件请求速率会随该值线性变化。",
    pduSessionsPerUserTip: "平均每用户 PDU 会话数。该值作为场景描述；如需建模会话驱动的流量变化，请调整事件频率。",
    intentRatioTip: "初始 PDU 建立、PDU 会话修改和业务请求中携带用户意图的比例。",
    initialRegistrationTip: "单个用户在一小时内触发初始注册的次数。",
    periodicRegistrationTip: "单个用户在一小时内触发周期注册更新的次数。",
    mobilityRegistrationTip: "单个用户在一小时内触发移动性注册更新的次数。",
    initialPduTip: "单个用户在一小时内建立初始 PDU 会话的次数。该事件可携带意图。",
    pduReleaseTip: "单个用户在一小时内释放 PDU 会话的次数。",
    pduModificationTip: "单个用户在一小时内修改 PDU 会话的次数。该事件可携带意图。",
    serviceRequestTip: "单个用户在一小时内触发业务请求的次数。该事件可携带意图。",
    anReleaseTip: "单个用户在一小时内触发接入网释放的次数。",
    handoverTip: "单个用户在一小时内发生切换的次数。",
    pagingTip: "单个用户在一小时内收到寻呼的次数。",
    cpuCoresTip: "可用于确定性流程处理和 Agent CPU 侧逻辑的总 CPU 核数。",
    nicCapacityTip: "可用于控制面消息传输的网卡容量。",
    ramCapacityTip: "主机内存容量，用于 Agent/NF 进程、活跃请求上下文和运行状态。",
    npuCountTip: "推理池中的 NPU 数量。参考配置使用 8 张 Ascend 910B4 NPU。",
    hbmPerNpuTip: "每个 NPU 可用的高带宽内存。参考配置为每 NPU 32 GB HBM。",
    npuIntentCapacityTip: "单个 NPU 的假设意图推理吞吐量。在 8 张 NPU 和 24,000 peak intent req/s 下，70% 利用率目标约需要 4,286 intent/s/NPU。",
    nonIntentCpuCostTip: "CPU-ms 表示一个 CPU 核占用一毫秒。0.3 CPU-ms 等价于单核 0.3 ms 的计算量。",
    intentCpuCostTip: "意图解析、约束检查、规划和工具封装等 NPU 推理之外的 CPU 侧 Agent 工作量。",
    intentInferenceLatencyTip: "不含排队延迟时，单个意图请求的 NPU 推理服务时间。",
    intentExtraBandwidthTip: "由 Agent-Tool 封装和 Agent 间任务消息带来的额外控制面消息字节数。",
    allRequests: "占全部请求",
    totalTraffic: "总流量",
    eligibleTraffic: "可携带意图",
    users: "用户",
    sessionsPerUser: "PDU 会话/用户",
    bottleneck: "瓶颈",
    intentTraffic: "意图流量为",
    npu70: "若保持 NPU 利用率不超过 70%，需要",
    accelerator: "个 NPU",
    accelerators: "个 NPU",
    stable: "稳定",
    degraded: "退化",
    high_risk: "高风险",
    unstable: "不稳定",
    cpu: "CPU",
    npu: "NPU",
    network: "网络",
    npuInference: "NPU 推理",
    ram: "内存",
    coresUnit: "核"
  }
};

let currentLang: Lang = "en";

function t(key: string): string {
  return I18N[currentLang][key] ?? I18N.en[key] ?? key;
}

function statusText(name: SystemStatus): string {
  return t(name);
}

function mustGet<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing DOM element: ${id}`);
  }
  return node as T;
}

const input = Object.fromEntries(
  INPUT_IDS.map((id) => [id, mustGet<HTMLInputElement>(id)])
) as Record<string, HTMLInputElement>;

function num(id: string): number {
  const value = Number(input[id].value);
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function queueDelayMs(util: number, serviceMs: number): number {
  if (util >= 1) return Infinity;
  if (util <= 0) return 0;
  return serviceMs * util / (1 - util);
}

function classifyStatus(util: number, degraded = 0.7, highRisk = 0.85): SystemStatus {
  if (util >= 1) return "unstable";
  if (util >= highRisk) return "high_risk";
  if (util >= degraded) return "degraded";
  return "stable";
}

function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "unstable";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function pct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "unstable";
  return `${(value * 100).toFixed(digits)}%`;
}

function eventLoads(): EventLoad[] {
  const users = Math.max(0, num("userCount"));
  return EVENTS.map((event) => {
    const perUserPerHour = Math.max(0, num(event.inputId));
    return {
      ...event,
      perUserPerHour,
      rps: users * perUserPerHour / 3600
    };
  });
}

function weightedAverage(events: EventLoad[], totalRps: number, key: keyof EventDefinition): number {
  if (totalRps <= 0) return 0;
  return events.reduce((sum, event) => {
    const value = event[key];
    return typeof value === "number" ? sum + event.rps * value : sum;
  }, 0) / totalRps;
}

function evaluate(intentRatioPercent = num("intentRatio")): Result {
  const events = eventLoads();
  const totalRps = events.reduce((sum, event) => sum + event.rps, 0);
  const eligibleRps = events.filter((event) => event.intentEligible).reduce((sum, event) => sum + event.rps, 0);
  const intentRatio = clamp(intentRatioPercent / 100, 0, 1);
  const intentRps = eligibleRps * intentRatio;
  const actualIntentShare = totalRps > 0 ? intentRps / totalRps : 0;

  const baseCpuAvg = weightedAverage(events, totalRps, "baseCpuMs");
  const baseBandwidthAvg = weightedAverage(events, totalRps, "baseBandwidthKb");
  const baseLatencyAvg = weightedAverage(events, totalRps, "baseLatencyMs");

  const cpuMsPerRequest = baseCpuAvg
    + actualIntentShare * Math.max(0, num("intentCpu"))
    + (1 - actualIntentShare) * Math.max(0, num("nonIntentCpu"));
  const cpuCores = Math.max(1, num("cpuCores"));
  const cpuCoreDemand = totalRps * cpuMsPerRequest / 1000;
  const cpuUtil = cpuCoreDemand / cpuCores;
  const cpuDelay = queueDelayMs(cpuUtil, cpuMsPerRequest);

  const bandwidthKbPerRequest = baseBandwidthAvg + actualIntentShare * Math.max(0, num("intentBandwidthKb"));
  const networkGbps = totalRps * bandwidthKbPerRequest * 8 / 1000000;
  const networkUtil = networkGbps / Math.max(1, num("nicGbps"));
  const networkDelay = queueDelayMs(networkUtil, 0.1);

  const npuCount = Math.max(0, num("npuCount"));
  const npuCapacityPerNpu = Math.max(1, num("npuCapacityPerNpu"));
  const npuTotalCapacity = npuCount * npuCapacityPerNpu;
  const npuUtil = npuTotalCapacity > 0 ? intentRps / npuTotalCapacity : Infinity;
  const npuQueueDelay = queueDelayMs(npuUtil, 1000 / Math.max(1, npuTotalCapacity));
  const intentNpuLatency = Math.max(0, num("intentNpuMs")) + npuQueueDelay;

  const activeIntentRequests = intentRps * Math.max(0, num("intentNpuMs")) / 1000;
  const activeNpuCount = intentRps > 0 ? Math.min(npuCount, Math.ceil(intentRps / npuCapacityPerNpu)) : 0;
  const npuHbmGb = intentRps > 0 ? activeNpuCount * 16 + activeIntentRequests * 4 / 1024 : 0;
  const npuHbmUtil = npuHbmGb / Math.max(1, npuCount * Math.max(1, num("npuHbmPerNpuGb")));

  const activeRequests = totalRps * baseLatencyAvg / 1000;
  const ramGb = 32 + activeRequests * 128 / 1024 / 1024;
  const ramUtil = ramGb / Math.max(1, num("ramGb"));

  const memoryTrafficKb = (1 - actualIntentShare) * 64 + actualIntentShare * 512;
  const memoryTrafficGbps = totalRps * memoryTrafficKb * 8 / 1000000;

  let meanLatency = 0;
  for (const event of events) {
    const eventShare = totalRps > 0 ? event.rps / totalRps : 0;
    const eventIntentShare = event.intentEligible ? intentRatio : 0;
    const nonIntentLatency = event.baseLatencyMs + 1 + cpuDelay + networkDelay;
    const intentLatency = event.baseLatencyMs + 4 + Math.max(0, num("intentCpu")) + intentNpuLatency + cpuDelay + networkDelay;
    meanLatency += eventShare * ((1 - eventIntentShare) * nonIntentLatency + eventIntentShare * intentLatency);
  }

  const bottleneckUtil = Math.max(cpuUtil, npuUtil, networkUtil);
  const unstable = cpuUtil >= 1 || npuUtil >= 1 || networkUtil >= 1 || !Number.isFinite(meanLatency);
  let p95Latency = Infinity;
  let p99Latency = Infinity;
  if (!unstable) {
    const tailAmplifier = 1 + 2 * bottleneckUtil / Math.max(0.001, 1 - bottleneckUtil);
    p95Latency = meanLatency * Math.min(tailAmplifier, 10);
    p99Latency = meanLatency * Math.min(tailAmplifier * 1.35, 15);
  } else {
    meanLatency = Infinity;
  }

  const systemStatus: SystemStatus = unstable ? "unstable" : classifyStatus(bottleneckUtil);
  const requiredNpus70 = intentRps > 0 ? Math.ceil(intentRps / (npuCapacityPerNpu * 0.7)) : 0;

  return {
    totalRps,
    eligibleRps,
    intentRatio,
    actualIntentShare,
    intentRps,
    cpuMsPerRequest,
    cpuCoreDemand,
    cpuUtil,
    ramGb,
    ramUtil,
    memoryTrafficGbps,
    npuUtil,
    npuHbmGb,
    npuHbmUtil,
    requiredNpus70,
    networkGbps,
    networkUtil,
    meanLatency,
    p95Latency,
    p99Latency,
    systemStatus,
    cpuStatus: classifyStatus(cpuUtil),
    npuStatus: classifyStatus(npuUtil),
    netStatus: classifyStatus(networkUtil),
    events
  };
}

function colorForStatus(name: SystemStatus): string {
  if (name === "stable") return "#3c8b4a";
  if (name === "degraded") return "#a76f11";
  return "#c94d41";
}

function setBar(id: string, util: number, statusName: SystemStatus): void {
  const node = mustGet<HTMLElement>(id);
  node.style.width = `${clamp(util, 0, 1) * 100}%`;
  node.style.background = colorForStatus(statusName);
}

function bottleneckLabel(result: Result): string {
  const pairs: Array<[string, number]> = [
    [t("cpu"), result.cpuUtil],
    [t("npuInference"), result.npuUtil],
    [t("network"), result.networkUtil],
    [t("ram"), result.ramUtil]
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs[0][0];
}

function updateEventTable(result: Result): void {
  const tbody = mustGet<HTMLTableSectionElement>("eventTable");
  tbody.innerHTML = result.events.map((event) => `
    <tr>
      <td>${t(event.labelKey)}</td>
      <td>${fmt(event.perUserPerHour, 2)}</td>
      <td>${fmt(event.rps, 0)}</td>
      <td>${event.intentEligible ? t("yes") : t("no")}</td>
    </tr>
  `).join("");
}

function updateSummary(result: Result): void {
  mustGet("intentRatioLabel").textContent = `${Math.round(result.intentRatio * 100)}%`;
  mustGet("actualIntentLabel").textContent = `${pct(result.actualIntentShare)} ${t("allRequests")}`;
  mustGet("trafficHint").textContent =
    `${t("totalTraffic")}: ${fmt(result.totalRps, 0)} req/s; ${fmt(result.eligibleRps, 0)} req/s ${t("eligibleTraffic")}; ${fmt(num("userCount"), 0)} ${t("users")}; ${fmt(num("pduSessionsPerUser"), 1)} ${t("sessionsPerUser")}.`;

  mustGet("cpuDemand").textContent = `${fmt(result.cpuCoreDemand, 1)} ${t("coresUnit")}`;
  mustGet("ramDemand").textContent = `${fmt(result.ramGb, 1)} GB`;
  mustGet("npuDemand").textContent = pct(result.npuUtil);
  mustGet("netDemand").textContent = `${fmt(result.networkGbps, 3)} Gbps`;

  setBar("cpuBar", result.cpuUtil, result.cpuStatus);
  setBar("ramBar", result.ramUtil, classifyStatus(result.ramUtil));
  setBar("npuBar", result.npuUtil, result.npuStatus);
  setBar("netBar", result.networkUtil, result.netStatus);

  mustGet("meanLatency").textContent = `${fmt(result.meanLatency, 1)} ms`;
  mustGet("p95Latency").textContent = `${fmt(result.p95Latency, 1)} ms`;
  mustGet("p99Latency").textContent = `${fmt(result.p99Latency, 1)} ms`;

  const stateDot = mustGet<HTMLElement>("stateDot");
  const stateText = mustGet("stateText");
  stateDot.style.background = colorForStatus(result.systemStatus);
  stateDot.style.boxShadow = `0 0 20px ${colorForStatus(result.systemStatus)}`;
  stateText.textContent = statusText(result.systemStatus);

  const npus = result.requiredNpus70;
  const acceleratorLabel = currentLang === "zh"
    ? t("accelerator")
    : (npus === 1 ? t("accelerator") : t("accelerators"));
  mustGet("bottleneckNote").textContent = `${t("bottleneck")}: ${bottleneckLabel(result)}. ${t("intentTraffic")} ${fmt(result.intentRps, 0)} req/s; ${t("npu70")} ${npus} ${acceleratorLabel}.`;
  updateEventTable(result);
}

function updateTable(rows: Result[]): void {
  const tbody = mustGet<HTMLTableSectionElement>("sweepTable");
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${Math.round(row.intentRatio * 100)}%</td>
      <td>${pct(row.actualIntentShare)}</td>
      <td>${fmt(row.intentRps, 0)}</td>
      <td>${pct(row.cpuUtil)}</td>
      <td>${pct(row.npuUtil)}</td>
      <td>${fmt(row.networkGbps, 3)} Gbps</td>
      <td>${fmt(row.meanLatency, 1)} ms</td>
      <td class="status-${row.systemStatus}">${statusText(row.systemStatus)}</td>
    </tr>
  `).join("");
}

function drawChart(rows: Result[]): void {
  const canvas = mustGet<HTMLCanvasElement>("sweepChart");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcf8";
  ctx.fillRect(0, 0, width, height);

  const pad = { left: 58, right: 44, top: 24, bottom: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (index / (rows.length - 1)) * plotW;
  const y = (value: number, max: number) => pad.top + plotH - (clamp(value, 0, max) / max) * plotH;
  const finiteUtils = rows.flatMap((row) => [row.cpuUtil, row.npuUtil, row.networkUtil]).filter(Number.isFinite);
  const maxUtil = Math.max(1.1, ...finiteUtils);

  ctx.strokeStyle = "#d7ddd3";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5f6a61";
  ctx.font = "18px Aptos, Segoe UI, sans-serif";
  for (let i = 0; i <= 4; i += 1) {
    const gy = pad.top + (i / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, gy);
    ctx.lineTo(width - pad.right, gy);
    ctx.stroke();
    ctx.fillText(`${Math.round((1 - i / 4) * maxUtil * 100)}%`, 10, gy + 6);
  }

  const series: Array<{ key: "cpuUtil" | "npuUtil" | "networkUtil"; label: string; color: string }> = [
    { key: "cpuUtil", label: t("cpu"), color: "#3c8b4a" },
    { key: "npuUtil", label: t("npu"), color: "#d66a00" },
    { key: "networkUtil", label: t("network"), color: "#1769d1" }
  ];

  for (const item of series) {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    rows.forEach((row, index) => {
      const pointX = x(index);
      const pointY = y(row[item.key], maxUtil);
      if (index === 0) ctx.moveTo(pointX, pointY);
      else ctx.lineTo(pointX, pointY);
    });
    ctx.stroke();

    rows.forEach((row, index) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(x(index) - 4, y(row[item.key], maxUtil) - 4, 8, 8);
    });
  }

  ctx.strokeStyle = "#c94d41";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(pad.left, y(1, maxUtil));
  ctx.lineTo(width - pad.right, y(1, maxUtil));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#1d241f";
  ctx.font = "20px Aptos, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  rows.forEach((row, index) => {
    ctx.fillText(`${Math.round(row.intentRatio * 100)}%`, x(index), height - 14);
  });

  let legendX = pad.left;
  ctx.textAlign = "left";
  for (const item of series) {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, 18, 14, 14);
    ctx.fillStyle = "#1d241f";
    ctx.fillText(item.label, legendX + 20, 32);
    legendX += 110;
  }
}

function applyTranslations(): void {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-tip-key]").forEach((node) => {
    const key = node.dataset.tipKey;
    if (key) node.dataset.tip = t(key);
  });
  const langToggle = mustGet<HTMLButtonElement>("langToggle");
  langToggle.textContent = currentLang === "en" ? "中文" : "English";
  langToggle.setAttribute(
    "aria-label",
    currentLang === "en" ? "Switch to Chinese" : "切换到英文"
  );
  const docLink = mustGet<HTMLAnchorElement>("docLink");
  docLink.href = currentLang === "zh"
    ? "https://github.com/acore2026/analytical-resource-model/blob/main/agentic_core_resource_model_zh.md"
    : "https://github.com/acore2026/analytical-resource-model/blob/main/agentic_core_resource_model.md";
  mustGet<HTMLCanvasElement>("sweepChart").setAttribute("aria-label", t("intentSweepAria"));
}

function recompute(): void {
  const current = evaluate();
  const rows = SWEEP.map((ratio) => evaluate(ratio));
  updateSummary(current);
  updateTable(rows);
  drawChart(rows);
}

function reset(): void {
  Object.entries(BASELINE).forEach(([key, value]) => {
    input[key].value = String(value);
  });
  for (const event of EVENTS) {
    input[event.inputId].value = String(event.perUserPerHour);
  }
  recompute();
}

function toggleLanguage(): void {
  currentLang = currentLang === "en" ? "zh" : "en";
  applyTranslations();
  recompute();
}

INPUT_IDS.forEach((id) => {
  input[id].addEventListener("input", recompute);
});

mustGet("langToggle").addEventListener("click", toggleLanguage);
mustGet("resetBtn").addEventListener("click", reset);
window.addEventListener("resize", recompute);
applyTranslations();
recompute();
