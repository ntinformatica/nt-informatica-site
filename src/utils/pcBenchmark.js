export function createBenchmarkGameId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function cleanUrl(value) {
  const trimmed = String(value || "").trim();
  return isValidHttpUrl(trimmed) ? trimmed : "";
}

export function normalizeFps(value) {
  if (value === "" || value === null || value === undefined) return "";
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : "";
}

export function formatFps(value) {
  const parsed = normalizeFps(value);
  if (parsed === "") return "FPS não informado";
  return `${Number.isInteger(parsed) ? parsed : parsed.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} FPS`;
}

export function classifyFps(value) {
  const fps = normalizeFps(value);
  if (fps === "") return "FPS não informado";
  if (fps >= 120) return "Competitivo";
  if (fps >= 60) return "Muito fluido";
  if (fps >= 45) return "Fluido";
  if (fps >= 30) return "Jogável";
  return "Desempenho limitado";
}

export function formatBenchmarkResolution(game = {}) {
  const resolution = String(game.resolution || "").trim();
  const detail = String(game.resolutionDetail || "").trim();
  if (resolution && detail && resolution !== detail) return `${resolution} — ${detail}`;
  return resolution || detail;
}

function parseLegacyRecommendedGame(text) {
  const source = String(text || "").trim();
  if (!source) return null;

  const parts = source.split(/\s+-\s+/).map((item) => item.trim()).filter(Boolean);
  const [namePart, ...details] = parts;
  if (!namePart) return null;

  const game = {
    id: createBenchmarkGameId(),
    externalGameId: "",
    name: namePart,
    coverUrl: "",
    graphicsPreset: "",
    resolution: "",
    resolutionDetail: "",
    averageFps: "",
    videoUrl: "",
  };

  details.forEach((detail) => {
    const normalized = detail.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (normalized.startsWith("grafico")) {
      game.graphicsPreset = detail.replace(/^gr[aá]fico\s*/i, "").trim();
      return;
    }
    if (normalized.startsWith("resolucao")) {
      game.resolution = detail.replace(/^resolu[cç][aã]o\s*/i, "").trim();
      return;
    }
    if (normalized.startsWith("fps")) {
      game.averageFps = normalizeFps(detail.replace(/^fps\s*/i, "").trim());
    }
  });

  return game;
}

export function normalizeBenchmarkGame(game = {}) {
  return {
    id: String(game.id || createBenchmarkGameId()),
    externalGameId: String(game.externalGameId || game.external_game_id || ""),
    name: String(game.name || "").trim(),
    coverUrl: cleanUrl(game.coverUrl || game.cover_url),
    graphicsPreset: String(game.graphicsPreset || game.graphics_preset || "").trim(),
    resolution: String(game.resolution || "").trim(),
    resolutionDetail: String(game.resolutionDetail || game.resolution_detail || "").trim(),
    averageFps: normalizeFps(game.averageFps ?? game.average_fps),
    videoUrl: cleanUrl(game.videoUrl || game.video_url),
  };
}

export function normalizeBenchmarkGames(value, legacyRecommendedGames = []) {
  const rawGames = Array.isArray(value) ? value : [];
  const normalized = rawGames.map(normalizeBenchmarkGame).filter((game) => game.name || game.coverUrl || game.videoUrl);

  if (normalized.length) return normalized;

  return (Array.isArray(legacyRecommendedGames) ? legacyRecommendedGames : [])
    .map(parseLegacyRecommendedGame)
    .filter(Boolean);
}

export function normalizeProductBenchmark(product = {}) {
  const recommendedGames = Array.isArray(product.recommendedGames)
    ? product.recommendedGames
    : String(product.recommendedGames || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  const benchmarkGames = normalizeBenchmarkGames(product.benchmarkGames, recommendedGames);
  const hasExplicitToggle = product.showBenchmarkSection !== undefined && product.showBenchmarkSection !== null;

  return {
    showBenchmarkSection: hasExplicitToggle ? Boolean(product.showBenchmarkSection) : benchmarkGames.length > 0,
    ntTestaEpisode: String(product.ntTestaEpisode || "").trim(),
    fullBenchmarkVideoUrl: cleanUrl(product.fullBenchmarkVideoUrl),
    benchmarkGames,
  };
}

export function duplicateBenchmarkGames(games = []) {
  return normalizeBenchmarkGames(games).map((game) => ({
    ...game,
    id: createBenchmarkGameId(),
  }));
}

export function benchmarkGameToSupabase(game = {}) {
  const normalized = normalizeBenchmarkGame(game);
  return {
    id: normalized.id,
    externalGameId: normalized.externalGameId,
    name: normalized.name,
    coverUrl: normalized.coverUrl,
    graphicsPreset: normalized.graphicsPreset,
    resolution: normalized.resolution,
    resolutionDetail: normalized.resolutionDetail,
    averageFps: normalized.averageFps === "" ? null : normalized.averageFps,
    videoUrl: normalized.videoUrl,
  };
}
