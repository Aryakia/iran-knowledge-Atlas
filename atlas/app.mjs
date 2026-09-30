import { chart, stockSeries } from "./charts.mjs";
import { geographicMap, enableMapPan } from "./maps.mjs";

const $ = (id) => document.getElementById(id);
const esc = (x) =>
  String(x)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const yearLabel = (y) => `${Math.abs(y)} ${y < 0 ? "BCE" : "CE"}`;

let atlas, scenarios, geo, state, mapControl;
const historyByYear = new Map();

function report(message, error = false) {
  $("status").textContent = message;
  $("status").className = error ? "load-status error" : "load-status";
}

function activeEra(year) {
  return atlas.eras.find((e) => year >= e.start && year < e.end) ?? atlas.eras.at(-1);
}

function historyAt(year) {
  return historyByYear.get(year) ?? historyByYear.get(year < 0 ? -1 : 1);
}

function selectYear(raw) {
  let year = Math.round(Number(raw));
  if (!Number.isFinite(year)) return;
  year = Math.max(-700, Math.min(2026, year));
  if (year === 0) year = 1;
  state.year = year;
  renderHistory();
  renderMap();
  renderDossier();
}

function renderHistory() {
  const e = activeEra(state.year);
  const s = historyAt(state.year);

  $("era-select").value = e.id;
  $("year-number").value = state.year;
  $("year-range").value = state.year;
  $("year-label").textContent = yearLabel(state.year);
  $("era-title").textContent = e.name;
  $("era-polities").textContent = `${e.polities} · ${e.center}`;
  $("period-dates").textContent =
    `${yearLabel(e.start)} – ${yearLabel(Math.min(2026, e.end - 1))}`;
  $("stock-k").textContent = s.knowledge.toFixed(1);
  $("stock-g").textContent = s.capability.toFixed(1);
  $("era-summary").textContent = e.summary;
  $("previous-era").disabled = atlas.eras.indexOf(e) === 0;
  $("next-era").disabled = e === atlas.eras.at(-1);

  const series = atlas.history.map((r) => ({
    t: r.year + 700,
    knowledge: r.knowledge,
    capability: r.capability,
  }));
  $("history-chart").innerHTML = chart(stockSeries(series), {
    maxX: 2726,
    marker: state.year + 700,
    formatX: (x) => yearLabel(Math.round(x - 700) || 1),
    label:
      "Published reconstructed knowledge and societal capability outputs, 700 BCE to 2026 CE",
  });
}

function renderMap() {
  const e = activeEra(state.year);
  document.querySelectorAll("[data-map]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.map === state.map)),
  );
  $("map-source").href =
    `https://www.openhistoricalmap.org/#map=${state.map === "world" ? 2 : 4}/32/53&date=${state.year}`;
  mapControl = null;

  if (state.map === "regional" || state.map === "world") {
    $("map-surface").innerHTML = geographicMap(geo, state.map);
    mapControl = enableMapPan($("geographic-map"), state.map);
    $("map-caption").textContent =
      "Modern geographic context from Natural Earth. These boundaries do not represent the selected historical period.";
  } else {
    $("map-surface").innerHTML =
      `<iframe title="OpenHistoricalMap in ${yearLabel(state.year)}" src="https://embed.openhistoricalmap.org/#map=3/32/53&date=${state.year}&layer=O" loading="lazy" referrerpolicy="no-referrer"></iframe><a class="map-fallback" href="https://www.openhistoricalmap.org/#map=3/32/53&date=${state.year}" target="_blank" rel="noopener noreferrer">External map · open separately ↗</a>`;
    $("map-caption").textContent =
      `Dated historical context for ${e.short} from OpenHistoricalMap. Community coverage varies by place and date.`;
  }

  for (const id of ["zoom-in", "zoom-out", "map-reset"])
    $(id).disabled = !mapControl;
}

function renderDossier() {
  const e = activeEra(state.year);
  const q = $("dossier-search").value.trim().toLocaleLowerCase();
  const matches = (x) => !q || JSON.stringify(x).toLocaleLowerCase().includes(q);
  const events = atlas.events.filter((x) => x.era === e.id && matches(x));
  const scholars = atlas.scholars.filter((x) => x.era === e.id && matches(x));

  $("dossier-title").textContent = e.name;
  $("event-count").textContent = `(${events.length})`;
  $("scholar-count").textContent = `(${scholars.length})`;

  $("event-list").innerHTML =
    events
      .map(
        (x) =>
          `<article class="event"><div><time>${yearLabel(x.year)}</time><button data-year="${x.year}">Select year</button></div><div><h4>${esc(x.title)}</h4><p>${esc(x.detail)}</p><a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(x.source)}</a><small>${x.citationStatus === "direct_url" ? "Record-level reference" : "Source family only · exact reference needed"}</small></div></article>`,
      )
      .join("") || '<p class="empty">No matching events in this period.</p>';

  $("scholar-list").innerHTML =
    scholars
      .map(
        (x) =>
          `<article class="scholar"><p class="field">${esc(x.field)} · ${esc(x.dates)}</p><h4>${esc(x.name)}</h4><p>${esc(x.bio)}</p><a href="${esc(x.source)}" target="_blank" rel="noopener noreferrer">Biographical source</a></article>`,
      )
      .join("") || '<p class="empty">No matching scholar profiles in this period.</p>';

  $("event-list")
    .querySelectorAll("[data-year]")
    .forEach((b) => {
      b.onclick = () => {
        selectYear(b.dataset.year);
        $("atlas").scrollIntoView({ behavior: "smooth" });
      };
    });
}

function renderScenario() {
  const scenario =
    scenarios.scenarios.find((x) => x.id === state.scenario) ??
    scenarios.scenarios[0];
  $("scenario-title").textContent = scenario.label;
  $("scenario-description").textContent = scenario.description;
  $("scenario-context").textContent =
    `Precomputed from a ${scenarios.year} starting point · ${scenarios.horizonYears}-year horizon · ${scenarios.sampling}`;

  $("scenario-chart").innerHTML = chart(stockSeries(scenario.trajectory), {
    maxX: scenarios.horizonYears,
    label: `${scenario.label}: published precomputed stock trajectories`,
  });

  const first = scenario.trajectory[0];
  const last = scenario.trajectory.at(-1);
  const deltaK = last.knowledge - first.knowledge;
  const deltaG = last.capability - first.capability;
  $("result-kpis").innerHTML =
    `<article><span>Knowledge at +${scenarios.horizonYears}</span><b class="knowledge">${last.knowledge.toFixed(1)}</b><small>${deltaK >= 0 ? "+" : ""}${deltaK.toFixed(1)} from start</small></article>` +
    `<article><span>Capability at +${scenarios.horizonYears}</span><b class="capability">${last.capability.toFixed(1)}</b><small>${deltaG >= 0 ? "+" : ""}${deltaG.toFixed(1)} from start</small></article>`;
}

async function start() {
  const [atlasResponse, scenarioResponse, geoResponse] = await Promise.all([
    fetch("./data/public-atlas.json"),
    fetch("./data/public-scenarios.json"),
    fetch("./data/maps/modern-context.geojson"),
  ]);
  if (!atlasResponse.ok || !scenarioResponse.ok || !geoResponse.ok)
    throw new Error("One or more public data assets could not be loaded");

  atlas = await atlasResponse.json();
  scenarios = await scenarioResponse.json();
  geo = await geoResponse.json();

  for (const row of atlas.history) historyByYear.set(row.year, row);

  state = { year: 2026, map: "regional", scenario: scenarios.scenarios[0].id };

  $("era-select").innerHTML = atlas.eras
    .map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`)
    .join("");
  $("scenario-select").innerHTML = scenarios.scenarios
    .map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`)
    .join("");

  $("source-list").innerHTML = atlas.sources
    .map(
      (s) =>
        `<article><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><p>${esc(s.use)}</p><small>${esc(s.status)}</small></article>`,
    )
    .join("");

  $("era-select").onchange = (ev) => {
    const e = atlas.eras.find((x) => x.id === ev.target.value);
    if (!e) return;
    selectYear(Math.round((e.start + Math.min(e.end - 1, 2026)) / 2));
  };

  const commitYear = () => {
    if ($("year-number").value !== "") selectYear($("year-number").value);
  };
  $("year-number").onchange = commitYear;
  $("year-number").onblur = commitYear;
  $("year-number").onkeydown = (ev) => {
    if (ev.key === "Enter") commitYear();
  };
  $("year-range").oninput = (ev) => selectYear(ev.target.value);

  for (const [id, direction] of [
    ["previous-era", -1],
    ["next-era", 1],
  ]) {
    $(id).onclick = () => {
      const e = activeEra(state.year);
      const next = atlas.eras[atlas.eras.indexOf(e) + direction];
      if (next)
        selectYear(Math.round((next.start + Math.min(next.end - 1, 2026)) / 2));
    };
  }

  document.querySelectorAll("[data-map]").forEach((b) => {
    b.onclick = () => {
      state.map = b.dataset.map;
      renderMap();
    };
  });
  $("zoom-in").onclick = () => mapControl?.zoom(0.8);
  $("zoom-out").onclick = () => mapControl?.zoom(1.25);
  $("map-reset").onclick = () => mapControl?.reset();

  $("scenario-select").onchange = (ev) => {
    state.scenario = ev.target.value;
    renderScenario();
  };
  $("dossier-search").oninput = renderDossier;

  renderHistory();
  renderMap();
  renderDossier();
  renderScenario();
  $("application").hidden = false;
  report("");
}

start().catch((error) =>
  report(
    `The public atlas could not load. ${error.message}. Reload the page to retry.`,
    true,
  ),
);
