"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  USE_CASE_PRESETS,
  UseCaseId,
  QuantizationType,
  ServingEngineId,
  PricingTierId,
  WorkloadConfig,
  SimulationResult,
  runFullMatrixSimulation,
  getQualityBarDescription,
  buildDeployCli,
} from "@/lib/inference-engine";
import { Logo } from "@/components/Logo";
import {
  Check,
  Copy,
  Share2,
  ChevronDown,
  AlertCircle,
  Brain,
  Cpu,
  Wallet,
} from "lucide-react";

type PriorityMode = "cheapest" | "balanced" | "smartest";

const STORAGE_KEY = "inference_advisor_state_v5";

const CONCURRENCY_STOPS = [
  { value: 2, label: "Just me", hint: "1–3 people" },
  { value: 16, label: "A small team", hint: "about 16 at once" },
  { value: 48, label: "Hundreds of users", hint: "about 48 at once" },
  { value: 110, label: "Thousands of users", hint: "100+ at once" },
];

const PRIORITY_OPTIONS: { id: PriorityMode; label: string; hint: string }[] = [
  { id: "cheapest", label: "Cheapest", hint: "Lowest bill that still does the job" },
  { id: "balanced", label: "Balanced", hint: "Best mix of price and quality" },
  { id: "smartest", label: "Smartest", hint: "Best answers, price is secondary" },
];

const PRIORITY_WHY: Record<PriorityMode, string> = {
  cheapest:
    "You asked for the lowest bill, so this is the least expensive option that is still smart and fast enough.",
  balanced:
    "You asked for a balance, so this is the option that gives the best mix of quality, speed and price.",
  smartest:
    "You asked for the best answers, so this is the most capable option that still fits your needs.",
};

function humanConcurrency(c: number): string {
  if (c <= 3) return "Just you or one or two colleagues";
  if (c <= 20) return "A small team using it at the same time";
  if (c <= 64) return "Hundreds of customers, a few dozen chatting at any moment";
  return "A big audience, 100+ conversations happening at the same instant";
}

function modelSizeWord(billions: number): string {
  if (billions <= 10) return "a compact, quick";
  if (billions <= 40) return "a mid-sized";
  if (billions <= 100) return "a large";
  return "a very large, top-tier";
}

/** Keep only the strengths a non-technical reader can understand. */
function plainStrengths(strengths: string[]): string {
  const techy = /license|\bfp\d|\bint\d|\d+x\b|\bgpu\b|vram|\bgb\b|moe|gqa|mla|token|quant/i;
  const plain = strengths.filter((s) => !techy.test(s)).slice(0, 3);
  return plain.length > 0
    ? `being ${plain.map((s) => s.toLowerCase()).join(", ")}`
    : "being a well-rounded all-purpose model";
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtSeconds(ms: number): string {
  const s = ms / 1000;
  return s < 1 ? `${s.toFixed(2)} sec` : `${s.toFixed(1)} sec`;
}

/** A simple horizontal bar with an optional "what you need" marker. */
function Bar({
  value,
  max,
  marker,
  ok,
  accent = true,
}: {
  value: number;
  max: number;
  marker?: number;
  ok: boolean;
  accent?: boolean;
}) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  const markerPct =
    marker !== undefined ? Math.max(0, Math.min(100, (marker / max) * 100)) : undefined;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-zinc-100">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          !accent ? "bg-zinc-300" : ok ? "bg-blue-600" : "bg-amber-500"
        }`}
        style={{ width: `${pct}%` }}
      />
      {markerPct !== undefined && (
        <div
          className="absolute -top-1 h-4.5 w-0.5 bg-zinc-900"
          style={{ left: `${markerPct}%`, height: "18px" }}
          title="What you need"
        />
      )}
    </div>
  );
}

export default function InferenceDashboardPage() {
  const [priority, setPriority] = useState<PriorityMode>("balanced");
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

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

  // Debounced copy so dragging the slider stays smooth.
  const [debouncedConfig, setDebouncedConfig] = useState<WorkloadConfig>(config);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedConfig(config), 90);
    return () => clearTimeout(timer);
  }, [config]);

  // Restore from the share link (URL) or from the last visit (localStorage).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("uc")) {
      const uc = (params.get("uc") as UseCaseId) || "chatbot";
      const preset = USE_CASE_PRESETS[uc] || USE_CASE_PRESETS.chatbot;
      const prio = params.get("prio") as PriorityMode;
      if (prio && PRIORITY_OPTIONS.some((p) => p.id === prio)) setPriority(prio);
      setConfig((prev) => ({
        ...prev,
        useCaseId: preset.id,
        promptTokens: preset.promptTokens,
        p95PromptTokens: preset.p95PromptTokens,
        outputTokens: preset.outputTokens,
        p95OutputTokens: preset.p95OutputTokens,
        concurrency: Number(params.get("conc")) || preset.concurrency,
        targetTtftMs: preset.targetTtftMs,
        targetTpotTokPerSec: preset.targetTpotTokPerSec,
        minQualityBar: Number(params.get("qbar")) || preset.minQualityBar,
        quantization: preset.recommendedQuant as QuantizationType,
        servingEngine: preset.recommendedEngine as ServingEngineId,
        pricingTier: "ondemand" as PricingTierId,
        prefixCacheHitRate: preset.prefixCacheHitRate,
        isOnlineWorkload: preset.isOnlineWorkload,
        maxBudgetPerHour: Number(params.get("bhr")) || 15,
        requireCommercialLicense: params.get("comm") === "1",
      }));
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.config) setConfig((prev) => ({ ...prev, ...parsed.config }));
        if (parsed.priority) setPriority(parsed.priority);
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  // Save to localStorage + shareable URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ config: debouncedConfig, priority })
      );
      const params = new URLSearchParams();
      params.set("uc", debouncedConfig.useCaseId);
      params.set("conc", String(debouncedConfig.concurrency));
      params.set("prio", priority);
      params.set("qbar", String(debouncedConfig.minQualityBar));
      params.set("bhr", String(debouncedConfig.maxBudgetPerHour));
      if (debouncedConfig.requireCommercialLicense) params.set("comm", "1");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    } catch {
      /* ignore */
    }
  }, [debouncedConfig, priority]);

  // Any change to the answers clears a manual "pick this one" choice.
  useEffect(() => {
    setOverrideId(null);
  }, [debouncedConfig, priority]);

  const qualityOffset = (p: PriorityMode) => (p === "smartest" ? 6 : p === "cheapest" ? -4 : 0);

  const handleSelectUseCase = (useCaseId: UseCaseId) => {
    const preset = USE_CASE_PRESETS[useCaseId];
    setConfig((prev) => ({
      ...prev,
      useCaseId,
      promptTokens: preset.promptTokens,
      p95PromptTokens: preset.p95PromptTokens,
      outputTokens: preset.outputTokens,
      p95OutputTokens: preset.p95OutputTokens,
      concurrency: prev.concurrency,
      targetTtftMs: preset.targetTtftMs,
      targetTpotTokPerSec: preset.targetTpotTokPerSec,
      minQualityBar: Math.min(86, Math.max(52, preset.minQualityBar + qualityOffset(priority))),
      quantization: preset.recommendedQuant,
      servingEngine: preset.recommendedEngine,
      prefixCacheHitRate: preset.prefixCacheHitRate,
      isOnlineWorkload: preset.isOnlineWorkload,
    }));
  };

  const handleSelectPriority = (p: PriorityMode) => {
    setPriority(p);
    const preset = USE_CASE_PRESETS[config.useCaseId];
    setConfig((prev) => ({
      ...prev,
      minQualityBar: Math.min(86, Math.max(52, preset.minQualityBar + qualityOffset(p))),
    }));
  };

  // ---- Run the (unchanged) calculation engine ----
  const simulationResults = useMemo(
    () => runFullMatrixSimulation(debouncedConfig),
    [debouncedConfig]
  );

  // Pick one recommendation + a distinct cheaper and smarter alternative.
  const recommendations = useMemo(() => {
    const valid = simulationResults.filter((r) => r.fitsInVram);
    const budgetMatched = valid.filter(
      (r) => r.economics.hourlyCostUsd <= debouncedConfig.maxBudgetPerHour
    );
    const strictPool = budgetMatched.filter((r) => r.scores.meetsAllSlas);
    const activePool =
      strictPool.length > 0 ? strictPool : budgetMatched.length > 0 ? budgetMatched : valid;

    const sorted = [...activePool].sort((a, b) => {
      if (priority === "cheapest") {
        return (
          a.economics.costPerMillionBlendedTokens - b.economics.costPerMillionBlendedTokens ||
          b.scores.overallMatchScore - a.scores.overallMatchScore
        );
      }
      if (priority === "smartest") {
        return (
          b.scores.useCaseQualityScore - a.scores.useCaseQualityScore ||
          a.economics.costPerMillionBlendedTokens - b.economics.costPerMillionBlendedTokens
        );
      }
      return b.scores.overallMatchScore - a.scores.overallMatchScore;
    });

    const hero: SimulationResult | undefined = sorted[0] || simulationResults[0];

    const cheaperCandidates = valid
      .filter(
        (r) =>
          r.id !== hero?.id &&
          r.model.id !== hero?.model.id &&
          r.scores.meetsQualityBar &&
          r.economics.monthlyCostUsd < (hero?.economics.monthlyCostUsd ?? Infinity)
      )
      .sort(
        (a, b) =>
          b.scores.overallMatchScore - a.scores.overallMatchScore ||
          a.economics.monthlyCostUsd - b.economics.monthlyCostUsd
      );
    const cheaper =
      cheaperCandidates[0] ||
      valid
        .filter(
          (r) =>
            r.id !== hero?.id &&
            r.economics.monthlyCostUsd < (hero?.economics.monthlyCostUsd ?? Infinity)
        )
        .sort((a, b) => b.scores.useCaseQualityScore - a.scores.useCaseQualityScore)[0];

    const smarterCandidates = valid
      .filter(
        (r) =>
          r.id !== hero?.id &&
          r.id !== cheaper?.id &&
          r.scores.useCaseQualityScore > (hero?.scores.useCaseQualityScore ?? 0)
      )
      .sort(
        (a, b) =>
          b.scores.useCaseQualityScore - a.scores.useCaseQualityScore ||
          a.economics.monthlyCostUsd - b.economics.monthlyCostUsd
      );
    const smarter = smarterCandidates[0];

    return {
      hero,
      cheaper,
      smarter,
      strictMatchCount: strictPool.length,
    };
  }, [simulationResults, debouncedConfig.maxBudgetPerHour, priority]);

  const hero = recommendations.hero;

  // The three options shown in the comparison chart (all different from each other).
  const options = useMemo(() => {
    const list: { key: string; label: string; r: SimulationResult }[] = [];
    if (recommendations.cheaper) list.push({ key: "cheaper", label: "Cheaper option", r: recommendations.cheaper });
    if (hero) list.push({ key: "pick", label: "Our pick", r: hero });
    if (recommendations.smarter) list.push({ key: "smarter", label: "Smarter option", r: recommendations.smarter });
    return list;
  }, [recommendations, hero]);

  const shown: SimulationResult | undefined =
    (overrideId && options.find((o) => o.r.id === overrideId)?.r) || hero;

  // When nothing satisfies everything, explain what's blocking and offer a fix.
  const blocker = useMemo(() => {
    if (recommendations.strictMatchCount > 0) return null;
    const valid = simulationResults.filter((r) => r.fitsInVram);
    if (valid.length === 0) {
      return {
        reason: "No single machine can hold this much work in memory.",
        actionLabel: "Allow several graphics cards working together",
        applyFix: () => setConfig((p) => ({ ...p, allowMultiGpu: true, quantization: "FP8" })),
      };
    }
    const passesBudget = valid.filter(
      (r) => r.economics.hourlyCostUsd <= debouncedConfig.maxBudgetPerHour
    );
    if (passesBudget.length === 0) {
      const minHr = Math.ceil(Math.min(...valid.map((r) => r.economics.hourlyCostUsd)) * 2) / 2;
      const minMo = Math.round(minHr * debouncedConfig.monthlyActiveHours);
      return {
        reason: `Your budget (${fmtMoney(
          debouncedConfig.maxBudgetPerHour * debouncedConfig.monthlyActiveHours
        )}/month) is lower than the cheapest hardware that can do this job.`,
        actionLabel: `Raise the budget to ${fmtMoney(minMo)}/month`,
        applyFix: () => setConfig((p) => ({ ...p, maxBudgetPerHour: minHr })),
      };
    }
    const passesQuality = passesBudget.filter((r) => r.scores.meetsQualityBar);
    if (passesQuality.length === 0) {
      const best = Math.floor(Math.max(...passesBudget.map((r) => r.scores.useCaseQualityScore)));
      return {
        reason: "Nothing within your budget is smart enough for this kind of task.",
        actionLabel: "Accept slightly simpler answers to see options",
        applyFix: () => setConfig((p) => ({ ...p, minQualityBar: best })),
      };
    }
    return {
      reason: "Your speed target is stricter than what the hardware in your budget can deliver.",
      actionLabel: "Allow slightly slower replies",
      applyFix: () =>
        setConfig((p) => ({
          ...p,
          targetTtftMs: Math.max(p.targetTtftMs, 1200),
          targetTpotTokPerSec: Math.min(p.targetTpotTokPerSec, 25),
        })),
    };
  }, [recommendations.strictMatchCount, simulationResults, debouncedConfig]);

  const handleCopyCli = useCallback(() => {
    if (!shown) return;
    navigator.clipboard.writeText(buildDeployCli(shown, debouncedConfig));
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  }, [shown, debouncedConfig]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  }, []);

  const preset = USE_CASE_PRESETS[config.useCaseId];
  const taskName = preset.shortName.toLowerCase();

  // ---- Plain-English numbers for the shown option ----
  const view = useMemo(() => {
    if (!shown) return null;
    const q = shown.scores.useCaseQualityScore;
    const bar = debouncedConfig.minQualityBar;
    const ttftS = shown.performance.ttftMs / 1000;
    const targetTtftS = debouncedConfig.targetTtftMs / 1000;
    const wordsPerSec = shown.performance.tpotTokPerSec * 0.75;
    const targetWordsPerSec = debouncedConfig.targetTpotTokPerSec * 0.75;
    const users = shown.performance.maxConcurrentUsersWithinSlo;
    const replyWords = Math.round(debouncedConfig.outputTokens * 0.75);
    const replySeconds = ttftS + debouncedConfig.outputTokens / Math.max(1, shown.performance.tpotTokPerSec);
    const costPer1000 =
      ((debouncedConfig.promptTokens * shown.economics.costPerMillionInputTokens +
        debouncedConfig.outputTokens * shown.economics.costPerMillionOutputTokens) /
        1_000_000) *
      1000;
    const cheapestProvider = [...shown.gpu.pricing.providers].sort(
      (a, b) => a.hourlyRate - b.hourlyRate
    )[0];
    return {
      q,
      bar,
      smartOk: q >= bar,
      ttftS,
      targetTtftS,
      speedOk: shown.performance.ttftMs <= debouncedConfig.targetTtftMs,
      wordsPerSec,
      targetWordsPerSec,
      streamOk: wordsPerSec >= targetWordsPerSec,
      users,
      usersOk: users >= debouncedConfig.concurrency,
      memUsed: shown.vramBreakdown.totalRequiredGb,
      memTotal: shown.vramBreakdown.totalAvailableGb,
      memPct: shown.vramBreakdown.utilizationPct,
      memOk: shown.vramBreakdown.utilizationPct <= 92,
      replyWords,
      replySeconds,
      costPer1000,
      provider: cheapestProvider?.provider,
    };
  }, [shown, debouncedConfig]);

  const allOk = !!view && view.smartOk && view.speedOk && view.streamOk && view.usersOk && view.memOk;

  const maxOptionCost = Math.max(1, ...options.map((o) => o.r.economics.monthlyCostUsd));

  const tradeoff = (r: SimulationResult): string => {
    if (!hero || r.id === hero.id) return "Our recommended balance of price, quality and speed.";
    const dCost = r.economics.monthlyCostUsd - hero.economics.monthlyCostUsd;
    const dQ = r.scores.useCaseQualityScore - hero.scores.useCaseQualityScore;
    const costText =
      dCost < 0
        ? `saves about ${fmtMoney(-dCost)}/month`
        : `costs about ${fmtMoney(dCost)}/month more`;
    const qText =
      Math.abs(dQ) < 1
        ? "with about the same quality"
        : dQ < 0
        ? `but answers are noticeably less sharp (${Math.abs(Math.round(dQ))} points lower)`
        : `and answers are sharper (${Math.round(dQ)} points higher)`;
    return `${costText[0].toUpperCase()}${costText.slice(1)}, ${qText}.`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0a0a0a]">
      <header className="px-4 sm:px-6 py-5">
        <div className="max-w-[720px] mx-auto flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-mono text-sm font-light tracking-tight">inferenceadvisor</span>
          </span>
          <span className="text-xs text-zinc-500">Free · no sign-up</span>
        </div>
      </header>

      <main className="w-full max-w-[720px] mx-auto px-4 sm:px-6 pb-20 space-y-12">
        {/* Intro */}
        <section className="pt-4 sm:pt-8 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Which AI should you run, and on what?
          </h1>
          <p className="text-base text-zinc-600 leading-relaxed">
            Answer three quick questions. We&apos;ll recommend a free, open-source AI model and the
            computer to run it on, tell you what it will cost, and explain why.
          </p>
        </section>

        {/* Step 1 */}
        <section aria-labelledby="s1" className="space-y-4">
          <h2 id="s1" className="text-lg font-semibold tracking-tight">
            1. What are you building?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(Object.keys(USE_CASE_PRESETS) as UseCaseId[]).map((id) => {
              const p = USE_CASE_PRESETS[id];
              const active = config.useCaseId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectUseCase(id)}
                  aria-pressed={active}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600"
                      : "border-zinc-200 hover:border-zinc-400 bg-white"
                  }`}
                >
                  <div className="font-semibold text-sm">{p.shortName}</div>
                  <p className="text-xs text-zinc-500 mt-1 leading-snug">{p.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2 */}
        <section aria-labelledby="s2" className="space-y-4 pt-8 border-t border-zinc-200">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="s2" className="text-lg font-semibold tracking-tight">
              2. How many people will use it at once?
            </h2>
            <span className="font-mono text-sm font-semibold text-blue-600 whitespace-nowrap">
              {config.concurrency} {config.concurrency === 1 ? "person" : "people"}
            </span>
          </div>
          <input
            type="range"
            aria-label="People using it at the same time"
            min={1}
            max={128}
            step={1}
            value={config.concurrency}
            onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}
            className="w-full cursor-pointer"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CONCURRENCY_STOPS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setConfig({ ...config, concurrency: s.value })}
                className="text-left px-3 py-2 rounded-lg border border-zinc-200 hover:border-zinc-400 text-xs"
              >
                <span className="font-medium block">{s.label}</span>
                <span className="text-zinc-500">{s.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-500">{humanConcurrency(config.concurrency)}.</p>
        </section>

        {/* Step 3 */}
        <section aria-labelledby="s3" className="space-y-4 pt-8 border-t border-zinc-200">
          <h2 id="s3" className="text-lg font-semibold tracking-tight">
            3. What matters most?
          </h2>
          <div
            role="radiogroup"
            aria-label="What matters most"
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={priority === o.id}
                onClick={() => handleSelectPriority(o.id)}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  priority === o.id ? "bg-white shadow-sm text-zinc-900" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            {PRIORITY_OPTIONS.find((o) => o.id === priority)?.hint}. For {taskName} we&apos;ll aim for:{" "}
            <span className="text-zinc-700">{getQualityBarDescription(config.minQualityBar).toLowerCase()}</span>.
          </p>

          <details className="group pt-2">
            <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-medium text-zinc-600 hover:text-zinc-900 py-1">
              <span>Optional: set a budget limit</span>
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-4 text-sm">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-600">Most I want to spend</span>
                  <span className="font-mono font-semibold">
                    {fmtMoney(config.maxBudgetPerHour * config.monthlyActiveHours)} / month
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Maximum monthly budget"
                  min={0.5}
                  max={35}
                  step={0.5}
                  value={config.maxBudgetPerHour}
                  onChange={(e) => setConfig({ ...config, maxBudgetPerHour: Number(e.target.value) })}
                  className="w-full cursor-pointer"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.requireCommercialLicense}
                  onChange={(e) => setConfig({ ...config, requireCommercialLicense: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                <span>Only models I&apos;m allowed to use in a business</span>
              </label>
            </div>
          </details>
        </section>

        {/* Blocker */}
        {blocker && (
          <div className="p-4 rounded-xl border border-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">We couldn&apos;t meet every wish, so here&apos;s the closest match</p>
                <p className="text-zinc-500 mt-0.5">{blocker.reason}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={blocker.applyFix}
              className="shrink-0 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:opacity-90"
            >
              {blocker.actionLabel}
            </button>
          </div>
        )}

        {/* ===================== RESULT ===================== */}
        {shown && view && (
          <section
            aria-label="Our recommendation"
            className="pt-10 border-t-2 border-zinc-900 space-y-10"
          >
            {/* Headline */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                {overrideId ? "Option you picked" : "Our recommendation"}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                Use <span className="text-blue-600">{shown.model.shortName}</span>{" "}
                <span className="block text-xl sm:text-2xl font-medium text-zinc-600 mt-1">
                  on {shown.gpuCount === 1 ? "one" : shown.gpuCount} rented {shown.gpu.shortName}{" "}
                  {shown.gpuCount === 1 ? "graphics card" : "graphics cards"}
                </span>
              </h2>
              <p className="text-base text-zinc-700 leading-relaxed">
                {PRIORITY_WHY[priority]}{" "}
                {allOk
                  ? `It's smart enough for ${taskName}, replies quickly, and has enough power for ${config.concurrency} ${
                      config.concurrency === 1 ? "person" : "people"
                    } at once.`
                  : "It's the closest match to everything you asked for. See the checklist below for where it falls a little short."}
              </p>
            </div>

            {/* What you're getting */}
            <div className="space-y-5">
              <h3 className="text-lg font-semibold tracking-tight">What you&apos;re getting</h3>
              <div className="divide-y divide-zinc-200 border-y border-zinc-200">
                <div className="flex gap-4 py-5">
                  <Brain className="w-5 h-5 mt-0.5 text-zinc-900 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">The AI: {shown.model.name}</p>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {modelSizeWord(shown.model.totalParamsB)} AI model made by {shown.model.provider}, which you
                      download and run yourself. It&apos;s known for{" "}
                      {plainStrengths(shown.model.strengths)}.{" "}
                      {shown.model.commercialUse
                        ? `You can use it in a business (${shown.model.license} license).`
                        : `Check the ${shown.model.license} license before using it commercially.`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 py-5">
                  <Cpu className="w-5 h-5 mt-0.5 text-zinc-900 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      The computer: {shown.gpuCount}× {shown.gpu.name}
                    </p>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      A powerful graphics card (GPU) built for AI, with {shown.gpu.vramGb} GB of memory
                      {shown.gpuCount > 1 ? " each" : ""}. You rent it by the hour
                      {view.provider ? `, for example from ${view.provider}` : ""}, so there&apos;s nothing to buy.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 py-5">
                  <Wallet className="w-5 h-5 mt-0.5 text-zinc-900 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      The bill: about {fmtMoney(shown.economics.monthlyCostUsd)} per month
                    </p>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      That&apos;s roughly ${shown.economics.hourlyCostUsd.toFixed(2)} per hour, kept running all
                      day, every day. Each reply costs about{" "}
                      {view.costPer1000 < 0.01 ? "less than a cent" : `$${(view.costPer1000 / 1000).toFixed(4)}`}
                      {" "}(around ${view.costPer1000.toFixed(2)} per 1,000 replies).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Why: checklist with bars */}
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Why it&apos;s a good fit</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  The black tick on each bar marks what your use case needs.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-sm">Smart enough for the job</p>
                    <span className="font-mono text-sm">
                      {Math.round(view.q)} / 100 <span className="text-zinc-400">(need {view.bar}+)</span>
                    </span>
                  </div>
                  <Bar value={view.q} max={100} marker={view.bar} ok={view.smartOk} />
                  <p className="text-xs text-zinc-500">
                    {view.smartOk
                      ? `Quality score from public tests, weighted for ${taskName}. Good for: ${getQualityBarDescription(view.bar).toLowerCase()}.`
                      : "Slightly under the quality we'd normally want for this task."}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-sm">Answers start quickly</p>
                    <span className="font-mono text-sm">
                      {fmtSeconds(shown.performance.ttftMs)}{" "}
                      <span className="text-zinc-400">(want under {fmtSeconds(debouncedConfig.targetTtftMs)})</span>
                    </span>
                  </div>
                  <Bar
                    value={view.ttftS}
                    max={Math.max(view.ttftS, view.targetTtftS) * 1.3}
                    marker={view.targetTtftS}
                    ok={view.speedOk}
                  />
                  <p className="text-xs text-zinc-500">
                    The wait before the first words appear. Shorter is better.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-sm">Writes faster than people read</p>
                    <span className="font-mono text-sm">
                      {view.wordsPerSec.toFixed(0)} words/sec{" "}
                      <span className="text-zinc-400">(want {view.targetWordsPerSec.toFixed(0)}+)</span>
                    </span>
                  </div>
                  <Bar
                    value={view.wordsPerSec}
                    max={Math.max(view.wordsPerSec, view.targetWordsPerSec) * 1.3}
                    marker={view.targetWordsPerSec}
                    ok={view.streamOk}
                  />
                  <p className="text-xs text-zinc-500">
                    A typical reply of about {view.replyWords} words is fully written in roughly{" "}
                    {view.replySeconds.toFixed(0)} seconds. Most people read about 4 words per second.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-sm">Enough power for your crowd</p>
                    <span className="font-mono text-sm">
                      ~{view.users} people <span className="text-zinc-400">(you need {config.concurrency})</span>
                    </span>
                  </div>
                  <Bar
                    value={view.users}
                    max={Math.max(view.users, config.concurrency) * 1.2}
                    marker={config.concurrency}
                    ok={view.usersOk}
                  />
                  <p className="text-xs text-zinc-500">
                    How many people can chat at the same time while keeping the speed above.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-sm">Fits comfortably in memory</p>
                    <span className="font-mono text-sm">
                      {Math.round(view.memUsed)} of {Math.round(view.memTotal)} GB
                    </span>
                  </div>
                  <Bar value={view.memPct} max={100} marker={92} ok={view.memOk} />
                  <p className="text-xs text-zinc-500">
                    The AI and everyone&apos;s conversations must fit in the graphics card&apos;s memory.{" "}
                    {view.memOk ? "There's room to spare." : "It's a tight fit."}
                  </p>
                </div>
              </div>
            </div>

            {/* Compare options */}
            {options.length > 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Other options to consider</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Tap one to see its details above.
                  </p>
                </div>
                <div className="space-y-3">
                  {options.map((o) => {
                    const selected = shown.id === o.r.id;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setOverrideId(o.r.id === hero?.id ? null : o.r.id)}
                        aria-pressed={selected}
                        className={`w-full text-left p-4 rounded-xl border transition-colors ${
                          selected ? "border-blue-600 ring-1 ring-blue-600 bg-blue-50/40" : "border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            {o.label}
                          </span>
                          <span className="text-sm font-semibold">
                            {o.r.model.shortName}{" "}
                            <span className="font-normal text-zinc-500">
                              on {o.r.gpuCount}× {o.r.gpu.shortName}
                            </span>
                          </span>
                        </div>
                        <div className="grid grid-cols-[72px_1fr_92px] items-center gap-3 mt-3 text-xs">
                          <span className="text-zinc-500">Cost</span>
                          <Bar
                            value={o.r.economics.monthlyCostUsd}
                            max={maxOptionCost}
                            ok
                            accent={selected}
                          />
                          <span className="font-mono text-right">{fmtMoney(o.r.economics.monthlyCostUsd)}/mo</span>
                          <span className="text-zinc-500">Quality</span>
                          <Bar value={o.r.scores.useCaseQualityScore} max={100} ok accent={selected} />
                          <span className="font-mono text-right">{Math.round(o.r.scores.useCaseQualityScore)}/100</span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-3">{tradeoff(o.r)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleShare}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {copiedShare ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copiedShare ? "Link copied" : "Share this recommendation"}
              </button>
              <button
                type="button"
                onClick={handleCopyCli}
                className="px-4 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {copiedCli ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedCli ? "Copied" : "Copy setup command for my developer"}
              </button>
            </div>
          </section>
        )}

        {/* Helpful extras */}
        <section className="space-y-3 pt-8 border-t border-zinc-200 text-sm">
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center justify-between font-medium py-2">
              <span>What do these words mean?</span>
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="mt-2 space-y-3 text-zinc-600 leading-relaxed">
              <div>
                <dt className="font-medium text-zinc-900">Open-source model</dt>
                <dd>An AI (like the one behind ChatGPT) whose files are free to download, so you run it yourself instead of paying per message.</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">GPU / graphics card</dt>
                <dd>The chip that does the heavy lifting for AI. You can rent them by the hour from cloud companies.</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">Memory</dt>
                <dd>Bigger AIs and more simultaneous users need more memory on the graphics card, just like a laptop with too many tabs open.</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">Quality score</dt>
                <dd>Out of 100, based on public AI tests for the kind of work you picked. Higher means better answers.</dd>
              </div>
            </dl>
          </details>

          <details className="group">
            <summary className="cursor-pointer list-none flex items-center justify-between font-medium py-2">
              <span>How accurate is this?</span>
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-zinc-600 leading-relaxed">
              {shown?.confidenceLevel === "Measured Benchmark"
                ? "This setup is based on speeds published by people who ran this exact combination. "
                : "This setup is estimated from the graphics card's published specs, adjusted for real-world efficiency. "}
              Prices are typical hourly rental rates and change often. Treat the numbers as a
              solid starting point, then test with your own data before committing.
            </p>
          </details>
        </section>
      </main>

      <footer className="px-4 sm:px-6 py-8 border-t border-zinc-100">
        <p className="max-w-[720px] mx-auto text-xs text-zinc-400">
          InferenceAdvisor gives estimates for planning, not guarantees.
        </p>
      </footer>
    </div>
  );
}
