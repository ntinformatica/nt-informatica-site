const RAWG_SEARCH_URL = "https://api.rawg.io/api/games";
const MAX_QUERY_LENGTH = 80;
const MAX_RESULTS = 8;
const UNAVAILABLE_MESSAGE = "A busca automática está indisponível no momento. Utilize a URL manual da capa.";

function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, max-age=300");
  response.end(JSON.stringify(payload));
}

function normalizeResult(item) {
  const platforms = Array.isArray(item.platforms)
    ? item.platforms.map((entry) => entry?.platform?.name).filter(Boolean)
    : [];

  return {
    externalId: String(item.id || ""),
    name: item.name || "",
    coverUrl: item.background_image || "",
    releaseYear: item.released ? Number(String(item.released).slice(0, 4)) || null : null,
    platforms,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    json(response, 405, { error: "Método não permitido." });
    return;
  }

  const query = String(request.query?.query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) {
    json(response, 400, { error: "Informe pelo menos 2 caracteres para buscar um jogo." });
    return;
  }

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    json(response, 200, { results: [], unavailable: true, message: UNAVAILABLE_MESSAGE });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const url = new URL(RAWG_SEARCH_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("search", query);
    url.searchParams.set("page_size", String(MAX_RESULTS));
    url.searchParams.set("search_precise", "false");

    const rawgResponse = await fetch(url, { signal: controller.signal });
    const payload = await rawgResponse.json().catch(() => ({}));

    if (!rawgResponse.ok) {
      console.warn("RAWG search unavailable:", payload?.detail || rawgResponse.status);
      json(response, 200, { results: [], unavailable: true, message: UNAVAILABLE_MESSAGE });
      return;
    }

    const results = Array.isArray(payload.results)
      ? payload.results.map(normalizeResult).filter((item) => item.externalId && item.name)
      : [];

    json(response, 200, { results });
  } catch (error) {
    console.warn("RAWG search failed:", error.message);
    json(response, 200, { results: [], unavailable: true, message: UNAVAILABLE_MESSAGE });
  } finally {
    clearTimeout(timeout);
  }
}
