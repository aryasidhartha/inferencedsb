"use client";

import React, { useState, useMemo } from "react";
import { SimulationResult } from "@/lib/inference-engine";
import { TrendingUp, Zap, CheckCircle2, BarChart3 } from "lucide-react";

interface ParetoChartProps {
  results: SimulationResult[];
  selectedId: string;
  onSelect: (result: SimulationResult) => void;
  targetTtftMs: number;
  targetTpotTokPerSec: number;
}

type ChartMode = "cost-quality" | "cost-throughput" | "sla-latency";

export function ParetoChart({
  results,
  selectedId,
  onSelect,
  targetTtftMs,
  targetTpotTokPerSec,
}: ParetoChartProps) {
  const [mode, setMode] = useState<ChartMode>("cost-quality");
  const [onlySlaCompliant, setOnlySlaCompliant] = useState<boolean>(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = results.filter((r) =>
      onlySlaCompliant ? r.scores.meetsAllSlas : r.fitsInVram
    );
    return base.length > 0 ? base : results.filter((r) => r.fitsInVram);
  }, [results, onlySlaCompliant]);

  // SVG coordinate system dimensions
  const width = 860;
  const height = 340;
  const padLeft = 64;
  const padRight = 34;
  const padTop = 26;
  const padBottom = 46;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const chartData = useMemo(() => {
    if (filtered.length === 0) {
      return {
        points: [],
        frontierPoints: [],
        xTicks: [0, 1],
        yTicks: [0, 1],
        xLabel: "",
        yLabel: "",
        xFormat: (v: number) => `${v}`,
        yFormat: (v: number) => `${v}`,
        slaX: null as number | null,
        slaY: null as number | null,
      };
    }

    const getRawX = (r: SimulationResult) => {
      if (mode === "sla-latency") return r.performance.ttftMs;
      return r.economics.costPerMillionOutputTokens;
    };

    const getRawY = (r: SimulationResult) => {
      if (mode === "cost-quality") return r.scores.useCaseQualityScore;
      if (mode === "cost-throughput") return r.performance.totalOutputTokPerSec;
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

    minX = Math.max(0, minX - xSpan * 0.06);
    maxX = maxX + xSpan * 0.08;
    minY = Math.max(0, minY - ySpan * 0.08);
    maxY = maxY + ySpan * 0.1;

    const toSvgX = (val: number) =>
      padLeft + ((val - minX) / Math.max(0.0001, maxX - minX)) * plotW;
    const toSvgY = (val: number) =>
      padTop + plotH - ((val - minY) / Math.max(0.0001, maxY - minY)) * plotH;

    const points = filtered.map((r) => {
      const rx = getRawX(r);
      const ry = getRawY(r);
      const isPareto =
        mode === "cost-throughput"
          ? r.isParetoOptimalCostThroughput
          : r.isParetoOptimalCostQuality;

      return {
        result: r,
        rx,
        ry,
        cx: toSvgX(rx),
        cy: toSvgY(ry),
        isPareto,
        radius:
          r.id === selectedId
            ? 8
            : isPareto
            ? 6.5
            : 4.8,
      };
    });

    // Sort Pareto frontier points left-to-right to draw the connecting frontier curve
    const frontierPoints =
      mode === "sla-latency"
        ? []
        : points
            .filter((p) => p.isPareto)
            .sort((a, b) => a.rx - b.rx);

    const xTicks = Array.from({ length: 6 }, (_, i) => minX + ((maxX - minX) * i) / 5);
    const yTicks = Array.from({ length: 5 }, (_, i) => minY + ((maxY - minY) * i) / 4);

    const xFormat = (v: number) => {
      if (mode === "sla-latency") return `${Math.round(v)}ms`;
      return v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(1)}`;
    };

    const yFormat = (v: number) => {
      if (mode === "cost-quality") return `${v.toFixed(0)}`;
      return `${Math.round(v)}`;
    };

    const xLabel =
      mode === "sla-latency"
        ? "Time to First Token — TTFT (ms, Lower is Faster)"
        : "Unit Cost per 1M Output Tokens ($ USD — Lower is Better)";

    const yLabel =
      mode === "cost-quality"
        ? "Benchmark Quality Index (0–100)"
        : mode === "cost-throughput"
        ? "Cluster Output Throughput (Tok/s)"
        : "Per-User Stream Speed (Tok/s)";

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

    return {
      points,
      frontierPoints,
      xTicks,
      yTicks,
      xLabel,
      yLabel,
      xFormat,
      yFormat,
      slaX,
      slaY,
    };
  }, [filtered, mode, selectedId, targetTtftMs, targetTpotTokPerSec, plotW, plotH]);

  const activeHoveredPoint = useMemo(() => {
    if (!hoveredId) return null;
    return chartData.points.find((p) => p.result.id === hoveredId) || null;
  }, [hoveredId, chartData.points]);

  const frontierPathD = useMemo(() => {
    if (chartData.frontierPoints.length < 2) return "";
    return chartData.frontierPoints
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
      .join(" ");
  }, [chartData.frontierPoints]);

  return (
    <div className="bg-[#121215] border border-zinc-800/90 rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Efficiency Frontier & Architectural Tradeoffs
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Select any deployment node to inspect hardware roofline utilization, memory footprint, and cloud unit economics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-900 px-2.5 py-1.5 rounded-md border border-zinc-800 cursor-pointer select-none hover:border-zinc-700 transition-colors">
            <input
              type="checkbox"
              checked={onlySlaCompliant}
              onChange={(e) => setOnlySlaCompliant(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-0"
            />
            <span>SLA Compliant Only</span>
          </label>

          <div className="inline-flex rounded-md bg-zinc-950 p-0.5 border border-zinc-800">
            <button
              onClick={() => setMode("cost-quality")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "cost-quality"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              Cost vs. Quality
            </button>
            <button
              onClick={() => setMode("cost-throughput")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === "cost-throughput"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              Cost vs. Throughput
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
              Latency SLA Envelope
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-1">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block ring-2 ring-indigo-500/25" />
            Pareto Frontier (Optimal Value)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
            Meets Latency SLAs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            Outside SLA Target
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

      {/* Interactive SVG Plot Container */}
      <div className="relative w-full bg-[#09090b] border border-zinc-800/80 rounded-lg p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[330px] select-none overflow-visible"
        >
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
                  stroke="#1f1f23"
                  strokeDasharray="3 3"
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
                  stroke="#1f1f23"
                  strokeDasharray="3 3"
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
                y={padTop + 14}
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
              opacity={0.75}
            />
          )}

          {/* Data Nodes */}
          {chartData.points.map((pt) => {
            const isSelected = pt.result.id === selectedId;
            const isHovered = pt.result.id === hoveredId;

            let fill = "#d97706"; // amber if outside SLA
            if (pt.result.scores.meetsAllSlas) {
              fill = "#2dd4bf"; // muted teal for SLA compliant
            }
            if (pt.isPareto) {
              fill = "#6366f1"; // indigo for Pareto optimal
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
                    fill={isSelected ? "#6366f1" : "#6366f1"}
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

                {/* Direct Labels on Pareto Frontier or Selected Node */}
                {(pt.isPareto || isSelected) && (
                  <text
                    x={pt.cx + 8}
                    y={pt.cy - 6}
                    fill={isSelected ? "#ffffff" : "#cbd5e1"}
                    fontSize={9.5}
                    fontWeight={isSelected ? 600 : 500}
                    className="pointer-events-none"
                  >
                    {pt.result.model.name.replace(" Instruct", "")} ({pt.result.gpuCount}x{" "}
                    {pt.result.gpu.name.replace("NVIDIA ", "").replace("AMD Instinct ", "")})
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip on Hover */}
        {activeHoveredPoint && (
          <div className="
            absolute top-3 right-3 z-20 pointer-events-none
            bg-[#09090b]/95 border border-zinc-700/90 rounded-lg p-3.5 shadow-2xl text-xs w-64 backdrop-blur-md
          ">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-zinc-100 truncate">
                {activeHoveredPoint.result.model.name}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-zinc-700">
                {activeHoveredPoint.result.quantization}
              </span>
            </div>
            <div className="text-indigo-400 font-medium mb-2">
              {activeHoveredPoint.result.gpuCount}x{" "}
              {activeHoveredPoint.result.gpu.name} (
              {activeHoveredPoint.result.vramBreakdown.totalAvailableGb}GB VRAM)
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-zinc-300 border-t border-zinc-800 pt-2 tabular-nums">
              <span className="text-zinc-400">Cost / 1M Tok:</span>
              <span className="font-mono font-semibold text-teal-400 text-right">
                ${activeHoveredPoint.result.economics.costPerMillionOutputTokens.toFixed(3)}
              </span>
              <span className="text-zinc-400">Hourly Rate:</span>
              <span className="font-mono text-right">
                ${activeHoveredPoint.result.economics.hourlyCostUsd.toFixed(2)}/hr
              </span>
              <span className="text-zinc-400">Quality Index:</span>
              <span className="font-mono text-right text-zinc-100">
                {activeHoveredPoint.result.scores.useCaseQualityScore}/100
              </span>
              <span className="text-zinc-400">Cluster Output:</span>
              <span className="font-mono text-right">
                {activeHoveredPoint.result.performance.totalOutputTokPerSec.toLocaleString()}{" "}
                tok/s
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
    </div>
  );
}
