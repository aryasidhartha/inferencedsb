"use client";

import React, { useState, useMemo } from "react";
import { SimulationResult } from "@/lib/inference-engine";
import {
  TrendingUp,
  Zap,
  CheckCircle2,
  BarChart3,
  LayoutGrid,
} from "lucide-react";

interface ParetoChartProps {
  results: SimulationResult[];
  selectedId: string;
  onSelect: (result: SimulationResult) => void;
  targetTtftMs: number;
  targetTpotTokPerSec: number;
  minQualityBar: number;
}

type ChartMode =
  | "aa-quadrant-quality"
  | "aa-quadrant-speed"
  | "aa-bars"
  | "sla-latency";

export function ParetoChart({
  results,
  selectedId,
  onSelect,
  targetTtftMs,
  targetTpotTokPerSec,
  minQualityBar,
}: ParetoChartProps) {
  const [mode, setMode] = useState<ChartMode>("aa-quadrant-quality");
  const [onlySlaCompliant, setOnlySlaCompliant] = useState<boolean>(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = results.filter((r) =>
      onlySlaCompliant ? r.scores.meetsAllSlas : r.fitsInVram
    );
    return base.length > 0 ? base : results.filter((r) => r.fitsInVram);
  }, [results, onlySlaCompliant]);

  const width = 880;
  const height = 360;
  const padLeft = 66;
  const padRight = 36;
  const padTop = 28;
  const padBottom = 48;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const chartData = useMemo(() => {
    if (filtered.length === 0) {
      return {
        points: [],
        frontierPoints: [],
        xTicks: [0, 1],
        yTicks: [0, 1],
        midXSvg: padLeft + plotW / 2,
        midYSvg: padTop + plotH / 2,
        xLabel: "",
        yLabel: "",
        xFormat: (v: number) => `${v}`,
        yFormat: (v: number) => `${v}`,
        slaX: null as number | null,
        slaY: null as number | null,
        qTopLeft: "",
        qTopRight: "",
        qBottomLeft: "",
        qBottomRight: "",
      };
    }

    const getRawX = (r: SimulationResult) => {
      if (mode === "sla-latency") return r.performance.ttftMs;
      return r.economics.costPerMillionBlendedTokens;
    };

    const getRawY = (r: SimulationResult) => {
      if (mode === "aa-quadrant-quality") return r.scores.useCaseQualityScore;
      if (mode === "aa-quadrant-speed") return r.performance.totalOutputTokPerSec;
      return r.performance.tpotTokPerSec;
    };

    const xs = filtered.map(getRawX);
    const ys = filtered.map(getRawY);

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (mode === "sla-latency") {
      maxX = Math.max(maxX, targetTtftMs * 1.15);
      minY = Math.min(minY, targetTpotTokPerSec * 0.8);
    }

    const xSpan = Math.max(0.01, maxX - minX);
    const ySpan = Math.max(1, maxY - minY);

    minX = Math.max(0, minX - xSpan * 0.07);
    maxX = maxX + xSpan * 0.09;
    minY = Math.max(0, minY - ySpan * 0.09);
    maxY = maxY + ySpan * 0.11;

    const toSvgX = (val: number) =>
      padLeft + ((val - minX) / Math.max(0.0001, maxX - minX)) * plotW;
    const toSvgY = (val: number) =>
      padTop + plotH - ((val - minY) / Math.max(0.0001, maxY - minY)) * plotH;

    // Compute median X and Y for Artificial Analysis style 4-Quadrant split
    const sortedX = [...xs].sort((a, b) => a - b);
    const sortedY = [...ys].sort((a, b) => a - b);
    const medX = sortedX[Math.floor(sortedX.length / 2)] || (minX + maxX) / 2;
    const medY = sortedY[Math.floor(sortedY.length / 2)] || (minY + maxY) / 2;

    const midXSvg = Math.min(
      padLeft + plotW * 0.72,
      Math.max(padLeft + plotW * 0.28, toSvgX(medX))
    );
    const midYSvg = Math.min(
      padTop + plotH * 0.72,
      Math.max(padTop + plotH * 0.28, toSvgY(medY))
    );

    const points = filtered.map((r) => {
      const rx = getRawX(r);
      const ry = getRawY(r);
      const isPareto =
        mode === "aa-quadrant-speed"
          ? r.isParetoOptimalCostThroughput
          : r.isParetoOptimalCostQuality;

      return {
        result: r,
        rx,
        ry,
        cx: toSvgX(rx),
        cy: toSvgY(ry),
        isPareto,
        radius: r.id === selectedId ? 8 : isPareto ? 6.5 : 4.8,
      };
    });

    const frontierPoints =
      mode === "sla-latency"
        ? []
        : points.filter((p) => p.isPareto).sort((a, b) => a.rx - b.rx);

    const xTicks = Array.from(
      { length: 6 },
      (_, i) => minX + ((maxX - minX) * i) / 5
    );
    const yTicks = Array.from(
      { length: 5 },
      (_, i) => minY + ((maxY - minY) * i) / 4
    );

    const xFormat = (v: number) => {
      if (mode === "sla-latency") return `${Math.round(v)}ms`;
      return v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(1)}`;
    };

    const yFormat = (v: number) => {
      if (mode === "aa-quadrant-quality") return `${v.toFixed(0)}`;
      return `${Math.round(v)}`;
    };

    const xLabel =
      mode === "sla-latency"
        ? "Time to First Token — TTFT (ms, Lower is Faster)"
        : "Blended Price per 1M Tokens ($ USD, 3:1 Input:Output — Lower is Cheaper)";

    const yLabel =
      mode === "aa-quadrant-quality"
        ? "Artificial Analysis Style Intelligence Index"
        : mode === "aa-quadrant-speed"
        ? "Cluster Output Speed (Tokens/sec)"
        : "Per-User Stream Speed (Tokens/sec)";

    const slaX =
      mode === "sla-latency" && targetTtftMs >= minX && targetTtftMs <= maxX
        ? toSvgX(targetTtftMs)
        : null;
    const slaY =
      mode === "sla-latency" &&
      targetTpotTokPerSec >= minY &&
      targetTpotTokPerSec <= maxY
        ? toSvgY(targetTpotTokPerSec)
        : null;

    const qTopLeft =
      mode === "sla-latency"
        ? "MOST ATTRACTIVE: Fast Stream & Low TTFT"
        : mode === "aa-quadrant-speed"
        ? "MOST ATTRACTIVE: High Throughput & Low Cost"
        : "MOST ATTRACTIVE: High Intelligence & Low Price";

    const qTopRight =
      mode === "sla-latency"
        ? "Fast Stream, Slower First Token"
        : "PREMIUM FRONTIER: High Intelligence, Higher Cost";

    const qBottomLeft =
      mode === "sla-latency"
        ? "Fast First Token, Slower Stream"
        : "BUDGET / LIGHTWEIGHT: Low Cost, Lower Intelligence";

    const qBottomRight =
      mode === "sla-latency"
        ? "OUTSIDE SLO: Slow TTFT & Slow Stream"
        : "SUB-OPTIMAL: Higher Cost & Lower Intelligence";

    return {
      points,
      frontierPoints,
      xTicks,
      yTicks,
      midXSvg,
      midYSvg,
      xLabel,
      yLabel,
      xFormat,
      yFormat,
      slaX,
      slaY,
      qTopLeft,
      qTopRight,
      qBottomLeft,
      qBottomRight,
    };
  }, [
    filtered,
    mode,
    selectedId,
    targetTtftMs,
    targetTpotTokPerSec,
    plotW,
    plotH,
  ]);

  const activeHoveredPoint = useMemo(() => {
    if (!hoveredId) return null;
    return chartData.points.find((p) => p.result.id === hoveredId) || null;
  }, [hoveredId, chartData.points]);

  const frontierPathD = useMemo(() => {
    if (chartData.frontierPoints.length < 2) return "";
    return chartData.frontierPoints
      .map(
        (p, idx) =>
          `${idx === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`
      )
      .join(" ");
  }, [chartData.frontierPoints]);

  // Top 8 unique models for Artificial Analysis 3-Column Bar Leaderboards
  const topBarItems = useMemo(() => {
    const seenModels = new Set<string>();
    const unique: SimulationResult[] = [];
    for (const r of filtered) {
      if (!seenModels.has(r.model.id)) {
        seenModels.add(r.model.id);
        unique.push(r);
      }
      if (unique.length >= 8) break;
    }
    return unique;
  }, [filtered]);

  return (
    <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Artificial Analysis Quadrant & Efficiency Leaderboards
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Top-left quadrant highlights configurations delivering the highest intelligence & speed at the lowest $/1M token price.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-900 px-2.5 py-1.5 rounded-md border border-zinc-800 cursor-pointer select-none hover:border-zinc-700 transition-colors">
            <input
              type="checkbox"
              checked={onlySlaCompliant}
              onChange={(e) => setOnlySlaCompliant(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0"
            />
            <span>Meets All SLOs Only</span>
          </label>

          <div className="inline-flex flex-wrap rounded-md bg-zinc-950 p-0.5 border border-zinc-800">
            <button
              onClick={() => setMode("aa-quadrant-quality")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "aa-quadrant-quality"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              Quality vs. Price
            </button>
            <button
              onClick={() => setMode("aa-bars")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "aa-bars"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-teal-400" />
              3-Pillar Bar Charts
            </button>
            <button
              onClick={() => setMode("aa-quadrant-speed")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "aa-quadrant-speed"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              Throughput vs. Price
            </button>
            <button
              onClick={() => setMode("sla-latency")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "sla-latency"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              TTFT vs. Stream Speed
            </button>
          </div>
        </div>
      </div>

      {/* MODE A: ARTIFICIAL ANALYSIS 3-PILLAR BAR LEADERBOARDS */}
      {mode === "aa-bars" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pillar 1: Quality Index */}
          <div className="bg-[#09090b] border border-zinc-800/90 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block">
                  Pillar 1 · Intelligence
                </span>
                <h3 className="text-xs font-bold text-zinc-100">
                  Use-Case Quality Score (0–100)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                Min Bar: {minQualityBar}
              </span>
            </div>
            <div className="space-y-2.5">
              {topBarItems
                .slice()
                .sort(
                  (a, b) =>
                    b.scores.useCaseQualityScore - a.scores.useCaseQualityScore
                )
                .map((r) => {
                  const pct = Math.min(100, r.scores.useCaseQualityScore);
                  const isSel = r.id === selectedId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className="cursor-pointer group"
                    >
                      <div className="flex justify-between text-[11px] mb-1">
                        <span
                          className={`truncate ${
                            isSel
                              ? "text-white font-semibold"
                              : "text-zinc-300 group-hover:text-white"
                          }`}
                        >
                          {r.model.shortName}{" "}
                          <span className="text-zinc-500 font-mono text-[10px]">
                            ({r.gpuCount}x {r.gpu.shortName})
                          </span>
                        </span>
                        <span className="font-mono font-semibold text-indigo-300">
                          {r.scores.useCaseQualityScore}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                        <div
                          className={`h-full rounded-full ${
                            isSel ? "bg-white" : "bg-indigo-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Pillar 2: Output Speed (Tokens/sec per User) */}
          <div className="bg-[#09090b] border border-zinc-800/90 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 block">
                  Pillar 2 · Speed
                </span>
                <h3 className="text-xs font-bold text-zinc-100">
                  Stream Speed (Tokens/s per User)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                SLO: {targetTpotTokPerSec}+ tok/s
              </span>
            </div>
            <div className="space-y-2.5">
              {topBarItems
                .slice()
                .sort(
                  (a, b) =>
                    b.performance.tpotTokPerSec - a.performance.tpotTokPerSec
                )
                .map((r) => {
                  const maxSpd = Math.max(
                    80,
                    ...topBarItems.map((i) => i.performance.tpotTokPerSec)
                  );
                  const pct = Math.min(
                    100,
                    (r.performance.tpotTokPerSec / maxSpd) * 100
                  );
                  const isSel = r.id === selectedId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className="cursor-pointer group"
                    >
                      <div className="flex justify-between text-[11px] mb-1">
                        <span
                          className={`truncate ${
                            isSel
                              ? "text-white font-semibold"
                              : "text-zinc-300 group-hover:text-white"
                          }`}
                        >
                          {r.model.shortName}{" "}
                          <span className="text-zinc-500 font-mono text-[10px]">
                            ({r.gpuCount}x {r.gpu.shortName})
                          </span>
                        </span>
                        <span className="font-mono font-semibold text-teal-300">
                          {r.performance.tpotTokPerSec} tok/s
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                        <div
                          className={`h-full rounded-full ${
                            isSel ? "bg-white" : "bg-teal-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Pillar 3: Blended Price ($/1M Tokens vs Commercial APIs) */}
          <div className="bg-[#09090b] border border-zinc-800/90 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                  Pillar 3 · Price (Lower is Better)
                </span>
                <h3 className="text-xs font-bold text-zinc-100">
                  Blended $ / 1M Tokens (3:1 In:Out)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-teal-400">
                vs. GPT-4o ($4.38)
              </span>
            </div>
            <div className="space-y-2.5">
              {topBarItems
                .slice()
                .sort(
                  (a, b) =>
                    a.economics.costPerMillionBlendedTokens -
                    b.economics.costPerMillionBlendedTokens
                )
                .slice(0, 6)
                .map((r) => {
                  const pct = Math.min(
                    100,
                    Math.max(
                      6,
                      (r.economics.costPerMillionBlendedTokens / 4.5) * 100
                    )
                  );
                  const isSel = r.id === selectedId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className="cursor-pointer group"
                    >
                      <div className="flex justify-between text-[11px] mb-1">
                        <span
                          className={`truncate ${
                            isSel
                              ? "text-white font-semibold"
                              : "text-zinc-300 group-hover:text-white"
                          }`}
                        >
                          {r.model.shortName}{" "}
                          <span className="text-zinc-500 font-mono text-[10px]">
                            ({r.gpuCount}x {r.gpu.shortName})
                          </span>
                        </span>
                        <span className="font-mono font-semibold text-teal-400">
                          ${r.economics.costPerMillionBlendedTokens.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                        <div
                          className={`h-full rounded-full ${
                            isSel ? "bg-white" : "bg-teal-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

              {/* Proprietary API Reference Bars */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1 text-zinc-400">
                    <span>GPT-4o API (Proprietary Ref)</span>
                    <span className="font-mono text-rose-400">$4.38 / 1M</span>
                  </div>
                  <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500/70 rounded-full"
                      style={{ width: "96%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-1">
            <div className="flex flex-wrap items-center gap-5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block ring-2 ring-indigo-500/25" />
                Pareto Frontier (Best Value)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                Meets All SLOs
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                Outside SLO / Quality Bar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-indigo-500 inline-block" />
                Active Selection
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 tabular-nums">
              {chartData.points.length} viable topologies evaluated
            </div>
          </div>

          {/* Interactive SVG Quadrant Plot Container */}
          <div className="relative w-full bg-[#09090b] border border-zinc-800/80 rounded-lg p-2 overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[350px] select-none overflow-visible"
            >
              {/* Artificial Analysis Top-Left "Most Attractive" Shaded Quadrant */}
              <rect
                x={padLeft}
                y={padTop}
                width={Math.max(0, chartData.midXSvg - padLeft)}
                height={Math.max(0, chartData.midYSvg - padTop)}
                fill="#14b8a6"
                fillOpacity={0.05}
              />

              {/* Quadrant Divider Lines */}
              <line
                x1={chartData.midXSvg}
                y1={padTop}
                x2={chartData.midXSvg}
                y2={padTop + plotH}
                stroke="#27272a"
                strokeDasharray="6 4"
                strokeWidth={1.2}
              />
              <line
                x1={padLeft}
                y1={chartData.midYSvg}
                x2={width - padRight}
                y2={chartData.midYSvg}
                stroke="#27272a"
                strokeDasharray="6 4"
                strokeWidth={1.2}
              />

              {/* 4 Quadrant Watermark Labels */}
              <text
                x={padLeft + 10}
                y={padTop + 16}
                fill="#2dd4bf"
                fillOpacity={0.75}
                fontSize={9.5}
                fontFamily="monospace"
                fontWeight={600}
              >
                {chartData.qTopLeft}
              </text>
              <text
                x={width - padRight - 10}
                y={padTop + 16}
                textAnchor="end"
                fill="#a1a1aa"
                fillOpacity={0.45}
                fontSize={9.5}
                fontFamily="monospace"
              >
                {chartData.qTopRight}
              </text>
              <text
                x={padLeft + 10}
                y={padTop + plotH - 8}
                fill="#a1a1aa"
                fillOpacity={0.45}
                fontSize={9.5}
                fontFamily="monospace"
              >
                {chartData.qBottomLeft}
              </text>
              <text
                x={width - padRight - 10}
                y={padTop + plotH - 8}
                textAnchor="end"
                fill="#f43f5e"
                fillOpacity={0.4}
                fontSize={9.5}
                fontFamily="monospace"
              >
                {chartData.qBottomRight}
              </text>

              {/* Horizontal Grid Lines & Y-Axis Ticks */}
              {chartData.yTicks.map((tick, idx) => {
                const y =
                  padTop +
                  plotH -
                  (idx / Math.max(1, chartData.yTicks.length - 1)) * plotH;
                return (
                  <g key={`y-${idx}`}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke="#18181b"
                      strokeDasharray="2 3"
                      strokeWidth={1}
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill="#71717a"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {chartData.yFormat(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Grid Lines & X-Axis Ticks */}
              {chartData.xTicks.map((tick, idx) => {
                const x =
                  padLeft +
                  (idx / Math.max(1, chartData.xTicks.length - 1)) * plotW;
                return (
                  <g key={`x-${idx}`}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + plotH}
                      stroke="#18181b"
                      strokeDasharray="2 3"
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={padTop + plotH + 18}
                      textAnchor="middle"
                      fill="#71717a"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {chartData.xFormat(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Axes Border Lines */}
              <line
                x1={padLeft}
                y1={padTop}
                x2={padLeft}
                y2={padTop + plotH}
                stroke="#3f3f46"
                strokeWidth={1}
              />
              <line
                x1={padLeft}
                y1={padTop + plotH}
                x2={width - padRight}
                y2={padTop + plotH}
                stroke="#3f3f46"
                strokeWidth={1}
              />

              {/* Axis Titles */}
              <text
                x={padLeft + plotW / 2}
                y={height - 6}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize={11}
              >
                {chartData.xLabel}
              </text>
              <text
                x={16}
                y={padTop + plotH / 2}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize={11}
                transform={`rotate(-90 16 ${padTop + plotH / 2})`}
              >
                {chartData.yLabel}
              </text>

              {/* SLA Reference Lines in Latency Mode */}
              {mode === "sla-latency" && chartData.slaX !== null && (
                <g>
                  <line
                    x1={chartData.slaX}
                    y1={padTop}
                    x2={chartData.slaX}
                    y2={padTop + plotH}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <text
                    x={chartData.slaX - 6}
                    y={padTop + 28}
                    textAnchor="end"
                    fill="#fb7185"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    Max TTFT ({targetTtftMs}ms)
                  </text>
                </g>
              )}

              {mode === "sla-latency" && chartData.slaY !== null && (
                <g>
                  <line
                    x1={padLeft}
                    y1={chartData.slaY}
                    x2={width - padRight}
                    y2={chartData.slaY}
                    stroke="#2dd4bf"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <text
                    x={width - padRight - 6}
                    y={chartData.slaY - 6}
                    textAnchor="end"
                    fill="#2dd4bf"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    Min Stream ({targetTpotTokPerSec} tok/s)
                  </text>
                </g>
              )}

              {/* Pareto Frontier Connecting Curve */}
              {frontierPathD && (
                <path
                  d={frontierPathD}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.8}
                />
              )}

              {/* Data Nodes */}
              {chartData.points.map((pt) => {
                const isSelected = pt.result.id === selectedId;
                const isHovered = pt.result.id === hoveredId;

                let fill = "#d97706";
                if (pt.result.scores.meetsAllSlas) {
                  fill = "#2dd4bf";
                }
                if (pt.isPareto) {
                  fill = "#6366f1";
                }
                if (isSelected) {
                  fill = "#ffffff";
                }

                return (
                  <g
                    key={pt.result.id}
                    className="cursor-pointer transition-transform"
                    onMouseEnter={() => setHoveredId(pt.result.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelect(pt.result)}
                  >
                    {(isSelected || isHovered || pt.isPareto) && (
                      <circle
                        cx={pt.cx}
                        cy={pt.cy}
                        r={pt.radius + 4}
                        fill="#6366f1"
                        opacity={isSelected ? 0.35 : 0.16}
                      />
                    )}
                    <circle
                      cx={pt.cx}
                      cy={pt.cy}
                      r={isHovered ? pt.radius + 1.5 : pt.radius}
                      fill={fill}
                      stroke={
                        isSelected
                          ? "#6366f1"
                          : pt.isPareto
                          ? "#c7d2fe"
                          : "#09090b"
                      }
                      strokeWidth={isSelected ? 2.5 : pt.isPareto ? 1.5 : 1}
                      opacity={isSelected || isHovered || pt.isPareto ? 1 : 0.8}
                    />

                    {(pt.isPareto || isSelected) && (
                      <text
                        x={pt.cx + 8}
                        y={pt.cy - 6}
                        fill={isSelected ? "#ffffff" : "#cbd5e1"}
                        fontSize={9.5}
                        fontWeight={isSelected ? 600 : 500}
                        className="pointer-events-none"
                      >
                        {pt.result.model.shortName} ({pt.result.gpuCount}x{" "}
                        {pt.result.gpu.shortName})
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Floating Tooltip on Hover */}
            {activeHoveredPoint && (
              <div className="absolute top-3 right-3 z-20 pointer-events-none bg-[#09090b]/95 border border-zinc-700/90 rounded-lg p-3.5 shadow-2xl text-xs w-68 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-zinc-100 truncate">
                    {activeHoveredPoint.result.model.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                    {activeHoveredPoint.result.futbin.ovr} OVR
                  </span>
                </div>
                <div className="text-indigo-400 font-medium mb-2">
                  {activeHoveredPoint.result.gpuCount}x{" "}
                  {activeHoveredPoint.result.gpu.name} ·{" "}
                  {activeHoveredPoint.result.quantization}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-zinc-300 border-t border-zinc-800 pt-2 tabular-nums">
                  <span className="text-zinc-400">Blended / 1M:</span>
                  <span className="font-mono font-semibold text-teal-400 text-right">
                    $
                    {activeHoveredPoint.result.economics.costPerMillionBlendedTokens.toFixed(
                      3
                    )}
                  </span>
                  <span className="text-zinc-400">Input / Output:</span>
                  <span className="font-mono text-right text-[11px]">
                    $
                    {activeHoveredPoint.result.economics.costPerMillionInputTokens.toFixed(
                      2
                    )}{" "}
                    / $
                    {activeHoveredPoint.result.economics.costPerMillionOutputTokens.toFixed(
                      2
                    )}
                  </span>
                  <span className="text-zinc-400">Quality Index:</span>
                  <span className="font-mono text-right text-zinc-100">
                    {activeHoveredPoint.result.scores.useCaseQualityScore}/100
                  </span>
                  <span className="text-zinc-400">Stream / TTFT:</span>
                  <span className="font-mono text-right">
                    {activeHoveredPoint.result.performance.tpotTokPerSec} tok/s ·{" "}
                    {activeHoveredPoint.result.performance.ttftMs}ms
                  </span>
                </div>
                {activeHoveredPoint.isPareto && (
                  <div className="mt-2 pt-1.5 border-t border-zinc-800 flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pareto Optimal Frontier Node
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
