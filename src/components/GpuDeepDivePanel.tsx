"use client";

import React, { useState } from "react";
import {
  SimulationResult,
  WorkloadConfig,
  ServingEngineId,
} from "@/lib/inference-engine";
import {
  HardDrive,
  Gauge,
  Terminal,
  Copy,
  Check,
  Server,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

interface GpuDeepDivePanelProps {
  selected: SimulationResult;
  config: WorkloadConfig;
}

export function GpuDeepDivePanel({ selected, config }: GpuDeepDivePanelProps) {
  const [copied, setCopied] = useState(false);
  const [engineTab, setEngineTab] = useState<ServingEngineId>(
    config.servingEngine
  );

  const {
    model,
    gpu,
    gpuCount,
    vramBreakdown,
    performance,
    economics,
    futbin,
    scalingCliffWarning,
    confidenceLevel,
  } = selected;

  const weightsPct = Math.min(
    100,
    (vramBreakdown.weightsGb / vramBreakdown.totalAvailableGb) * 100
  );
  const kvPct = Math.min(
    100 - weightsPct,
    (vramBreakdown.kvCacheGb / vramBreakdown.totalAvailableGb) * 100
  );
  const loraPct = Math.min(
    100 - weightsPct - kvPct,
    (vramBreakdown.loraOverheadGb / vramBreakdown.totalAvailableGb) * 100
  );
  const actPct = Math.min(
    100 - weightsPct - kvPct - loraPct,
    (vramBreakdown.activationsGb / vramBreakdown.totalAvailableGb) * 100
  );

  const proprietaryBlendedCost = 4.38; // GPT-4o 3:1 blended ($2.50 in, $10.00 out)
  const savingsPctVsApi = Math.max(
    0,
    Math.round(
      ((proprietaryBlendedCost - economics.costPerMillionBlendedTokens) /
        proprietaryBlendedCost) *
        100
    )
  );

  const hfRepoMap: Record<string, string> = {
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

  const repoId = hfRepoMap[model.id] || model.name;
  const maxLen = Math.min(
    model.maxContextLength,
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

  let launchCmd = "";
  if (engineTab === "vllm") {
    launchCmd = `vllm serve ${repoId} \\\n  --tensor-parallel-size ${gpuCount} \\\n  ${quantFlagVllm} \\\n  --max-model-len ${maxLen} \\\n  --enable-chunked-prefill${prefixFlagVllm}${specFlagVllm}${loraFlagVllm} \\\n  --gpu-memory-utilization 0.90`;
  } else if (engineTab === "sglang") {
    launchCmd = `python3 -m sglang.launch_server --model-path ${repoId} \\\n  --tp ${gpuCount} \\\n  --context-length ${maxLen} \\\n  --kv-cache-dtype fp8_e5m2 \\\n  --chunked-prefill-size 8192 \\\n  --mem-fraction-static 0.88`;
  } else if (engineTab === "trtllm") {
    launchCmd = `trtllm-build --checkpoint_dir ./ckpt_${model.id} \\\n  --tp_size ${gpuCount} --use_fp8_context_fmha enable \\\n  --use_paged_context_fmha enable --max_num_tokens ${maxLen}`;
  } else {
    launchCmd = `./llama-server -m ${model.id}-${selected.quantization.toLowerCase()}.gguf \\\n  -ngl 999 -c ${maxLen} -np ${config.concurrency} --flash-attn --cont-batching`;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(launchCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {futbin.ovr} OVR · {futbin.tier}
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono rounded border flex items-center gap-1 ${
                confidenceLevel === "Measured Benchmark"
                  ? "bg-teal-500/10 text-teal-300 border-teal-500/30"
                  : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              {confidenceLevel}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {model.architecture} ({model.activeParamsB}B active /{" "}
              {model.totalParamsB}B total) · {model.attentionType} ·{" "}
              {model.license}
            </span>
          </div>
          <h2 className="text-base font-semibold text-zinc-100 mt-1.5 tracking-tight">
            {model.name}{" "}
            <span className="text-zinc-500 font-normal">hosted on</span>{" "}
            <span className="text-indigo-300 font-medium">
              {gpuCount}x {gpu.name} ({vramBreakdown.totalAvailableGb}GB{" "}
              {gpu.memoryType})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-4 tabular-nums">
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              Max Users Within SLO
            </div>
            <div className="text-lg font-semibold font-mono text-teal-400">
              {performance.maxConcurrentUsersWithinSlo}{" "}
              <span className="text-xs text-zinc-500 font-normal">
                / {vramBreakdown.maxConcurrentUsersWithinVram} VRAM cap
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scaling Cliff Warning Banner (if triggered) */}
      {scalingCliffWarning && (
        <div className="bg-amber-950/35 border border-amber-500/40 rounded-lg px-4 py-3 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">
              Multi-GPU Scaling Cliff Detected:{" "}
            </span>
            {scalingCliffWarning}
          </div>
        </div>
      )}

      {/* 1. Stage 1 Memory Feasibility & KV Cache Breakdown */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>
              Stage 1: Memory Feasibility & p95 KV-Cache Footprint (
              {selected.quantization})
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            <strong className="text-zinc-100">
              {vramBreakdown.totalRequiredGb} GB
            </strong>{" "}
            / {vramBreakdown.totalAvailableGb} GB ({vramBreakdown.utilizationPct}
            % utilized · {vramBreakdown.headroomGb} GB free)
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3.5 w-full bg-zinc-900 rounded overflow-hidden flex border border-zinc-800 p-0.5 gap-0.5">
          <div
            style={{ width: `${weightsPct}%` }}
            className="bg-indigo-500 rounded-l-[2px] transition-all duration-300"
            title={`Weights: ${vramBreakdown.weightsGb} GB`}
          />
          <div
            style={{ width: `${kvPct}%` }}
            className="bg-teal-400 transition-all duration-300"
            title={`p95 KV Cache: ${vramBreakdown.kvCacheGb} GB`}
          />
          {vramBreakdown.loraOverheadGb > 0 && (
            <div
              style={{ width: `${loraPct}%` }}
              className="bg-amber-400 transition-all duration-300"
              title={`LoRA / Fine-Tune: ${vramBreakdown.loraOverheadGb} GB`}
            />
          )}
          <div
            style={{ width: `${actPct}%` }}
            className="bg-zinc-600 rounded-r-[2px] transition-all duration-300"
            title={`Runtime & CUDA Context: ${vramBreakdown.activationsGb} GB`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs tabular-nums">
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />
              Weights ({model.totalParamsB}B)
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5">
              {vramBreakdown.weightsGb} GB
            </div>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-teal-400 inline-block" />
              p95 KV ({config.concurrency} seqs)
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5">
              {vramBreakdown.kvCacheGb} GB
            </div>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
              LoRA / Adapter
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5">
              {vramBreakdown.loraOverheadGb} GB
            </div>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-zinc-600 inline-block" />
              CUDA & Activations
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5">
              {vramBreakdown.activationsGb} GB
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stage 2 Speed & Stage 3 Separate Input/Output Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                <Gauge className="w-4 h-4 text-indigo-400" />
                Stage 2: Speed & Serving Stack Telemetry
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                {performance.bottleneck}
              </span>
            </div>

            <div className="space-y-3 mt-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">
                    Achieved Memory BW Utilization (
                    {gpu.memoryBandwidthGbPerSec * gpuCount} GB/s peak)
                  </span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {performance.gpuMemBwUtilPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${performance.gpuMemBwUtilPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">
                    Achieved Compute MFU (
                    {(selected.quantization === "FP8" && gpu.nativeFp8
                      ? gpu.fp8Tflops
                      : gpu.fp16Tflops) * gpuCount}{" "}
                    TFLOPS peak)
                  </span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {performance.gpuComputeUtilPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full"
                    style={{ width: `${performance.gpuComputeUtilPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/80 text-[11px] tabular-nums">
            <div>
              <span className="text-zinc-500 block">Avg / p95 TTFT</span>
              <span className="font-mono text-zinc-200 font-medium">
                {performance.ttftMs}ms / {performance.p95TtftMs}ms
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">ITL / Stream</span>
              <span className="font-mono text-zinc-200 font-medium">
                {performance.itlMs}ms ({performance.tpotTokPerSec} tok/s)
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Interconnect</span>
              <span className="font-mono text-zinc-200 font-medium">
                {gpu.interconnect} ({gpu.interconnectBwGbPerSec} GB/s)
              </span>
            </div>
          </div>
        </div>

        {/* 3. Stage 3 Separate Input vs. Output Token Cost & Cloud Providers */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                <Server className="w-4 h-4 text-indigo-400" />
                Stage 3: Unit Token Economics ({config.pricingTier.toUpperCase()})
              </span>
              <span className="text-[11px] font-mono text-teal-400">
                {savingsPctVsApi}% below GPT-4o API
              </span>
            </div>

            <div className="space-y-1.5 mt-2">
              {gpu.pricing.providers.map((p) => {
                const unitRate =
                  config.pricingTier === "spot" ? p.spotRate : p.hourlyRate;
                const clusterHourly = unitRate * gpuCount;
                const clusterMonthly = Math.round(
                  clusterHourly * config.monthlyActiveHours
                );
                return (
                  <div
                    key={p.provider}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-zinc-900/70 border border-zinc-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-200">
                        {p.provider}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {p.region}
                      </span>
                    </div>
                    <div className="font-mono text-zinc-200 tabular-nums">
                      <span className="text-zinc-100 font-semibold">
                        ${clusterHourly.toFixed(2)}/hr
                      </span>{" "}
                      <span className="text-zinc-500 text-[11px]">
                        (${clusterMonthly.toLocaleString()}/mo)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/80 text-[11px] tabular-nums">
            <div>
              <span className="text-zinc-500 block">Input Cost (Prefill)</span>
              <span className="font-mono text-indigo-300 font-semibold">
                ${economics.costPerMillionInputTokens.toFixed(3)} / 1M
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Output Cost (Decode)</span>
              <span className="font-mono text-teal-400 font-semibold">
                ${economics.costPerMillionOutputTokens.toFixed(3)} / 1M
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Blended (3:1 In:Out)</span>
              <span className="font-mono text-white font-semibold">
                ${economics.costPerMillionBlendedTokens.toFixed(3)} / 1M
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Ready-to-Deploy Production Command */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-200">
              Stage 4: Serving Stack Deployment CLI (with Chunked Prefill & Prefix Cache)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded bg-zinc-900 p-0.5 border border-zinc-800 text-[11px]">
              {(["vllm", "sglang", "trtllm", "llamacpp"] as ServingEngineId[]).map(
                (eng) => (
                  <button
                    key={eng}
                    onClick={() => setEngineTab(eng)}
                    className={`px-2 py-0.5 rounded uppercase font-mono ${
                      engineTab === eng
                        ? "bg-zinc-800 text-zinc-100 font-semibold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {eng}
                  </button>
                )
              )}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors border border-zinc-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-teal-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy CLI</span>
                </>
              )}
            </button>
          </div>
        </div>
        <pre className="text-xs font-mono text-zinc-300 bg-zinc-950 p-3 rounded overflow-x-auto border border-zinc-800/80 leading-relaxed">
          {launchCmd}
        </pre>
      </div>
    </div>
  );
}
