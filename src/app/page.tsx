"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  USE_CASE_PRESETS,
  UseCaseId,
  QuantizationType,
  WorkloadConfig,
  runFullMatrixSimulation,
  getQuantSpec,
  SimulationResult,
} from "@/lib/inference-engine";
import { ParetoChart } from "@/components/ParetoChart";
import { GpuDeepDivePanel } from "@/components/GpuDeepDivePanel";
import {
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Trophy,
  TrendingDown,
  Award,
  Search,
  ArrowUpDown,
  MessageSquare,
  Database,
  Code2,
  Bot,
  Layers,
  Activity,
} from "lucide-react";

const USE_CASE_ICONS: Record<UseCaseId, React.ReactNode> = {
  chatbot: <MessageSquare className="w-3.5 h-3.5" />,
  rag: <Database className="w-3.5 h-3.5" />,
  coding: <Code2 className="w-3.5 h-3.5" />,
  agentic: <Bot className="w-3.5 h-3.5" />,
  batch: <Layers className="w-3.5 h-3.5" />,
};

type SortField =
  | "overallMatchScore"
  | "costPerMillionOutputTokens"
  | "useCaseQualityScore"
  | "totalOutputTokPerSec"
  | "ttftMs"
  | "hourlyCostUsd";

export default function InferenceDashboardPage() {
  const [config, setConfig] = useState<WorkloadConfig>({
    useCaseId: "chatbot",
    promptTokens: USE_CASE_PRESETS.chatbot.promptTokens,
    outputTokens: USE_CASE_PRESETS.chatbot.outputTokens,
    concurrency: USE_CASE_PRESETS.chatbot.concurrency,
    targetTtftMs: USE_CASE_PRESETS.chatbot.targetTtftMs,
    targetTpotTokPerSec: USE_CASE_PRESETS.chatbot.targetTpotTokPerSec,
    quantization: USE_CASE_PRESETS.chatbot.recommendedQuant,
    monthlyActiveHours: 730,
    maxBudgetPerHour: 15,
    allowMultiGpu: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("overallMatchScore");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSelectUseCase = (useCaseId: UseCaseId) => {
    const preset = USE_CASE_PRESETS[useCaseId];
    setConfig((prev) => ({
      ...prev,
      useCaseId,
      promptTokens: preset.promptTokens,
      outputTokens: preset.outputTokens,
      concurrency: preset.concurrency,
      targetTtftMs: preset.targetTtftMs,
      targetTpotTokPerSec: preset.targetTpotTokPerSec,
      quantization: preset.recommendedQuant,
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
        a.economics.costPerMillionOutputTokens -
        b.economics.costPerMillionOutputTokens
    );
    const bestCostEfficiency = lowestCostPool[0] || bestOverall;

    const highestQualityPool = [...pool].sort(
      (a, b) =>
        b.scores.useCaseQualityScore - a.scores.useCaseQualityScore ||
        a.economics.costPerMillionOutputTokens -
          b.economics.costPerMillionOutputTokens
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
        r.gpu.architecture.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (sortField) {
        case "overallMatchScore":
          valA = a.scores.overallMatchScore;
          valB = b.scores.overallMatchScore;
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
        field === "costPerMillionOutputTokens" ||
          field === "ttftMs" ||
          field === "hourlyCostUsd"
      );
    }
  };

  const currentPreset = USE_CASE_PRESETS[config.useCaseId];
  const quantSpec = getQuantSpec(config.quantization);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Navigation & Use-Case Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#09090b]/90 border-b border-zinc-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-100">
                  InferenceAdvisor
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  v2.6 Enterprise
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Open-Source LLM Infrastructure Sizing & Roofline Cost-Efficiency Analyzer
              </p>
            </div>
          </div>

          {/* Use-Case Selector Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800/90">
            {(Object.keys(USE_CASE_PRESETS) as UseCaseId[]).map((id) => {
              const preset = USE_CASE_PRESETS[id];
              const active = config.useCaseId === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectUseCase(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
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
      <main className="max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* LEFT SIDEBAR: Workload & SLA Controls */}
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
          <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-5 sticky top-20">
            <div className="border-b border-zinc-800/80 pb-3.5">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Workload Specification</span>
              </div>
              <h2 className="text-sm font-semibold text-zinc-100 mt-1">
                {currentPreset.name}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {currentPreset.description}
              </p>
            </div>

            {/* Capability Weights Bar */}
            <div>
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1.5">
                <span>Evaluation Benchmark Weights</span>
                <span className="font-mono text-zinc-500">100%</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono text-center tabular-nums">
                <div className="bg-[#09090b] border border-zinc-800/90 rounded p-1.5">
                  <span className="text-zinc-500 block">General</span>
                  <span className="text-zinc-200 font-semibold">
                    {Math.round(currentPreset.capabilityWeights.general * 100)}%
                  </span>
                </div>
                <div className="bg-[#09090b] border border-zinc-800/90 rounded p-1.5">
                  <span className="text-zinc-500 block">Code</span>
                  <span className="text-zinc-200 font-semibold">
                    {Math.round(currentPreset.capabilityWeights.coding * 100)}%
                  </span>
                </div>
                <div className="bg-[#09090b] border border-zinc-800/90 rounded p-1.5">
                  <span className="text-zinc-500 block">Reason</span>
                  <span className="text-zinc-200 font-semibold">
                    {Math.round(currentPreset.capabilityWeights.reasoning * 100)}%
                  </span>
                </div>
                <div className="bg-[#09090b] border border-zinc-800/90 rounded p-1.5">
                  <span className="text-zinc-500 block">RAG</span>
                  <span className="text-zinc-200 font-semibold">
                    {Math.round(currentPreset.capabilityWeights.rag * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              {/* Input Prompt Length */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-300 font-medium">
                    Avg Input Context
                  </span>
                  <span className="font-mono text-zinc-100 font-medium tabular-nums">
                    {config.promptTokens.toLocaleString()} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min={256}
                  max={16384}
                  step={256}
                  value={config.promptTokens}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      promptTokens: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>256</span>
                  <span>4,096</span>
                  <span>8,192</span>
                  <span>16,384</span>
                </div>
              </div>

              {/* Output Generation Length */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-300 font-medium">
                    Avg Output Generation
                  </span>
                  <span className="font-mono text-zinc-100 font-medium tabular-nums">
                    {config.outputTokens.toLocaleString()} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min={64}
                  max={4096}
                  step={64}
                  value={config.outputTokens}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      outputTokens: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>64</span>
                  <span>512</span>
                  <span>2,048</span>
                  <span>4,096</span>
                </div>
              </div>

              {/* Concurrent Active Users */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-300 font-medium">
                    Concurrent Active Streams
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
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>1</span>
                  <span>16</span>
                  <span>64</span>
                  <span>128</span>
                </div>
              </div>
            </div>

            {/* Quantization Selector */}
            <div className="pt-3 border-t border-zinc-800/80">
              <label className="text-xs font-medium text-zinc-300 block mb-2">
                Weight & KV-Cache Precision
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["FP16", "FP8", "INT4"] as QuantizationType[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setConfig({ ...config, quantization: q })}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono font-medium border transition-all ${
                      config.quantization === q
                        ? "bg-indigo-600/15 border-indigo-500 text-indigo-300"
                        : "bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400 mt-2 leading-snug">
                {quantSpec.description}
              </p>
            </div>

            {/* Latency SLA & Budget Constraints */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-3.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Service Level Objectives (SLOs)
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Max Time to First Token</span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    {config.targetTtftMs} ms
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
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Min Per-User Decode Rate</span>
                  <span className="font-mono text-zinc-200 tabular-nums">
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

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Hourly Compute Budget</span>
                  <span className="font-mono text-zinc-200 tabular-nums">
                    ${config.maxBudgetPerHour}/hr{" "}
                    <span className="text-zinc-500">
                      ($
                      {Math.round(
                        config.maxBudgetPerHour * config.monthlyActiveHours
                      ).toLocaleString()}
                      /mo)
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={35}
                  step={0.5}
                  value={config.maxBudgetPerHour}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      maxBudgetPerHour: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between pt-1 text-xs text-zinc-300 cursor-pointer">
                <span>Multi-GPU Tensor Parallelism</span>
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
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <section className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          {/* TOP 3 HERO RECOMMENDATION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.bestOverall && (
              <RecommendationHeroCard
                badge="Primary Recommendation"
                badgeIcon={<Trophy className="w-3.5 h-3.5 text-indigo-400" />}
                isPrimary
                result={recommendations.bestOverall}
                isSelected={selectedResult?.id === recommendations.bestOverall.id}
                onSelect={() => setSelectedId(recommendations.bestOverall.id)}
              />
            )}

            {recommendations.bestCostEfficiency && (
              <RecommendationHeroCard
                badge="Lowest Unit Cost ($/1M)"
                badgeIcon={
                  <TrendingDown className="w-3.5 h-3.5 text-teal-400" />
                }
                result={recommendations.bestCostEfficiency}
                isSelected={
                  selectedResult?.id === recommendations.bestCostEfficiency.id
                }
                onSelect={() =>
                  setSelectedId(recommendations.bestCostEfficiency.id)
                }
              />
            )}

            {recommendations.bestQuality && (
              <RecommendationHeroCard
                badge="Highest Benchmark Quality"
                badgeIcon={<Award className="w-3.5 h-3.5 text-slate-300" />}
                result={recommendations.bestQuality}
                isSelected={selectedResult?.id === recommendations.bestQuality.id}
                onSelect={() => setSelectedId(recommendations.bestQuality.id)}
              />
            )}
          </div>

          {/* PARETO FRONTIER INTERACTIVE CHART */}
          <ParetoChart
            results={simulationResults}
            selectedId={selectedResult?.id || ""}
            onSelect={(r) => setSelectedId(r.id)}
            targetTtftMs={config.targetTtftMs}
            targetTpotTokPerSec={config.targetTpotTokPerSec}
          />

          {/* DEEP-DIVE HARDWARE & MODEL INSPECTOR */}
          {selectedResult && (
            <GpuDeepDivePanel selected={selectedResult} config={config} />
          )}

          {/* FULL SIMULATION LEADERBOARD TABLE */}
          <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 tracking-tight">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Hardware × Model Evaluation Matrix
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Showing {filteredTableResults.length} valid configurations ranked by composite efficiency and SLA compliance.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter model or GPU (e.g. H100, Qwen)..."
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
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">GPU Topology</th>
                    <th className="py-2.5 px-3">VRAM Footprint</th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("useCaseQualityScore")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Quality <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("totalOutputTokPerSec")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Throughput <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("ttftMs")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Latency SLO <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("hourlyCostUsd")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Hourly <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("costPerMillionOutputTokens")}
                    >
                      <span className="inline-flex items-center gap-1">
                        $/1M Tok <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-zinc-100"
                      onClick={() => toggleSort("overallMatchScore")}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Fit Index <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredTableResults.slice(0, 25).map((r) => {
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
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-zinc-100 flex items-center gap-1.5">
                            <span>{r.model.name}</span>
                            {r.isParetoOptimalCostQuality && (
                              <span
                                title="Pareto Optimal on Cost vs Quality Frontier"
                                className="px-1.5 py-0.2 text-[10px] rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono"
                              >
                                Pareto
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {r.model.totalParamsB}B · {r.quantization} · {r.model.license}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-medium text-zinc-200">
                            {r.gpuCount}x {r.gpu.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {r.vramBreakdown.totalAvailableGb}GB {r.gpu.memoryType} ·{" "}
                            {r.gpu.memoryBandwidthGbPerSec * r.gpuCount} GB/s
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono">
                          <div className="text-zinc-300">
                            {r.vramBreakdown.totalRequiredGb} /{" "}
                            {r.vramBreakdown.totalAvailableGb} GB
                          </div>
                          <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
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

                        <td className="py-2.5 px-3 font-mono">
                          <span className="text-zinc-100 font-medium">
                            {r.scores.useCaseQualityScore}
                          </span>
                          <span className="text-zinc-500">/100</span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-zinc-200">
                          {r.performance.totalOutputTokPerSec.toLocaleString()} tok/s
                        </td>

                        <td className="py-2.5 px-3 font-mono">
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
                                {r.performance.tpotTokPerSec} tok/s/user
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-zinc-300">
                          ${r.economics.hourlyCostUsd.toFixed(2)}/hr
                        </td>

                        <td className="py-2.5 px-3 font-mono">
                          <span className="text-teal-400 font-medium">
                            ${r.economics.costPerMillionOutputTokens.toFixed(3)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700/80">
                            {r.scores.overallMatchScore}
                          </span>
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

interface RecommendationHeroCardProps {
  badge: string;
  badgeIcon: React.ReactNode;
  isPrimary?: boolean;
  result: SimulationResult;
  isSelected: boolean;
  onSelect: () => void;
}

function RecommendationHeroCard({
  badge,
  badgeIcon,
  isPrimary,
  result,
  isSelected,
  onSelect,
}: RecommendationHeroCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl p-4 bg-[#121215] border transition-all duration-150 ${
        isSelected
          ? "border-indigo-500 ring-1 ring-indigo-500/50 bg-zinc-900/90"
          : isPrimary
          ? "border-zinc-700/90 hover:border-zinc-600"
          : "border-zinc-800/90 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {badgeIcon}
          {badge}
        </span>
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#09090b] text-zinc-200 border border-zinc-800 tabular-nums">
          Index {result.scores.overallMatchScore}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-zinc-100 truncate">
        {result.model.name}
      </h3>
      <div className="text-xs text-indigo-300 mt-0.5 flex items-center justify-between">
        <span>
          {result.gpuCount}x {result.gpu.name} ({result.vramBreakdown.totalAvailableGb}GB)
        </span>
        <span className="font-mono text-[11px] text-zinc-500">
          {result.quantization}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-zinc-800/80 text-xs tabular-nums">
        <div>
          <span className="text-[10px] text-zinc-500 block">Unit Cost</span>
          <span className="font-mono font-semibold text-teal-400">
            ${result.economics.costPerMillionOutputTokens.toFixed(3)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 block">Output Rate</span>
          <span className="font-mono font-medium text-zinc-200">
            {result.performance.totalOutputTokPerSec} tok/s
          </span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 block">Hourly Rate</span>
          <span className="font-mono font-medium text-zinc-200">
            ${result.economics.hourlyCostUsd.toFixed(2)}/hr
          </span>
        </div>
      </div>
    </div>
  );
}
