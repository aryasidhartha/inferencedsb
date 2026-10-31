"use client";

import React, { useState } from "react";
import { SimulationResult, WorkloadConfig } from "@/lib/inference-engine";
import {
  HardDrive,
  Gauge,
  Terminal,
  Copy,
  Check,
  Server,
} from "lucide-react";

interface GpuDeepDivePanelProps {
  selected: SimulationResult;
  config: WorkloadConfig;
}

export function GpuDeepDivePanel({ selected, config }: GpuDeepDivePanelProps) {
  const [copied, setCopied] = useState(false);
  const [engineTab, setEngineTab] = useState<"vllm" | "sglang">("vllm");

  const { model, gpu, gpuCount, vramBreakdown, performance, economics, scores } =
    selected;

  const weightsPct = Math.min(
    100,
    (vramBreakdown.weightsGb / vramBreakdown.totalAvailableGb) * 100
  );
  const kvPct = Math.min(
    100 - weightsPct,
    (vramBreakdown.kvCacheGb / vramBreakdown.totalAvailableGb) * 100
  );
  const actPct = Math.min(
    100 - weightsPct - kvPct,
    (vramBreakdown.activationsGb / vramBreakdown.totalAvailableGb) * 100
  );

  const usableForKvGb = Math.max(
    0.5,
    vramBreakdown.totalAvailableGb * 0.94 -
      vramBreakdown.weightsGb -
      vramBreakdown.activationsGb
  );
  const kvPerUserGb =
    config.concurrency > 0
      ? vramBreakdown.kvCacheGb / config.concurrency
      : 0.1;
  const maxSafeConcurrentUsers = Math.max(
    1,
    Math.floor(usableForKvGb / Math.max(0.005, kvPerUserGb))
  );

  const proprietaryApiCostPerM = 10.0;
  const savingsPctVsApi = Math.max(
    0,
    Math.round(
      ((proprietaryApiCostPerM - economics.costPerMillionOutputTokens) /
        proprietaryApiCostPerM) *
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
    Math.max(4096, (config.promptTokens + config.outputTokens) * 2)
  );

  const quantFlagVllm =
    selected.quantization === "FP8"
      ? "--quantization fp8 --kv-cache-dtype fp8"
      : selected.quantization === "INT4"
      ? "--quantization awq_marlin --kv-cache-dtype fp8"
      : "--dtype bfloat16";

  const quantFlagSglang =
    selected.quantization === "FP8"
      ? "--quantization fp8 --kv-cache-dtype fp8_e5m2"
      : selected.quantization === "INT4"
      ? "--quantization awq --kv-cache-dtype fp8_e5m2"
      : "--dtype bfloat16";

  const launchCmd =
    engineTab === "vllm"
      ? `vllm serve ${repoId} \\\n  --tensor-parallel-size ${gpuCount} \\\n  ${quantFlagVllm} \\\n  --max-model-len ${maxLen} \\\n  --max-num-seqs ${config.concurrency * 2} \\\n  --gpu-memory-utilization 0.92`
      : `python3 -m sglang.launch_server --model-path ${repoId} \\\n  --tp ${gpuCount} \\\n  ${quantFlagSglang} \\\n  --context-length ${maxLen} \\\n  --mem-fraction-static 0.90`;

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
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
              Infrastructure Telemetry
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {model.architecture} · {model.totalParamsB}B Params · {model.license}
            </span>
          </div>
          <h2 className="text-base font-semibold text-zinc-100 mt-1.5 tracking-tight">
            {model.name}{" "}
            <span className="text-zinc-500 font-normal">deployed on</span>{" "}
            <span className="text-indigo-300 font-medium">
              {gpuCount}x {gpu.name} ({vramBreakdown.totalAvailableGb}GB {gpu.memoryType})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              Composite Fit Index
            </div>
            <div className="text-xl font-semibold font-mono text-zinc-100 tabular-nums">
              {scores.overallMatchScore}
              <span className="text-xs text-zinc-500 font-normal">/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. VRAM & KV Cache Breakdown */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>
              Memory Footprint & KV-Cache Allocation ({selected.quantization})
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            <strong className="text-zinc-100">{vramBreakdown.totalRequiredGb} GB</strong>{" "}
            / {vramBreakdown.totalAvailableGb} GB ({vramBreakdown.utilizationPct}%)
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3.5 w-full bg-zinc-900 rounded overflow-hidden flex border border-zinc-800 p-0.5 gap-0.5">
          <div
            style={{ width: `${weightsPct}%` }}
            className="bg-indigo-500 rounded-l-[2px] transition-all duration-300"
            title={`Model Weights: ${vramBreakdown.weightsGb} GB`}
          />
          <div
            style={{ width: `${kvPct}%` }}
            className="bg-slate-400 transition-all duration-300"
            title={`KV Cache (${config.concurrency} seqs): ${vramBreakdown.kvCacheGb} GB`}
          />
          <div
            style={{ width: `${actPct}%` }}
            className="bg-zinc-600 rounded-r-[2px] transition-all duration-300"
            title={`Activations & CUDA Graphs: ${vramBreakdown.activationsGb} GB`}
          />
        </div>

        {/* Legend & Max Concurrency Callout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />
              Model Weights
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5 tabular-nums">
              {vramBreakdown.weightsGb} GB
            </div>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-slate-400 inline-block" />
              KV Cache ({config.concurrency} seqs)
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5 tabular-nums">
              {vramBreakdown.kvCacheGb} GB
            </div>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-zinc-600 inline-block" />
              Runtime Buffer
            </div>
            <div className="font-mono font-semibold text-zinc-100 mt-0.5 tabular-nums">
              {vramBreakdown.activationsGb} GB
            </div>
          </div>
          <div className="bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <span className="w-2 h-2 rounded-sm bg-teal-500/50 border border-teal-500 inline-block" />
              Max Concurrency Cap
            </div>
            <div className="font-mono font-semibold text-teal-400 mt-0.5 tabular-nums">
              {maxSafeConcurrentUsers} streams
            </div>
          </div>
        </div>
      </div>

      {/* 2. Hardware Roofline & Bottleneck Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                <Gauge className="w-4 h-4 text-indigo-400" />
                Roofline & Bottleneck Diagnostics
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                {performance.bottleneck}
              </span>
            </div>

            <div className="space-y-3 mt-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">
                    Memory Bandwidth Utilization ({gpu.memoryBandwidthGbPerSec * gpuCount} GB/s)
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
                    Tensor Core Compute Utilization (
                    {(selected.quantization === "FP8" && gpu.nativeFp8
                      ? gpu.fp8Tflops
                      : gpu.fp16Tflops) * gpuCount}{" "}
                    TFLOPS)
                  </span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {performance.gpuComputeUtilPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{ width: `${performance.gpuComputeUtilPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/80 text-[11px] tabular-nums">
            <div>
              <span className="text-zinc-500 block">Arith. Intensity</span>
              <span className="font-mono text-zinc-200 font-medium">
                {performance.arithmeticIntensity} FLOP/B
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Ridge Point</span>
              <span className="font-mono text-zinc-200 font-medium">
                {performance.ridgePoint} FLOP/B
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

        {/* 3. Multi-Cloud Provider Pricing & TCO */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                <Server className="w-4 h-4 text-indigo-400" />
                Cloud Infrastructure Quotes ({gpuCount}x {gpu.name})
              </span>
              <span className="text-[11px] font-mono text-teal-400">
                {savingsPctVsApi}% below commercial APIs
              </span>
            </div>

            <div className="space-y-1.5 mt-2">
              {gpu.pricing.providers.map((p) => {
                const clusterHourly = p.hourlyRate * gpuCount;
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
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          p.availability === "High"
                            ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                            : "bg-amber-950/50 text-amber-400 border border-amber-800/50"
                        }`}
                      >
                        {p.availability}
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
              <span className="text-zinc-500 block">Output Unit Cost</span>
              <span className="font-mono text-teal-400 font-semibold">
                ${economics.costPerMillionOutputTokens.toFixed(3)} / 1M
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Blended Unit Cost</span>
              <span className="font-mono text-zinc-200 font-semibold">
                ${economics.costPerMillionBlendedTokens.toFixed(3)} / 1M
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Thermal Envelope</span>
              <span className="font-mono text-zinc-200 font-medium">
                {economics.powerDrawWatts}W TDP
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Ready-to-Deploy Production Command */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-200">
              Production Inference Server Provisioning Command
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded bg-zinc-900 p-0.5 border border-zinc-800 text-[11px]">
              <button
                onClick={() => setEngineTab("vllm")}
                className={`px-2 py-0.5 rounded ${
                  engineTab === "vllm"
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                vLLM
              </button>
              <button
                onClick={() => setEngineTab("sglang")}
                className={`px-2 py-0.5 rounded ${
                  engineTab === "sglang"
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                SGLang
              </button>
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
