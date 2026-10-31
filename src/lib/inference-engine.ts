export type UseCaseId =
  | "chatbot"
  | "rag"
  | "coding"
  | "agentic"
  | "batch";

export type QuantizationType = "FP16" | "FP8" | "INT4";

export interface UseCasePreset {
  id: UseCaseId;
  name: string;
  shortName: string;
  description: string;
  promptTokens: number;
  outputTokens: number;
  concurrency: number;
  targetTtftMs: number;
  targetTpotTokPerSec: number;
  recommendedQuant: QuantizationType;
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
  provider: string;
  license: string;
  architecture: "Dense" | "MoE";
  totalParamsB: number;
  activeParamsB: number;
  numLayers: number;
  numKvHeads: number;
  headDim: number;
  maxContextLength: number;
  benchmarks: {
    mmluPro: number; // 0-100
    liveCodeBench: number; // 0-100
    arenaElo: number; // ~1100-1350
    math500: number; // 0-100
    ragFaithfulness: number; // 0-100
  };
  strengths: string[];
}

export interface GPUSpec {
  id: string;
  name: string;
  vendor: "NVIDIA" | "AMD";
  architecture: string;
  vramGb: number;
  memoryType: string;
  memoryBandwidthGbPerSec: number;
  fp16Tflops: number;
  fp8Tflops: number;
  int4Tops: number;
  nativeFp8: boolean;
  interconnect: "NVLink" | "InfinityFabric" | "PCIe Gen5" | "PCIe Gen4";
  interconnectBwGbPerSec: number;
  tdpWatts: number;
  maxGpusPerNode: number;
  pricing: {
    lowest: number;
    average: number;
    providers: {
      provider: string;
      hourlyRate: number;
      availability: "High" | "Medium" | "Spot";
    }[];
  };
}

export interface WorkloadConfig {
  useCaseId: UseCaseId;
  promptTokens: number;
  outputTokens: number;
  concurrency: number;
  targetTtftMs: number;
  targetTpotTokPerSec: number;
  quantization: QuantizationType;
  monthlyActiveHours: number;
  maxBudgetPerHour: number;
  allowMultiGpu: boolean;
}

export interface SimulationResult {
  id: string;
  model: LLMModelSpec;
  gpu: GPUSpec;
  gpuCount: number;
  quantization: QuantizationType;
  fitsInVram: boolean;
  vramBreakdown: {
    weightsGb: number;
    kvCacheGb: number;
    activationsGb: number;
    totalRequiredGb: number;
    totalAvailableGb: number;
    utilizationPct: number;
    headroomGb: number;
  };
  performance: {
    ttftMs: number;
    itlMs: number;
    tpotTokPerSec: number; // Per-user streaming speed
    totalOutputTokPerSec: number; // Aggregate cluster output tok/s
    totalCombinedTokPerSec: number; // Input + Output tok/s
    prefillTokPerSec: number;
    bottleneck: "Memory Bandwidth" | "Compute (Prefill/Batch)" | "Interconnect (TP)" | "VRAM Capacity";
    arithmeticIntensity: number;
    ridgePoint: number;
    gpuComputeUtilPct: number;
    gpuMemBwUtilPct: number;
  };
  economics: {
    hourlyCostUsd: number;
    monthlyCostUsd: number;
    costPerMillionOutputTokens: number;
    costPerMillionBlendedTokens: number;
    tokensPerDollar: number;
    powerDrawWatts: number;
  };
  scores: {
    useCaseQualityScore: number; // 0-100 adjusted for quantization degradation
    costEfficiencyScore: number; // 0-100
    slaComplianceScore: number; // 0-100
    overallMatchScore: number; // 0-100 composite score
    meetsTtftSla: boolean;
    meetsTpotSla: boolean;
    meetsAllSlas: boolean;
  };
  isParetoOptimalCostQuality: boolean;
  isParetoOptimalCostThroughput: boolean;
}

export const USE_CASE_PRESETS: Record<UseCaseId, UseCasePreset> = {
  chatbot: {
    id: "chatbot",
    name: "Interactive AI Assistant / Chat",
    shortName: "Customer Chat",
    description:
      "Low-latency conversational UI requiring fast Time-to-First-Token (<500ms) and smooth >35 tok/s streaming per user.",
    promptTokens: 1024,
    outputTokens: 384,
    concurrency: 16,
    targetTtftMs: 500,
    targetTpotTokPerSec: 35,
    recommendedQuant: "FP8",
    capabilityWeights: {
      general: 0.45,
      coding: 0.15,
      reasoning: 0.25,
      rag: 0.15,
    },
  },
  rag: {
    id: "rag",
    name: "Enterprise RAG & Knowledge Base",
    shortName: "Enterprise RAG",
    description:
      "Heavy prefill workloads with long retrieved document contexts (4K-16K tokens), prioritizing grounded faithfulness & KV-cache capacity.",
    promptTokens: 6144,
    outputTokens: 512,
    concurrency: 12,
    targetTtftMs: 1200,
    targetTpotTokPerSec: 25,
    recommendedQuant: "FP8",
    capabilityWeights: {
      general: 0.25,
      coding: 0.05,
      reasoning: 0.2,
      rag: 0.5,
    },
  },
  coding: {
    id: "coding",
    name: "Code Copilot & SWE Assistant",
    shortName: "Code Copilot",
    description:
      "Ultra-snappy IDE autocomplete and multi-file refactoring requiring top LiveCodeBench accuracy and high per-stream decode speed.",
    promptTokens: 2048,
    outputTokens: 512,
    concurrency: 16,
    targetTtftMs: 400,
    targetTpotTokPerSec: 45,
    recommendedQuant: "FP8",
    capabilityWeights: {
      general: 0.1,
      coding: 0.6,
      reasoning: 0.25,
      rag: 0.05,
    },
  },
  agentic: {
    id: "agentic",
    name: "Deep Reasoning & Multi-Step Agents",
    shortName: "Reasoning Agents",
    description:
      "Long chain-of-thought (CoT) generation and tool-calling loops where reasoning depth and output token economics dominate.",
    promptTokens: 4096,
    outputTokens: 1536,
    concurrency: 8,
    targetTtftMs: 1500,
    targetTpotTokPerSec: 40,
    recommendedQuant: "FP8",
    capabilityWeights: {
      general: 0.15,
      coding: 0.25,
      reasoning: 0.45,
      rag: 0.15,
    },
  },
  batch: {
    id: "batch",
    name: "High-Throughput Batch Processing",
    shortName: "Batch ETL",
    description:
      "Offline classification, entity extraction, and summarization maximizing total tokens/sec per dollar at high batch concurrency.",
    promptTokens: 3072,
    outputTokens: 256,
    concurrency: 64,
    targetTtftMs: 4500,
    targetTpotTokPerSec: 15,
    recommendedQuant: "INT4",
    capabilityWeights: {
      general: 0.4,
      coding: 0.05,
      reasoning: 0.15,
      rag: 0.4,
    },
  },
};

export const OPEN_SOURCE_MODELS: LLMModelSpec[] = [
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B Instruct",
    provider: "Meta",
    license: "Llama 3.1 Community",
    architecture: "Dense",
    totalParamsB: 8.03,
    activeParamsB: 8.03,
    numLayers: 32,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 48.4,
      liveCodeBench: 34.2,
      arenaElo: 1176,
      math500: 51.2,
      ragFaithfulness: 79.5,
    },
    strengths: ["Ultra-low latency", "Single 24GB GPU fit", "Massive ecosystem"],
  },
  {
    id: "qwen-2.5-7b",
    name: "Qwen 2.5 7B Instruct",
    provider: "Alibaba Cloud",
    license: "Apache 2.0",
    architecture: "Dense",
    totalParamsB: 7.62,
    activeParamsB: 7.62,
    numLayers: 28,
    numKvHeads: 4,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 56.3,
      liveCodeBench: 45.8,
      arenaElo: 1204,
      math500: 74.6,
      ragFaithfulness: 83.0,
    },
    strengths: ["Apache 2.0 license", "Tiny GQA KV-cache (4 heads)", "Punches above weight"],
  },
  {
    id: "qwen-2.5-14b",
    name: "Qwen 2.5 14B Instruct",
    provider: "Alibaba Cloud",
    license: "Apache 2.0",
    architecture: "Dense",
    totalParamsB: 14.7,
    activeParamsB: 14.7,
    numLayers: 48,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 63.5,
      liveCodeBench: 53.4,
      arenaElo: 1239,
      math500: 79.8,
      ragFaithfulness: 86.4,
    },
    strengths: ["Sweet-spot mid-size model", "Strong structured JSON & RAG", "Apache 2.0"],
  },
  {
    id: "mistral-small-24b",
    name: "Mistral Small 3 24B",
    provider: "Mistral AI",
    license: "Apache 2.0",
    architecture: "Dense",
    totalParamsB: 24.0,
    activeParamsB: 24.0,
    numLayers: 40,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 32768,
    benchmarks: {
      mmluPro: 66.8,
      liveCodeBench: 55.2,
      arenaElo: 1258,
      math500: 81.0,
      ragFaithfulness: 88.5,
    },
    strengths: ["Fast 40-layer design", "Low latency 24B class", "Enterprise RAG workhorse"],
  },
  {
    id: "gemma-2-27b",
    name: "Gemma 2 27B IT",
    provider: "Google",
    license: "Gemma Terms",
    architecture: "Dense",
    totalParamsB: 27.2,
    activeParamsB: 27.2,
    numLayers: 46,
    numKvHeads: 16,
    headDim: 128,
    maxContextLength: 8192,
    benchmarks: {
      mmluPro: 60.2,
      liveCodeBench: 44.5,
      arenaElo: 1244,
      math500: 68.5,
      ragFaithfulness: 84.0,
    },
    strengths: ["High conversational nuance", "Strong creative & chat tone", "Single L40S fit"],
  },
  {
    id: "qwen-2.5-coder-32b",
    name: "Qwen 2.5 Coder 32B",
    provider: "Alibaba Cloud",
    license: "Apache 2.0",
    architecture: "Dense",
    totalParamsB: 32.5,
    activeParamsB: 32.5,
    numLayers: 64,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 68.4,
      liveCodeBench: 67.2,
      arenaElo: 1278,
      math500: 84.5,
      ragFaithfulness: 86.2,
    },
    strengths: ["SOTA open-weights coding", "Rivals GPT-4o on code", "Apache 2.0"],
  },
  {
    id: "deepseek-r1-32b",
    name: "DeepSeek R1 Distill 32B",
    provider: "DeepSeek",
    license: "MIT",
    architecture: "Dense",
    totalParamsB: 32.5,
    activeParamsB: 32.5,
    numLayers: 64,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 74.5,
      liveCodeBench: 69.8,
      arenaElo: 1308,
      math500: 94.3,
      ragFaithfulness: 88.8,
    },
    strengths: ["Exceptional math & reasoning", "MIT License", "Fits single 80GB or 48GB (FP8/INT4)"],
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B Instruct",
    provider: "Meta",
    license: "Llama 3.3 Community",
    architecture: "Dense",
    totalParamsB: 70.6,
    activeParamsB: 70.6,
    numLayers: 80,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 71.8,
      liveCodeBench: 61.5,
      arenaElo: 1296,
      math500: 86.0,
      ragFaithfulness: 92.4,
    },
    strengths: ["Gold-standard 70B instruction following", "128K context", "Low GQA KV footprint"],
  },
  {
    id: "qwen-2.5-72b",
    name: "Qwen 2.5 72B Instruct",
    provider: "Alibaba Cloud",
    license: "Qwen License",
    architecture: "Dense",
    totalParamsB: 72.7,
    activeParamsB: 72.7,
    numLayers: 80,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 73.2,
      liveCodeBench: 64.8,
      arenaElo: 1306,
      math500: 88.2,
      ragFaithfulness: 93.5,
    },
    strengths: ["Top-tier multilingual & RAG", "Strong tool calling", "Long-context stability"],
  },
  {
    id: "deepseek-r1-70b",
    name: "DeepSeek R1 Distill 70B",
    provider: "DeepSeek",
    license: "MIT",
    architecture: "Dense",
    totalParamsB: 70.6,
    activeParamsB: 70.6,
    numLayers: 80,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 76.8,
      liveCodeBench: 72.4,
      arenaElo: 1326,
      math500: 95.8,
      ragFaithfulness: 91.5,
    },
    strengths: ["Frontier-level reasoning & coding", "MIT license", "Fits 1x H100/H200 in FP8"],
  },
  {
    id: "mixtral-8x22b",
    name: "Mixtral 8x22B Instruct",
    provider: "Mistral AI",
    license: "Apache 2.0",
    architecture: "MoE",
    totalParamsB: 141.0,
    activeParamsB: 39.1,
    numLayers: 56,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 65536,
    benchmarks: {
      mmluPro: 65.4,
      liveCodeBench: 53.0,
      arenaElo: 1262,
      math500: 78.4,
      ragFaithfulness: 87.8,
    },
    strengths: ["Sparse MoE (39B active params)", "Fast decode on high-VRAM nodes", "Apache 2.0"],
  },
  {
    id: "llama-3.1-405b",
    name: "Llama 3.1 405B Instruct",
    provider: "Meta",
    license: "Llama 3.1 Community",
    architecture: "Dense",
    totalParamsB: 405.0,
    activeParamsB: 405.0,
    numLayers: 126,
    numKvHeads: 8,
    headDim: 128,
    maxContextLength: 131072,
    benchmarks: {
      mmluPro: 76.2,
      liveCodeBench: 66.4,
      arenaElo: 1319,
      math500: 89.4,
      ragFaithfulness: 95.2,
    },
    strengths: ["Maximum dense world knowledge", "Best-in-class RAG synthesis", "Requires multi-GPU node"],
  },
];

export const GPU_CATALOG: GPUSpec[] = [
  {
    id: "l4-24gb",
    name: "NVIDIA L4",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGb: 24,
    memoryType: "GDDR6",
    memoryBandwidthGbPerSec: 300,
    fp16Tflops: 121,
    fp8Tflops: 242,
    int4Tops: 485,
    nativeFp8: true,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 72,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.44,
      average: 0.58,
      providers: [
        { provider: "RunPod", hourlyRate: 0.44, availability: "High" },
        { provider: "GCP (g2-standard)", hourlyRate: 0.70, availability: "High" },
        { provider: "Modal", hourlyRate: 0.59, availability: "High" },
      ],
    },
  },
  {
    id: "a10g-24gb",
    name: "NVIDIA A10G",
    vendor: "NVIDIA",
    architecture: "Ampere",
    vramGb: 24,
    memoryType: "GDDR6",
    memoryBandwidthGbPerSec: 600,
    fp16Tflops: 125,
    fp8Tflops: 125,
    int4Tops: 250,
    nativeFp8: false,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 150,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.72,
      average: 0.95,
      providers: [
        { provider: "AWS (g5.xlarge)", hourlyRate: 1.00, availability: "High" },
        { provider: "Modal", hourlyRate: 0.76, availability: "High" },
        { provider: "RunPod", hourlyRate: 0.72, availability: "Medium" },
      ],
    },
  },
  {
    id: "rtx-4090-24gb",
    name: "NVIDIA RTX 4090",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGb: 24,
    memoryType: "GDDR6X",
    memoryBandwidthGbPerSec: 1008,
    fp16Tflops: 165,
    fp8Tflops: 330,
    int4Tops: 660,
    nativeFp8: true,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 450,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.49,
      average: 0.64,
      providers: [
        { provider: "Vast.ai", hourlyRate: 0.49, availability: "High" },
        { provider: "RunPod", hourlyRate: 0.69, availability: "High" },
        { provider: "Tensordock", hourlyRate: 0.58, availability: "Medium" },
      ],
    },
  },
  {
    id: "rtx-5090-32gb",
    name: "NVIDIA RTX 5090",
    vendor: "NVIDIA",
    architecture: "Blackwell",
    vramGb: 32,
    memoryType: "GDDR7",
    memoryBandwidthGbPerSec: 1792,
    fp16Tflops: 209,
    fp8Tflops: 419,
    int4Tops: 838,
    nativeFp8: true,
    interconnect: "PCIe Gen5",
    interconnectBwGbPerSec: 128,
    tdpWatts: 575,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 0.89,
      average: 1.05,
      providers: [
        { provider: "Vast.ai", hourlyRate: 0.89, availability: "Medium" },
        { provider: "RunPod", hourlyRate: 1.09, availability: "Medium" },
        { provider: "SaladCloud", hourlyRate: 0.95, availability: "High" },
      ],
    },
  },
  {
    id: "l40s-48gb",
    name: "NVIDIA L40S",
    vendor: "NVIDIA",
    architecture: "Ada Lovelace",
    vramGb: 48,
    memoryType: "GDDR6",
    memoryBandwidthGbPerSec: 864,
    fp16Tflops: 362,
    fp8Tflops: 733,
    int4Tops: 1466,
    nativeFp8: true,
    interconnect: "PCIe Gen4",
    interconnectBwGbPerSec: 64,
    tdpWatts: 350,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 1.05,
      average: 1.34,
      providers: [
        { provider: "RunPod", hourlyRate: 1.05, availability: "High" },
        { provider: "Lambda Labs", hourlyRate: 1.29, availability: "High" },
        { provider: "CoreWeave", hourlyRate: 1.55, availability: "High" },
      ],
    },
  },
  {
    id: "a100-80gb",
    name: "NVIDIA A100 SXM",
    vendor: "NVIDIA",
    architecture: "Ampere",
    vramGb: 80,
    memoryType: "HBM2e",
    memoryBandwidthGbPerSec: 2039,
    fp16Tflops: 312,
    fp8Tflops: 312,
    int4Tops: 624,
    nativeFp8: false,
    interconnect: "NVLink",
    interconnectBwGbPerSec: 600,
    tdpWatts: 400,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 1.49,
      average: 1.79,
      providers: [
        { provider: "RunPod", hourlyRate: 1.49, availability: "High" },
        { provider: "Lambda Labs", hourlyRate: 1.79, availability: "High" },
        { provider: "AWS / GCP", hourlyRate: 2.45, availability: "High" },
      ],
    },
  },
  {
    id: "h100-80gb",
    name: "NVIDIA H100 SXM",
    vendor: "NVIDIA",
    architecture: "Hopper",
    vramGb: 80,
    memoryType: "HBM3",
    memoryBandwidthGbPerSec: 3350,
    fp16Tflops: 989,
    fp8Tflops: 1979,
    int4Tops: 3958,
    nativeFp8: true,
    interconnect: "NVLink",
    interconnectBwGbPerSec: 900,
    tdpWatts: 700,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 2.49,
      average: 2.89,
      providers: [
        { provider: "Lambda Labs", hourlyRate: 2.69, availability: "High" },
        { provider: "RunPod", hourlyRate: 2.49, availability: "High" },
        { provider: "CoreWeave", hourlyRate: 3.15, availability: "High" },
      ],
    },
  },
  {
    id: "h200-141gb",
    name: "NVIDIA H200 SXM",
    vendor: "NVIDIA",
    architecture: "Hopper",
    vramGb: 141,
    memoryType: "HBM3e",
    memoryBandwidthGbPerSec: 4800,
    fp16Tflops: 989,
    fp8Tflops: 1979,
    int4Tops: 3958,
    nativeFp8: true,
    interconnect: "NVLink",
    interconnectBwGbPerSec: 900,
    tdpWatts: 700,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 3.49,
      average: 3.85,
      providers: [
        { provider: "RunPod", hourlyRate: 3.49, availability: "Medium" },
        { provider: "CoreWeave", hourlyRate: 3.95, availability: "High" },
        { provider: "Lambda Labs", hourlyRate: 3.79, availability: "Medium" },
      ],
    },
  },
  {
    id: "mi300x-192gb",
    name: "AMD Instinct MI300X",
    vendor: "AMD",
    architecture: "CDNA 3",
    vramGb: 192,
    memoryType: "HBM3",
    memoryBandwidthGbPerSec: 5300,
    fp16Tflops: 1307,
    fp8Tflops: 2614,
    int4Tops: 5228,
    nativeFp8: true,
    interconnect: "InfinityFabric",
    interconnectBwGbPerSec: 896,
    tdpWatts: 750,
    maxGpusPerNode: 8,
    pricing: {
      lowest: 2.39,
      average: 2.75,
      providers: [
        { provider: "TensorWave", hourlyRate: 2.39, availability: "High" },
        { provider: "RunPod", hourlyRate: 2.69, availability: "Medium" },
        { provider: "Vultr", hourlyRate: 2.95, availability: "High" },
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
    label: "FP16 / BF16 (Full Precision)",
    description: "Zero accuracy loss. Requires 2 bytes/param + 16-bit KV cache.",
  },
  FP8: {
    bytesPerParam: 1.0,
    kvBytes: 1.0,
    qualityRetentionFactor: 0.992,
    label: "FP8 (W8A8 + FP8 KV)",
    description:
      "<0.8% accuracy delta. Halves VRAM & doubles Tensor Core throughput on Hopper/Ada/CDNA3.",
  },
  INT4: {
    bytesPerParam: 0.55, // AWQ/GPTQ group-size 128 overhead included
    kvBytes: 1.0, // FP8 KV cache paired with INT4 weights
    qualityRetentionFactor: 0.965,
    label: "INT4 AWQ/GPTQ (W4A16)",
    description:
      "~3.5% accuracy delta on complex reasoning. Compresses weights by 3.6x for max memory bandwidth.",
  },
};

export function getQuantSpec(quant: QuantizationType) {
  return QUANT_SPECS[quant];
}

export function computeUseCaseQualityScore(
  model: LLMModelSpec,
  useCaseId: UseCaseId,
  quantization: QuantizationType
): number {
  const preset = USE_CASE_PRESETS[useCaseId];
  const w = preset.capabilityWeights;

  // Normalize Arena ELO (1150 -> 50, 1340 -> 98)
  const normalizedArena = Math.min(
    99,
    Math.max(40, ((model.benchmarks.arenaElo - 1140) / 200) * 55 + 44)
  );
  const generalScore = model.benchmarks.mmluPro * 0.45 + normalizedArena * 0.55;
  const codingScore = model.benchmarks.liveCodeBench * 1.15; // Scale LCB (where 72% is frontier)
  const reasoningScore =
    model.benchmarks.math500 * 0.55 + model.benchmarks.mmluPro * 0.45;
  const ragScore = model.benchmarks.ragFaithfulness;

  const rawWeighted =
    generalScore * w.general +
    Math.min(99, codingScore) * w.coding +
    reasoningScore * w.reasoning +
    ragScore * w.rag;

  const quantRetention = QUANT_SPECS[quantization].qualityRetentionFactor;
  return Number(Math.min(99.5, rawWeighted * quantRetention).toFixed(1));
}

export function simulateDeployment(
  model: LLMModelSpec,
  gpu: GPUSpec,
  gpuCount: number,
  config: WorkloadConfig
): SimulationResult {
  const quantSpec = QUANT_SPECS[config.quantization];
  const totalContextPerSeq = config.promptTokens + config.outputTokens;

  // 1. VRAM Calculation
  const weightsGb = model.totalParamsB * quantSpec.bytesPerParam * 1.03; // 3% metadata/embedding buffer
  const kvBytesPerToken =
    2 * model.numLayers * model.numKvHeads * model.headDim * quantSpec.kvBytes;
  const kvCacheGb =
    (config.concurrency * totalContextPerSeq * kvBytesPerToken) / 1e9;
  const activationsGb =
    0.75 * gpuCount +
    model.activeParamsB * 0.035 +
    (config.concurrency * config.promptTokens * 0.000015);

  const totalRequiredGb = weightsGb + kvCacheGb + activationsGb;
  const totalAvailableGb = gpu.vramGb * gpuCount;
  // Require at least 6% safety buffer for CUDA runtime & PagedAttention blocks
  const fitsInVram =
    totalRequiredGb <= totalAvailableGb * 0.94 &&
    totalContextPerSeq <= model.maxContextLength;
  const utilizationPct = Math.min(
    100,
    Number(((totalRequiredGb / totalAvailableGb) * 100).toFixed(1))
  );
  const headroomGb = Number((totalAvailableGb - totalRequiredGb).toFixed(1));

  // 2. Tensor Parallelism Efficiency
  let tpCommEfficiency = 1.0;
  if (gpuCount > 1) {
    const isHighSpeedLink =
      gpu.interconnect === "NVLink" || gpu.interconnect === "InfinityFabric";
    const perHopPenalty = isHighSpeedLink ? 0.045 : 0.14;
    tpCommEfficiency = Math.max(
      0.45,
      1 - perHopPenalty * Math.log2(gpuCount)
    );
  }

  // 3. Effective Compute TFLOPS
  let singleGpuTflops = gpu.fp16Tflops;
  if (config.quantization === "FP8") {
    singleGpuTflops = gpu.nativeFp8 ? gpu.fp8Tflops : gpu.fp16Tflops * 0.95;
  } else if (config.quantization === "INT4") {
    // W4A16 uses FP16 Tensor Cores with dequantization overhead
    singleGpuTflops = gpu.fp16Tflops * 0.88;
  }

  // Realistic MFU (Model FLOPs Utilization) during inference prefill & continuous batching
  const mfu = 0.62 * tpCommEfficiency;
  const clusterEffectiveFlops = singleGpuTflops * gpuCount * mfu * 1e12;

  // Effective Memory Bandwidth (GB/s -> Bytes/s)
  const memBwEfficiency = 0.78 * tpCommEfficiency;
  const clusterEffectiveBwBytesPerSec =
    gpu.memoryBandwidthGbPerSec * gpuCount * memBwEfficiency * 1e9;

  // 4. Prefill & TTFT Calculation
  // Under continuous batching, average concurrent prefill queue pressure scales smoothly
  const concurrentPrefillFactor = Math.max(
    1,
    1 + (config.concurrency - 1) * 0.18
  );
  const prefillFlopsPerReq =
    2 * model.activeParamsB * 1e9 * config.promptTokens;
  const prefillComputeTimeSec =
    (prefillFlopsPerReq * concurrentPrefillFactor) / clusterEffectiveFlops;

  // Also check memory-read floor for prefill
  const activeWeightBytes =
    model.activeParamsB * 1e9 * quantSpec.bytesPerParam;
  const prefillMemTimeSec = activeWeightBytes / clusterEffectiveBwBytesPerSec;

  const ttftSec =
    Math.max(prefillComputeTimeSec, prefillMemTimeSec) +
    0.012 * Math.log2(gpuCount + 1);
  const ttftMs = Math.round(ttftSec * 1000);
  const prefillTokPerSec = Math.round(
    (config.promptTokens * concurrentPrefillFactor) / ttftSec
  );

  // 5. Decode Step & TPOT (Roofline Model for Continuous Batching)
  // Per decode step across `concurrency` active sequences:
  // Bytes transferred = Active Model Weights + KV Cache read for all active sequences
  const avgSeqContextInFlight =
    config.promptTokens + config.outputTokens * 0.5;
  const kvCacheBytesPerStep =
    config.concurrency * avgSeqContextInFlight * kvBytesPerToken;
  const totalBytesPerDecodeStep = activeWeightBytes + kvCacheBytesPerStep;

  const memBoundStepTimeSec =
    totalBytesPerDecodeStep / clusterEffectiveBwBytesPerSec;

  // Compute FLOPs per decode step across `concurrency` sequences
  const decodeFlopsPerStep =
    2 * model.activeParamsB * 1e9 * config.concurrency +
    4 *
      model.numLayers *
      model.numKvHeads *
      model.headDim *
      avgSeqContextInFlight *
      config.concurrency;
  const computeBoundStepTimeSec = decodeFlopsPerStep / clusterEffectiveFlops;

  // Roofline step time (smooth blend of memory + compute + all-reduce latency)
  const interconnectStepLatencySec =
    gpuCount > 1
      ? (model.numLayers * 2 * 0.000006) /
        (gpu.interconnect === "NVLink" || gpu.interconnect === "InfinityFabric"
          ? 1
          : 2.8)
      : 0;

  const stepTimeSec =
    Math.sqrt(
      memBoundStepTimeSec * memBoundStepTimeSec +
        computeBoundStepTimeSec * computeBoundStepTimeSec
    ) + interconnectStepLatencySec;

  const itlMs = Number((stepTimeSec * 1000).toFixed(1));
  const tpotTokPerSec = Number((1 / stepTimeSec).toFixed(1));
  const totalOutputTokPerSec = Math.round(tpotTokPerSec * config.concurrency);
  const ioRatio =
    (config.promptTokens + config.outputTokens) / config.outputTokens;
  const totalCombinedTokPerSec = Math.round(totalOutputTokPerSec * ioRatio);

  // Roofline diagnostics
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
    96,
    Math.round(
      (memBoundStepTimeSec / Math.max(0.0001, stepTimeSec)) *
        memBwEfficiency *
        100
    )
  );
  const gpuComputeUtilPct = Math.min(
    95,
    Math.round(
      (computeBoundStepTimeSec / Math.max(0.0001, stepTimeSec)) * mfu * 100
    )
  );

  // 6. Economics
  const hourlyCostUsd = Number((gpu.pricing.lowest * gpuCount).toFixed(2));
  const monthlyCostUsd = Math.round(hourlyCostUsd * config.monthlyActiveHours);

  const outputTokensPerHour = totalOutputTokPerSec * 3600;
  const costPerMillionOutputTokens =
    outputTokensPerHour > 0
      ? Number(((hourlyCostUsd / outputTokensPerHour) * 1e6).toFixed(3))
      : 999;

  const blendedTokensPerHour = totalCombinedTokPerSec * 3600;
  const costPerMillionBlendedTokens =
    blendedTokensPerHour > 0
      ? Number(((hourlyCostUsd / blendedTokensPerHour) * 1e6).toFixed(3))
      : 999;

  const tokensPerDollar =
    hourlyCostUsd > 0 ? Math.round(outputTokensPerHour / hourlyCostUsd) : 0;
  const powerDrawWatts = gpu.tdpWatts * gpuCount;

  // 7. Scoring
  const useCaseQualityScore = computeUseCaseQualityScore(
    model,
    config.useCaseId,
    config.quantization
  );

  const meetsTtftSla = ttftMs <= config.targetTtftMs;
  const meetsTpotSla = tpotTokPerSec >= config.targetTpotTokPerSec;
  const meetsAllSlas = fitsInVram && meetsTtftSla && meetsTpotSla;

  // SLA Score (100 if meets comfortably, penalized smoothly if slightly over/under)
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

  // Log-scaled cost efficiency score: $0.05/1M -> ~98, $0.50/1M -> ~75, $5.00/1M -> ~35
  const rawCostScore =
    100 - Math.max(0, Math.log10(Math.max(0.03, costPerMillionOutputTokens) / 0.03) * 34);
  const costEfficiencyScore = fitsInVram
    ? Math.round(Math.min(99, Math.max(5, rawCostScore)))
    : 0;

  // Composite Overall Match Score balancing Quality (40%), Cost/Output Efficiency (35%), and SLA Compliance (25%)
  const budgetPenalty =
    hourlyCostUsd > config.maxBudgetPerHour ? 0.65 : 1.0;
  const overallMatchScore = fitsInVram
    ? Number(
        (
          (useCaseQualityScore * 0.4 +
            costEfficiencyScore * 0.35 +
            slaComplianceScore * 0.25) *
          budgetPenalty
        ).toFixed(1)
      )
    : 0;

  return {
    id: `${model.id}__${gpu.id}__${gpuCount}x__${config.quantization}`,
    model,
    gpu,
    gpuCount,
    quantization: config.quantization,
    fitsInVram,
    vramBreakdown: {
      weightsGb: Number(weightsGb.toFixed(1)),
      kvCacheGb: Number(kvCacheGb.toFixed(1)),
      activationsGb: Number(activationsGb.toFixed(1)),
      totalRequiredGb: Number(totalRequiredGb.toFixed(1)),
      totalAvailableGb,
      utilizationPct,
      headroomGb,
    },
    performance: {
      ttftMs,
      itlMs,
      tpotTokPerSec,
      totalOutputTokPerSec,
      totalCombinedTokPerSec,
      prefillTokPerSec,
      bottleneck,
      arithmeticIntensity,
      ridgePoint,
      gpuComputeUtilPct,
      gpuMemBwUtilPct,
    },
    economics: {
      hourlyCostUsd,
      monthlyCostUsd,
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
      meetsAllSlas,
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

  // For each (model, gpu) pair, find the smallest valid gpuCount that fits in VRAM
  // (plus the next TP size up if multi-GPU is enabled and improves latency/SLA)
  for (const model of OPEN_SOURCE_MODELS) {
    for (const gpu of GPU_CATALOG) {
      let fitCountFound = 0;
      for (const count of gpuCounts) {
        if (count > gpu.maxGpusPerNode) continue;
        const sim = simulateDeployment(model, gpu, count, config);
        if (sim.fitsInVram) {
          candidateResults.push(sim);
          fitCountFound++;
          // Keep minimal GPU count + 1 step up for TP latency comparison
          if (fitCountFound >= 2) break;
        }
      }
    }
  }

  // Mark Pareto-optimal configurations (Cost per 1M Output Tokens vs Use-Case Quality Score)
  for (const a of candidateResults) {
    if (!a.fitsInVram) continue;
    const dominatedCostQuality = candidateResults.some(
      (b) =>
        b.id !== a.id &&
        b.fitsInVram &&
        b.economics.costPerMillionOutputTokens <=
          a.economics.costPerMillionOutputTokens &&
        b.scores.useCaseQualityScore >= a.scores.useCaseQualityScore &&
        (b.economics.costPerMillionOutputTokens <
          a.economics.costPerMillionOutputTokens ||
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

  // Sort by overallMatchScore descending
  return candidateResults.sort(
    (a, b) => b.scores.overallMatchScore - a.scores.overallMatchScore
  );
}
