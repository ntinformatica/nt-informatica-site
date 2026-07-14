const storePhone = "5547999309344";
const blockingStatuses = ["pendente", "confirmado", "bloqueado"];

const supabaseConfig = window.NT_SUPABASE_CONFIG || {};
const supabaseUrl = String(supabaseConfig.url || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
const supabaseAnonKey = String(supabaseConfig.anonKey || "").trim();
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const fallbackSettings = {
  pricePerHour: 20,
  openingTime: "09:00",
  closingTime: "22:00",
  slotMinutes: 30,
  activeDays: [1, 2, 3, 4, 5, 6],
  reservationNotice: "Sua solicitação foi enviada. A reserva será confirmada pela NT Informática.",
};

const fallbackPackages = [
  { id: "local-package-60", name: "1 Hora", durationMinutes: 60, price: 20, active: true, sortOrder: 10 },
  { id: "local-package-120", name: "2 Horas", durationMinutes: 120, price: 40, active: true, sortOrder: 20 },
  { id: "local-package-180", name: "3 Horas", durationMinutes: 180, price: 50, active: true, sortOrder: 30 },
];

const fallbackStations = [
  { id: "local-pc", name: "PC Gamer", type: "pc", description: "Modo local de teste", active: true, sortOrder: 10 },
  { id: "local-ps5", name: "PlayStation 5", type: "ps5", description: "Modo local de teste", active: true, sortOrder: 20 },
];

const state = {
  selectedDay: 0,
  selectedDate: "",
  selectedStationId: "",
  selectedSlot: "",
  stations: [],
  reservations: [],
  packages: fallbackPackages,
  customerPlan: null,
  settings: fallbackSettings,
  localMode: !isSupabaseConfigured,
  loading: true,
};

const dayStrip = document.querySelector("#dayStrip");
const slotGrid = document.querySelector("#slotGrid");
const selectedSummary = document.querySelector("#selectedSummary");
const bookingForm = document.querySelector("#bookingForm");
const bookingList = document.querySelector("#bookingList");
const durationInput = document.querySelector("#duration");
const toast = document.querySelector("#toast");
const whatsappLink = document.querySelector("#whatsappLink");
const stationGrid = document.querySelector(".station-grid");
const noticeText = document.querySelector(".fine-print");
const customerNameInput = document.querySelector("#customerName");
const customerPhoneInput = document.querySelector("#customerPhone");
const planStatus = document.querySelector("#planStatus");
const planPaymentOption = document.querySelector("#planPaymentOption");
const paymentSummary = document.querySelector("#paymentSummary");
const paymentOptions = document.querySelector("#paymentOptions");

function cleanTime(value) {
  return String(value || "").slice(0, 5);
}

function minutesFromTime(value) {
  const [hour, minute] = cleanTime(value).split(":").map(Number);
  return (hour * 60) + minute;
}

function timeFromMinutes(value) {
  const normalized = Math.max(0, value);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function todayDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(offset = state.selectedDay) {
  return todayDate(offset).toISOString().slice(0, 10);
}

function dayLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
}

function dateLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function fullDateLabel(offset = state.selectedDay) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(todayDate(offset));
}

function selectedStation() {
  return state.stations.find((station) => station.id === state.selectedStationId) || state.stations[0];
}

function stationName(station = selectedStation()) {
  return station?.name || "Arena Gamer";
}

function stationType(station = selectedStation()) {
  return station?.type || "pc";
}

function priceForDuration(minutes) {
  const pack = state.packages.find((item) => item.active !== false && Number(item.durationMinutes) === Number(minutes));
  if (pack) return Number(pack.price || 0);
  const total = (Number(minutes || 0) / 60) * Number(state.settings.pricePerHour || 20);
  return Math.round(total * 100) / 100;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function formatMinutes(value) {
  const total = Math.max(0, Number(value || 0));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (total === 0) return "0h";
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${minutes}min`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra,
  };
}

async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Erro Supabase ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function fromStation(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description || "",
    active: row.active !== false,
    availabilityStatus: row.availability_status || "disponivel",
    sortOrder: Number(row.sort_order || 0),
  };
}

function fromSettings(row = {}) {
  return {
    pricePerHour: Number(row.price_per_hour ?? 20),
    openingTime: cleanTime(row.opening_time || "09:00"),
    closingTime: cleanTime(row.closing_time || "22:00"),
    slotMinutes: Number(row.slot_minutes || 30),
    activeDays: Array.isArray(row.active_days) ? row.active_days : [1, 2, 3, 4, 5, 6],
    reservationNotice: row.reservation_notice || fallbackSettings.reservationNotice,
  };
}

function fromPackage(row) {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: Number(row.duration_minutes || 60),
    price: Number(row.price || 0),
    active: row.active !== false,
    sortOrder: Number(row.sort_order || 0),
  };
}

function fromReservation(row) {
  return {
    id: row.id,
    stationId: row.station_id,
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    reservationDate: row.reservation_date,
    startTime: cleanTime(row.start_time),
    endTime: cleanTime(row.end_time),
    durationMinutes: Number(row.duration_minutes || 0),
    totalPrice: Number(row.total_price || 0),
    status: row.status || "pendente",
    notes: row.notes || "",
    paymentType: row.payment_type || "avulso",
    subscriptionId: row.subscription_id || "",
  };
}

function fromCustomerPlan(row = {}) {
  const plan = row.arena_monthly_plans || {};
  const customer = row.arena_customers || {};
  const today = new Date().toISOString().slice(0, 10);
  const remainingMinutes = Number(row.remaining_minutes || 0);
  const activeSubscription = row.status === "ativo";
  const activePlan = plan.active !== false;
  const activeCustomer = customer.active !== false;
  const expired = Boolean(row.expiration_date && row.expiration_date < today);
  const hasBalance = remainingMinutes > 0;

  return {
    subscriptionId: row.id || row.subscription_id || "",
    planName: plan.name || row.plan_name || "",
    remainingMinutes,
    expirationDate: row.expiration_date || "",
    activeSubscription,
    expired,
    hasBalance,
    hasActivePlan: activeCustomer && activePlan && activeSubscription && !expired && hasBalance,
    hasPlan: Boolean(row.id || row.subscription_id || row.has_active_plan),
  };
}

async function loadArenaData() {
  state.loading = true;
  try {
    if (!isSupabaseConfigured) {
      state.localMode = true;
      state.stations = fallbackStations;
      state.settings = fallbackSettings;
      state.packages = fallbackPackages;
      state.reservations = JSON.parse(localStorage.getItem("nt-arena-local-reservations") || "[]");
      return;
    }

    const [stations, settings, packages] = await Promise.all([
      supabaseRequest("/arena_stations?select=*&active=eq.true&order=sort_order.asc,name.asc"),
      supabaseRequest("/arena_settings?select=*&order=created_at.asc&limit=1"),
      supabaseRequest("/arena_packages?select=*&active=eq.true&order=sort_order.asc,duration_minutes.asc"),
    ]);

    state.localMode = false;
    state.stations = (stations || [])
      .map(fromStation)
      .filter((station) => !["manutencao", "inativo"].includes(station.availabilityStatus));
    state.settings = fromSettings(settings?.[0]);
    state.packages = (packages || []).map(fromPackage);
    if (!state.packages.length) state.packages = fallbackPackages;
    await loadReservationsForSelectedDate();
  } catch (error) {
    console.error(error);
    state.localMode = true;
    state.stations = fallbackStations;
    state.settings = fallbackSettings;
    state.packages = fallbackPackages;
    state.reservations = JSON.parse(localStorage.getItem("nt-arena-local-reservations") || "[]");
    showToast("Supabase indisponível. Modo local de teste ativo.");
  } finally {
    if (!state.selectedStationId) state.selectedStationId = state.stations[0]?.id || "";
    state.loading = false;
  }
}

async function loadReservationsForSelectedDate() {
  state.selectedDate = isoDate();
  if (!isSupabaseConfigured || state.localMode) return;
  const rows = await supabaseRequest(`/arena_reservations?select=*&reservation_date=eq.${state.selectedDate}`);
  state.reservations = (rows || []).map(fromReservation);
}

function buildSlots() {
  const start = minutesFromTime(state.settings.openingTime);
  const end = minutesFromTime(state.settings.closingTime);
  const step = Number(state.settings.slotMinutes || 30);
  const slots = [];
  for (let minute = start; minute < end; minute += step) {
    slots.push(timeFromMinutes(minute));
  }
  return slots;
}

function isActiveDay(offset) {
  const dow = todayDate(offset).getDay();
  return state.settings.activeDays.includes(dow);
}

function isPastSlot(slot) {
  if (state.selectedDay !== 0) return false;
  const [hour, minute] = slot.split(":").map(Number);
  const slotDate = new Date();
  slotDate.setHours(hour, minute, 0, 0);
  return slotDate <= new Date();
}

function isBlockingReservation(reservation) {
  return blockingStatuses.includes(reservation.status);
}

function overlaps(start, end, busyStart, busyEnd) {
  return start < busyEnd && end > busyStart;
}

function selectedRange() {
  if (!state.selectedSlot) return null;
  const start = minutesFromTime(state.selectedSlot);
  const duration = Number(durationInput.value || 60);
  return {
    start,
    end: start + duration,
    startTime: timeFromMinutes(start),
    endTime: timeFromMinutes(start + duration),
    duration,
  };
}

function rangeIsBusy(range) {
  if (!range) return false;
  return state.reservations.some((reservation) => (
    reservation.stationId === state.selectedStationId
    && reservation.reservationDate === state.selectedDate
    && isBlockingReservation(reservation)
    && overlaps(range.start, range.end, minutesFromTime(reservation.startTime), minutesFromTime(reservation.endTime))
  ));
}

function slotIsBusy(slot) {
  const start = minutesFromTime(slot);
  const end = start + Number(state.settings.slotMinutes || 30);
  return state.reservations.some((reservation) => (
    reservation.stationId === state.selectedStationId
    && reservation.reservationDate === state.selectedDate
    && isBlockingReservation(reservation)
    && overlaps(start, end, minutesFromTime(reservation.startTime), minutesFromTime(reservation.endTime))
  ));
}

function reservationForSlot(slot) {
  const start = minutesFromTime(slot);
  const end = start + Number(state.settings.slotMinutes || 30);
  return state.reservations.find((reservation) => (
    reservation.stationId === state.selectedStationId
    && reservation.reservationDate === state.selectedDate
    && isBlockingReservation(reservation)
    && overlaps(start, end, minutesFromTime(reservation.startTime), minutesFromTime(reservation.endTime))
  ));
}

function selectionProblem() {
  const range = selectedRange();
  if (!range) return "Escolha um horário antes de reservar.";
  if (!isActiveDay(state.selectedDay)) return "A Arena não atende neste dia.";
  if (range.end > minutesFromTime(state.settings.closingTime)) return "Não há tempo suficiente antes do fechamento.";
  if (isPastSlot(range.startTime)) return "Esse horário já passou.";
  if (rangeIsBusy(range)) return "Horário indisponível. Escolha outro período.";
  return "";
}

function buildReservationMessage({ customerName = "", customerPhone = "" } = {}) {
  const range = selectedRange();
  if (!range) return "Olá, NT Informática. Quero saber quais horários estão disponíveis para jogar na Arena Gamer.";

  return [
    "Olá, NT Informática. Enviei uma solicitação de reserva na Arena Gamer.",
    customerName ? `Nome: ${customerName}.` : "",
    customerPhone ? `WhatsApp do cliente: ${customerPhone}.` : "",
    `Equipamento: ${stationName()}.`,
    `Dia: ${fullDateLabel(state.selectedDay)}.`,
    `Horário: ${range.startTime} até ${range.endTime}.`,
    `Duração: ${range.duration} minutos.`,
    `Valor: ${formatMoney(priceForDuration(range.duration))}.`,
    selectedPaymentType() === "plano" ? "Forma de pagamento: usar plano mensal." : "Forma de pagamento: avulso.",
    "Status: aguardando confirmação da loja.",
  ].filter(Boolean).join("\n");
}

function whatsappHref(message) {
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
}

function renderDays() {
  dayStrip.innerHTML = "";
  for (let index = 0; index < 7; index += 1) {
    const date = todayDate(index);
    const active = isActiveDay(index);
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !active;
    button.className = `day-card${state.selectedDay === index ? " active" : ""}${!active ? " past" : ""}`;
    button.innerHTML = `<strong>${dayLabel(date)}</strong><span>${dateLabel(date)}</span>`;
    button.addEventListener("click", async () => {
      state.selectedDay = index;
      state.selectedSlot = "";
      state.selectedDate = isoDate(index);
      await loadReservationsForSelectedDate();
      render();
    });
    dayStrip.appendChild(button);
  }
}

function renderStations() {
  stationGrid.innerHTML = "";
  if (!state.stations.length) {
    stationGrid.innerHTML = '<div class="empty-state">Nenhum equipamento ativo cadastrado.</div>';
    return;
  }

  state.stations.forEach((station) => {
    const button = document.createElement("button");
    button.className = `station-card${station.id === state.selectedStationId ? " active" : ""}`;
    button.type = "button";
    button.dataset.station = station.type;
    button.innerHTML = `<span>${station.type === "ps5" ? "PLAYSTATION 5" : "PC GAMER"}</span><strong>${station.name}</strong>`;
    button.addEventListener("click", () => {
      state.selectedStationId = station.id;
      state.selectedSlot = "";
      render();
    });
    stationGrid.appendChild(button);
  });
}

function renderSlots() {
  const range = selectedRange();
  slotGrid.innerHTML = "";

  if (!isActiveDay(state.selectedDay)) {
    slotGrid.innerHTML = '<div class="empty-state">A Arena não atende neste dia.</div>';
    return;
  }

  buildSlots().forEach((slot) => {
    const reservation = reservationForSlot(slot);
    const busy = Boolean(reservation);
    const past = isPastSlot(slot);
    const selected = range && minutesFromTime(slot) >= range.start && minutesFromTime(slot) < range.end;
    const status = reservation?.status || "livre";
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = busy || past;
    button.className = `slot-button ${status}${busy ? " busy" : ""}${past ? " past" : ""}${selected ? " selected" : ""}`;
    button.innerHTML = `<strong>${slot}</strong><span>${busy ? "Horário indisponível" : past ? "Encerrado" : "Livre"}</span>`;
    button.addEventListener("click", () => {
      state.selectedSlot = slot;
      renderSlots();
      renderSummary();
    });
    slotGrid.appendChild(button);
  });
}

function renderDurationOptions() {
  const selected = durationInput.value || "60";
  durationInput.innerHTML = state.packages
    .filter((pack) => pack.active !== false)
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.durationMinutes - b.durationMinutes))
    .map((pack) => `<option value="${pack.durationMinutes}">${pack.name} - ${formatMoney(pack.price)}</option>`)
    .join("");
  durationInput.value = [...durationInput.options].some((option) => option.value === selected) ? selected : durationInput.options[0]?.value || "60";
}

function renderSummary() {
  const range = selectedRange();
  if (!range) {
    selectedSummary.textContent = "Selecione um horário";
    renderPaymentOptions();
    updateWhatsapp();
    return;
  }

  const problem = selectionProblem();
  selectedSummary.textContent = problem
    ? problem
    : `${stationName()} em ${fullDateLabel(state.selectedDay)}, ${range.startTime} até ${range.endTime} - ${formatMoney(priceForDuration(range.duration))}`;
  renderReservationPreview();
  renderPaymentOptions();
  updateWhatsapp();
}

function selectedPaymentType() {
  return document.querySelector("input[name='paymentType']:checked")?.value || "avulso";
}

async function lookupCustomerPlan() {
  const phone = normalizePhone(customerPhoneInput?.value);
  state.customerPlan = null;
  if (!phone || phone.length < 10 || !isSupabaseConfigured || state.localMode) {
    renderPaymentOptions();
    return;
  }

  try {
    const rows = await supabaseRequest(`/arena_customer_subscriptions?select=id,status,remaining_minutes,expiration_date,arena_monthly_plans(name,active),arena_customers!inner(active)&arena_customers.normalized_phone=eq.${encodeURIComponent(phone)}&order=expiration_date.desc&limit=1`);
    state.customerPlan = fromCustomerPlan(rows?.[0] || {});
  } catch (error) {
    console.error(error);
    try {
      const rows = await supabaseRequest("/rpc/find_arena_customer_plan_by_phone", {
        method: "POST",
        body: JSON.stringify({ p_phone: phone }),
      });
      state.customerPlan = fromCustomerPlan(rows?.[0] || {});
    } catch (fallbackError) {
      console.error(fallbackError);
      state.customerPlan = null;
    }
  }
  renderPaymentOptions();
}

function renderPaymentOptions() {
  const plan = state.customerPlan;
  const range = selectedRange();
  const activePlan = plan?.hasActivePlan;
  const selectedDuration = Number(range?.duration || durationInput?.value || 0);
  const projectedBalance = Number(plan?.remainingMinutes || 0) - selectedDuration;
  if (planPaymentOption) planPaymentOption.classList.toggle("is-hidden", !activePlan);
  if (!activePlan && selectedPaymentType() === "plano") {
    const avulsoInput = document.querySelector("input[name='paymentType'][value='avulso']");
    if (avulsoInput) avulsoInput.checked = true;
  }
  document.querySelectorAll(".payment-option").forEach((option) => {
    const input = option.querySelector("input");
    option.classList.toggle("active", input?.checked === true);
  });
  if (paymentSummary) paymentSummary.textContent = selectedPaymentType() === "plano" ? "Plano mensal" : "Pix/loja";
  if (planStatus) {
    planStatus.classList.toggle("available", Boolean(activePlan));
    planStatus.classList.toggle("warning", Boolean((plan?.hasPlan && !activePlan) || (activePlan && selectedDuration && projectedBalance < 0)));

    if (activePlan) {
      planStatus.innerHTML = `
        <strong>${plan.planName || "Plano mensal"} ativo</strong>
        <span>Saldo disponível: ${formatMinutes(plan.remainingMinutes)}</span>
        <span>Válido até: ${formatDate(plan.expirationDate)}</span>
        ${selectedDuration ? `<span>Reserva selecionada: ${formatMinutes(selectedDuration)}</span><span>Saldo previsto após confirmação: ${formatMinutes(Math.max(0, projectedBalance))}</span>` : ""}
        ${selectedDuration && projectedBalance < 0 ? "<span>Saldo de horas insuficiente para esta duração.</span>" : ""}
      `;
      return;
    }

    if (plan?.hasPlan && plan.expired) {
      planStatus.textContent = "Plano mensal vencido.";
      return;
    }

    if (plan?.hasPlan && !plan.hasBalance) {
      planStatus.textContent = "Plano mensal ativo, porém sem saldo disponível.";
      return;
    }

    planStatus.textContent = "Pagamento avulso disponível. Se você possui plano mensal, digite o WhatsApp cadastrado.";
  }
}

function renderReservationPreview() {
  let preview = document.querySelector("#reservationPreview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "reservationPreview";
    preview.className = "reservation-preview";
    bookingForm.insertBefore(preview, bookingForm.querySelector(".payment-row"));
  }

  const range = selectedRange();
  if (!range || selectionProblem()) {
    preview.innerHTML = "<strong>Resumo</strong><span>Escolha data, equipamento, duração e horário inicial.</span>";
    return;
  }

  preview.innerHTML = `
    <strong>Resumo da solicitação</strong>
    <span>Equipamento: ${stationName()}</span>
    <span>Data: ${fullDateLabel(state.selectedDay)}</span>
    <span>Início: ${range.startTime} · Término: ${range.endTime}</span>
    <span>Duração: ${range.duration / 60} ${range.duration === 60 ? "hora" : "horas"}</span>
    <span>Valor total: ${formatMoney(priceForDuration(range.duration))}</span>
    <span>Pagamento: ${selectedPaymentType() === "plano" ? "Usar plano mensal" : "Pagamento avulso"}</span>
    <span>Nome: ${customerNameInput?.value || "preencha seu nome"}</span>
    <span>Telefone: ${customerPhoneInput?.value || "preencha seu WhatsApp"}</span>
  `;
}

function renderBookings() {
  const ownBookings = state.localMode
    ? state.reservations
    : state.reservations.filter((reservation) => reservation.customerPhone);

  bookingList.innerHTML = "";
  if (!ownBookings.length) {
    bookingList.innerHTML = `<div class="empty-state">${state.localMode ? "Modo local de teste: nenhuma solicitação salva neste navegador." : "Nenhuma solicitação para este dia."}</div>`;
    return;
  }

  ownBookings
    .slice()
    .sort((a, b) => `${a.reservationDate} ${a.startTime}`.localeCompare(`${b.reservationDate} ${b.startTime}`))
    .forEach((booking) => {
      const station = state.stations.find((item) => item.id === booking.stationId);
      const card = document.createElement("article");
      card.className = "booking-card";
      card.innerHTML = `
        <span>${booking.customerName || "Cliente"} - ${booking.customerPhone || "sem telefone"}</span>
        <strong>${station?.name || "Arena"} - ${booking.reservationDate}, ${booking.startTime} até ${booking.endTime}</strong>
        <span>${booking.durationMinutes} min - ${formatMoney(booking.totalPrice)}</span>
        <span class="status">${booking.status}</span>
      `;
      bookingList.appendChild(card);
    });
}

function updateWhatsapp() {
  whatsappLink.href = whatsappHref(buildReservationMessage());
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function switchView(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#${view}-view`).classList.add("active");
  if (view === "bookings") renderBookings();
}

function applyStationTheme() {
  document.body.classList.toggle("theme-pc", stationType() === "pc");
  document.body.classList.toggle("theme-ps5", stationType() === "ps5");
}

function renderModeNotice() {
  if (!noticeText) return;
  noticeText.textContent = state.localMode
    ? "Modo local de teste: as solicitações ficam salvas apenas neste navegador porque o Supabase não está configurado."
    : "Sua solicitação será salva como pendente e confirmada pela NT Informática.";
}

function render() {
  applyStationTheme();
  renderModeNotice();
  renderDurationOptions();
  renderDays();
  renderStations();
  renderSlots();
  renderSummary();
  renderBookings();
}

async function createReservation(payload) {
  if (state.localMode || !isSupabaseConfigured) {
    const reservation = {
      id: `local-${Date.now()}`,
      ...payload,
      endTime: selectedRange().endTime,
      totalPrice: priceForDuration(payload.durationMinutes),
      status: "pendente",
    };
    const stored = JSON.parse(localStorage.getItem("nt-arena-local-reservations") || "[]");
    const conflict = stored.some((item) => (
      item.stationId === reservation.stationId
      && item.reservationDate === reservation.reservationDate
      && isBlockingReservation(item)
      && overlaps(
        minutesFromTime(reservation.startTime),
        minutesFromTime(reservation.endTime),
        minutesFromTime(item.startTime),
        minutesFromTime(item.endTime),
      )
    ));
    if (conflict) throw new Error("Horário indisponível.");
    stored.unshift(reservation);
    localStorage.setItem("nt-arena-local-reservations", JSON.stringify(stored));
    state.reservations = stored;
    return reservation;
  }

  const rows = await supabaseRequest("/rpc/create_arena_reservation", {
    method: "POST",
    body: JSON.stringify({
      p_station_id: payload.stationId,
      p_customer_name: payload.customerName,
      p_customer_phone: payload.customerPhone,
      p_reservation_date: payload.reservationDate,
      p_start_time: payload.startTime,
      p_duration_minutes: payload.durationMinutes,
      p_notes: payload.notes || null,
      p_payment_type: payload.paymentType || "avulso",
      p_subscription_id: payload.subscriptionId || null,
    }),
  });
  const created = fromReservation(rows?.[0] || {});
  await loadReservationsForSelectedDate();
  return created;
}

document.querySelectorAll("[data-view]").forEach((control) => {
  control.addEventListener("click", () => switchView(control.dataset.view));
});

document.querySelector("#todayButton").addEventListener("click", async () => {
  state.selectedDay = 0;
  state.selectedSlot = "";
  state.selectedDate = isoDate(0);
  await loadReservationsForSelectedDate();
  render();
});

durationInput.addEventListener("change", () => {
  renderSlots();
  renderSummary();
});

customerNameInput?.addEventListener("input", renderReservationPreview);
customerPhoneInput?.addEventListener("input", () => {
  renderReservationPreview();
  window.clearTimeout(customerPhoneInput.lookupTimer);
  customerPhoneInput.lookupTimer = window.setTimeout(lookupCustomerPlan, 450);
});

paymentOptions?.addEventListener("change", () => {
  renderPaymentOptions();
  renderReservationPreview();
  updateWhatsapp();
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const problem = selectionProblem();
  if (problem) {
    showToast(problem);
    return;
  }

  const form = new FormData(bookingForm);
  const customerName = String(form.get("customerName") || "").trim();
  const customerPhone = String(form.get("customerPhone") || "").trim();
  const notes = String(form.get("customerNotes") || "").trim();
  const paymentType = String(form.get("paymentType") || "avulso");

  if (!customerName || !customerPhone) {
    showToast("Informe nome e WhatsApp para reservar.");
    return;
  }

  if (paymentType === "plano" && !state.customerPlan?.hasActivePlan) {
    showToast("Plano mensal indisponível para este telefone.");
    return;
  }

  if (paymentType === "plano" && Number(state.customerPlan?.remainingMinutes || 0) < Number(durationInput.value || 0)) {
    showToast("Saldo de horas insuficiente para esta reserva.");
    return;
  }

  try {
    const range = selectedRange();
    await createReservation({
      stationId: state.selectedStationId,
      customerName,
      customerPhone,
      reservationDate: state.selectedDate,
      startTime: range.startTime,
      durationMinutes: range.duration,
      notes,
      paymentType,
      subscriptionId: paymentType === "plano" ? state.customerPlan?.subscriptionId || "" : "",
    });

    state.selectedSlot = "";
    bookingForm.reset();
    await loadReservationsForSelectedDate();
    render();
    switchView("bookings");
    showToast(paymentType === "plano" ? "Sua solicitação foi enviada. A utilização do plano será processada após a confirmação da reserva pela NT Informática." : state.settings.reservationNotice || fallbackSettings.reservationNotice);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Falha ao salvar reserva.");
  }
});

document.querySelector("#copyMessage").addEventListener("click", async () => {
  const message = buildReservationMessage();
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(message);
    showToast("Mensagem copiada.");
    return;
  }
  showToast(message);
});

async function start() {
  state.selectedDate = isoDate(0);
  await loadArenaData();
  render();
}

start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/arena/sw.js?v=20260706-1010", { scope: "/arena/" }).catch(() => {
      showToast("Modo instalável indisponível neste navegador.");
    });
  });
}
