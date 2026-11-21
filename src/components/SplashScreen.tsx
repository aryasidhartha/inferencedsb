"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen loading animation: a GPU chip whose cores light up in a wave
 * (the AI "thinking") with a status line that types what we're working out.
 * It is rendered on the server too, so it shows instantly while the rest of
 * the site loads, then fades away once the page is ready.
 *
 * Timing: edit SHOW_MS. Look and feel: see ".splash-*" in globals.css.
 */
const SHOW_MS = 2200;
const FADE_MS = 650;

const MESSAGES = [
  "Checking GPU memory",
  "Estimating response speed",
  "Comparing prices",
  "Picking your best setup",
];

const GRID = 4; // 4x4 cores
const CORE = 11;
const GAP = 4;
const DIE = GRID * CORE + (GRID + 1) * GAP; // inner die size
const PAD = 22; // distance from chip edge to die
const SIZE = DIE + PAD * 2;
const PINS = 6;

export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [msg, setMsg] = useState(0);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), SHOW_MS);
    const t2 = setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Type the current message, then move on to the next one.
  useEffect(() => {
    const full = MESSAGES[msg].length;
    if (chars < full) {
      const t = setTimeout(() => setChars((c) => c + 1), 28);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setMsg((m) => (m + 1) % MESSAGES.length);
      setChars(0);
    }, 260);
    return () => clearTimeout(t);
  }, [msg, chars]);

  if (phase === "gone") return null;

  const cores: { x: number; y: number; delay: number }[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      cores.push({
        x: PAD + GAP + c * (CORE + GAP),
        y: PAD + GAP + r * (CORE + GAP),
        delay: (r + c) * 0.14,
      });
    }
  }

  const pinPositions = Array.from({ length: PINS }, (_, i) => PAD + ((i + 0.5) * DIE) / PINS);

  return (
    <div className="splash-root" data-phase={phase} role="status" aria-label="Loading InferenceAdvisor">
      <div className="splash-inner">
        <svg className="splash-chip" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {pinPositions.map((p) => (
            <g key={p}>
              <line className="splash-pin" x1={p} y1={0} x2={p} y2={PAD - 6} />
              <line className="splash-pin" x1={p} y1={SIZE} x2={p} y2={SIZE - PAD + 6} />
              <line className="splash-pin" x1={0} y1={p} x2={PAD - 6} y2={p} />
              <line className="splash-pin" x1={SIZE} y1={p} x2={SIZE - PAD + 6} y2={p} />
            </g>
          ))}
          <rect className="splash-chip-body" x={PAD - 6} y={PAD - 6} width={DIE + 12} height={DIE + 12} rx={8} />
          <rect className="splash-chip-die" x={PAD} y={PAD} width={DIE} height={DIE} rx={4} />
          {cores.map((c, i) => (
            <rect
              key={i}
              className="splash-core"
              x={c.x}
              y={c.y}
              width={CORE}
              height={CORE}
              rx={2}
              style={{ animationDelay: `${c.delay}s` }}
            />
          ))}
        </svg>

        <div className="splash-mem" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 7) * 0.11}s` }} />
          ))}
        </div>

        <div>
          <div className="splash-title">InferenceAdvisor</div>
          <div className="splash-status">
            {MESSAGES[msg].slice(0, chars)}
            <span className="splash-cursor" />
          </div>
        </div>
      </div>
    </div>
  );
}
