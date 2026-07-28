import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { getGameImage, normalizeGameLibraryName } from "../../utils/pcBenchmark";
import { readJson, slugify, writeJson } from "./localStorageHelpers";

const gameLibraryStorageKey = "nt-admin-game-library-v1";

function readLocalGames() {
  return readJson(gameLibraryStorageKey, []).map(normalizeGame);
}

function writeLocalGames(games) {
  writeJson(gameLibraryStorageKey, games.map(normalizeGame).sort(sortByName));
}

function sortByName(first, second) {
  return first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
}

function uniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeGame(data = {}) {
  const name = String(data.name || "").trim();
  return {
    id: String(data.id || uniqueId()),
    name,
    slug: data.slug || slugify(name),
    coverUrl: getGameImage(data),
    createdAt: data.createdAt || data.created_at || "",
    updatedAt: data.updatedAt || data.updated_at || "",
  };
}

function toSupabase(game) {
  const normalized = normalizeGame(game);
  return {
    name: normalized.name,
    slug: normalized.slug || slugify(normalized.name),
    cover_url: normalized.coverUrl || "",
    updated_at: new Date().toISOString(),
  };
}

function fromSupabase(row) {
  return normalizeGame(row);
}

function findDuplicate(games, game, ignoredId = "") {
  const normalizedName = normalizeGameLibraryName(game.name);
  const slug = game.slug || slugify(game.name);
  return games.find((item) => (
    item.id !== ignoredId
    && (normalizeGameLibraryName(item.name) === normalizedName || item.slug === slug)
  ));
}

export async function listGames() {
  if (!isSupabaseConfigured) return readLocalGames().sort(sortByName);

  try {
    const rows = await supabaseRequest("/game_library?select=*&order=name.asc");
    return rows.map(fromSupabase).sort(sortByName);
  } catch (error) {
    console.warn("Nao foi possivel carregar biblioteca de jogos do Supabase:", error);
    return readLocalGames().sort(sortByName);
  }
}

export async function listPublicGames() {
  if (!isSupabaseConfigured) return [];

  const rows = await supabaseRequest("/game_library?select=*&order=name.asc", {
    forceAnon: true,
  });
  return rows.map(fromSupabase).sort(sortByName);
}

export async function createGame(data) {
  const game = normalizeGame({ ...data, slug: data.slug || slugify(data.name) });
  if (!game.name) throw new Error("Informe o nome do jogo.");

  const currentGames = await listGames();
  const duplicate = findDuplicate(currentGames, game);
  if (duplicate) throw new Error("Este jogo já existe na biblioteca.");

  if (isSupabaseConfigured) {
    const [row] = await supabaseRequest("/game_library", {
      method: "POST",
      body: JSON.stringify(toSupabase(game)),
    });
    return fromSupabase(row);
  }

  const item = normalizeGame({ ...game, id: game.id || uniqueId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  writeLocalGames([item, ...readLocalGames()]);
  return item;
}

export async function upsertGameByName(data) {
  const game = normalizeGame({ ...data, slug: data.slug || slugify(data.name) });
  const currentGames = await listGames();
  const duplicate = findDuplicate(currentGames, game);
  if (duplicate) {
    if (!duplicate.coverUrl && game.coverUrl) {
      return updateGame(duplicate.id, { ...duplicate, coverUrl: game.coverUrl });
    }
    return duplicate;
  }
  return createGame(game);
}

export async function updateGame(id, data) {
  const game = normalizeGame({ ...data, id, slug: data.slug || slugify(data.name) });
  if (!game.name) throw new Error("Informe o nome do jogo.");

  const currentGames = await listGames();
  const duplicate = findDuplicate(currentGames, game, id);
  if (duplicate) throw new Error("Já existe outro jogo com este nome.");

  if (isSupabaseConfigured) {
    const [row] = await supabaseRequest(`/game_library?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(toSupabase(game)),
    });
    return fromSupabase(row);
  }

  const nextGames = readLocalGames().map((item) => (
    item.id === id ? normalizeGame({ ...item, ...game, id, updatedAt: new Date().toISOString() }) : item
  ));
  writeLocalGames(nextGames);
  return nextGames.find((item) => item.id === id);
}

export async function deleteGame(id) {
  if (isSupabaseConfigured) {
    await supabaseRequest(`/game_library?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }

  writeLocalGames(readLocalGames().filter((item) => item.id !== id));
}

export function countGameUsage(gameId, pcs = []) {
  return (pcs || []).reduce((total, pc) => {
    const games = Array.isArray(pc.benchmarkGames) ? pc.benchmarkGames : [];
    return total + games.filter((game) => String(game.gameId || game.game_id || "") === String(gameId)).length;
  }, 0);
}

export function gameUsageDetails(gameId, pcs = []) {
  return (pcs || [])
    .map((pc) => ({
      pc,
      count: (Array.isArray(pc.benchmarkGames) ? pc.benchmarkGames : []).filter((game) => String(game.gameId || game.game_id || "") === String(gameId)).length,
    }))
    .filter((item) => item.count > 0);
}
