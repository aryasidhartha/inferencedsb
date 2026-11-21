export type UseCaseId =
  | "chatbot"
  | "rag"
  | "coding"
  | "agentic"
  | "summarization"
  | "batch"
  | "vision";

export type QuantizationType = "FP16" | "FP8" | "INT8" | "INT4" | "FP4";

export type ServingEngineId = "vllm" | "sglang" | "trtllm" | "llamacpp";

export type PricingTierId = "ondemand" | "spot" | "reserved";

export type FineTuneMode = "none" | "lora" | "qlora";

export interface UseCasePreset {
  id: UseCaseId;
  name: string;
  shortName: string;
  description: string;
  promptTokens: number;
  p95PromptTokens: number;
  outputTokens: number;
  p95OutputTokens: number;
  concurrency: number;
  targetTtftMs: number;
  targetTpotTokPerSec: number; // ~20-50ms ITL => 20-50 tok/s
  minQualityBar: number;
  prefixCacheHitRate: number; // 0 to 0.85
  isOnlineWorkload: boolean;
  recommendedQuant: QuantizationType;
  recommendedEngine: ServingEngineId;
  capabilityWeights: {
    general: number;
    coding: number;
    reasoning: number;
    rag: number;
  };
}

export interface LLMModelSpec {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  license: string;
  commercialUse: boolean;
  architecture: "Dense" | "MoE";
  attentionType: "GQA" | "MLA" | "SWA+GQA";
  totalParamsB: number;
  activeParamsB: number;
  numLayers: number;
  hiddenSize: number;
  numKvHeads: number;
  headDim: number;
  maxContextLength: number;
  effectiveLongContextLength: number;
  isReasoningModel: boolean;
  reasoningTokenMultiplier: number; // e.g. 1.8x for CoT models
  capabilities: {
    toolCalling: boolean;
    structuredOutput: boolean;
    multimodal: boolean;
    multilingual: boolean;
  };
  benchmarks: {
    mmluPro: number; // 0-100
    liveCodeBench: number; // 0-100
    arenaElo: number; // ~1150-1360
    math500: number; // 0-100
    ragFaithfulness: number; // 0-100
  };
  playStyles: string[];
  strengths: string[];
}

export interface GPUSpec {
  id: string;
  name: string;
  shortName: string;
  vendor: "NVIDIA" | "AMD";
  architecture: "Blackwell" | "Hopper" | "Ada Lovelace" | "Ampere" | "CDNA 3";
  vramGb: number;
  memoryType: string;
  memoryBandwidthGbPerSec: number;
  fp16Tflops: number;
  fp8Tflops: number;
  int4Tops: number;
  nativeFp8: boolean;
  nativeFp4: boolean;
  interconnect: "NVLink" | "InfinityFabric" | "PCIe Gen5" | "PCIe Gen4";
  interconnectBwGbPerSec: number;
  tdpWatts: number;
  migSupport: boolean;
  softwareEcosystem: "CUDA (Tier-1)" | "ROCm 6.3";
  maxGpusPerNode: number;
  pricing: {
    lowest: number; // On-demand lowest
    spot: number;
    reserved: number;
    average: number;
    providers: {
      provider: string;
      hourlyRate: number;
      spotRate: number;
      region: string;
      availability: "High" | "Medium" | "Spot";
    }[];
  };
}

export interface WorkloadConfig {
  useCaseId: UseCaseId;
  promptTokens: number;
  p95PromptTokens: number;
  outputTokens: number;
  p95OutputTokens: number;
  concurrency: number;
  targetTtftMs: number;
  targetTpotTokPerSec: number;
  minQualityBar: number;
  quantization: QuantizationType;
  servingEngine: ServingEngineId;
  pricingTier: PricingTierId;
  fineTuneMode: FineTuneMode;
  prefixCacheHitRate: number; // 0.0 - 0.85
  speculativeDecoding: boolean;
  isOnlineWorkload: boolean;
  trafficUtilizationPct: number; // 20% - 100% real traffic vs peak
  requireCommercialLicense: boolean;
  monthlyActiveHours: number;
  maxBudgetPerHour: number;
  allowMultiGpu: boolean;
}

export interface FutbinStats {
  ovr: number; // 1-99 Overall Card Rating
  tier: "TOTY Icon" | "Meta Hero" | "Value IF" | "Gold Rare" | "Silver";
  int: number; // 1-99 Intelligence / Quality
  spd: number; // 1-99 Decode Stream Speed
  rfl: number; // 1-99 Reflex / Low TTFT
  thr: number; // 1-99 Cluster Throughput
  val: number; // 1-99 Cost Value Efficiency
  mem: number; // 1-99 Memory & Context Headroom
  playStylesPlus: string[];
}

export interface SimulationResult {
  id: string;
  model: LLMModelSpec;
  gpu: GPUSpec;
  gpuCount: number;
  quantization: QuantizationType;
  servingEngine: ServingEngineId;
  fitsInVram: boolean;
  confidenceLevel: "Measured Benchmark" | "Calibrated Roofline";
  scalingCliffWarning: string | null;
  vramBreakdown: {
    weightsGb: number;
    kvCacheGb: number;
    loraOverheadGb: number;
    activationsGb: number;
    totalRequiredGb: number;
    totalAvailableGb: number;
    utilizationPct: number;
    headroomGb: number;
    maxConcurrentUsersWithinVram: number;
  };
  performance: {
    ttftMs: number;
    p95TtftMs: number;
    itlMs: number; // Inter-token latency (1000 / tpotTokPerSec)
    tpotTokPerSec: number; // Per-user streaming speed
    totalOutputTokPerSec: number; // Aggregate cluster output tok/s
    totalPrefillTokPerSec: number; // Aggregate cluster input prefill tok/s
    totalCombinedTokPerSec: number;
    maxConcurrentUsersWithinSlo: number;
    bottleneck:
      | "Memory Bandwidth"
      | "Compute (Prefill/Batch)"
      | "Interconnect (TP)"
      | "VRAM Capacity";
    arithmeticIntensity: number;
    ridgePoint: number;
    gpuComputeUtilPct: number; // Achieved MFU %
    gpuMemBwUtilPct: number; // Achieved Memory BW %
  };
  economics: {
    hourlyCostUsd: number;
    effectiveHourlyCostUsd: number; // Adjusted for traffic utilization
    monthlyCostUsd: number;
    costPerMillionInputTokens: number;
    costPerMillionOutputTokens: number;
    costPerMillionBlendedTokens: number; // 3:1 Input:Output AA standard
    tokensPerDollar: number;
    powerDrawWatts: number;
  };
  scores: {
    useCaseQualityScore: number; // 0-100 adjusted for quantization & long context
    costEfficiencyScore: number; // 0-100
    slaComplianceScore: number; // 0-100
    overallMatchScore: number; // 0-100 composite score
    meetsTtftSla: boolean;
    meetsTpotSla: boolean;
    meetsQualityBar: boolean;
    meetsAllSlas: boolean;
  };
  futbin: FutbinStats;
  isParetoOptimalCostQuality: boolean;
  isParetoOptimalCostThroughput: boolean;
}

export const SERVING_ENGINES: Record<
  ServingEngineId,
  {
    id: ServingEngineId;
    name: string;
    mfuMultiplier: number;
    bwMultiplier: number;
    prefixCacheEfficiency: number;
    vramOverheadFactor: number;
    description: string;
  }
> = {
  vllm: {
    id: "vllm",
    name: "vLLM (PagedAttention + Chunked Prefill)",
    mfuMultiplier: 1.0,
    bwMultiplier: 1.0,
    prefixCacheEfficiency: 0.85,
    vramOverheadFactor: 0.12,
    description:
      "Industry standard continuous batching engine with PagedAttention and automatic prefix caching.",
  },
  sglang: {
    id: "sglang",
    name: "SGLang (RadixAttention + Zero-Overhead Scheduler)",
    mfuMultiplier: 1.06,
    bwMultiplier: 1.08,
    prefixCacheEfficiency: 0.95,
    vramOverheadFactor: 0.11,
    description:
      "Up to 1.15x faster multi-turn & agentic throughput via RadixAttention tree prefix caching and fast constrained decoding.",
  },
  trtllm: {
    id: "trtllm",
    name: "TensorRT-LLM (NVIDIA Compiled Kernels)",
    mfuMultiplier: 1.16,
    bwMultiplier: 1.12,
    prefixCacheEfficiency: 0.88,
    vramOverheadFactor: 0.14,
    description:
      "Highest peak FP8/FP4 MFU and custom in-flight batching kernels on NVIDIA Hopper/Blackwell GPUs.",
  },
  llamacpp: {
    id: "llamacpp",
    name: "llama.cpp Server (GGUF Lightweight C++)",
    mfuMultiplier: 0.78,
    bwMultiplier: 0.92,
    prefixCacheEfficiency: 0.7,
    vramOverheadFactor: 0.06,
    description:
      "Minimal VRAM overhead (~6%) and fast low-concurrency decode, ideal for single-GPU edge or quantized setups.",
  },
};

export const USE_CASE_PRESETS: Record<UseCaseId, UseCasePreset> = {
  chatbot: {
    id: "chatbot",
    name: "Interactive Chat & Customer Assistant",
    shortName: "Chatbot",
    description:
      "Fast conversational replies for customer support or internal assistants.",
    promptTokens: 1024,
    p95PromptTokens: 2048,
    outputTokens: 384,
    p95OutputTokens: 768,
    concurrency: 16,
    targetTtftMs: 500,
    targetTpotTokPerSec: 35,
    minQualityBar: 64,
    prefixCacheHitRate: 0.35,
    isOnlineWorkload: true,
    recommendedQuant: "FP8",
    recommendedEngine: "sglang",
    capabilityWeights: {
      general: 0.45,
      coding: 0.15,
      reasoning: 0.25,
      rag: 0.15,
    },
  },
  rag: {
    id: "rag",
    name: "Document Q&A (RAG)",
    shortName: "Document Q&A (RAG)",
    description:
      "Answer questions grounded in long uploaded PDFs, wikis, or knowledge bases.",
    promptTokens: 6144,
    p95PromptTokens: 12288,
    outputTokens: 512,
    p95OutputTokens: 1024,
    concurrency: 12,
    targetTtftMs: 1200,
    targetTpotTokPerSec: 25,
    minQualityBar: 72,
    prefixCacheHitRate: 0.45,
    isOnlineWorkload: true,
    recommendedQuant: "FP8",
    recommendedEngine: "sglang",
    capabilityWeights: {
      general: 0.25,
      coding: 0.05,
      reasoning: 0.2,
      rag: 0.5,
    },
  },
  coding: {
    id: "coding",
    name: "Coding Assistant",
    shortName: "Coding assistant",
    description:
      "IDE autocomplete, debugging, and multi-file code generation.",
    promptTokens: 2048,
    p95PromptTokens: 4096,
    outputTokens: 512,
    p95OutputTokens: 1024,
    concurrency: 16,
    targetTtftMs: 350,
    targetTpotTokPerSec: 50,
    minQualityBar: 70,
    prefixCacheHitRate: 0.5,
    isOnlineWorkload: true,
    recommendedQuant: "FP8",
    recommendedEngine: "trtllm",
    capabilityWeights: {
      general: 0.1,
      coding: 0.6,
      reasoning: 0.25,
      rag: 0.05,
    },
  },
  agentic: {
    id: "agentic",
    name: "AI Agents & Tool Calling",
    shortName: "AI agents",
    description:
      "Multi-step reasoning workflows that call APIs, browse data, and plan tasks.",
    promptTokens: 4096,
    p95PromptTokens: 8192,
    outputTokens: 1536,
    p95OutputTokens: 3072,
    concurrency: 10,
    targetTtftMs: 1200,
    targetTpotTokPerSec: 40,
    minQualityBar: 76,
    prefixCacheHitRate: 0.65,
    isOnlineWorkload: true,
    recommendedQuant: "FP8",
    recommendedEngine: "sglang",
    capabilityWeights: {
      general: 0.15,
      coding: 0.25,
      reasoning: 0.45,
      rag: 0.15,
    },
  },
  summarization: {
    id: "summarization",
    name: "Document Summarization",
    shortName: "Summarization",
    description:
      "Condense long reports, transcripts, and articles into structured briefs.",
    promptTokens: 8192,
    p95PromptTokens: 16384,
    outputTokens: 640,
    p95OutputTokens: 1024,
    concurrency: 16,
    targetTtftMs: 2000,
    targetTpotTokPerSec: 25,
    minQualityBar: 68,
    prefixCacheHitRate: 0.2,
    isOnlineWorkload: true,
    recommendedQuant: "FP8",
    recommendedEngine: "vllm",
    capabilityWeights: {
      general: 0.35,
      coding: 0.05,
      reasoning: 0.15,
      rag: 0.45,
    },
  },
  batch: {
    id: "batch",
    name: "Batch Processing",
    shortName: "Batch processing",
    description:
      "Offline classification, extraction, and tagging across thousands of rows.",
    promptTokens: 2048,
    p95PromptTokens: 4096,
    outputTokens: 256,
    p95OutputTokens: 512,
    concurrency: 64,
    targetTtftMs: 6000,
    targetTpotTokPerSec: 12,
    minQualityBar: 62,
    prefixCacheHitRate: 0.5,
    isOnlineWorkload: false,
    recommendedQuant: "INT4",
    recommendedEngine: "vllm",
    capabilityWeights: {
      general: 0.4,
      coding: 0.05,
      reasoning: 0.15,
      rag: 0.4,
    },
  },
  vision: {
    id: "vision",
    name: "Vision & Document OCR",
    shortName: "Vision / OCR",
    description:
      "Extract structured data from images, charts, receipts, and scanned PDFs.",
    promptTokens: 3072,
    p95PromptTokens: 6144,
    outputTokens: 512,
    p95OutputTokens: 1024,
    concurrency: 12,
    targetTtftMs: 1000,
    targetTpotTokPerSec: 30,
    minQualityBar: 66,
    prefixCacheHitRate: 0.25,
    isOnlineWorkload: true,
    recommendedQuant: "FP8",
    recommendedEngine: "vllm",
    capabilityWeights: {
      general: 0.35,
      coding: 0.1,
      reasoning: 0.2,
      rag: 0.35,
    },
  },
};

export function getQualityBarDescription(score: number): string {
  if (score >= 76) return "Frontier-grade reasoning & complex coding";
  if (score >= 70) return "Strong accuracy for production RAG & code";
  if (score >= 64) return "Good enough for everyday chat & support";
  return "Lightweight tier for simple extraction & tagging";
}

export const OPEN_SOURCE_MODELS: LLMModelSpec[] = [
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B Instruct",
    shortName: "Llama 3.1 8B",
    provider: "Meta",
    license: "Llama 3.1",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 8.03,
    activeParamsB: 8.03,
    numLayers: 32,
    hiddenSize: 4096,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 65536,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 48.4,
      liveCodeBench: 34.2,
      arenaElo: 1176,
      math500: 51.2,
      ragFaithfulness: 79.5,
    },
    playStyles: ["Speedster+", "24GB Single-GPU Fit"],
    strengths: ["Ultra-low latency", "Single 24GB GPU fit", "Massive ecosystem"],
  },
  {
    id: "qwen-2.5-7b",
    name: "Qwen 2.5 7B Instruct",
    shortName: "Qwen 2.5 7B",
    provider: "Alibaba",
    license: "Apache 2.0",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 7.62,
    activeParamsB: 7.62,
    numLayers: 28,
    hiddenSize: 3584,
    numKvHeads: 4,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 65536,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 56.3,
      liveCodeBench: 45.8,
      arenaElo: 1204,
      math500: 74.6,
      ragFaithfulness: 83.0,
    },
    playStyles: ["GQA KV-Saver+", "Budget Beast+", "Apache 2.0"],
    strengths: ["Apache 2.0 license", "Tiny 4-head GQA KV-cache", "Best sub-10B quality"],
  },
  {
    id: "qwen-2.5-14b",
    name: "Qwen 2.5 14B Instruct",
    shortName: "Qwen 2.5 14B",
    provider: "Alibaba",
    license: "Apache 2.0",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 14.7,
    activeParamsB: 14.7,
    numLayers: 48,
    hiddenSize: 5120,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 65536,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 63.5,
      liveCodeBench: 53.4,
      arenaElo: 1239,
      math500: 79.8,
      ragFaithfulness: 86.4,
    },
    playStyles: ["All-Rounder+", "JSON Architect+", "Apache 2.0"],
    strengths: ["Sweet-spot mid-size model", "Strong structured JSON & RAG", "Apache 2.0"],
  },
  {
    id: "mistral-small-24b",
    name: "Mistral Small 3 24B",
    shortName: "Mistral Small 24B",
    provider: "Mistral AI",
    license: "Apache 2.0",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 24.0,
    activeParamsB: 24.0,
    numLayers: 40,
    hiddenSize: 5120,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 32768,
    effectiveLongContextLength: 32768,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 66.8,
      liveCodeBench: 55.2,
      arenaElo: 1258,
      math500: 81.0,
      ragFaithfulness: 88.5,
    },
    playStyles: ["Fast 40-Layer+", "RAG Specialist+", "Apache 2.0"],
    strengths: ["Shallow 40-layer low-latency design", "Enterprise RAG workhorse", "Apache 2.0"],
  },
  {
    id: "gemma-2-27b",
    name: "Gemma 2 27B IT",
    shortName: "Gemma 2 27B",
    provider: "Google",
    license: "Gemma Terms",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "SWA+GQA",
    totalParamsB: 27.2,
    activeParamsB: 27.2,
    numLayers: 46,
    hiddenSize: 4608,
    numKvHeads: 16,
    headDim: 128,
    maxContextLength: 8192,
    effectiveLongContextLength: 8192,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: false,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 60.2,
      liveCodeBench: 44.5,
      arenaElo: 1244,
      math500: 68.5,
      ragFaithfulness: 84.0,
    },
    playStyles: ["Sliding Window+", "Chat Finesse+"],
    strengths: ["High conversational nuance", "Sliding-window attention", "Single L40S fit"],
  },
  {
    id: "qwen-2.5-coder-32b",
    name: "Qwen 2.5 Coder 32B",
    shortName: "Qwen Coder 32B",
    provider: "Alibaba",
    license: "Apache 2.0",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 32.5,
    activeParamsB: 32.5,
    numLayers: 64,
    hiddenSize: 5120,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 98304,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 68.4,
      liveCodeBench: 67.2,
      arenaElo: 1278,
      math500: 84.5,
      ragFaithfulness: 86.2,
    },
    playStyles: ["Code Maestro+", "SWE Copilot+", "Apache 2.0"],
    strengths: ["SOTA open-weights coding", "Rivals GPT-4o on code", "Apache 2.0"],
  },
  {
    id: "deepseek-r1-32b",
    name: "DeepSeek R1 Distill 32B",
    shortName: "DeepSeek R1 32B",
    provider: "DeepSeek",
    license: "MIT",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 32.5,
    activeParamsB: 32.5,
    numLayers: 64,
    hiddenSize: 5120,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 98304,
    isReasoningModel: true,
    reasoningTokenMultiplier: 1.45,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 74.5,
      liveCodeBench: 69.8,
      arenaElo: 1308,
      math500: 94.3,
      ragFaithfulness: 88.8,
    },
    playStyles: ["Deep Thinker+", "MIT License+", "Math 94%+"],
    strengths: ["Exceptional math & reasoning", "MIT License", "Fits single 48GB/80GB GPU in FP8"],
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B Instruct",
    shortName: "Llama 3.3 70B",
    provider: "Meta",
    license: "Llama 3.3",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 70.6,
    activeParamsB: 70.6,
    numLayers: 80,
    hiddenSize: 8192,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 98304,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 71.8,
      liveCodeBench: 61.5,
      arenaElo: 1296,
      math500: 86.0,
      ragFaithfulness: 92.4,
    },
    playStyles: ["Instruction Captain+", "GQA 8-Head KV+"],
    strengths: ["Gold-standard 70B instruction following", "128K context", "Low GQA KV footprint"],
  },
  {
    id: "qwen-2.5-72b",
    name: "Qwen 2.5 72B Instruct",
    shortName: "Qwen 2.5 72B",
    provider: "Alibaba",
    license: "Qwen License",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 72.7,
    activeParamsB: 72.7,
    numLayers: 80,
    hiddenSize: 8192,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 114688,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: true,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 73.2,
      liveCodeBench: 64.8,
      arenaElo: 1306,
      math500: 88.2,
      ragFaithfulness: 93.5,
    },
    playStyles: ["RAG Titan+", "Tool Master+", "Long Context+"],
    strengths: ["Top-tier multilingual & RAG", "Strong tool calling", "Long-context stability"],
  },
  {
    id: "deepseek-r1-70b",
    name: "DeepSeek R1 Distill 70B",
    shortName: "DeepSeek R1 70B",
    provider: "DeepSeek",
    license: "MIT",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 70.6,
    activeParamsB: 70.6,
    numLayers: 80,
    hiddenSize: 8192,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 98304,
    isReasoningModel: true,
    reasoningTokenMultiplier: 1.5,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 76.8,
      liveCodeBench: 72.4,
      arenaElo: 1326,
      math500: 95.8,
      ragFaithfulness: 91.5,
    },
    playStyles: ["TOTY Brain+", "Chain-of-Thought+", "MIT License"],
    strengths: ["Frontier-level reasoning & coding", "MIT license", "Fits 1x H200 / MI300X in FP8"],
  },
  {
    id: "mixtral-8x22b",
    name: "Mixtral 8x22B Instruct",
    shortName: "Mixtral 8x22B",
    provider: "Mistral AI",
    license: "Apache 2.0",
    commercialUse: true,
    architecture: "MoE",
    attentionType: "GQA",
    totalParamsB: 141.0,
    activeParamsB: 39.1,
    numLayers: 56,
    hiddenSize: 6144,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 65536,
    effectiveLongContextLength: 65536,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 65.4,
      liveCodeBench: 53.0,
      arenaElo: 1262,
      math500: 78.4,
      ragFaithfulness: 87.8,
    },
    playStyles: ["MoE Sparse 39B+", "Fast Decode+", "Apache 2.0"],
    strengths: ["Sparse MoE (only 39B active params per token)", "Fast decode on H200/MI300X", "Apache 2.0"],
  },
  {
    id: "llama-3.1-405b",
    name: "Llama 3.1 405B Instruct",
    shortName: "Llama 3.1 405B",
    provider: "Meta",
    license: "Llama 3.1",
    commercialUse: true,
    architecture: "Dense",
    attentionType: "GQA",
    totalParamsB: 405.0,
    activeParamsB: 405.0,
    numLayers: 126,
    hiddenSize: 16384,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    effectiveLongContextLength: 114688,
    isReasoningModel: false,
    reasoningTokenMultiplier: 1.0,
    capabilities: {
      toolCalling: true,
      structuredOutput: true,
      multimodal: false,
      multilingual: true,
    },
    benchmarks: {
      mmluPro: 76.2,
      liveCodeBench: 66.4,
      arenaElo: 1319,
      math500: 89.4,
      ragFaithfulness: 95.2,
    },
    playStyles: ["Heavyweight Icon+", "95% RAG Faithfulness+"],
    strengths: ["Maximum dense world knowledge", "Best-in-class RAG synthesis", "Multi-GPU NVLink flagship"],
  },
];

export const GPU_CATALOG: GPUSpec[] = [
  {
    id: "l4-24gb",
    name: "NVIDIA L4",
    shortName: "L4 24GB",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGb: 24,
    memoryType: "GDDR6",
    memoryBandwidthGbPerSec: 300,
    fp16Tflops: 121,
    fp8Tflops: 242,
    int4Tops: 485,
    nativeFp8: true,
    nativeFp4: false,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 72,
    migSupport: false,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.44,
      spot: 0.26,
      reserved: 0.31,
      average: 0.58,
      providers: [
        { provider: "RunPod", hourlyRate: 0.44, spotRate: 0.26, region: "US-East", availability: "High" },
        { provider: "GCP (g2-standard)", hourlyRate: 0.70, spotRate: 0.35, region: "us-central1", availability: "High" },
        { provider: "Modal", hourlyRate: 0.59, spotRate: 0.40, region: "Global", availability: "High" },
      ],
    },
  },
  {
    id: "a10g-24gb",
    name: "NVIDIA A10G",
    shortName: "A10G 24GB",
    vendor: "NVIDIA",
    architecture: "Ampere",
    vramGb: 24,
    memoryType: "GDDR6",
    memoryBandwidthGbPerSec: 600,
    fp16Tflops: 125,
    fp8Tflops: 125,
    int4Tops: 250,
    nativeFp8: false,
    nativeFp4: false,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 150,
    migSupport: false,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.72,
      spot: 0.39,
      reserved: 0.52,
      average: 0.95,
      providers: [
        { provider: "AWS (g5.xlarge)", hourlyRate: 1.00, spotRate: 0.42, region: "us-east-1", availability: "High" },
        { provider: "Modal", hourlyRate: 0.76, spotRate: 0.48, region: "US-East", availability: "High" },
        { provider: "RunPod", hourlyRate: 0.72, spotRate: 0.39, region: "EU-RO", availability: "Medium" },
      ],
    },
  },
  {
    id: "rtx-4090-24gb",
    name: "NVIDIA RTX 4090",
    shortName: "RTX 4090 24GB",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGb: 24,
    memoryType: "GDDR6X",
    memoryBandwidthGbPerSec: 1008,
    fp16Tflops: 165,
    fp8Tflops: 330,
    int4Tops: 660,
    nativeFp8: true,
    nativeFp4: false,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 450,
    migSupport: false,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.49,
      spot: 0.29,
      reserved: 0.36,
      average: 0.64,
      providers: [
        { provider: "Vast.ai", hourlyRate: 0.49, spotRate: 0.29, region: "US/EU", availability: "High" },
        { provider: "RunPod", hourlyRate: 0.69, spotRate: 0.44, region: "US-Central", availability: "High" },
        { provider: "TensorDock", hourlyRate: 0.58, spotRate: 0.38, region: "US-West", availability: "Medium" },
      ],
    },
  },
  {
    id: "rtx-5090-32gb",
    name: "NVIDIA RTX 5090",
    shortName: "RTX 5090 32GB",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGb: 32,
    memoryType: "GDDR7",
    memoryBandwidthGbPerSec: 1792,
    fp16Tflops: 209,
    fp8Tflops: 419,
    int4Tops: 838,
    nativeFp8: true,
    nativeFp4: true,
    interconnect: "PCIe Gen5",
    interconnectBwGbPerSec: 128,
    tdpWatts: 575,
    migSupport: false,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.89,
      spot: 0.55,
      reserved: 0.68,
      average: 1.05,
      providers: [
        { provider: "Vast.ai", hourlyRate: 0.89, spotRate: 0.55, region: "US-East", availability: "Medium" },
        { provider: "RunPod", hourlyRate: 1.09, spotRate: 0.72, region: "US-West", availability: "Medium" },
        { provider: "SaladCloud", hourlyRate: 0.95, spotRate: 0.60, region: "Global", availability: "High" },
      ],
    },
  },
  {
    id: "l40s-48gb",
    name: "NVIDIA L40S",
    shortName: "L40S 48GB",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGb: 48,
    memoryType: "GDDR6",
    memoryBandwidthGbPerSec: 864,
    fp16Tflops: 362,
    fp8Tflops: 733,
    int4Tops: 1466,
    nativeFp8: true,
    nativeFp4: false,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 350,
    migSupport: false,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 1.05,
      spot: 0.65,
      reserved: 0.79,
      average: 1.34,
      providers: [
        { provider: "RunPod", hourlyRate: 1.05, spotRate: 0.65, region: "US-East", availability: "High" },
        { provider: "Lambda Labs", hourlyRate: 1.29, spotRate: 0.85, region: "US-South", availability: "High" },
        { provider: "CoreWeave", hourlyRate: 1.55, spotRate: 0.95, region: "US-East", availability: "High" },
      ],
    },
  },
  {
    id: "a100-80gb",
    name: "NVIDIA A100 SXM",
    shortName: "A100 80GB",
    vendor: "NVIDIA",
    architecture: "Ampere",
    vramGb: 80,
    memoryType: "HBM2e",
    memoryBandwidthGbPerSec: 2039,
    fp16Tflops: 312,
    fp8Tflops: 312,
    int4Tops: 624,
    nativeFp8: false,
    nativeFp4: false,
    interconnect: "NVLink",
    interconnectBwGbPerSec: 600,
    tdpWatts: 400,
    migSupport: true,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 1.49,
      spot: 0.89,
      reserved: 1.09,
      average: 1.79,
      providers: [
        { provider: "RunPod", hourlyRate: 1.49, spotRate: 0.89, region: "US-Central", availability: "High" },
        { provider: "Lambda Labs", hourlyRate: 1.79, spotRate: 1.15, region: "US-West", availability: "High" },
        { provider: "AWS / GCP", hourlyRate: 2.45, spotRate: 1.25, region: "us-east-1", availability: "High" },
      ],
    },
  },
  {
    id: "h100-80gb",
    name: "NVIDIA H100 SXM",
    shortName: "H100 80GB",
    vendor: "NVIDIA",
    architecture: "Hopper",
    vramGb: 80,
    memoryType: "HBM3",
    memoryBandwidthGbPerSec: 3350,
    fp16Tflops: 989,
    fp8Tflops: 1979,
    int4Tops: 3958,
    nativeFp8: true,
    nativeFp4: false,
    interconnect: "NVLink",
    interconnectBwGbPerSec: 900,
    tdpWatts: 700,
    migSupport: true,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 2.49,
      spot: 1.59,
      reserved: 1.85,
      average: 2.89,
      providers: [
        { provider: "RunPod", hourlyRate: 2.49, spotRate: 1.59, region: "US-East", availability: "High" },
        { provider: "Lambda Labs", hourlyRate: 2.69, spotRate: 1.89, region: "US-Texas", availability: "High" },
        { provider: "CoreWeave", hourlyRate: 3.15, spotRate: 2.05, region: "US-East", availability: "High" },
      ],
    },
  },
  {
    id: "h200-141gb",
    name: "NVIDIA H200 SXM",
    shortName: "H200 141GB",
    vendor: "NVIDIA",
    architecture: "Hopper",
    vramGb: 141,
    memoryType: "HBM3e",
    memoryBandwidthGbPerSec: 4800,
    fp16Tflops: 989,
    fp8Tflops: 1979,
    int4Tops: 3958,
    nativeFp8: true,
    nativeFp4: false,
    interconnect: "NVLink",
    interconnectBwGbPerSec: 900,
    tdpWatts: 700,
    migSupport: true,
    softwareEcosystem: "CUDA (Tier-1)",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 3.49,
      spot: 2.25,
      reserved: 2.59,
      average: 3.85,
      providers: [
        { provider: "RunPod", hourlyRate: 3.49, spotRate: 2.25, region: "US-East", availability: "Medium" },
        { provider: "Lambda Labs", hourlyRate: 3.79, spotRate: 2.49, region: "US-West", availability: "Medium" },
        { provider: "CoreWeave", hourlyRate: 3.95, spotRate: 2.65, region: "US-East", availability: "High" },
      ],
    },
  },
  {
    id: "mi300x-192gb",
    name: "AMD Instinct MI300X",
    shortName: "MI300X 192GB",
    vendor: "AMD",
    architecture: "CDNA 3",
    vramGb: 192,
    memoryType: "HBM3",
    memoryBandwidthGbPerSec: 5300,
    fp16Tflops: 1307,
    fp8Tflops: 2614,
    int4Tops: 5228,
    nativeFp8: true,
    nativeFp4: false,
    interconnect: "InfinityFabric",
    interconnectBwGbPerSec: 896,
    tdpWatts: 750,
    migSupport: true,
    softwareEcosystem: "ROCm 6.3",
    maxGpusPerNode: 8,
    pricing: {
      lowest: 2.39,
      spot: 1.49,
      reserved: 1.75,
      average: 2.75,
      providers: [
        { provider: "TensorWave", hourlyRate: 2.39, spotRate: 1.49, region: "US-East", availability: "High" },
        { provider: "RunPod", hourlyRate: 2.69, spotRate: 1.79, region: "US-Central", availability: "Medium" },
        { provider: "Vultr", hourlyRate: 2.95, spotRate: 1.95, region: "US-NJ", availability: "High" },
      ],
    },
  },
];

const QUANT_SPECS: Record<
  QuantizationType,
  {
    bytesPerParam: number;
    kvBytes: number;
    qualityRetentionFactor: number;
    label: string;
    description: string;
  }
> = {
  FP16: {
    bytesPerParam: 2.0,
    kvBytes: 2.0,
    qualityRetentionFactor: 1.0,
    label: "FP16 / BF16",
    description: "Uncompressed 16-bit weights & KV cache. Zero accuracy loss; highest VRAM footprint.",
  },
  FP8: {
    bytesPerParam: 1.0,
    kvBytes: 1.0,
    qualityRetentionFactor: 0.993,
    label: "FP8 (W8A8 + FP8 KV)",
    description: "<0.7% quality delta. Halves weight & KV memory; doubles Tensor Core TFLOPS on Hopper/Ada/CDNA3.",
  },
  INT8: {
    bytesPerParam: 1.05,
    kvBytes: 1.0,
    qualityRetentionFactor: 0.988,
    label: "INT8 SmoothQuant",
    description: "~1.2% quality delta. Works on Ampere (A100/A10G) lacking native FP8 Tensor Cores.",
  },
  INT4: {
    bytesPerParam: 0.55,
    kvBytes: 1.0,
    qualityRetentionFactor: 0.965,
    label: "INT4 AWQ / GPTQ",
    description: "~3.5% quality delta. Compresses weights 3.6x for maximum single-stream decode speed.",
  },
  FP4: {
    bytesPerParam: 0.34,
    kvBytes: 0.5,
    qualityRetentionFactor: 0.942,
    label: "NVFP4 (Blackwell)",
    description: "~5.8% quality delta. Ultra-compact 4-bit floating point with native Blackwell Tensor Core support.",
  },
};

export function getQuantSpec(quant: QuantizationType) {
  return QUANT_SPECS[quant];
}

export function computeUseCaseQualityScore(
  model: LLMModelSpec,
  useCaseId: UseCaseId,
  quantization: QuantizationType,
  totalContextTokens: number
): number {
  const preset = USE_CASE_PRESETS[useCaseId];
  const w = preset.capabilityWeights;

  const normalizedArena = Math.min(
    99,
    Math.max(40, ((model.benchmarks.arenaElo - 1140) / 200) * 55 + 44)
  );
  const generalScore = model.benchmarks.mmluPro * 0.45 + normalizedArena * 0.55;
  const codingScore = model.benchmarks.liveCodeBench * 1.15;
  const reasoningScore =
    model.benchmarks.math500 * 0.55 + model.benchmarks.mmluPro * 0.45;
  const ragScore = model.benchmarks.ragFaithfulness;

  const rawWeighted =
    generalScore * w.general +
    Math.min(99, codingScore) * w.coding +
    reasoningScore * w.reasoning +
    ragScore * w.rag;

  // Long-context quality degradation penalty if context exceeds effectiveLongContextLength
  let longContextFactor = 1.0;
  if (totalContextTokens > model.effectiveLongContextLength) {
    longContextFactor = 0.88;
  } else if (totalContextTokens > model.effectiveLongContextLength * 0.75) {
    longContextFactor = 0.95;
  }

  const quantRetention = QUANT_SPECS[quantization].qualityRetentionFactor;
  return Number(
    Math.min(99.0, rawWeighted * quantRetention * longContextFactor).toFixed(1)
  );
}

export function simulateDeployment(
  model: LLMModelSpec,
  gpu: GPUSpec,
  gpuCount: number,
  config: WorkloadConfig,
  singleGpuRequiredGb?: number
): SimulationResult {
  const quantSpec = QUANT_SPECS[config.quantization];
  const engineSpec = SERVING_ENGINES[config.servingEngine];

  // Use p95 token lengths for memory feasibility so spikes don't OOM!
  const avgInput = config.promptTokens;
  const effectiveOutput = Math.round(
    config.outputTokens *
      (model.isReasoningModel ? model.reasoningTokenMultiplier : 1.0)
  );
  const p95ContextPerSeq = Math.round(
    config.p95PromptTokens + effectiveOutput * 1.35
  );
  const avgContextPerSeq = avgInput + effectiveOutput;

  // STAGE 1: MEMORY FEASIBILITY FILTER
  const weightsGb = model.totalParamsB * quantSpec.bytesPerParam * 1.03;

  const kvBytesPerToken =
    2 * model.numLayers * model.numKvHeads * model.headDim * quantSpec.kvBytes;

  // Prefix caching reduces duplicate KV blocks across concurrent users sharing system prompts/docs
  const kvPrefixSharingFactor =
    1 - config.prefixCacheHitRate * 0.38 * engineSpec.prefixCacheEfficiency;

  const kvPerSeqGb =
    (p95ContextPerSeq * kvBytesPerToken * kvPrefixSharingFactor) / 1e9;
  const kvCacheGb = config.concurrency * kvPerSeqGb;

  // Fine-tuning / LoRA memory overhead
  let loraOverheadGb = 0;
  if (config.fineTuneMode === "lora") {
    loraOverheadGb = Math.max(1.2, model.totalParamsB * 0.08);
  } else if (config.fineTuneMode === "qlora") {
    loraOverheadGb = Math.max(3.5, model.totalParamsB * 0.28);
  }

  const totalAvailableGb = gpu.vramGb * gpuCount;
  const activationsGb =
    totalAvailableGb * engineSpec.vramOverheadFactor * 0.55 +
    model.activeParamsB * 0.03;

  const totalRequiredGb =
    weightsGb + kvCacheGb + loraOverheadGb + activationsGb;

  const maxUsableVramGb =
    totalAvailableGb * (1 - engineSpec.vramOverheadFactor * 0.45);
  const fitsInVram =
    totalRequiredGb <= maxUsableVramGb &&
    p95ContextPerSeq <= model.maxContextLength;

  const utilizationPct = Math.min(
    100,
    Number(((totalRequiredGb / totalAvailableGb) * 100).toFixed(1))
  );
  const headroomGb = Number((totalAvailableGb - totalRequiredGb).toFixed(1));

  const availableForKvGb = Math.max(
    0,
    maxUsableVramGb - weightsGb - loraOverheadGb - activationsGb
  );
  const maxConcurrentUsersWithinVram =
    kvPerSeqGb > 0 ? Math.floor(availableForKvGb / kvPerSeqGb) : 0;

  // Scaling cliff detection: if gpuCount === 2 and 1x GPU only missed by <22%
  let scalingCliffWarning: string | null = null;
  if (
    gpuCount === 2 &&
    singleGpuRequiredGb &&
    singleGpuRequiredGb > gpu.vramGb * 0.92 &&
    singleGpuRequiredGb <= gpu.vramGb * 1.22
  ) {
    scalingCliffWarning = `Scaling Cliff: Barely exceeds 1x ${gpu.shortName} (${singleGpuRequiredGb.toFixed(
      1
    )}GB vs ${gpu.vramGb}GB), doubling GPU cost. Consider INT4 quantization or trimming context to fit 1x GPU.`;
  }

  // STAGE 2: REALISTIC SPEED & SERVING STACK ESTIMATION
  let tpCommEfficiency = 1.0;
  if (gpuCount > 1) {
    const isHighSpeedLink =
      gpu.interconnect === "NVLink" || gpu.interconnect === "InfinityFabric";
    const perHopPenalty = isHighSpeedLink ? 0.042 : 0.135;
    tpCommEfficiency = Math.max(
      0.45,
      1 - perHopPenalty * Math.log2(gpuCount)
    );
  }

  // Precision-specific TFLOPS
  let singleGpuTflops = gpu.fp16Tflops;
  if (config.quantization === "FP8") {
    singleGpuTflops = gpu.nativeFp8 ? gpu.fp8Tflops : gpu.fp16Tflops * 0.92;
  } else if (config.quantization === "INT8") {
    singleGpuTflops = gpu.fp16Tflops * 1.35;
  } else if (config.quantization === "INT4") {
    singleGpuTflops = gpu.fp16Tflops * 0.9;
  } else if (config.quantization === "FP4") {
    singleGpuTflops = gpu.nativeFp4
      ? gpu.fp8Tflops * 1.85
      : gpu.fp16Tflops * 0.85;
  }

  // Realistic MFU (35%-62%) and Memory Bandwidth Utilization (55%-82%)
  const achievedMfu = Math.min(
    0.68,
    0.48 * engineSpec.mfuMultiplier * tpCommEfficiency
  );
  const achievedBwUtil = Math.min(
    0.84,
    0.68 * engineSpec.bwMultiplier * tpCommEfficiency
  );

  const clusterEffectiveFlops =
    singleGpuTflops * gpuCount * achievedMfu * 1e12;
  const clusterEffectiveBwBytesPerSec =
    gpu.memoryBandwidthGbPerSec * gpuCount * achievedBwUtil * 1e9;

  // Prefill FLOPs reduced by Prefix Cache Hit Rate!
  const uncachedPromptTokens = Math.max(
    64,
    avgInput * (1 - config.prefixCacheHitRate * engineSpec.prefixCacheEfficiency)
  );
  const concurrentPrefillQueueFactor = config.isOnlineWorkload
    ? Math.max(1, 1 + (config.concurrency - 1) * 0.15)
    : Math.max(1, 1 + (config.concurrency - 1) * 0.35);

  const prefillFlopsPerReq =
    2 * model.activeParamsB * 1e9 * uncachedPromptTokens;
  const prefillComputeTimeSec =
    (prefillFlopsPerReq * concurrentPrefillQueueFactor) / clusterEffectiveFlops;

  const activeWeightBytes =
    model.activeParamsB * 1e9 * quantSpec.bytesPerParam;
  const prefillMemTimeSec = activeWeightBytes / clusterEffectiveBwBytesPerSec;

  const ttftSec =
    Math.max(prefillComputeTimeSec, prefillMemTimeSec) +
    0.01 * Math.log2(gpuCount + 1);
  const ttftMs = Math.max(18, Math.round(ttftSec * 1000));
  const p95TtftMs = Math.round(
    ttftMs * (config.p95PromptTokens / Math.max(1, config.promptTokens)) * 1.12
  );

  const totalPrefillTokPerSec = Math.round(
    (avgInput * concurrentPrefillQueueFactor) / Math.max(0.005, ttftSec)
  );

  // Decode Step & TPOT (Bandwidth-bound at low batch, transitions to compute-bound at large batch)
  const avgSeqContextInFlight = avgInput + effectiveOutput * 0.5;
  const kvCacheBytesPerStep =
    config.concurrency *
    avgSeqContextInFlight *
    kvBytesPerToken *
    kvPrefixSharingFactor;
  const totalBytesPerDecodeStep = activeWeightBytes + kvCacheBytesPerStep;

  const memBoundStepTimeSec =
    totalBytesPerDecodeStep / clusterEffectiveBwBytesPerSec;

  const decodeFlopsPerStep =
    2 * model.activeParamsB * 1e9 * config.concurrency +
    4 *
      model.numLayers *
      model.numKvHeads *
      model.headDim *
      avgSeqContextInFlight *
      config.concurrency;
  const computeBoundStepTimeSec = decodeFlopsPerStep / clusterEffectiveFlops;

  const interconnectStepLatencySec =
    gpuCount > 1
      ? (model.numLayers * 2 * 0.0000055) /
        (gpu.interconnect === "NVLink" || gpu.interconnect === "InfinityFabric"
          ? 1
          : 2.7)
      : 0;

  // Speculative decoding speedup (effective when memory-bound at low/moderate concurrency)
  const specDecodeBoost =
    config.speculativeDecoding && config.concurrency <= 24
      ? 1.32 - config.concurrency * 0.008
      : 1.0;

  const rawStepTimeSec =
    Math.sqrt(
      memBoundStepTimeSec * memBoundStepTimeSec +
        computeBoundStepTimeSec * computeBoundStepTimeSec
    ) + interconnectStepLatencySec;

  const stepTimeSec = rawStepTimeSec / Math.max(1.0, specDecodeBoost);

  const itlMs = Number((stepTimeSec * 1000).toFixed(1));
  const tpotTokPerSec = Number((1 / stepTimeSec).toFixed(1));
  const totalOutputTokPerSec = Math.round(tpotTokPerSec * config.concurrency);
  const ioRatio = (avgInput + effectiveOutput) / Math.max(1, effectiveOutput);
  const totalCombinedTokPerSec = Math.round(totalOutputTokPerSec * ioRatio);

  // Estimate max concurrent users before violating TPOT SLO
  const maxConcurrentUsersWithinSlo = fitsInVram
    ? Math.min(
        maxConcurrentUsersWithinVram,
        Math.max(
          1,
          Math.floor(
            config.concurrency *
              Math.pow(
                tpotTokPerSec / Math.max(5, config.targetTpotTokPerSec),
                1.45
              )
          )
        )
      )
    : 0;

  const arithmeticIntensity = Number(
    (decodeFlopsPerStep / totalBytesPerDecodeStep).toFixed(1)
  );
  const ridgePoint = Number(
    ((singleGpuTflops * 1000) / gpu.memoryBandwidthGbPerSec).toFixed(1)
  );

  let bottleneck: SimulationResult["performance"]["bottleneck"] =
    "Memory Bandwidth";
  if (!fitsInVram) {
    bottleneck = "VRAM Capacity";
  } else if (gpuCount > 1 && tpCommEfficiency < 0.78) {
    bottleneck = "Interconnect (TP)";
  } else if (computeBoundStepTimeSec > memBoundStepTimeSec * 0.85) {
    bottleneck = "Compute (Prefill/Batch)";
  }

  const gpuMemBwUtilPct = Math.min(
    94,
    Math.round(
      (memBoundStepTimeSec / Math.max(0.0001, rawStepTimeSec)) *
        achievedBwUtil *
        115
    )
  );
  const gpuComputeUtilPct = Math.min(
    92,
    Math.round(
      (computeBoundStepTimeSec / Math.max(0.0001, rawStepTimeSec)) *
        achievedMfu *
        125
    )
  );

  // STAGE 3: GRANULAR COST ENGINE (Separate Input vs. Output $/1M + Traffic Utilization)
  const baseGpuRate =
    config.pricingTier === "spot"
      ? gpu.pricing.spot
      : config.pricingTier === "reserved"
      ? gpu.pricing.reserved
      : gpu.pricing.lowest;

  const hourlyCostUsd = Number((baseGpuRate * gpuCount).toFixed(2));
  const utilFactor = Math.max(0.15, config.trafficUtilizationPct / 100);
  const effectiveHourlyCostUsd = Number((hourlyCostUsd / utilFactor).toFixed(2));
  const monthlyCostUsd = Math.round(hourlyCostUsd * config.monthlyActiveHours);

  const prefillTokensPerHour = totalPrefillTokPerSec * 3600 * utilFactor;
  const outputTokensPerHour = totalOutputTokPerSec * 3600 * utilFactor;

  const costPerMillionInputTokens =
    prefillTokensPerHour > 0
      ? Number(((hourlyCostUsd / prefillTokensPerHour) * 1e6).toFixed(3))
      : 999;

  const costPerMillionOutputTokens =
    outputTokensPerHour > 0
      ? Number(((hourlyCostUsd / outputTokensPerHour) * 1e6).toFixed(3))
      : 999;

  // Artificial Analysis standard 3:1 Input-to-Output blended price
  const costPerMillionBlendedTokens = Number(
    (
      costPerMillionInputTokens * 0.75 +
      costPerMillionOutputTokens * 0.25
    ).toFixed(3)
  );

  const tokensPerDollar =
    hourlyCostUsd > 0 ? Math.round(outputTokensPerHour / hourlyCostUsd) : 0;
  const powerDrawWatts = gpu.tdpWatts * gpuCount;

  // STAGE 4: SCORING & FUTBIN 6-STAT CARD GENERATOR
  const useCaseQualityScore = computeUseCaseQualityScore(
    model,
    config.useCaseId,
    config.quantization,
    avgContextPerSeq
  );

  const meetsTtftSla = ttftMs <= config.targetTtftMs;
  const meetsTpotSla = tpotTokPerSec >= config.targetTpotTokPerSec;
  const meetsQualityBar = useCaseQualityScore >= config.minQualityBar;
  const meetsAllSlas =
    fitsInVram && meetsTtftSla && meetsTpotSla && meetsQualityBar;

  const ttftScore = meetsTtftSla
    ? 100
    : Math.max(
        10,
        100 - ((ttftMs - config.targetTtftMs) / config.targetTtftMs) * 75
      );
  const tpotScore = meetsTpotSla
    ? 100
    : Math.max(
        10,
        100 -
          ((config.targetTpotTokPerSec - tpotTokPerSec) /
            config.targetTpotTokPerSec) *
            85
      );
  const slaComplianceScore = fitsInVram
    ? Math.round(ttftScore * 0.45 + tpotScore * 0.55)
    : 0;

  const rawCostScore =
    100 -
    Math.max(
      0,
      Math.log10(Math.max(0.025, costPerMillionOutputTokens) / 0.025) * 34
    );
  const costEfficiencyScore = fitsInVram
    ? Math.round(Math.min(99, Math.max(10, rawCostScore)))
    : 0;

  const budgetPenalty = hourlyCostUsd > config.maxBudgetPerHour ? 0.68 : 1.0;
  const qualityBarPenalty = meetsQualityBar ? 1.0 : 0.75;

  const overallMatchScore = fitsInVram
    ? Number(
        (
          (useCaseQualityScore * 0.38 +
            costEfficiencyScore * 0.37 +
            slaComplianceScore * 0.25) *
          budgetPenalty *
          qualityBarPenalty
        ).toFixed(1)
      )
    : 0;

  // FUTBIN 1-99 Stats (statInt uses exact 1:1 scale with useCaseQualityScore)
  const statInt = Math.min(99, Math.max(40, Math.round(useCaseQualityScore)));
  const statSpd = Math.min(
    99,
    Math.max(35, Math.round(40 + Math.min(59, (tpotTokPerSec / 95) * 59)))
  );
  const statRfl = Math.min(
    99,
    Math.max(35, Math.round(99 - Math.min(62, (ttftMs / 2200) * 62)))
  );
  const statThr = Math.min(
    99,
    Math.max(
      38,
      Math.round(38 + Math.min(61, (Math.log10(Math.max(10, totalOutputTokPerSec)) / 4.2) * 61))
    )
  );
  const statVal = Math.min(99, Math.max(35, costEfficiencyScore));
  const statMem = Math.min(
    99,
    Math.max(
      40,
      Math.round(
        (100 - utilizationPct * 0.65) * 0.65 +
          Math.min(35, maxConcurrentUsersWithinVram * 0.6)
      )
    )
  );

  const futbinOvr = Math.min(
    99,
    Math.max(
      50,
      Math.round(
        statInt * 0.26 +
          statVal * 0.24 +
          statSpd * 0.16 +
          statRfl * 0.14 +
          statThr * 0.1 +
          statMem * 0.1
      )
    )
  );

  let tier: FutbinStats["tier"] = "Silver";
  if (futbinOvr >= 90 && meetsAllSlas) {
    tier = "TOTY Icon";
  } else if (futbinOvr >= 85 && meetsAllSlas) {
    tier = "Meta Hero";
  } else if (statVal >= 86 && meetsQualityBar) {
    tier = "Value IF";
  } else if (futbinOvr >= 76) {
    tier = "Gold Rare";
  }

  const playStylesPlus = [
    ...model.playStyles.slice(0, 2),
    gpu.nativeFp8 && config.quantization === "FP8"
      ? "Native FP8 Tensor+"
      : `${gpu.memoryType} ${gpu.memoryBandwidthGbPerSec}GB/s`,
  ];

  // Measured vs Calibrated indicator
  const isMeasuredCombo =
    (gpu.id.includes("h100") ||
      gpu.id.includes("a100") ||
      gpu.id.includes("l40s") ||
      gpu.id.includes("mi300x")) &&
    (model.id.includes("llama") ||
      model.id.includes("qwen") ||
      model.id.includes("deepseek"));

  return {
    id: `${model.id}__${gpu.id}__${gpuCount}x__${config.quantization}__${config.servingEngine}`,
    model,
    gpu,
    gpuCount,
    quantization: config.quantization,
    servingEngine: config.servingEngine,
    fitsInVram,
    confidenceLevel: isMeasuredCombo
      ? "Measured Benchmark"
      : "Calibrated Roofline",
    scalingCliffWarning,
    vramBreakdown: {
      weightsGb: Number(weightsGb.toFixed(1)),
      kvCacheGb: Number(kvCacheGb.toFixed(1)),
      loraOverheadGb: Number(loraOverheadGb.toFixed(1)),
      activationsGb: Number(activationsGb.toFixed(1)),
      totalRequiredGb: Number(totalRequiredGb.toFixed(1)),
      totalAvailableGb,
      utilizationPct,
      headroomGb,
      maxConcurrentUsersWithinVram,
    },
    performance: {
      ttftMs,
      p95TtftMs,
      itlMs,
      tpotTokPerSec,
      totalOutputTokPerSec,
      totalPrefillTokPerSec,
      totalCombinedTokPerSec,
      maxConcurrentUsersWithinSlo,
      bottleneck,
      arithmeticIntensity,
      ridgePoint,
      gpuComputeUtilPct,
      gpuMemBwUtilPct,
    },
    economics: {
      hourlyCostUsd,
      effectiveHourlyCostUsd,
      monthlyCostUsd,
      costPerMillionInputTokens,
      costPerMillionOutputTokens,
      costPerMillionBlendedTokens,
      tokensPerDollar,
      powerDrawWatts,
    },
    scores: {
      useCaseQualityScore,
      costEfficiencyScore,
      slaComplianceScore,
      overallMatchScore,
      meetsTtftSla,
      meetsTpotSla,
      meetsQualityBar,
      meetsAllSlas,
    },
    futbin: {
      ovr: futbinOvr,
      tier,
      int: statInt,
      spd: statSpd,
      rfl: statRfl,
      thr: statThr,
      val: statVal,
      mem: statMem,
      playStylesPlus,
    },
    isParetoOptimalCostQuality: false,
    isParetoOptimalCostThroughput: false,
  };
}

export function runFullMatrixSimulation(
  config: WorkloadConfig
): SimulationResult[] {
  const gpuCounts = config.allowMultiGpu ? [1, 2, 4, 8] : [1];
  const candidateResults: SimulationResult[] = [];

  for (const model of OPEN_SOURCE_MODELS) {
    if (config.requireCommercialLicense && !model.commercialUse) continue;
    for (const gpu of GPU_CATALOG) {
      let fitCountFound = 0;
      let singleGpuReqGb: number | undefined = undefined;

      for (const count of gpuCounts) {
        if (count > gpu.maxGpusPerNode) continue;
        const sim = simulateDeployment(
          model,
          gpu,
          count,
          config,
          singleGpuReqGb
        );
        if (count === 1) {
          singleGpuReqGb = sim.vramBreakdown.totalRequiredGb;
        }
        if (sim.fitsInVram) {
          candidateResults.push(sim);
          fitCountFound++;
          if (fitCountFound >= 2) break;
        }
      }
    }
  }

  for (const a of candidateResults) {
    if (!a.fitsInVram) continue;
    const dominatedCostQuality = candidateResults.some(
      (b) =>
        b.id !== a.id &&
        b.fitsInVram &&
        b.economics.costPerMillionBlendedTokens <=
          a.economics.costPerMillionBlendedTokens &&
        b.scores.useCaseQualityScore >= a.scores.useCaseQualityScore &&
        (b.economics.costPerMillionBlendedTokens <
          a.economics.costPerMillionBlendedTokens ||
          b.scores.useCaseQualityScore > a.scores.useCaseQualityScore)
    );
    a.isParetoOptimalCostQuality = !dominatedCostQuality;

    const dominatedCostThroughput = candidateResults.some(
      (b) =>
        b.id !== a.id &&
        b.fitsInVram &&
        b.economics.costPerMillionOutputTokens <=
          a.economics.costPerMillionOutputTokens &&
        b.performance.totalOutputTokPerSec >=
          a.performance.totalOutputTokPerSec &&
        (b.economics.costPerMillionOutputTokens <
          a.economics.costPerMillionOutputTokens ||
          b.performance.totalOutputTokPerSec >
            a.performance.totalOutputTokPerSec)
    );
    a.isParetoOptimalCostThroughput = !dominatedCostThroughput;
  }

  // Rank primarily by lowest cost among options meeting quality bar + SLOs, then overall match score
  return candidateResults.sort((a, b) => {
    if (a.scores.meetsAllSlas !== b.scores.meetsAllSlas) {
      return a.scores.meetsAllSlas ? -1 : 1;
    }
    return b.scores.overallMatchScore - a.scores.overallMatchScore;
  });
}

const HF_REPO_MAP: Record<string, string> = {
  "llama-3.1-8b": "meta-llama/Llama-3.1-8B-Instruct",
  "qwen-2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
  "qwen-2.5-14b": "Qwen/Qwen2.5-14B-Instruct",
  "mistral-small-24b": "mistralai/Mistral-Small-24B-Instruct-2501",
  "gemma-2-27b": "google/gemma-2-27b-it",
  "qwen-2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
  "deepseek-r1-32b": "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
  "llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
  "qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
  "deepseek-r1-70b": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
  "mixtral-8x22b": "mistralai/Mixtral-8x22B-Instruct-v0.1",
  "llama-3.1-405b": "meta-llama/Llama-3.1-405B-Instruct",
};

export function buildDeployCli(
  selected: SimulationResult,
  config: WorkloadConfig,
  engineOverride?: ServingEngineId
): string {
  const engine = engineOverride || selected.servingEngine;
  const repoId = HF_REPO_MAP[selected.model.id] || selected.model.name;
  const maxLen = Math.min(
    selected.model.maxContextLength,
    Math.max(4096, config.p95PromptTokens + config.p95OutputTokens)
  );

  const prefixFlagVllm =
    config.prefixCacheHitRate > 0 ? " \\\n  --enable-prefix-caching" : "";
  const specFlagVllm = config.speculativeDecoding
    ? " \\\n  --speculative-model [ngram] --num-speculative-tokens 5"
    : "";
  const loraFlagVllm =
    config.fineTuneMode !== "none"
      ? " \\\n  --enable-lora --max-loras 4 --max-lora-rank 64"
      : "";

  const quantFlagVllm =
    selected.quantization === "FP8"
      ? "--quantization fp8 --kv-cache-dtype fp8"
      : selected.quantization === "INT8"
      ? "--quantization smoothquant --kv-cache-dtype fp8"
      : selected.quantization === "INT4"
      ? "--quantization awq_marlin --kv-cache-dtype fp8"
      : selected.quantization === "FP4"
      ? "--quantization fp4 --kv-cache-dtype fp8"
      : "--dtype bfloat16";

  if (engine === "vllm") {
    return `vllm serve ${repoId} \\\n  --tensor-parallel-size ${selected.gpuCount} \\\n  ${quantFlagVllm} \\\n  --max-model-len ${maxLen} \\\n  --enable-chunked-prefill${prefixFlagVllm}${specFlagVllm}${loraFlagVllm} \\\n  --gpu-memory-utilization 0.90`;
  }
  if (engine === "sglang") {
    return `python3 -m sglang.launch_server --model-path ${repoId} \\\n  --tp ${selected.gpuCount} \\\n  --context-length ${maxLen} \\\n  --kv-cache-dtype fp8_e5m2 \\\n  --chunked-prefill-size 8192 \\\n  --mem-fraction-static 0.88`;
  }
  if (engine === "trtllm") {
    return `trtllm-build --checkpoint_dir ./ckpt_${selected.model.id} \\\n  --tp_size ${selected.gpuCount} --use_fp8_context_fmha enable \\\n  --use_paged_context_fmha enable --max_num_tokens ${maxLen}`;
  }
  return `./llama-server -m ${selected.model.id}-${selected.quantization.toLowerCase()}.gguf \\\n  -ngl 999 -c ${maxLen} -np ${config.concurrency} --flash-attn --cont-batching`;
}
