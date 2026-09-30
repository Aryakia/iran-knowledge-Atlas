const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function chart(
  series,
  {
    maxX = 100,
    marker = null,
    formatX = (x) => `+${x}`,
    label = "Model stock trajectories",
  } = {},
) {
  const W = 860,
    H = 270,
    pad = { l: 42, r: 12, t: 16, b: 35 },
    x = (v) => pad.l + (v / maxX) * (W - pad.l - pad.r),
    y = (v) => H - pad.b - (v / 100) * (H - pad.t - pad.b);
  const grid = [0, 25, 50, 75, 100]
    .map(
      (v) =>
        `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`,
    )
    .join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (r) =>
        `<text x="${x(r * maxX)}" y="${H - 9}" text-anchor="${r === 0 ? "start" : r === 1 ? "end" : "middle"}">${escape(formatX(Math.round(r * maxX)))}</text>`,
    )
    .join("");
  const paths = series
    .map(
      (s) =>
        `<path class="${s.className}" d="${s.points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(2)},${y(p.y).toFixed(2)}`).join(" ")}"/>`,
    )
    .join("");
  return `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title>${grid}${ticks}${paths}${marker !== null ? `<line x1="${x(marker)}" x2="${x(marker)}" y1="${pad.t}" y2="${H - pad.b}" stroke="#ad8337" stroke-width="1.5"/>` : ""}</svg>`;
}
export const stockSeries = (rows, baseline = false) =>
  ["knowledge", "capability"].map((key, i) => ({
    className: `${i ? "g" : "k"} ${baseline ? "baseline" : ""}`,
    points: rows.map((p) => ({ x: p.t, y: p[key] })),
  }));
