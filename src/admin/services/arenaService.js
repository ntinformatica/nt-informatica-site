import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { readJson, writeJson } from "./localStorageHelpers";

const localArenaKey = "nt-admin-arena-local-v1";

const emptyArenaData = {
  stations: [],
  reservations: [],
  packages: [
    { id: "local-package-60", name: "1 Hora", durationMinutes: 60, price: 20, active: true, sortOrder: 10 },
    { id: "local-package-120", name: "2 Horas", durationMinutes: 120, price: 40, active: true, sortOrder: 20 },
    { id: "local-package-180", name: "3 Horas", durationMinutes: 180, price: 50, active: true, sortOrder: 30 },
  ],
  settings: {
    id: "local-settings",
    pricePerHour: 20,
    openingTime: "09:00",
    closingTime: "22:00",
    slotMinutes: 30,
    activeDays: [1, 2, 3, 4, 5, 6],
    reservationNotice: "Sua solicitação foi enviada. A reserva será confirmada pela NT Informática.",
  },
  localMode: true,
};

function localData() {
  return {
    ...emptyArenaData,
    ...readJson(localArenaKey, emptyArenaData),
    localMode: true,
  };
}

function saveLocalData(data) {
  writeJson(localArenaKey, { ...data, localMode: true });
  return data;
}

function toTime(value) {
  return String(value || "").slice(0, 5);
}

function minutesFromTime(value) {
  const [hour, minute] = toTime(value).split(":").map(Number);
  return (hour * 60) + minute;
}

function timeFromMinutes(value) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function moneyNumber(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const normalized = String(value ?? "")
    .trim()
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fromStation(row = {}) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.type || "pc",
    description: row.description || "",
    active: row.active !== false,
    sortOrder: Number(row.sort_order || 0),
  };
}

function toStation(station = {}) {
  return {
    name: station.name || "",
    type: station.type || "pc",
    description: station.description || "",
    active: station.active !== false,
    sort_order: Number(station.sortOrder || 0),
  };
}

function fromSettings(row = {}) {
  return {
    id: row.id || "",
    pricePerHour: Number(row.price_per_hour ?? 20),
    openingTime: toTime(row.opening_time || "09:00"),
    closingTime: toTime(row.closing_time || "22:00"),
    slotMinutes: Number(row.slot_minutes || 30),
    activeDays: Array.isArray(row.active_days) ? row.active_days : [1, 2, 3, 4, 5, 6],
    reservationNotice: row.reservation_notice || "Sua solicitação foi enviada. A reserva será confirmada pela NT Informática.",
  };
}

function fromPackage(row = {}) {
  return {
    id: row.id,
    name: row.name || "",
    durationMinutes: Number(row.duration_minutes || 60),
    price: Number(row.price || 0),
    active: row.active !== false,
    sortOrder: Number(row.sort_order || 0),
  };
}

function toPackage(pack = {}) {
  return {
    name: pack.name || "",
    duration_minutes: Number(pack.durationMinutes || 60),
    price: moneyNumber(pack.price, 0),
    active: pack.active !== false,
    sort_order: Number(pack.sortOrder || 0),
  };
}

function toSettings(settings = {}) {
  return {
    price_per_hour: moneyNumber(settings.pricePerHour, 20),
    opening_time: settings.openingTime || "09:00",
    closing_time: settings.closingTime || "22:00",
    slot_minutes: Number(settings.slotMinutes || 30),
    active_days: Array.isArray(settings.activeDays) ? settings.activeDays.map(Number) : [1, 2, 3, 4, 5, 6],
    reservation_notice: settings.reservationNotice || "",
  };
}

function fromReservation(row = {}, stations = []) {
  const station = stations.find((item) => item.id === row.station_id);
  return {
    id: row.id,
    stationId: row.station_id,
    stationName: station?.name || row.station_name || "",
    stationType: station?.type || row.station_type || "",
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    reservationDate: row.reservation_date || "",
    startTime: toTime(row.start_time),
    endTime: toTime(row.end_time),
    durationMinutes: Number(row.duration_minutes || 0),
    totalPrice: Number(row.total_price || 0),
    status: row.status || "pendente",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

export async function listArenaData() {
  if (!isSupabaseConfigured) return localData();

  const [stationRows, settingsRows, packageRows] = await Promise.all([
    supabaseRequest("/arena_stations?select=*&order=sort_order.asc,name.asc"),
    supabaseRequest("/arena_settings?select=*&order=created_at.asc&limit=1"),
    supabaseRequest("/arena_packages?select=*&order=sort_order.asc,duration_minutes.asc"),
  ]);

  const stations = (stationRows || []).map(fromStation);
  const reservationRows = await supabaseRequest("/arena_reservations?select=*&order=reservation_date.desc,start_time.asc&limit=250");
  const settings = fromSettings(settingsRows?.[0]);

  return {
    stations,
    reservations: (reservationRows || []).map((row) => fromReservation(row, stations)),
    packages: (packageRows || []).map(fromPackage),
    settings,
    localMode: false,
  };
}

export async function saveArenaStation(station) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const saved = {
      id: station.id || `station-${Date.now()}`,
      ...station,
      sortOrder: Number(station.sortOrder || 0),
      active: station.active !== false,
    };
    data.stations = station.id
      ? data.stations.map((item) => (item.id === station.id ? saved : item))
      : [saved, ...data.stations];
    return saveLocalData(data);
  }

  if (station.id) {
    return supabaseRequest(`/arena_stations?id=eq.${encodeURIComponent(station.id)}`, {
      method: "PATCH",
      body: JSON.stringify(toStation(station)),
    });
  }

  return supabaseRequest("/arena_stations", {
    method: "POST",
    body: JSON.stringify(toStation(station)),
  });
}

export async function deleteArenaStation(id) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.stations = data.stations.filter((station) => station.id !== id);
    return saveLocalData(data);
  }

  return supabaseRequest(`/arena_stations?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateArenaSettings(settings) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.settings = { ...data.settings, ...settings };
    return saveLocalData(data);
  }

  if (settings.id) {
    return supabaseRequest(`/arena_settings?id=eq.${encodeURIComponent(settings.id)}`, {
      method: "PATCH",
      body: JSON.stringify(toSettings(settings)),
    });
  }

  return supabaseRequest("/arena_settings", {
    method: "POST",
    body: JSON.stringify(toSettings(settings)),
  });
}

export async function saveArenaPackage(pack) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const saved = {
      id: pack.id || `package-${Date.now()}`,
      ...pack,
      durationMinutes: Number(pack.durationMinutes || 60),
      price: moneyNumber(pack.price, 0),
      active: pack.active !== false,
      sortOrder: Number(pack.sortOrder || 0),
    };
    data.packages = pack.id
      ? data.packages.map((item) => (item.id === pack.id ? saved : item))
      : [...data.packages, saved];
    return saveLocalData(data);
  }

  if (pack.id) {
    return supabaseRequest(`/arena_packages?id=eq.${encodeURIComponent(pack.id)}`, {
      method: "PATCH",
      body: JSON.stringify(toPackage(pack)),
    });
  }

  return supabaseRequest("/arena_packages", {
    method: "POST",
    body: JSON.stringify(toPackage(pack)),
  });
}

export async function deleteArenaPackage(id) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.packages = data.packages.filter((pack) => pack.id !== id);
    return saveLocalData(data);
  }

  return supabaseRequest(`/arena_packages?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createArenaReservation(reservation) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const durationMinutes = Number(reservation.durationMinutes || 60);
    const arenaPackage = data.packages.find((pack) => pack.active !== false && Number(pack.durationMinutes) === durationMinutes);
    const endTime = timeFromMinutes(minutesFromTime(reservation.startTime) + durationMinutes);
    data.reservations = [
      {
        id: `reservation-${Date.now()}`,
        ...reservation,
        endTime,
        durationMinutes,
        totalPrice: arenaPackage ? Number(arenaPackage.price || 0) : (durationMinutes / 60) * Number(data.settings.pricePerHour || 20),
        status: "pendente",
      },
      ...data.reservations,
    ];
    return saveLocalData(data);
  }

  return supabaseRequest("/rpc/create_arena_reservation", {
    method: "POST",
    body: JSON.stringify({
      p_station_id: reservation.stationId,
      p_customer_name: reservation.customerName,
      p_customer_phone: reservation.customerPhone,
      p_reservation_date: reservation.reservationDate,
      p_start_time: reservation.startTime,
      p_duration_minutes: Number(reservation.durationMinutes || 60),
      p_notes: reservation.notes || null,
    }),
  });
}

export async function createArenaBlock(block) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const durationMinutes = Math.max(0, minutesFromTime(block.endTime) - minutesFromTime(block.startTime));
    data.reservations = [
      {
        id: `block-${Date.now()}`,
        stationId: block.stationId,
        customerName: "Bloqueio manual",
        customerPhone: "",
        reservationDate: block.reservationDate,
        startTime: block.startTime,
        endTime: block.endTime,
        durationMinutes,
        totalPrice: 0,
        status: "bloqueado",
        notes: block.reason || "",
      },
      ...data.reservations,
    ];
    return saveLocalData(data);
  }

  return supabaseRequest("/rpc/create_arena_block", {
    method: "POST",
    body: JSON.stringify({
      p_station_id: block.stationId,
      p_reservation_date: block.reservationDate,
      p_start_time: block.startTime,
      p_end_time: block.endTime,
      p_reason: block.reason || null,
    }),
  });
}

export async function updateArenaReservationStatus(id, status) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.reservations = data.reservations.map((reservation) => (
      reservation.id === id ? { ...reservation, status } : reservation
    ));
    return saveLocalData(data);
  }

  return supabaseRequest(`/arena_reservations?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteArenaReservation(id) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.reservations = data.reservations.filter((reservation) => reservation.id !== id);
    return saveLocalData(data);
  }

  return supabaseRequest(`/arena_reservations?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}
