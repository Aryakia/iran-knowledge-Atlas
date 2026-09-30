export function geographicMap(geo, mode) {
  const paths = geo.features
    .map((f) => {
      const polygons =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      const d = polygons
        .map((poly) =>
          poly
            .map(
              (ring) =>
                ring
                  .map(
                    ([lon, lat], i) =>
                      `${i ? "L" : "M"}${(lon + 180).toFixed(3)},${(90 - lat).toFixed(3)}`,
                  )
                  .join(" ") + "Z",
            )
            .join(" "),
        )
        .join(" ");
      return `<path class="country ${f.properties.code === "IRN" ? "iran" : ""}" d="${d}"><title>${f.properties.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</title></path>`;
    })
    .join("");
  return `<svg id="geographic-map" viewBox="${mode === "regional" ? "202 32 77 50" : "0 5 360 160"}" role="img" aria-label="Modern geographic context; no historical borders are implied" tabindex="0"><title>Modern geographic context, Natural Earth</title>${paths}</svg>`;
}
export function enableMapPan(svg, mode) {
  let view = mode === "regional" ? [202, 32, 77, 50] : [0, 5, 360, 160],
    start;
  const initial = [...view];
  const apply = () => svg.setAttribute("viewBox", view.join(" "));
  const zoom = (factor) => {
    const width = Math.max(4, Math.min(720, view[2] * factor)),
      ratio = width / view[2],
      height = view[3] * ratio;
    view = [
      view[0] + (view[2] - width) / 2,
      view[1] + (view[3] - height) / 2,
      width,
      height,
    ];
    apply();
  };
  svg.onpointerdown = (e) => {
    svg.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, view: [...view] };
  };
  svg.onpointermove = (e) => {
    if (!start) return;
    const rect = svg.getBoundingClientRect(),
      scale = Math.min(rect.width / start.view[2], rect.height / start.view[3]);
    view = [
      start.view[0] - (e.clientX - start.x) / scale,
      start.view[1] - (e.clientY - start.y) / scale,
      start.view[2],
      start.view[3],
    ];
    apply();
  };
  svg.onpointerup = svg.onpointercancel = () => {
    start = null;
  };
  svg.onkeydown = (e) => {
    const moves = {
      ArrowLeft: [-0.1, 0],
      ArrowRight: [0.1, 0],
      ArrowUp: [0, -0.1],
      ArrowDown: [0, 0.1],
    };
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoom(0.8);
    } else if (e.key === "-") {
      e.preventDefault();
      zoom(1.25);
    } else if (moves[e.key]) {
      e.preventDefault();
      view[0] += moves[e.key][0] * view[2];
      view[1] += moves[e.key][1] * view[3];
      apply();
    }
  };
  return {
    zoom,
    reset: () => {
      view = [...initial];
      apply();
    },
  };
}
