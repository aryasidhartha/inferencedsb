"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  USE_CASE_PRESETS,
  UseCaseId,
  QuantizationType,
  ServingEngineId,
  PricingTierId,
  FineTuneMode,
  WorkloadConfig,
  runFullMatrixSimulation,
  getQuantSpec,
  SERVING_ENGINES,
} from "@/lib/inference-engine";
import { ParetoChart } from "@/components/ParetoChart";
import { GpuDeepDivePanel } from "@/components/GpuDeepDivePanel";
import { FutbinComparator } from "@/components/FutbinComparator";
import {
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowUpDown,
  MessageSquare,
  Database,
  Code2,
  Bot,
  Layers,
  Activity,
  FileText,
  Eye,
  Server,
} from "lucide-react";

const USE_CASE_ICONS: Record<UseCaseId, React.ReactNode> = {
  chatbot: <MessageSquare className="w-3.5 h-3.5" />,
  rag: <Database className="w-3.5 h-3.5" />,
  coding: <Code2 className="w-3.5 h-3.5" />,
  agentic: <Bot className="w-3.5 h-3.5" />,
  summarization: <FileText className="w-3.5 h-3.5" />,
  batch: <Layers className="w-3.5 h-3.5" />,
  vision: <Eye className="w-3.5 h-3.5" />,
};

type SortField =
  | "futbinOvr"
  | "costPerMillionBlendedTokens"
  | "costPerMillionOutputTokens"
  | "useCaseQualityScore"
  | "totalOutputTokPerSec"
  | "ttftMs"
  | "hourlyCostUsd";

export default function InferenceDashboardPage() {
  const [config, setConfig] = useState<WorkloadConfig>({
    useCaseId: "chatbot",
    promptTokens: USE_CASE_PRESETS.chatbot.promptTokens,
    p95PromptTokens: USE_CASE_PRESETS.chatbot.p95PromptTokens,
    outputTokens: USE_CASE_PRESETS.chatbot.outputTokens,
    p95OutputTokens: USE_CASE_PRESETS.chatbot.p95OutputTokens,
    concurrency: USE_CASE_PRESETS.chatbot.concurrency,
    targetTtftMs: USE_CASE_PRESETS.chatbot.targetTtftMs,
    targetTpotTokPerSec: USE_CASE_PRESETS.chatbot.targetTpotTokPerSec,
    minQualityBar: USE_CASE_PRESETS.chatbot.minQualityBar,
    quantization: USE_CASE_PRESETS.chatbot.recommendedQuant,
    servingEngine: USE_CASE_PRESETS.chatbot.recommendedEngine,
    pricingTier: "ondemand",
    fineTuneMode: "none",
    prefixCacheHitRate: USE_CASE_PRESETS.chatbot.prefixCacheHitRate,
    speculativeDecoding: false,
    isOnlineWorkload: USE_CASE_PRESETS.chatbot.isOnlineWorkload,
    trafficUtilizationPct: 80,
    requireCommercialLicense: false,
    monthlyActiveHours: 730,
    maxBudgetPerHour: 15,
    allowMultiGpu: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("futbinOvr");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSelectUseCase = (useCaseId: UseCaseId) => {
    const preset = USE_CASE_PRESETS[useCaseId];
    setConfig((prev) => ({
      ...prev,
      useCaseId,
      promptTokens: preset.promptTokens,
      p95PromptTokens: preset.p95PromptTokens,
      outputTokens: preset.outputTokens,
      p95OutputTokens: preset.p95OutputTokens,
      concurrency: preset.concurrency,
      targetTtftMs: preset.targetTtftMs,
      targetTpotTokPerSec: preset.targetTpotTokPerSec,
      minQualityBar: preset.minQualityBar,
      quantization: preset.recommendedQuant,
      servingEngine: preset.recommendedEngine,
      prefixCacheHitRate: preset.prefixCacheHitRate,
      isOnlineWorkload: preset.isOnlineWorkload,
    }));
  };

  const simulationResults = useMemo(
    () => runFullMatrixSimulation(config),
    [config]
  );

  const recommendations = useMemo(() => {
    const valid = simulationResults.filter((r) => r.fitsInVram);
    const slaCompliant = valid.filter(
      (r) =>
        r.scores.meetsAllSlas &&
        r.economics.hourlyCostUsd <= config.maxBudgetPerHour
    );
    const pool = slaCompliant.length > 0 ? slaCompliant : valid;

    const bestOverall = pool[0] || simulationResults[0];

    const lowestCostPool = [...pool].sort(
      (a, b) =>
        a.economics.costPerMillionBlendedTokens -
        b.economics.costPerMillionBlendedTokens
    );
    const bestCostEfficiency = lowestCostPool[0] || bestOverall;

    const highestQualityPool = [...pool].sort(
      (a, b) =>
        b.scores.useCaseQualityScore - a.scores.useCaseQualityScore ||
        a.economics.costPerMillionBlendedTokens -
          b.economics.costPerMillionBlendedTokens
    );
    const bestQuality = highestQualityPool[0] || bestOverall;

    return {
      bestOverall,
      bestCostEfficiency,
      bestQuality,
    };
  }, [simulationResults, config.maxBudgetPerHour]);

  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (
      recommendations.bestOverall &&
      (!selectedId || !simulationResults.some((r) => r.id === selectedId))
    ) {
      setSelectedId(recommendations.bestOverall.id);
    }
  }, [recommendations.bestOverall, selectedId, simulationResults]);

  const selectedResult = useMemo(() => {
    return (
      simulationResults.find((r) => r.id === selectedId) ||
      recommendations.bestOverall
    );
  }, [simulationResults, selectedId, recommendations.bestOverall]);

  const filteredTableResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = simulationResults.filter((r) => {
      if (!q) return true;
      return (
        r.model.name.toLowerCase().includes(q) ||
        r.gpu.name.toLowerCase().includes(q) ||
        r.model.provider.toLowerCase().includes(q) ||
        r.gpu.architecture.toLowerCase().includes(q) ||
        r.futbin.tier.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (sortField) {
        case "futbinOvr":
          valA = a.futbin.ovr;
          valB = b.futbin.ovr;
          break;
        case "costPerMillionBlendedTokens":
          valA = a.economics.costPerMillionBlendedTokens;
          valB = b.economics.costPerMillionBlendedTokens;
          break;
        case "costPerMillionOutputTokens":
          valA = a.economics.costPerMillionOutputTokens;
          valB = b.economics.costPerMillionOutputTokens;
          break;
        case "useCaseQualityScore":
          valA = a.scores.useCaseQualityScore;
          valB = b.scores.useCaseQualityScore;
          break;
        case "totalOutputTokPerSec":
          valA = a.performance.totalOutputTokPerSec;
          valB = b.performance.totalOutputTokPerSec;
          break;
        case "ttftMs":
          valA = a.performance.ttftMs;
          valB = b.performance.ttftMs;
          break;
        case "hourlyCostUsd":
          valA = a.economics.hourlyCostUsd;
          valB = b.economics.hourlyCostUsd;
          break;
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [simulationResults, searchQuery, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(
        field === "costPerMillionBlendedTokens" ||
          field === "costPerMillionOutputTokens" ||
          field === "ttftMs" ||
          field === "hourlyCostUsd"
      );
    }
  };

  const currentPreset = USE_CASE_PRESETS[config.useCaseId];
  const quantSpec = getQuantSpec(config.quantization);
  const engineSpec = SERVING_ENGINES[config.servingEngine];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Navigation & Use-Case Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#09090b]/90 border-b border-zinc-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-[1640px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-100">
                  InferenceAdvisor
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  AA + FUTBIN v3.0
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                4-Stage Pipeline: 1. Memory Filter → 2. Speed Roofline → 3. Input/Output Pricing → 4. FUTBIN OVR Ranker
              </p>
            </div>
          </div>

          {/* 7 Use-Case Selector Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800/90">
            {(Object.keys(USE_CASE_PRESETS) as UseCaseId[]).map((id) => {
              const preset = USE_CASE_PRESETS[id];
              const active = config.useCaseId === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectUseCase(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  {USE_CASE_ICONS[id]}
                  <span>{preset.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-[1640px] w-full mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* LEFT SIDEBAR: 4-Stage Pipeline Controls */}
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
          <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-4 sticky top-20">
            <div className="border-b border-zinc-800/80 pb-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. Workload Inputs</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                  {config.isOnlineWorkload ? "Online (Latency)" : "Offline (Batch)"}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-zinc-100 mt-1">
                {currentPreset.name}
              </h2>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                {currentPreset.description}
              </p>
            </div>

            {/* Token Shapes (Avg + p95) & Concurrency */}
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">
                    Input Tokens (Avg / p95)
                  </span>
                  <span className="font-mono text-zinc-100 font-medium tabular-nums">
                    {config.promptTokens.toLocaleString()}{" "}
                    <span className="text-zinc-500 text-[11px]">
                      (p95: {config.p95PromptTokens.toLocaleString()})
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={256}
                  max={16384}
                  step={256}
                  value={config.promptTokens}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setConfig({
                      ...config,
                      promptTokens: val,
                      p95PromptTokens: val * 2,
                    });
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">
                    Output Tokens (Avg / p95)
                  </span>
                  <span className="font-mono text-zinc-100 font-medium tabular-nums">
                    {config.outputTokens.toLocaleString()}{" "}
                    <span className="text-zinc-500 text-[11px]">
                      (p95: {config.p95OutputTokens.toLocaleString()})
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={64}
                  max={4096}
                  step={64}
                  value={config.outputTokens}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setConfig({
                      ...config,
                      outputTokens: val,
                      p95OutputTokens: val * 2,
                    });
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">
                    Concurrent Users / Streams
                  </span>
                  <span className="font-mono text-zinc-100 font-medium tabular-nums">
                    {config.concurrency} streams
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={128}
                  step={1}
                  value={config.concurrency}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      concurrency: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">
                    Prefix Cache Hit Rate
                  </span>
                  <span className="font-mono text-teal-400 font-medium tabular-nums">
                    {Math.round(config.prefixCacheHitRate * 100)}% cached
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={config.prefixCacheHitRate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      prefixCacheHitRate: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
              </div>
            </div>

            {/* Serving Stack & Quantization */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>2. Serving Stack & Precision</span>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Inference Engine
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    ["vllm", "sglang", "trtllm", "llamacpp"] as ServingEngineId[]
                  ).map((eng) => (
                    <button
                      key={eng}
                      onClick={() =>
                        setConfig({ ...config, servingEngine: eng })
                      }
                      className={`py-1.5 px-1 rounded text-[11px] font-mono uppercase border transition-all ${
                        config.servingEngine === eng
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                          : "bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {eng}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                  {engineSpec.description}
                </p>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Quantization Precision
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {(
                    ["FP16", "FP8", "INT8", "INT4", "FP4"] as QuantizationType[]
                  ).map((q) => (
                    <button
                      key={q}
                      onClick={() => setConfig({ ...config, quantization: q })}
                      className={`py-1.5 px-1 rounded text-[11px] font-mono font-medium border transition-all ${
                        config.quantization === q
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                          : "bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                  {quantSpec.description}
                </p>
              </div>

              {/* Fine-Tune / LoRA Mode */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Fine-Tuning / LoRA Adapter Memory
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "none", label: "Inference" },
                      { id: "lora", label: "Multi-LoRA" },
                      { id: "qlora", label: "QLoRA Dev" },
                    ] as { id: FineTuneMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        setConfig({ ...config, fineTuneMode: m.id })
                      }
                      className={`py-1 px-1.5 rounded text-[11px] font-medium border transition-all ${
                        config.fineTuneMode === m.id
                          ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                          : "bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pricing Tier, Traffic Utilization & SLOs */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                3. Pricing Tier & SLO Guardrails
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: "ondemand", label: "On-Demand" },
                    { id: "reserved", label: "Reserved -30%" },
                    { id: "spot", label: "Spot -45%" },
                  ] as { id: PricingTierId; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setConfig({ ...config, pricingTier: t.id })}
                    className={`py-1.5 px-1 rounded text-[11px] font-medium border transition-all ${
                      config.pricingTier === t.id
                        ? "bg-teal-500/15 border-teal-500/50 text-teal-300"
                        : "bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">
                    Traffic Utilization (Active vs Idle)
                  </span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {config.trafficUtilizationPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={config.trafficUtilizationPct}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      trafficUtilizationPct: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Min Quality Bar (0–100)</span>
                  <span className="font-mono text-indigo-300 tabular-nums">
                    {config.minQualityBar} pts
                  </span>
                </div>
                <input
                  type="range"
                  min={45}
                  max={88}
                  step={1}
                  value={config.minQualityBar}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      minQualityBar: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">Max TTFT</span>
                    <span className="font-mono text-zinc-200">
                      {config.targetTtftMs}ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={5000}
                    step={50}
                    value={config.targetTtftMs}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        targetTtftMs: Number(e.target.value),
                      })
                    }
                    className="w-full cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">Min Stream</span>
                    <span className="font-mono text-zinc-200">
                      {config.targetTpotTokPerSec} tok/s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={config.targetTpotTokPerSec}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        targetTpotTokPerSec: Number(e.target.value),
                      })
                    }
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-1.5">
                <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                  <span>Speculative Decoding (N-gram / Medusa)</span>
                  <input
                    type="checkbox"
                    checked={config.speculativeDecoding}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        speculativeDecoding: e.target.checked,
                      })
                    }
                    className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                  <span>Allow Multi-GPU Tensor Parallelism</span>
                  <input
                    type="checkbox"
                    checked={config.allowMultiGpu}
                    onChange={(e) =>
                      setConfig({ ...config, allowMultiGpu: e.target.checked })
                    }
                    className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0"
                  />
                </label>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <section className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          {/* 1. FUTBIN HARDWARE × MODEL META CARDS & 1v1 VERSUS ARENA */}
          <FutbinComparator
            results={simulationResults}
            selectedId={selectedResult?.id || ""}
            onSelect={(r) => setSelectedId(r.id)}
            recommendations={recommendations}
          />

          {/* 2. ARTIFICIAL ANALYSIS 4-QUADRANT & 3-PILLAR BAR CHARTS */}
          <ParetoChart
            results={simulationResults}
            selectedId={selectedResult?.id || ""}
            onSelect={(r) => setSelectedId(r.id)}
            targetTtftMs={config.targetTtftMs}
            targetTpotTokPerSec={config.targetTpotTokPerSec}
            minQualityBar={config.minQualityBar}
          />

          {/* 3. 4-STAGE PIPELINE DEEP-DIVE HARDWARE & MODEL INSPECTOR */}
          {selectedResult && (
            <GpuDeepDivePanel selected={selectedResult} config={config} />
          )}

          {/* 4. FULL SIMULATION LEADERBOARD TABLE */}
          <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 tracking-tight">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Complete Hardware × LLM Evaluation Matrix
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Showing {filteredTableResults.length} memory-feasible configurations ranked by SLO compliance, FUTBIN OVR, and Blended $/1M token price.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter model, GPU, or tier (e.g. TOTY)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium text-[11px] uppercase tracking-wider">
                    <th
                      className="py-2.5 px-2.5 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("futbinOvr")}
                    >
                      <span className="inline-flex items-center gap-1">
                        OVR <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="py-2.5 px-2.5">Model & Architecture</th>
                    <th className="py-2.5 px-2.5">Apt GPU Config</th>
                    <th className="py-2.5 px-2.5">VRAM & Max Users</th>
                    <th
                      className="py-2.5 px-2.5 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("useCaseQualityScore")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Quality <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-2.5 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("ttftMs")}
                    >
                      <span className="inline-flex items-center gap-1">
                        TTFT / Stream <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-2.5 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("costPerMillionBlendedTokens")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Blended $/1M <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-2.5 text-right cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("hourlyCostUsd")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        $/Hr <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredTableResults.slice(0, 28).map((r) => {
                    const isSelected = selectedResult?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-indigo-500/10 hover:bg-indigo-500/15"
                            : "hover:bg-zinc-900/70"
                        }`}
                      >
                        <td className="py-2.5 px-2.5 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-xs border ${
                                r.futbin.ovr >= 90
                                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                                  : r.futbin.ovr >= 84
                                  ? "bg-teal-500/15 text-teal-300 border-teal-500/35"
                                  : "bg-zinc-800 text-zinc-200 border-zinc-700"
                              }`}
                            >
                              {r.futbin.ovr}
                            </span>
                            <span className="text-[10px] text-zinc-500 hidden xl:inline">
                              {r.futbin.tier}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-2.5">
                          <div className="font-medium text-zinc-100 flex items-center gap-1.5">
                            <span>{r.model.shortName}</span>
                            {r.isParetoOptimalCostQuality && (
                              <span className="px-1.5 py-0.2 text-[10px] rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono">
                                Pareto
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {r.model.architecture} ({r.model.activeParamsB}B) ·{" "}
                            {r.quantization} · {r.model.license}
                          </div>
                        </td>

                        <td className="py-2.5 px-2.5">
                          <div className="font-medium text-zinc-200">
                            {r.gpuCount}x {r.gpu.shortName}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {r.gpu.memoryBandwidthGbPerSec * r.gpuCount} GB/s ·{" "}
                            {r.confidenceLevel === "Measured Benchmark"
                              ? "Measured"
                              : "Roofline"}
                          </div>
                        </td>

                        <td className="py-2.5 px-2.5 font-mono">
                          <div className="text-zinc-300">
                            {r.vramBreakdown.totalRequiredGb}/
                            {r.vramBreakdown.totalAvailableGb}GB (
                            {r.performance.maxConcurrentUsersWithinSlo}u SLO)
                          </div>
                          <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                r.vramBreakdown.utilizationPct > 85
                                  ? "bg-amber-500"
                                  : "bg-indigo-500"
                              }`}
                              style={{
                                width: `${r.vramBreakdown.utilizationPct}%`,
                              }}
                            />
                          </div>
                        </td>

                        <td className="py-2.5 px-2.5 font-mono">
                          <span
                            className={`font-medium ${
                              r.scores.meetsQualityBar
                                ? "text-zinc-100"
                                : "text-amber-400"
                            }`}
                          >
                            {r.scores.useCaseQualityScore}
                          </span>
                          <span className="text-zinc-500">/100</span>
                        </td>

                        <td className="py-2.5 px-2.5 font-mono">
                          <div className="flex items-center gap-1.5">
                            {r.scores.meetsAllSlas ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <div>
                              <div className="text-zinc-200">
                                {r.performance.ttftMs}ms TTFT
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {r.performance.tpotTokPerSec} tok/s (
                                {r.performance.itlMs}ms ITL)
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-2.5 font-mono">
                          <div className="text-teal-400 font-semibold">
                            ${r.economics.costPerMillionBlendedTokens.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            In: ${r.economics.costPerMillionInputTokens.toFixed(2)}{" "}
                            · Out: $
                            {r.economics.costPerMillionOutputTokens.toFixed(2)}
                          </div>
                        </td>

                        <td className="py-2.5 px-2.5 text-right font-mono text-zinc-200">
                          ${r.economics.hourlyCostUsd.toFixed(2)}/hr
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
