import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { readJson, writeJson } from "./localStorageHelpers";

const localArenaKey = "nt-admin-arena-local-v1";

const emptyArenaData = {
  stations: [],
  reservations: [],
  customers: [],
  monthlyPlans: [
    { id: "local-plan-player", name: "Plano Player", price: 150, includedMinutes: 600, validityDays: 30, description: "10 horas mensais para jogar na NT Arena Gamer, com validade de 30 dias.", active: true, sortOrder: 1 },
    { id: "local-plan-pro", name: "Plano Pro", price: 250, includedMinutes: 1200, validityDays: 30, description: "20 horas mensais para jogar na NT Arena Gamer, com validade de 30 dias.", active: true, sortOrder: 2 },
    { id: "local-plan-squad", name: "Plano Squad", price: 400, includedMinutes: 2400, validityDays: 30, description: "40 horas mensais para jogar na NT Arena Gamer, equivalente a R$ 10,00 por hora.", active: true, sortOrder: 3 },
  ],
  subscriptions: [],
  creditMovements: [],
  maintenance: [],
  notifications: [],
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

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
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
    processor: row.processor || "",
    graphicsCard: row.graphics_card || "",
    memory: row.memory || "",
    storage: row.storage || "",
    monitor: row.monitor || "",
    accessories: row.accessories || "",
    imageUrl: row.image_url || "",
    active: row.active !== false,
    availabilityStatus: row.availability_status || (row.active === false ? "inativo" : "disponivel"),
    sortOrder: Number(row.sort_order || 0),
    internalNotes: row.internal_notes || "",
  };
}

function toStation(station = {}) {
  return {
    name: station.name || "",
    type: station.type || "pc",
    description: station.description || "",
    processor: station.processor || "",
    graphics_card: station.graphicsCard || "",
    memory: station.memory || "",
    storage: station.storage || "",
    monitor: station.monitor || "",
    accessories: station.accessories || "",
    image_url: station.imageUrl || "",
    active: station.active !== false,
    availability_status: station.active === false ? "inativo" : (station.availabilityStatus || "disponivel"),
    sort_order: Number(station.sortOrder || 0),
    internal_notes: station.internalNotes || "",
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

function fromCustomer(row = {}) {
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    normalizedPhone: row.normalized_phone || normalizePhone(row.phone),
    email: row.email || "",
    notes: row.notes || "",
    active: row.active !== false,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function toCustomer(customer = {}) {
  return {
    name: customer.name || "",
    phone: customer.phone || "",
    normalized_phone: normalizePhone(customer.phone),
    email: customer.email || "",
    notes: customer.notes || "",
    active: customer.active !== false,
  };
}

function fromMonthlyPlan(row = {}) {
  return {
    id: row.id,
    name: row.name || "",
    price: Number(row.price || 0),
    includedMinutes: Number(row.included_minutes || 0),
    validityDays: Number(row.validity_days || 30),
    description: row.description || "",
    active: row.active !== false,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function toMonthlyPlan(plan = {}) {
  return {
    name: plan.name || "",
    price: moneyNumber(plan.price, 0),
    included_minutes: Number(plan.includedMinutes || 0),
    validity_days: Number(plan.validityDays || 30),
    description: plan.description || "",
    active: plan.active !== false,
    sort_order: Number(plan.sortOrder || 0),
  };
}

function fromSubscription(row = {}, customers = [], plans = []) {
  const customer = customers.find((item) => item.id === row.customer_id);
  const plan = plans.find((item) => item.id === row.plan_id);
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: customer?.name || row.customer_name || "",
    customerPhone: customer?.phone || row.customer_phone || "",
    planId: row.plan_id,
    planName: plan?.name || row.plan_name || "",
    startDate: row.start_date || "",
    expirationDate: row.expiration_date || "",
    totalMinutes: Number(row.total_minutes || 0),
    usedMinutes: Number(row.used_minutes || 0),
    remainingMinutes: Number(row.remaining_minutes || 0),
    status: row.status || "ativo",
    amountPaid: Number(row.amount_paid || 0),
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function fromCreditMovement(row = {}, customers = [], subscriptions = []) {
  const customer = customers.find((item) => item.id === row.customer_id);
  const subscription = subscriptions.find((item) => item.id === row.subscription_id);
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    customerId: row.customer_id,
    customerName: customer?.name || subscription?.customerName || "",
    reservationId: row.reservation_id || "",
    type: row.type || "ajuste",
    minutes: Number(row.minutes || 0),
    previousBalance: Number(row.previous_balance || 0),
    newBalance: Number(row.new_balance || 0),
    reason: row.reason || "",
    notes: row.notes || "",
    createdAt: row.created_at || "",
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
    customerId: row.customer_id || "",
    subscriptionId: row.subscription_id || "",
    paymentType: row.payment_type || "avulso",
    creditsConsumedMinutes: Number(row.credits_consumed_minutes || 0),
    creditsProcessed: row.credits_processed === true,
    sessionStartedAt: row.session_started_at || "",
    sessionPausedAt: row.session_paused_at || "",
    sessionResumedAt: row.session_resumed_at || "",
    sessionEndedAt: row.session_ended_at || "",
    sessionStatus: row.session_status || "nao_iniciada",
    pausedSeconds: Number(row.paused_seconds || 0),
    actualDurationMinutes: Number(row.actual_duration_minutes || 0),
    overtimeMinutes: Number(row.overtime_minutes || 0),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function fromMaintenance(row = {}, stations = []) {
  const station = stations.find((item) => item.id === row.station_id);
  return {
    id: row.id,
    stationId: row.station_id,
    stationName: station?.name || "",
    title: row.title || "",
    description: row.description || "",
    status: row.status || "agendada",
    startedAt: row.started_at || "",
    expectedEndAt: row.expected_end_at || "",
    endedAt: row.ended_at || "",
    internalNotes: row.internal_notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function fromNotification(row = {}) {
  return {
    id: row.id,
    type: row.type || "",
    title: row.title || "",
    message: row.message || "",
    priority: row.priority || "normal",
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    actionUrl: row.action_url || "",
    read: row.read === true,
    dismissed: row.dismissed === true,
    createdAt: row.created_at || "",
    readAt: row.read_at || "",
    dismissedAt: row.dismissed_at || "",
  };
}

export async function listArenaData() {
  if (!isSupabaseConfigured) return localData();

  const [stationRows, settingsRows, packageRows, customerRows, planRows] = await Promise.all([
    supabaseRequest("/arena_stations?select=*&order=sort_order.asc,name.asc"),
    supabaseRequest("/arena_settings?select=*&order=created_at.asc&limit=1"),
    supabaseRequest("/arena_packages?select=*&order=sort_order.asc,duration_minutes.asc"),
    supabaseRequest("/arena_customers?select=*&order=name.asc"),
    supabaseRequest("/arena_monthly_plans?select=*&order=sort_order.asc,name.asc"),
  ]);

  const stations = (stationRows || []).map(fromStation);
  const customers = (customerRows || []).map(fromCustomer);
  const monthlyPlans = (planRows || []).map(fromMonthlyPlan);
  const [subscriptionRows, movementRows, reservationRows, maintenanceRows, notificationRows] = await Promise.all([
    supabaseRequest("/arena_customer_subscriptions?select=*&order=created_at.desc&limit=500"),
    supabaseRequest("/arena_credit_movements?select=*&order=created_at.desc&limit=500"),
    supabaseRequest("/arena_reservations?select=*&order=reservation_date.desc,start_time.asc&limit=500"),
    supabaseRequest("/arena_station_maintenance?select=*&order=created_at.desc&limit=500").catch(() => []),
    supabaseRequest("/admin_notifications?select=*&dismissed=eq.false&order=created_at.desc&limit=100").catch(() => []),
  ]);
  const subscriptions = (subscriptionRows || []).map((row) => fromSubscription(row, customers, monthlyPlans));
  const settings = fromSettings(settingsRows?.[0]);

  return {
    stations,
    reservations: (reservationRows || []).map((row) => fromReservation(row, stations)),
    customers,
    monthlyPlans,
    subscriptions,
    creditMovements: (movementRows || []).map((row) => fromCreditMovement(row, customers, subscriptions)),
    maintenance: (maintenanceRows || []).map((row) => fromMaintenance(row, stations)),
    notifications: (notificationRows || []).map(fromNotification),
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

export async function saveArenaCustomer(customer) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const normalizedPhone = normalizePhone(customer.phone);
    const saved = {
      id: customer.id || `customer-${Date.now()}`,
      ...customer,
      normalizedPhone,
      active: customer.active !== false,
    };
    data.customers = customer.id
      ? data.customers.map((item) => (item.id === customer.id ? saved : item))
      : [saved, ...data.customers.filter((item) => item.normalizedPhone !== normalizedPhone)];
    return saveLocalData(data);
  }

  if (customer.id) {
    return supabaseRequest(`/arena_customers?id=eq.${encodeURIComponent(customer.id)}`, {
      method: "PATCH",
      body: JSON.stringify(toCustomer(customer)),
    });
  }

  return supabaseRequest("/rpc/create_or_find_arena_customer", {
    method: "POST",
    body: JSON.stringify({
      p_name: customer.name,
      p_phone: customer.phone,
      p_email: customer.email || "",
      p_notes: customer.notes || "",
    }),
  });
}

export async function saveArenaMonthlyPlan(plan) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const saved = {
      id: plan.id || `monthly-plan-${Date.now()}`,
      ...plan,
      price: moneyNumber(plan.price, 0),
      includedMinutes: Number(plan.includedMinutes || 0),
      validityDays: Number(plan.validityDays || 30),
      active: plan.active !== false,
      sortOrder: Number(plan.sortOrder || 0),
    };
    data.monthlyPlans = plan.id
      ? data.monthlyPlans.map((item) => (item.id === plan.id ? saved : item))
      : [...data.monthlyPlans, saved];
    return saveLocalData(data);
  }

  if (plan.id) {
    return supabaseRequest(`/arena_monthly_plans?id=eq.${encodeURIComponent(plan.id)}`, {
      method: "PATCH",
      body: JSON.stringify(toMonthlyPlan(plan)),
    });
  }

  return supabaseRequest("/arena_monthly_plans", {
    method: "POST",
    body: JSON.stringify(toMonthlyPlan(plan)),
  });
}

export async function deleteArenaMonthlyPlan(id) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.monthlyPlans = data.monthlyPlans.filter((plan) => plan.id !== id);
    return saveLocalData(data);
  }

  return supabaseRequest(`/arena_monthly_plans?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function activateArenaSubscription(payload) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const plan = data.monthlyPlans.find((item) => item.id === payload.planId);
    if (!plan) throw new Error("Plano mensal não encontrado.");
    const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
    const expiration = new Date(`${startDate}T00:00:00`);
    expiration.setDate(expiration.getDate() + Number(plan.validityDays || 30) - 1);
    const saved = {
      id: `subscription-${Date.now()}`,
      customerId: payload.customerId,
      planId: plan.id,
      planName: plan.name,
      startDate,
      expirationDate: expiration.toISOString().slice(0, 10),
      totalMinutes: Number(plan.includedMinutes || 0),
      usedMinutes: 0,
      remainingMinutes: Number(plan.includedMinutes || 0),
      status: "ativo",
      amountPaid: moneyNumber(payload.amountPaid, plan.price),
      notes: payload.notes || "",
    };
    data.subscriptions = [saved, ...data.subscriptions.map((item) => (
      item.customerId === payload.customerId && item.status === "ativo" ? { ...item, status: "encerrado" } : item
    ))];
    data.creditMovements = [{
      id: `movement-${Date.now()}`,
      subscriptionId: saved.id,
      customerId: payload.customerId,
      type: "credito",
      minutes: saved.totalMinutes,
      previousBalance: 0,
      newBalance: saved.totalMinutes,
      reason: "Ativação de plano mensal",
      notes: payload.notes || "",
      createdAt: new Date().toISOString(),
    }, ...data.creditMovements];
    return saveLocalData(data);
  }

  return supabaseRequest("/rpc/activate_arena_subscription", {
    method: "POST",
    body: JSON.stringify({
      p_customer_id: payload.customerId,
      p_plan_id: payload.planId,
      p_start_date: payload.startDate || null,
      p_amount_paid: moneyNumber(payload.amountPaid, null),
      p_notes: payload.notes || "",
      p_keep_previous_balance: payload.keepPreviousBalance === true,
    }),
  });
}

export async function updateArenaSubscriptionStatus(subscriptionId, status) {
  if (!isSupabaseConfigured) {
    const data = localData();
    data.subscriptions = data.subscriptions.map((item) => (item.id === subscriptionId ? { ...item, status } : item));
    return saveLocalData(data);
  }

  return supabaseRequest(`/arena_customer_subscriptions?id=eq.${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function adjustArenaCredits(payload) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const subscription = data.subscriptions.find((item) => item.id === payload.subscriptionId);
    if (!subscription) throw new Error("Assinatura não encontrada.");
    const previousBalance = Number(subscription.remainingMinutes || 0);
    const minutes = Number(payload.minutes || 0);
    let newBalance = minutes;
    if (payload.type === "credito" || payload.type === "estorno") newBalance = previousBalance + minutes;
    if (payload.type === "consumo") newBalance = previousBalance - minutes;
    if (newBalance < 0) throw new Error("Saldo de horas insuficiente para esta reserva.");
    data.subscriptions = data.subscriptions.map((item) => (
      item.id === subscription.id
        ? { ...item, remainingMinutes: newBalance, usedMinutes: Math.max(0, Number(item.totalMinutes || 0) - newBalance) }
        : item
    ));
    data.creditMovements = [{
      id: `movement-${Date.now()}`,
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      type: payload.type || "ajuste",
      minutes: Math.abs(newBalance - previousBalance),
      previousBalance,
      newBalance,
      reason: payload.reason || "Ajuste manual de saldo",
      notes: payload.notes || "",
      createdAt: new Date().toISOString(),
    }, ...data.creditMovements];
    return saveLocalData(data);
  }

  return supabaseRequest("/rpc/adjust_arena_credits", {
    method: "POST",
    body: JSON.stringify({
      p_subscription_id: payload.subscriptionId,
      p_type: payload.type || "ajuste",
      p_minutes: Number(payload.minutes || 0),
      p_reason: payload.reason || "",
      p_notes: payload.notes || "",
    }),
  });
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
        paymentType: reservation.paymentType || "avulso",
        subscriptionId: reservation.subscriptionId || "",
        creditsConsumedMinutes: 0,
        creditsProcessed: false,
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
      p_payment_type: reservation.paymentType || "avulso",
      p_subscription_id: reservation.subscriptionId || null,
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

  return supabaseRequest("/rpc/update_arena_reservation_status", {
    method: "POST",
    body: JSON.stringify({
      p_reservation_id: id,
      p_status: status,
    }),
  });
}

function updateLocalSession(id, updater) {
  const data = localData();
  const now = new Date().toISOString();
  data.reservations = data.reservations.map((reservation) => (
    reservation.id === id ? updater({ ...reservation }, now) : reservation
  ));
  return saveLocalData(data);
}

export async function startArenaSession(id) {
  if (!isSupabaseConfigured) {
    return updateLocalSession(id, (reservation, now) => ({
      ...reservation,
      status: "confirmado",
      sessionStartedAt: reservation.sessionStartedAt || now,
      sessionResumedAt: now,
      sessionPausedAt: "",
      sessionStatus: "em_andamento",
    }));
  }

  return supabaseRequest("/rpc/start_arena_session", {
    method: "POST",
    body: JSON.stringify({ p_reservation_id: id }),
  });
}

export async function pauseArenaSession(id) {
  if (!isSupabaseConfigured) {
    return updateLocalSession(id, (reservation, now) => ({
      ...reservation,
      sessionPausedAt: now,
      sessionStatus: "pausada",
    }));
  }

  return supabaseRequest("/rpc/pause_arena_session", {
    method: "POST",
    body: JSON.stringify({ p_reservation_id: id }),
  });
}

export async function resumeArenaSession(id) {
  if (!isSupabaseConfigured) {
    return updateLocalSession(id, (reservation, now) => {
      const pauseStarted = reservation.sessionPausedAt ? new Date(reservation.sessionPausedAt).getTime() : Date.now();
      const extraPaused = Math.max(0, Math.floor((Date.now() - pauseStarted) / 1000));
      return {
        ...reservation,
        pausedSeconds: Number(reservation.pausedSeconds || 0) + extraPaused,
        sessionPausedAt: "",
        sessionResumedAt: now,
        sessionStatus: "em_andamento",
      };
    });
  }

  return supabaseRequest("/rpc/resume_arena_session", {
    method: "POST",
    body: JSON.stringify({ p_reservation_id: id }),
  });
}

export async function endArenaSession(id) {
  if (!isSupabaseConfigured) {
    return updateLocalSession(id, (reservation, now) => ({
      ...reservation,
      status: "concluido",
      sessionEndedAt: now,
      sessionStatus: "encerrada",
    }));
  }

  return supabaseRequest("/rpc/end_arena_session", {
    method: "POST",
    body: JSON.stringify({ p_reservation_id: id }),
  });
}

export async function saveArenaMaintenance(maintenance) {
  if (!isSupabaseConfigured) {
    const data = localData();
    const saved = {
      id: maintenance.id || `maintenance-${Date.now()}`,
      ...maintenance,
      status: maintenance.status || "em_andamento",
      createdAt: maintenance.createdAt || new Date().toISOString(),
    };
    data.maintenance = maintenance.id
      ? data.maintenance.map((item) => (item.id === maintenance.id ? saved : item))
      : [saved, ...data.maintenance];
    data.stations = data.stations.map((station) => (
      station.id === saved.stationId ? { ...station, availabilityStatus: saved.status === "cancelada" || saved.status === "concluida" ? "disponivel" : "manutencao" } : station
    ));
    return saveLocalData(data);
  }

  if (maintenance.id) {
    return supabaseRequest(`/arena_station_maintenance?id=eq.${encodeURIComponent(maintenance.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: maintenance.title || "",
        description: maintenance.description || "",
        status: maintenance.status || "em_andamento",
        started_at: maintenance.startedAt || new Date().toISOString(),
        expected_end_at: maintenance.expectedEndAt || null,
        ended_at: maintenance.endedAt || null,
        internal_notes: maintenance.internalNotes || "",
      }),
    });
  }

  return supabaseRequest("/rpc/create_arena_station_maintenance", {
    method: "POST",
    body: JSON.stringify({
      p_station_id: maintenance.stationId,
      p_title: maintenance.title || "Manutencao",
      p_description: maintenance.description || "",
      p_status: maintenance.status || "em_andamento",
      p_started_at: maintenance.startedAt || null,
      p_expected_end_at: maintenance.expectedEndAt || null,
      p_internal_notes: maintenance.internalNotes || "",
    }),
  });
}

export async function finishArenaMaintenance(id) {
  if (!isSupabaseConfigured) {
    return saveArenaMaintenance({ id, status: "concluida", endedAt: new Date().toISOString() });
  }

  return supabaseRequest("/rpc/finish_arena_station_maintenance", {
    method: "POST",
    body: JSON.stringify({ p_maintenance_id: id }),
  });
}

export async function cancelArenaMaintenance(id) {
  if (!isSupabaseConfigured) {
    return saveArenaMaintenance({ id, status: "cancelada", endedAt: new Date().toISOString() });
  }

  return supabaseRequest("/rpc/cancel_arena_station_maintenance", {
    method: "POST",
    body: JSON.stringify({ p_maintenance_id: id }),
  });
}

export async function markAdminNotificationRead(id) {
  if (!isSupabaseConfigured) return localData();
  return supabaseRequest(`/admin_notifications?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ read: true, read_at: new Date().toISOString() }),
  });
}

export async function dismissAdminNotification(id) {
  if (!isSupabaseConfigured) return localData();
  return supabaseRequest(`/admin_notifications?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ dismissed: true, dismissed_at: new Date().toISOString() }),
  });
}

export async function markAllAdminNotificationsRead() {
  if (!isSupabaseConfigured) return localData();
  return supabaseRequest("/admin_notifications?read=eq.false&dismissed=eq.false", {
    method: "PATCH",
    body: JSON.stringify({ read: true, read_at: new Date().toISOString() }),
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
