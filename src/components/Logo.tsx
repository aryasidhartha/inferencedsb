/**
 * Simple InferenceAdvisor logo: a black GPU chip with four white cores.
 * Used in the page header. The browser-tab icon is src/app/icon.svg (same drawing).
 */
export function Logo({ size = 22 }: { size?: number }) {
  const cores = [
    { x: 20, y: 20 },
    { x: 38, y: 20 },
    { x: 38, y: 38 },
    { x: 20, y: 38 },
  ];
  const pins = [22, 36, 50];
  return (
    <svg width={size} height={size} viewBox="4 4 64 64" aria-hidden="true">
      {pins.map((p) => (
        <g key={p} stroke="#0a0a0a" strokeWidth={4} strokeLinecap="round">
          <line x1={p} y1={6} x2={p} y2={14} />
          <line x1={p} y1={58} x2={p} y2={66} />
          <line x1={6} y1={p} x2={14} y2={p} />
          <line x1={58} y1={p} x2={66} y2={p} />
        </g>
      ))}
      <rect x={14} y={14} width={44} height={44} rx={1} fill="#0a0a0a" />
      {cores.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={14} height={14} fill="#ffffff" />
      ))}
    </svg>
  );
}
