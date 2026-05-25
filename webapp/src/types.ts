export type EventKey =
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
export type SystemStatus = "stable" | "degraded" | "high_risk" | "unstable";
export type Lang = "en" | "zh";

export interface Baseline {
  userCount: number;
  pduSessionsPerUser: number;
  intentRatio: number;
  cpuCores: number;
  nicGbps: number;
  ramGb: number;
  npuHbmPerNpuGb: number;
  nonlinearKnee: number;
  nonlinearAlpha: number;
  nonlinearPower: number;
  qwen3InvocationRatio: number;
  qwen3InputTokens: number;
  qwen3OutputTokens: number;
  qwen3TokenCapacity: number;
  qwen3TensorParallel: number;
  qwen3TargetUtil: number;
  nonIntentCpu: number;
  intentCpu: number;
  qwen3LatencyMs: number;
  intentBandwidthKb: number;
}

export interface EventDefinition {
  key: EventKey;
  inputId: string;
  labelKey: string;
  tipKey: string;
  perUserPerHour: number;
  baseLatencyMs: number;
  baseCpuMs: number;
  baseBandwidthKb: number;
}

export interface EventLoad extends EventDefinition {
  rps: number;
}

export interface Result {
  totalRps: number;
  intentCandidateRps: number;
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
  qwen3RequestRps: number;
  qwen3TokenDemand: number;
  qwen3EffectiveTokenDemand: number;
  requiredQwen3Replicas: number;
  requiredProductionNpus: number;
  npuHbmGb: number;
  npuHbmUtil: number;
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
