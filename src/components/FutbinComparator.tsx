"use client";

import React, { useState, useMemo } from "react";
import { SimulationResult } from "@/lib/inference-engine";
import {
  Shield,
  Zap,
  Swords,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Award,
  TrendingDown,
  Brain,
} from "lucide-react";

interface FutbinComparatorProps {
  results: SimulationResult[];
  selectedId: string;
  onSelect: (result: SimulationResult) => void;
  recommendations: {
    bestOverall: SimulationResult;
    bestCostEfficiency: SimulationResult;
    bestQuality: SimulationResult;
  };
}

function getStatColorClass(val: number): string {
  if (val >= 90) return "text-teal-300 bg-teal-500/15 border-teal-500/40";
  if (val >= 80) return "text-indigo-300 bg-indigo-500/15 border-indigo-500/35";
  if (val >= 70) return "text-amber-300 bg-amber-500/15 border-amber-500/35";
  return "text-zinc-400 bg-zinc-800/80 border-zinc-700";
}

function getTierStyles(tier: SimulationResult["futbin"]["tier"]) {
  switch (tier) {
    case "TOTY Icon":
      return {
        cardBg:
          "bg-gradient-to-b from-indigo-950/80 via-[#121217] to-[#0c0c10] border-indigo-500/60",
        badge: "bg-indigo-500/20 text-indigo-200 border-indigo-400/50",
        ovrColor: "text-indigo-300",
        accentBar: "bg-indigo-500",
      };
    case "Meta Hero":
      return {
        cardBg:
          "bg-gradient-to-b from-violet-950/60 via-[#121217] to-[#0c0c10] border-violet-500/50",
        badge: "bg-violet-500/20 text-violet-200 border-violet-400/40",
        ovrColor: "text-violet-300",
        accentBar: "bg-violet-500",
      };
    case "Value IF":
      return {
        cardBg:
          "bg-gradient-to-b from-teal-950/65 via-[#121217] to-[#0c0c10] border-teal-500/55",
        badge: "bg-teal-500/20 text-teal-200 border-teal-400/45",
        ovrColor: "text-teal-300",
        accentBar: "bg-teal-400",
      };
    case "Gold Rare":
      return {
        cardBg:
          "bg-gradient-to-b from-amber-950/45 via-[#121217] to-[#0c0c10] border-amber-500/45",
        badge: "bg-amber-500/15 text-amber-200 border-amber-500/35",
        ovrColor: "text-amber-300",
        accentBar: "bg-amber-400",
      };
    default:
      return {
        cardBg: "bg-[#121215] border-zinc-800",
        badge: "bg-zinc-800 text-zinc-300 border-zinc-700",
        ovrColor: "text-zinc-200",
        accentBar: "bg-zinc-500",
      };
  }
}

export function FutbinComparator({
  results,
  selectedId,
  onSelect,
  recommendations,
}: FutbinComparatorProps) {
  const [showCompare1v1, setShowCompare1v1] = useState(false);
  const [compareRightId, setCompareRightId] = useState<string>(
    recommendations.bestCostEfficiency?.id !== recommendations.bestOverall?.id
      ? recommendations.bestCostEfficiency?.id
      : recommendations.bestQuality?.id || ""
  );

  const cardLeft = useMemo(
    () =>
      results.find((r) => r.id === selectedId) || recommendations.bestOverall,
    [results, selectedId, recommendations.bestOverall]
  );

  const cardRight = useMemo(() => {
    const found = results.find((r) => r.id === compareRightId);
    if (found && found.id !== cardLeft?.id) return found;
    return (
      results.find((r) => r.id !== cardLeft?.id) ||
      recommendations.bestCostEfficiency ||
      cardLeft
    );
  }, [results, compareRightId, cardLeft, recommendations.bestCostEfficiency]);

  const heroCards = [
    {
      roleLabel: "META PICK // BEST OVERALL",
      roleIcon: <Award className="w-3.5 h-3.5 text-indigo-400" />,
      item: recommendations.bestOverall,
    },
    {
      roleLabel: "SBC VALUE // LOWEST $/1M TOK",
      roleIcon: <TrendingDown className="w-3.5 h-3.5 text-teal-400" />,
      item: recommendations.bestCostEfficiency,
    },
    {
      roleLabel: "ICON TIER // MAX INTELLIGENCE",
      roleIcon: <Brain className="w-3.5 h-3.5 text-amber-400" />,
      item: recommendations.bestQuality,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/35 text-indigo-300 text-[11px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            FUTBIN Hardware × Model Cards
          </div>
          <span className="text-xs text-zinc-400">
            FIFA-style 99-point composite ratings across Intelligence, Speed, Reflex (TTFT), Throughput, Value & Memory
          </span>
        </div>

        <button
          onClick={() => setShowCompare1v1(!showCompare1v1)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
            showCompare1v1
              ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
              : "bg-[#121215] text-zinc-200 border-zinc-700 hover:border-indigo-500/60"
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>{showCompare1v1 ? "Hide 1v1 Card Arena" : "Compare Cards 1v1 (FUTBIN Versus)"}</span>
        </button>
      </div>

      {/* Top 3 FUTBIN Player Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {heroCards.map(({ roleLabel, roleIcon, item }, idx) => {
          if (!item) return null;
          const isSelected = item.id === selectedId;
          const styles = getTierStyles(item.futbin.tier);
          const f = item.futbin;

          return (
            <div
              key={`${roleLabel}-${item.id}-${idx}`}
              onClick={() => onSelect(item)}
              className={`relative cursor-pointer rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                styles.cardBg
              } ${
                isSelected
                  ? "ring-2 ring-indigo-400 shadow-xl shadow-indigo-950/40 scale-[1.01]"
                  : "hover:border-zinc-600"
              }`}
            >
              {/* Top Role Tag & Tier Pill */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                    {roleIcon}
                    {roleLabel}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}
                  >
                    {f.tier}
                  </span>
                </div>

                {/* FUT Card Crest: OVR + Position + Model & GPU Title */}
                <div className="flex items-start gap-3.5 pb-3 border-b border-zinc-800/80">
                  <div className="flex flex-col items-center justify-center bg-[#09090b]/90 border border-zinc-700/80 rounded-xl px-3 py-2 min-w-[66px] text-center shadow-inner">
                    <span
                      className={`text-2xl font-extrabold font-mono leading-none ${styles.ovrColor}`}
                    >
                      {f.ovr}
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 mt-1">
                      OVR
                    </span>
                    <div
                      className={`h-0.5 w-8 rounded-full mt-1 ${styles.accentBar}`}
                    />
                    <span className="text-[10px] font-mono font-semibold text-zinc-300 mt-1">
                      {item.quantization}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700">
                        {item.model.architecture} {item.model.totalParamsB}B
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 truncate">
                        {item.model.license}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white truncate mt-1">
                      {item.model.shortName}
                    </h3>

                    <div className="text-xs font-medium text-indigo-300 truncate mt-0.5">
                      {item.gpuCount}x {item.gpu.name} ({item.vramBreakdown.totalAvailableGb}GB)
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-400 font-mono">
                      <span>{item.servingEngine.toUpperCase()}</span>
                      <span>·</span>
                      <span
                        className={
                          item.confidenceLevel === "Measured Benchmark"
                            ? "text-teal-400"
                            : "text-zinc-400"
                        }
                      >
                        {item.confidenceLevel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6 Core FIFA Attributes Grid (2x3) */}
                <div className="grid grid-cols-3 gap-1.5 my-3">
                  {[
                    { code: "INT", val: f.int, desc: "Quality" },
                    { code: "SPD", val: f.spd, desc: `${item.performance.tpotTokPerSec} tok/s` },
                    { code: "RFL", val: f.rfl, desc: `${item.performance.ttftMs}ms TTFT` },
                    { code: "THR", val: f.thr, desc: `${item.performance.totalOutputTokPerSec} tok/s` },
                    { code: "VAL", val: f.val, desc: `$${item.economics.costPerMillionBlendedTokens}/1M` },
                    { code: "MEM", val: f.mem, desc: `${item.vramBreakdown.utilizationPct}% VRAM` },
                  ].map((stat) => (
                    <div
                      key={stat.code}
                      className={`rounded-lg px-2 py-1.5 border flex flex-col justify-between ${getStatColorClass(
                        stat.val
                      )}`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-mono font-bold tracking-wider opacity-85">
                          {stat.code}
                        </span>
                        <span className="text-sm font-extrabold font-mono tabular-nums">
                          {stat.val}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono opacity-75 truncate mt-0.5">
                        {stat.desc}
                      </span>
                    </div>
                  ))}
                </div>

                {/* PlayStyles+ Traits */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {f.playStylesPlus.map((ps) => (
                    <span
                      key={ps}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800 flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                      {ps}
                    </span>
                  ))}
                </div>
              </div>

              {/* FUTBIN Market Price Footer */}
              <div className="pt-2.5 border-t border-zinc-800/90 flex items-center justify-between text-xs tabular-nums">
                <div>
                  <span className="text-[10px] text-zinc-500 block">
                    Blended / Output Price
                  </span>
                  <span className="font-mono font-bold text-teal-400">
                    ${item.economics.costPerMillionBlendedTokens.toFixed(2)}
                  </span>
                  <span className="text-zinc-500 font-mono text-[11px]">
                    {" "}
                    / ${item.economics.costPerMillionOutputTokens.toFixed(2)} per 1M
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block">
                    Server Cost
                  </span>
                  <span className="font-mono font-semibold text-zinc-100">
                    ${item.economics.hourlyCostUsd.toFixed(2)}/hr
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1v1 FUTBIN Head-to-Head Card Comparison Arena */}
      {showCompare1v1 && cardLeft && cardRight && (
        <div className="bg-[#121215] border border-indigo-500/40 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  FUTBIN 1v1 Head-to-Head Card Comparator (In-Game Stats & Radar)
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Compare any two (Model + GPU) cards side-by-side to see exact latency, memory, and unit-cost deltas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                <span className="text-zinc-400">Card A (Selected):</span>
                <span className="font-semibold text-white">
                  {cardLeft.model.shortName} ({cardLeft.gpuCount}x {cardLeft.gpu.shortName})
                </span>
              </div>
              <span className="text-zinc-600 font-mono">VS</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                <select
                  value={cardRight.id}
                  onChange={(e) => setCompareRightId(e.target.value)}
                  className="bg-[#09090b] border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-teal-300 font-medium focus:outline-none focus:border-teal-400"
                >
                  {results.slice(0, 30).map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.futbin.ovr} OVR] {r.model.shortName} on {r.gpuCount}x{" "}
                      {r.gpu.shortName} (${r.economics.costPerMillionBlendedTokens}/1M)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: 6-Axis Hexagon Radar Chart */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center bg-[#09090b] border border-zinc-800/90 rounded-xl p-4">
              <HexagonRadarSVG left={cardLeft} right={cardRight} />
              <div className="flex items-center gap-6 mt-2 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
                  <span className="w-3 h-1.5 rounded bg-indigo-500 inline-block" />
                  {cardLeft.model.shortName} ({cardLeft.futbin.ovr} OVR)
                </span>
                <span className="flex items-center gap-1.5 text-teal-300 font-medium">
                  <span className="w-3 h-1.5 rounded bg-teal-400 inline-block" />
                  {cardRight.model.shortName} ({cardRight.futbin.ovr} OVR)
                </span>
              </div>
            </div>

            {/* Right: Side-by-Side In-Game Stats Comparison Table */}
            <div className="lg:col-span-7 space-y-2.5">
              {[
                {
                  label: "Overall FUTBIN Rating (OVR)",
                  leftVal: cardLeft.futbin.ovr,
                  rightVal: cardRight.futbin.ovr,
                  format: (v: number) => `${v} OVR`,
                  higherBetter: true,
                },
                {
                  label: "Intelligence / Benchmark Quality",
                  leftVal: cardLeft.scores.useCaseQualityScore,
                  rightVal: cardRight.scores.useCaseQualityScore,
                  format: (v: number) => `${v.toFixed(1)} / 100`,
                  higherBetter: true,
                },
                {
                  label: "Per-User Stream Speed (TPOT)",
                  leftVal: cardLeft.performance.tpotTokPerSec,
                  rightVal: cardRight.performance.tpotTokPerSec,
                  format: (v: number) => `${v.toFixed(1)} tok/s`,
                  higherBetter: true,
                },
                {
                  label: "First Token Latency (TTFT)",
                  leftVal: cardLeft.performance.ttftMs,
                  rightVal: cardRight.performance.ttftMs,
                  format: (v: number) => `${Math.round(v)} ms`,
                  higherBetter: false,
                },
                {
                  label: "Cluster Output Throughput",
                  leftVal: cardLeft.performance.totalOutputTokPerSec,
                  rightVal: cardRight.performance.totalOutputTokPerSec,
                  format: (v: number) => `${v.toLocaleString()} tok/s`,
                  higherBetter: true,
                },
                {
                  label: "Blended Cost per 1M Tokens (3:1)",
                  leftVal: cardLeft.economics.costPerMillionBlendedTokens,
                  rightVal: cardRight.economics.costPerMillionBlendedTokens,
                  format: (v: number) => `$${v.toFixed(3)}`,
                  higherBetter: false,
                },
                {
                  label: "Output Cost per 1M Tokens",
                  leftVal: cardLeft.economics.costPerMillionOutputTokens,
                  rightVal: cardRight.economics.costPerMillionOutputTokens,
                  format: (v: number) => `$${v.toFixed(3)}`,
                  higherBetter: false,
                },
                {
                  label: "Max Concurrent Streams (SLO Safe)",
                  leftVal: cardLeft.performance.maxConcurrentUsersWithinSlo,
                  rightVal: cardRight.performance.maxConcurrentUsersWithinSlo,
                  format: (v: number) => `${v} users`,
                  higherBetter: true,
                },
              ].map((row) => {
                const leftWins = row.higherBetter
                  ? row.leftVal > row.rightVal
                  : row.leftVal < row.rightVal;
                const rightWins = row.higherBetter
                  ? row.rightVal > row.leftVal
                  : row.rightVal < row.leftVal;
                const diff = row.leftVal - row.rightVal;
                const diffStr =
                  diff === 0
                    ? "TIE"
                    : `${diff > 0 ? "+" : ""}${
                        Math.abs(diff) < 10 ? diff.toFixed(2) : Math.round(diff)
                      }`;

                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-12 items-center bg-[#09090b] border border-zinc-800/80 rounded-lg px-3 py-2 text-xs tabular-nums"
                  >
                    <div
                      className={`col-span-3 font-mono font-semibold ${
                        leftWins ? "text-indigo-300" : "text-zinc-400"
                      }`}
                    >
                      {row.format(row.leftVal)}
                    </div>
                    <div className="col-span-6 text-center text-zinc-300 font-medium flex items-center justify-center gap-2">
                      <span>{row.label}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          leftWins
                            ? "bg-indigo-500/20 text-indigo-300"
                            : rightWins
                            ? "bg-teal-500/20 text-teal-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {diffStr}
                      </span>
                    </div>
                    <div
                      className={`col-span-3 text-right font-mono font-semibold ${
                        rightWins ? "text-teal-300" : "text-zinc-400"
                      }`}
                    >
                      {row.format(row.rightVal)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HexagonRadarSVG({
  left,
  right,
}: {
  left: SimulationResult;
  right: SimulationResult;
}) {
  const size = 240;
  const center = size / 2;
  const radius = 84;

  const axes: { key: keyof SimulationResult["futbin"]; label: string }[] = [
    { key: "int", label: "INT" },
    { key: "spd", label: "SPD" },
    { key: "rfl", label: "RFL" },
    { key: "thr", label: "THR" },
    { key: "val", label: "VAL" },
    { key: "mem", label: "MEM" },
  ];

  const getPoint = (idx: number, val99: number) => {
    const angle = (Math.PI * 2 * idx) / axes.length - Math.PI / 2;
    const r = (Math.max(20, val99) / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const leftPolygon = axes
    .map((a, idx) => {
      const pt = getPoint(idx, left.futbin[a.key] as number);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");

  const rightPolygon = axes
    .map((a, idx) => {
      const pt = getPoint(idx, right.futbin[a.key] as number);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Concentric Hexagon Rings */}
      {[0.35, 0.65, 1.0].map((scale) => {
        const ringPts = axes
          .map((_, idx) => {
            const pt = getPoint(idx, scale * 100);
            return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <polygon
            key={scale}
            points={ringPts}
            fill="none"
            stroke="#27272a"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis Spokes & Labels */}
      {axes.map((a, idx) => {
        const outer = getPoint(idx, 100);
        const labelPt = getPoint(idx, 122);
        return (
          <g key={a.key}>
            <line
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="#27272a"
              strokeWidth={1}
            />
            <text
              x={labelPt.x}
              y={labelPt.y + 4}
              textAnchor="middle"
              fill="#a1a1aa"
              fontSize={10}
              fontFamily="monospace"
              fontWeight={600}
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* Right Card Polygon (Teal) */}
      <polygon
        points={rightPolygon}
        fill="#2dd4bf"
        fillOpacity={0.22}
        stroke="#2dd4bf"
        strokeWidth={2}
      />

      {/* Left Card Polygon (Indigo) */}
      <polygon
        points={leftPolygon}
        fill="#6366f1"
        fillOpacity={0.28}
        stroke="#6366f1"
        strokeWidth={2}
      />
    </svg>
  );
}
