import { EVENTS } from "./config.js";
import type { EventDefinition, EventLoad, Result, SystemStatus } from "./types.js";

export type NumericInput = (id: string) => number;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function queueDelayMs(util: number, serviceMs: number): number {
  if (util >= 1) return Infinity;
  if (util <= 0) return 0;
  return serviceMs * util / (1 - util);
}

function saturationMultiplier(num: NumericInput, load: number): number {
  const knee = clamp(num("nonlinearKnee") / 100, 0, 0.99);
  const alpha = Math.max(0, num("nonlinearAlpha") / 100);
  const power = Math.max(0.1, num("nonlinearPower"));
  if (load <= knee) return 1;
  const pressure = (clamp(load, 0, 1) - knee) / Math.max(0.001, 1 - knee);
  return 1 + alpha * Math.pow(pressure, power);
}

export function classifyStatus(util: number, degraded = 0.7, highRisk = 0.85): SystemStatus {
  if (util >= 1) return "unstable";
  if (util >= highRisk) return "high_risk";
  if (util >= degraded) return "degraded";
  return "stable";
}

export function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "unstable";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

export function pct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "unstable";
  return `${(value * 100).toFixed(digits)}%`;
}

function eventLoads(num: NumericInput, userCountOverride = num("userCount")): EventLoad[] {
  const users = Math.max(0, userCountOverride);
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

export function evaluate(num: NumericInput, intentRatioPercent = num("intentRatio"), userCountOverride = num("userCount")): Result {
  const events = eventLoads(num, userCountOverride);
  const totalRps = events.reduce((sum, event) => sum + event.rps, 0);
  const intentCandidateRps = totalRps;
  const intentRatio = clamp(intentRatioPercent / 100, 0, 1);
  const intentRps = intentCandidateRps * intentRatio;
  const actualIntentShare = totalRps > 0 ? intentRps / totalRps : 0;

  const baseCpuAvg = weightedAverage(events, totalRps, "baseCpuMs");
  const baseBandwidthAvg = weightedAverage(events, totalRps, "baseBandwidthKb");
  const baseLatencyAvg = weightedAverage(events, totalRps, "baseLatencyMs");

  const linearCpuMsPerRequest = baseCpuAvg
    + actualIntentShare * Math.max(0, num("intentCpu"))
    + (1 - actualIntentShare) * Math.max(0, num("nonIntentCpu"));
  const cpuCores = Math.max(1, num("cpuCores"));
  const linearCpuCoreDemand = totalRps * linearCpuMsPerRequest / 1000;
  const linearCpuUtil = linearCpuCoreDemand / cpuCores;
  const cpuMsPerRequest = linearCpuMsPerRequest * saturationMultiplier(num, linearCpuUtil);
  const cpuCoreDemand = totalRps * cpuMsPerRequest / 1000;
  const cpuUtil = cpuCoreDemand / cpuCores;
  const cpuDelay = queueDelayMs(cpuUtil, cpuMsPerRequest);

  const bandwidthKbPerRequest = baseBandwidthAvg + actualIntentShare * Math.max(0, num("intentBandwidthKb"));
  const linearNetworkGbps = totalRps * bandwidthKbPerRequest * 8 / 1000000;
  const linearNetworkUtil = linearNetworkGbps / Math.max(1, num("nicGbps"));
  const networkGbps = linearNetworkGbps * saturationMultiplier(num, linearNetworkUtil);
  const networkUtil = networkGbps / Math.max(1, num("nicGbps"));
  const networkDelay = queueDelayMs(networkUtil, 0.1);

  const qwen3InvocationRatio = clamp(num("qwen3InvocationRatio") / 100, 0, 1);
  const qwen3InputTokens = Math.max(1, num("qwen3InputTokens"));
  const qwen3OutputTokens = Math.max(1, num("qwen3OutputTokens"));
  const qwen3TokensPerRequest = qwen3InputTokens + qwen3OutputTokens;
  const qwen3TokenCapacity = Math.max(1, num("qwen3TokenCapacity"));
  const qwen3TensorParallel = Math.max(1, num("qwen3TensorParallel"));
  const qwen3TargetUtil = clamp(num("qwen3TargetUtil") / 100, 0.01, 1);
  const qwen3RequestRps = intentRps * qwen3InvocationRatio;
  const qwen3TokenDemand = qwen3RequestRps * qwen3TokensPerRequest;
  const linearRequiredQwen3Replicas = qwen3TokenDemand > 0 ? Math.ceil(qwen3TokenDemand / (qwen3TokenCapacity * qwen3TargetUtil)) : 0;
  const linearProductionCapacity = linearRequiredQwen3Replicas * qwen3TokenCapacity;
  const linearNpuUtil = linearProductionCapacity > 0 ? qwen3TokenDemand / linearProductionCapacity : 0;
  const qwen3EffectiveTokenDemand = qwen3TokenDemand * saturationMultiplier(num, linearNpuUtil);
  const requiredQwen3Replicas = qwen3EffectiveTokenDemand > 0 ? Math.ceil(qwen3EffectiveTokenDemand / (qwen3TokenCapacity * qwen3TargetUtil)) : 0;
  const requiredProductionNpus = requiredQwen3Replicas * Math.ceil(qwen3TensorParallel);
  const productionCapacity = requiredQwen3Replicas * qwen3TokenCapacity;
  const npuUtil = productionCapacity > 0 ? qwen3EffectiveTokenDemand / productionCapacity : 0;
  const npuQueueDelay = productionCapacity > 0 ? queueDelayMs(npuUtil, 1000 / productionCapacity) : 0;
  const qwen3Latency = Math.max(0, num("qwen3LatencyMs")) + npuQueueDelay;

  const activeQwen3Requests = qwen3RequestRps * Math.max(0, num("qwen3LatencyMs")) / 1000;
  const npuHbmGb = qwen3RequestRps > 0 ? requiredProductionNpus * 16 + activeQwen3Requests * 4 / 1024 : 0;
  const productionHbmGb = requiredProductionNpus * Math.max(1, num("npuHbmPerNpuGb"));
  const npuHbmUtil = productionHbmGb > 0 ? npuHbmGb / productionHbmGb : 0;

  const activeRequests = totalRps * baseLatencyAvg / 1000;
  const ramGb = 32 + activeRequests * 128 / 1024 / 1024;
  const ramUtil = ramGb / Math.max(1, num("ramGb"));

  const memoryTrafficKb = (1 - actualIntentShare) * 64 + actualIntentShare * 512;
  const memoryTrafficGbps = totalRps * memoryTrafficKb * 8 / 1000000;

  let meanLatency = 0;
  for (const event of events) {
    const eventShare = totalRps > 0 ? event.rps / totalRps : 0;
    const eventIntentShare = intentRatio;
    const nonIntentLatency = event.baseLatencyMs + 1 + cpuDelay + networkDelay;
    const intentLatency = event.baseLatencyMs
      + 4
      + Math.max(0, num("intentCpu"))
      + qwen3InvocationRatio * qwen3Latency
      + cpuDelay
      + networkDelay;
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
  return {
    totalRps,
    intentCandidateRps,
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
    qwen3RequestRps,
    qwen3TokenDemand,
    qwen3EffectiveTokenDemand,
    requiredQwen3Replicas,
    requiredProductionNpus,
    npuHbmGb,
    npuHbmUtil,
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
