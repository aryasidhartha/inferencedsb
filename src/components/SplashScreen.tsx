"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen loading animation: one cube (your app) fans out to three cubes
 * (GPUs). It is rendered on the server too, so it appears instantly while the
 * rest of the site is still loading, then fades away once the page is ready.
 *
 * To change how long it stays: edit SHOW_MS. To restyle: see ".splash-*" in globals.css.
 */
const SHOW_MS = 1700;
const FADE_MS = 650;

// Isometric cube centred on (cx, cy) with radius s.
function Cube({ cx, cy, s, cls, dot }: { cx: number; cy: number; s: number; cls: string; dot?: boolean }) {
  const w = s * 0.866;
  const h = s * 0.5;
  const top = `${cx},${cy - s}`;
  const ur = `${cx + w},${cy - h}`;
  const lr = `${cx + w},${cy + h}`;
  const bot = `${cx},${cy + s}`;
  const ll = `${cx - w},${cy + h}`;
  const ul = `${cx - w},${cy - h}`;
  return (
    <g className={`splash-cube ${cls}`}>
      <polygon className="splash-stroke" points={`${top} ${ur} ${lr} ${bot} ${ll} ${ul}`} />
      <polyline className="splash-stroke" points={`${ul} ${cx},${cy} ${ur}`} />
      <line className="splash-stroke" x1={cx} y1={cy} x2={cx} y2={cy + s} />
      {dot && <ellipse className="splash-stroke" cx={cx} cy={cy - h} rx={s * 0.22} ry={s * 0.12} />}
    </g>
  );
}

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

  const paths = [
    "M 62 70 L 112 30",
    "M 62 70 L 128 70",
    "M 62 70 L 112 110",
  ];

  return (
    <div className="splash-root" data-phase={phase} role="status" aria-label="Loading InferenceAdvisor">
      <div className="splash-inner">
        <svg className="splash-logo" viewBox="0 0 170 140" aria-hidden="true">
          {paths.map((d, i) => (
            <path key={d} className="splash-line" d={d} style={{ animationDelay: `${0.3 + i * 0.12}s` }} />
          ))}
          {paths.map((d, i) => (
            <circle key={`dot-${d}`} className="splash-dot" r="2.4">
              <animateMotion dur="1.4s" begin={`${0.9 + i * 0.25}s`} repeatCount="indefinite" path={d} />
            </circle>
          ))}
          <Cube cx={40} cy={70} s={22} cls="c0" dot />
          <Cube cx={128} cy={30} s={16} cls="c1" />
          <Cube cx={146} cy={70} s={16} cls="c2" />
          <Cube cx={128} cy={110} s={16} cls="c3" />
        </svg>
        <div className="splash-word">
          <span>inferenceadvisor</span>
          <span className="splash-beta">BETA</span>
        </div>
      </div>
      <div className="splash-bar" aria-hidden="true" />
    </div>
  );
}
