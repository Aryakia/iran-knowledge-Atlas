import { chart, stockSeries, stockEnvelopeBands } from "./charts.mjs";
import { geographicMap, enableMapPan } from "./maps.mjs";

const $ = (id) => document.getElementById(id);
const esc = (x) =>
  String(x ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const yearLabel = (y) => `${Math.abs(y)} ${y < 0 ? "BCE" : "CE"}`;
const allowedMaps = new Set(["historic", "regional", "world"]);

let atlas, scenarios, geo, state, mapControl;
const historyByYear = new Map();

function report(message, error = false) {
  $("status").textContent = message;
  $("status").className = error ? "load-status error" : "load-status";
}

function activeEra(year) {
  return atlas.eras.find((e) => year >= e.start && year < e.end) ?? atlas.eras.at(-1);
}

function eraMidpoint(era) {
  return Math.round((era.start + Math.min(era.end - 1, 2026)) / 2);
}

function historyAt(year) {
  const exact = historyByYear.get(year);
  if (exact) return exact;
  const supported = year === 0 ? 1 : Math.max(-700, Math.min(2026, Math.round(year)));
  return historyByYear.get(supported) ?? historyByYear.get(2026);
}

function coverageClass(label = "") {
  if (label.startsWith("limited")) return "coverage-limited";
  if (label.startsWith("moderate")) return "coverage-moderate";
  return "coverage-stronger";
}

function syncUrl() {
  const url = new URL(window.location.href);
  const e = activeEra(state.year);
  url.searchParams.set("era", e.id);
  url.searchParams.set("year", String(state.year));
  url.searchParams.set("map", state.map);
  url.searchParams.set("scenario", state.scenario);
  url.searchParams.set("compare", `${state.compareA},${state.compareB}`);
  if (state.story) url.searchParams.set("story", state.story);
  else url.searchParams.delete("story");
  history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

function selectYear(raw, { forceHistoric = false, scroll = false } = {}) {
  let year = Math.round(Number(raw));
  if (!Number.isFinite(year)) return;
  year = Math.max(-700, Math.min(2026, year));
  if (year === 0) year = 1;
  state.year = year;
  if (forceHistoric) state.map = "historic";
  renderHistory();
  renderMap();
  renderDossier();
  renderWhy();
  renderStoryPlayer();
  syncUrl();
  if (scroll) $("atlas").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderLayers() {
  const targets = { evidence: "dossier", reconstruction: "atlas", simulation: "scenarios" };
  $("layer-cards").innerHTML = atlas.researchLayers
    .map(
      (layer) =>
        `<article class="layer-card layer-${esc(layer.id)}"><small>${esc(layer.label)}</small><h3>${esc(layer.description.split(".")[0])}</h3><p>${esc(layer.description)}</p><button data-layer-target="${targets[layer.id]}">Explore ${esc(layer.label.toLowerCase())}</button></article>`,
    )
    .join("");
  $("layer-cards").querySelectorAll("[data-layer-target]").forEach((button) => {
    button.addEventListener("click", () =>
      document.getElementById(button.dataset.layerTarget)?.scrollIntoView({ behavior: "smooth" }),
    );
  });
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
  $("era-evidence-summary").innerHTML =
    `<strong>${esc(e.evidence.label)}</strong><span>${e.evidence.eventsWithRecordLevelLinks}/${e.evidence.events} event records with record-level links · ${e.evidence.scholarsWithResolvedLinks}/${e.evidence.scholars} scholar links resolved</span>`;

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
      "Reconstructed knowledge capital and realized knowledge capability outputs, 700 BCE to 2026 CE",
  });

  renderEvidenceRail();
}

function renderEvidenceRail() {
  const total = 2027 - -700;
  $("evidence-rail").innerHTML = atlas.eras
    .map((e) => {
      const width = ((Math.min(e.end, 2027) - e.start) / total) * 100;
      return `<button class="${coverageClass(e.evidence.label)}" style="width:${width.toFixed(3)}%" title="${esc(e.name)}: ${esc(e.evidence.label)}" data-evidence-era="${esc(e.id)}" aria-label="${esc(e.name)}, ${esc(e.evidence.label)}"></button>`;
    })
    .join("");
  $("evidence-rail").querySelectorAll("[data-evidence-era]").forEach((button) => {
    button.addEventListener("click", () => {
      const e = atlas.eras.find((x) => x.id === button.dataset.evidenceEra);
      if (e) selectYear(eraMidpoint(e), { forceHistoric: true });
    });
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

  if (state.map === "historic") {
    $("map-surface").innerHTML =
      `<iframe title="${esc(e.name)} historical map in ${yearLabel(state.year)}" src="https://embed.openhistoricalmap.org/#map=4/32/53&date=${state.year}&layer=O" loading="lazy" referrerpolicy="no-referrer"></iframe><a class="map-fallback" href="https://www.openhistoricalmap.org/#map=4/32/53&date=${state.year}" target="_blank" rel="noopener noreferrer">Open this dated map separately ↗</a>`;
    $("map-caption").textContent =
      `${e.name} · ${yearLabel(state.year)}. Interactive dated context from OpenHistoricalMap; coverage and boundary precision vary by period.`;
  } else {
    $("map-surface").innerHTML = geographicMap(geo, state.map);
    mapControl = enableMapPan($("geographic-map"), state.map);
    $("map-caption").textContent =
      state.map === "regional"
        ? "Modern regional context from Natural Earth. It is for geographic orientation only and does not represent the selected dynasty's historical borders."
        : "Modern world context from Natural Earth. It is for orientation only and does not represent the selected dynasty's historical borders.";
  }

  for (const id of ["zoom-in", "zoom-out", "map-reset"])
    $(id).disabled = !mapControl;
}

function renderWhy() {
  const e = activeEra(state.year);
  const strengths = e.mechanisms.strengths.map((x) => `<li>${esc(x)}</li>`).join("");
  const pressures = e.mechanisms.pressures.map((x) => `<li>${esc(x)}</li>`).join("");
  $("why-panel").innerHTML =
    `<div class="mechanism-columns"><div><small>Relatively supportive assumptions</small><ul>${strengths}</ul></div><div><small>Relatively important pressures</small><ul>${pressures}</ul></div></div><p class="caption">${esc(e.mechanisms.disclosure)}</p>`;
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
        (x, i) =>
          `<article class="event"><div><time>${yearLabel(x.year)}</time><button data-year="${x.year}">Select year</button></div><div><p class="evidence-badge">${esc(x.eventEvidenceClass ?? "historical record")}</p><h4>${esc(x.title)}</h4><p>${esc(x.detail)}</p><a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(x.source)}</a><small>${x.citationStatus === "direct_url" ? "Record-level reference" : "Source family only · exact reference still needed"}</small><button class="text-button" data-event-index="${i}">Inspect provenance</button></div></article>`,
      )
      .join("") || '<p class="empty">No matching events in this period.</p>';

  $("scholar-list").innerHTML =
    scholars
      .map(
        (x, i) =>
          `<article class="scholar"><p class="field">${esc(x.field)} · ${esc(x.dates)}</p><h4>${esc(x.name)}</h4><p>${esc(x.bio)}</p><a href="${esc(x.source)}" target="_blank" rel="noopener noreferrer">Biographical source</a><small>${esc(x.citationStatus ?? "source status not classified")}</small><button class="text-button" data-scholar-index="${i}">Inspect provenance</button></article>`,
      )
      .join("") || '<p class="empty">No matching scholar profiles in this period.</p>';

  $("event-list").querySelectorAll("[data-year]").forEach((b) => {
    b.addEventListener("click", () => selectYear(b.dataset.year, { scroll: true }));
  });
  $("event-list").querySelectorAll("[data-event-index]").forEach((b) => {
    b.addEventListener("click", () => showProvenance("event", events[Number(b.dataset.eventIndex)]));
  });
  $("scholar-list").querySelectorAll("[data-scholar-index]").forEach((b) => {
    b.addEventListener("click", () => showProvenance("scholar", scholars[Number(b.dataset.scholarIndex)]));
  });
}

function midpointSnapshot(era) {
  const year = eraMidpoint(era);
  return { year, ...historyAt(year) };
}

function comparisonCard(era, side) {
  const snapshot = midpointSnapshot(era);
  return `<article class="compare-card"><p class="eyebrow">Period ${side}</p><h3>${esc(era.name)}</h3><p>${yearLabel(era.start)} – ${yearLabel(Math.min(2026, era.end - 1))}</p><p>${esc(era.center)} · ${esc(era.polities)}</p><div class="compare-stocks"><span><b>${snapshot.knowledge.toFixed(1)}</b> Knowledge</span><span><b>${snapshot.capability.toFixed(1)}</b> Realized capability</span></div><dl><div><dt>Evidence coverage</dt><dd>${esc(era.evidence.label)}</dd></div><div><dt>Events</dt><dd>${era.evidence.events} (${era.evidence.eventsWithRecordLevelLinks} record-linked)</dd></div><div><dt>Scholars</dt><dd>${era.evidence.scholars} (${era.evidence.scholarsWithResolvedLinks} links resolved)</dd></div></dl><p class="caption">Reconstructed values are midpoint model outputs, not observations.</p><button data-jump-era="${esc(era.id)}">Open in atlas</button></article>`;
}

function renderComparison() {
  const a = atlas.eras.find((x) => x.id === state.compareA) ?? atlas.eras[1];
  const b = atlas.eras.find((x) => x.id === state.compareB) ?? atlas.eras.at(-3);
  state.compareA = a.id;
  state.compareB = b.id;
  $("compare-a").value = a.id;
  $("compare-b").value = b.id;
  $("compare-grid").innerHTML = comparisonCard(a, "A") + comparisonCard(b, "B");
  $("compare-grid").querySelectorAll("[data-jump-era]").forEach((button) => {
    button.addEventListener("click", () => {
      const e = atlas.eras.find((x) => x.id === button.dataset.jumpEra);
      if (e) selectYear(eraMidpoint(e), { forceHistoric: true, scroll: true });
    });
  });
  syncUrl();
}

function renderScenario() {
  const scenario =
    scenarios.scenarios.find((x) => x.id === state.scenario) ??
    scenarios.scenarios[0];
  state.scenario = scenario.id;
  $("scenario-select").value = scenario.id;
  $("scenario-title").textContent = scenario.label;
  $("scenario-category").textContent = scenario.category;
  $("scenario-description").textContent = scenario.description;
  $("scenario-context").textContent =
    `Precomputed from a ${scenarios.year} starting point · ${scenarios.horizonYears}-year horizon · ${scenarios.sampling}`;

  $("scenario-chart").innerHTML = chart(stockSeries(scenario.trajectory), {
    maxX: scenarios.horizonYears,
    bands: stockEnvelopeBands(scenario.envelope),
    label: `${scenario.label}: public trajectory with structural-sensitivity envelope`,
  });
  $("uncertainty-note").textContent = scenarios.uncertainty;

  const first = scenario.trajectory[0];
  const last = scenario.trajectory.at(-1);
  const deltaK = last.knowledge - first.knowledge;
  const deltaG = last.capability - first.capability;
  $("result-kpis").innerHTML =
    `<article><span>Knowledge at +${scenarios.horizonYears}</span><b class="knowledge">${last.knowledge.toFixed(1)}</b><small>${deltaK >= 0 ? "+" : ""}${deltaK.toFixed(1)} from start</small></article>` +
    `<article><span>Capability at +${scenarios.horizonYears}</span><b class="capability">${last.capability.toFixed(1)}</b><small>${deltaG >= 0 ? "+" : ""}${deltaG.toFixed(1)} from start</small></article>`;
  syncUrl();
}

function renderStories() {
  $("story-cards").innerHTML = atlas.stories
    .map(
      (story) =>
        `<article><small>Guided tour · ${story.steps.length} stops</small><h3>${esc(story.title)}</h3><p>${esc(story.summary)}</p><button data-story="${esc(story.id)}">Start tour</button></article>`,
    )
    .join("");
  $("story-cards").querySelectorAll("[data-story]").forEach((button) => {
    button.addEventListener("click", () => {
      state.story = button.dataset.story;
      renderStoryPlayer();
      const story = atlas.stories.find((x) => x.id === state.story);
      if (story?.steps[0]) selectYear(story.steps[0].year, { forceHistoric: true, scroll: true });
    });
  });
  renderStoryPlayer();
}

function renderStoryPlayer() {
  const story = atlas.stories.find((x) => x.id === state.story);
  const player = $("story-player");
  if (!story) {
    player.hidden = true;
    player.innerHTML = "";
    return;
  }
  player.hidden = false;
  player.innerHTML =
    `<div class="story-player-head"><div><p class="eyebrow">Active tour</p><h3>${esc(story.title)}</h3><p>${esc(story.summary)}</p></div><button id="close-story">Close tour</button></div><div class="story-steps">${story.steps
      .map(
        (step, i) =>
          `<button class="${activeEra(state.year).id === step.era ? "active" : ""}" data-story-step="${i}"><span>${i + 1}</span><strong>${esc(step.label)}</strong><small>${yearLabel(step.year)}</small></button>`,
      )
      .join("")}</div><p class="story-note">${esc(story.steps.find((s) => s.era === activeEra(state.year).id)?.note ?? story.steps[0].note)}</p>`;
  $("close-story").addEventListener("click", () => {
    state.story = null;
    renderStoryPlayer();
    syncUrl();
  });
  player.querySelectorAll("[data-story-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = story.steps[Number(button.dataset.storyStep)];
      selectYear(step.year, { forceHistoric: true, scroll: true });
    });
  });
  syncUrl();
}

function renderSearch() {
  const q = $("global-search").value.trim().toLocaleLowerCase();
  const box = $("global-results");
  if (q.length < 2) {
    box.innerHTML = "";
    return;
  }
  const results = [];
  for (const e of atlas.eras)
    if (JSON.stringify(e).toLocaleLowerCase().includes(q))
      results.push({ type: "Period", title: e.name, subtitle: e.center, year: eraMidpoint(e) });
  for (const e of atlas.events)
    if (JSON.stringify(e).toLocaleLowerCase().includes(q))
      results.push({ type: "Event", title: e.title, subtitle: yearLabel(e.year), year: e.year });
  for (const s of atlas.scholars)
    if (JSON.stringify(s).toLocaleLowerCase().includes(q)) {
      const era = atlas.eras.find((x) => x.id === s.era);
      results.push({ type: "Scholar", title: s.name, subtitle: `${s.field} · ${s.dates}`, year: era ? eraMidpoint(era) : 2026 });
    }
  for (const s of atlas.sources)
    if (JSON.stringify(s).toLocaleLowerCase().includes(q))
      results.push({ type: "Source", title: s.name, subtitle: s.use, url: s.url });

  const shown = results.slice(0, 12);
  box.innerHTML = shown.length
    ? shown
        .map((r, i) =>
          r.url
            ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><small>${r.type}</small><strong>${esc(r.title)}</strong><span>${esc(r.subtitle)}</span></a>`
            : `<button data-search-index="${i}"><small>${r.type}</small><strong>${esc(r.title)}</strong><span>${esc(r.subtitle)}</span></button>`,
        )
        .join("")
    : '<p class="empty">No matching public atlas records.</p>';
  box.querySelectorAll("[data-search-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const r = shown[Number(button.dataset.searchIndex)];
      if (r?.year) selectYear(r.year, { forceHistoric: true, scroll: true });
      box.innerHTML = "";
    });
  });
}

function showProvenance(type, item) {
  const dialog = $("provenance-dialog");
  let title = "Evidence details";
  let body = "";
  if (type === "era") {
    title = item.name;
    body = `<p><strong>Layer:</strong> historical periodization + reconstruction context</p><p><strong>Documentary coverage:</strong> ${esc(item.evidence.label)}</p><p><strong>Events:</strong> ${item.evidence.eventsWithRecordLevelLinks}/${item.evidence.events} have record-level links.</p><p><strong>Scholars:</strong> ${item.evidence.scholarsWithResolvedLinks}/${item.evidence.scholars} have resolved links.</p><p class="caption">${esc(item.evidence.annotationBasis)}</p>`;
  } else if (type === "event") {
    title = item.title;
    body = `<p><strong>Layer:</strong> historical evidence</p><p><strong>Date:</strong> ${yearLabel(item.year)}</p><p><strong>Evidence class:</strong> ${esc(item.eventEvidenceClass ?? "historical record")}</p><p><strong>Citation status:</strong> ${esc(item.citationStatus)}</p><p><strong>Source:</strong> <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.source)}</a></p><p class="caption">The public historical record is separate from any unpublished numerical event-effect assumption.</p>`;
  } else if (type === "scholar") {
    title = item.name;
    body = `<p><strong>Layer:</strong> historical evidence</p><p><strong>Field:</strong> ${esc(item.field)}</p><p><strong>Dates:</strong> ${esc(item.dates)}</p><p><strong>Evidence class:</strong> ${esc(item.evidenceClass ?? "biographical record")}</p><p><strong>Citation status:</strong> ${esc(item.citationStatus ?? "not classified")}</p><p><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Open biographical source ↗</a></p>`;
  } else if (type === "scenario") {
    title = item.label;
    body = `<p><strong>Layer:</strong> System Dynamics simulation</p><p><strong>Experiment class:</strong> ${esc(item.category)}</p><p>${esc(item.description)}</p><p><strong>Structural uncertainty:</strong> ${esc(scenarios.uncertainty)}</p><p class="caption">${esc(scenarios.implementationDisclosure)}</p>`;
  }
  $("provenance-title").textContent = title;
  $("provenance-body").innerHTML = body;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function initializeState() {
  const params = new URLSearchParams(window.location.search);
  const eraFromUrl = atlas.eras.find((x) => x.id === params.get("era"));
  const yearFromUrl = Number(params.get("year"));
  const year =
    Number.isInteger(yearFromUrl) && yearFromUrl !== 0 && yearFromUrl >= -700 && yearFromUrl <= 2026
      ? yearFromUrl
      : eraFromUrl
        ? eraMidpoint(eraFromUrl)
        : 2026;
  const map = allowedMaps.has(params.get("map")) ? params.get("map") : "historic";
  const scenario = scenarios.scenarios.some((x) => x.id === params.get("scenario"))
    ? params.get("scenario")
    : scenarios.scenarios[0].id;
  const [compareA, compareB] = (params.get("compare") ?? "achaemenid,pahlavi").split(",");
  const story = atlas.stories.some((x) => x.id === params.get("story")) ? params.get("story") : null;
  return {
    year,
    map,
    scenario,
    compareA: atlas.eras.some((x) => x.id === compareA) ? compareA : "achaemenid",
    compareB: atlas.eras.some((x) => x.id === compareB) ? compareB : "pahlavi",
    story,
  };
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
  state = initializeState();

  $("release-version").textContent = `v${atlas.projectVersion} · public research release`;
  $("release-footer").innerHTML =
    `Public distribution v${esc(atlas.projectVersion)}<br><small>Source revision ${esc(atlas.sourceRevision.slice(0, 7))}</small>`;

  $("era-select").innerHTML = atlas.eras
    .map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`)
    .join("");
  const eraOptions = $("era-select").innerHTML;
  $("compare-a").innerHTML = eraOptions;
  $("compare-b").innerHTML = eraOptions;

  $("scenario-select").innerHTML = scenarios.scenarios
    .map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`)
    .join("");

  $("source-list").innerHTML = atlas.sources
    .map(
      (s) =>
        `<article><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><p>${esc(s.use)}</p><small>${esc(s.status)}</small></article>`,
    )
    .join("");

  renderLayers();
  renderStories();

  $("era-select").addEventListener("change", (ev) => {
    const e = atlas.eras.find((x) => x.id === ev.target.value);
    if (e) selectYear(eraMidpoint(e), { forceHistoric: true });
  });

  const commitYear = () => {
    if ($("year-number").value !== "") selectYear($("year-number").value);
  };
  $("year-number").addEventListener("change", commitYear);
  $("year-number").addEventListener("blur", commitYear);
  $("year-number").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") commitYear();
  });
  $("year-range").addEventListener("input", (ev) => selectYear(ev.target.value));

  for (const [id, direction] of [
    ["previous-era", -1],
    ["next-era", 1],
  ]) {
    $(id).addEventListener("click", () => {
      const e = activeEra(state.year);
      const next = atlas.eras[atlas.eras.indexOf(e) + direction];
      if (next) selectYear(eraMidpoint(next), { forceHistoric: true });
    });
  }

  document.querySelectorAll("[data-map]").forEach((b) => {
    b.addEventListener("click", () => {
      state.map = b.dataset.map;
      renderMap();
      syncUrl();
    });
  });
  $("zoom-in").addEventListener("click", () => mapControl?.zoom(0.8));
  $("zoom-out").addEventListener("click", () => mapControl?.zoom(1.25));
  $("map-reset").addEventListener("click", () => mapControl?.reset());

  $("scenario-select").addEventListener("change", (ev) => {
    state.scenario = ev.target.value;
    renderScenario();
  });
  $("compare-a").addEventListener("change", (ev) => {
    state.compareA = ev.target.value;
    renderComparison();
  });
  $("compare-b").addEventListener("change", (ev) => {
    state.compareB = ev.target.value;
    renderComparison();
  });
  $("dossier-search").addEventListener("input", renderDossier);
  $("global-search").addEventListener("input", renderSearch);
  $("inspect-era").addEventListener("click", () => showProvenance("era", activeEra(state.year)));
  $("inspect-scenario").addEventListener("click", () => {
    const scenario = scenarios.scenarios.find((x) => x.id === state.scenario);
    if (scenario) showProvenance("scenario", scenario);
  });

  renderHistory();
  renderMap();
  renderDossier();
  renderWhy();
  renderComparison();
  renderScenario();
  renderStoryPlayer();
  syncUrl();

  $("application").hidden = false;
  report("");
}

start().catch((error) =>
  report(
    `The public atlas could not load. ${error.message}. Reload the page to retry.`,
    true,
  ),
);
