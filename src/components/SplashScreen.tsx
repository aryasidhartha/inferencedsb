"use client";

import { useEffect, useState } from "react";

/**
 * Simple full-screen loading animation: a small GPU-chip mark whose four cores
 * light up one after another, next to the wordmark. Rendered on the server too,
 * so it shows instantly while the site loads, then fades out.
 *
 * Timing: edit SHOW_MS. Look and feel: see ".splash-*" in globals.css.
 */
const SHOW_MS = 1800;
const FADE_MS = 600;

export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), SHOW_MS);
    const t2 = setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  // 2x2 cores, lit clockwise: top-left, top-right, bottom-right, bottom-left.
  const cores = [
    { x: 20, y: 20 },
    { x: 38, y: 20 },
    { x: 38, y: 38 },
    { x: 20, y: 38 },
  ];
  const pins = [22, 36, 50];

  return (
    <div className="splash-root" data-phase={phase} role="status" aria-label="Loading InferenceAdvisor">
      <div className="splash-inner">
        <svg className="splash-mark" viewBox="0 0 72 72" aria-hidden="true">
          {pins.map((p) => (
            <g key={p}>
              <line className="splash-pin" x1={p} y1={6} x2={p} y2={14} />
              <line className="splash-pin" x1={p} y1={58} x2={p} y2={66} />
              <line className="splash-pin" x1={6} y1={p} x2={14} y2={p} />
              <line className="splash-pin" x1={58} y1={p} x2={66} y2={p} />
            </g>
          ))}
          <rect className="splash-body" x={14} y={14} width={44} height={44} rx={1} />
          {cores.map((c, i) => (
            <rect
              key={i}
              className="splash-core"
              x={c.x}
              y={c.y}
              width={14}
              height={14}
              rx={0}
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </svg>
        <span className="splash-word">inferenceadvisor</span>
      </div>
    </div>
  );
}
