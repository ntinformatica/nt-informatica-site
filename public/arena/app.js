const durationPrices = {
  1: 20,
  2: 40,
  3: 50
};

const storePhone = "5547999309344";
const state = {
  selectedDay: 0,
  selectedStation: "pc",
  selectedSlot: "",
  bookings: JSON.parse(localStorage.getItem("nt-bookings") || "[]")
};

const dayStrip = document.querySelector("#dayStrip");
const slotGrid = document.querySelector("#slotGrid");
const selectedSummary = document.querySelector("#selectedSummary");
const bookingForm = document.querySelector("#bookingForm");
const bookingList = document.querySelector("#bookingList");
const durationInput = document.querySelector("#duration");
const toast = document.querySelector("#toast");
const whatsappLink = document.querySelector("#whatsappLink");

const slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const busySeed = {
  pc: ["10:00", "14:00", "19:00"],
  ps5: ["11:00", "16:00", "20:00"]
};

function formatDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

function dayLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
}

function dateLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function fullDateLabel(offset) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(formatDate(offset));
}

function stationName(station) {
  return station === "pc" ? "PC Gamer" : "PlayStation 5";
}

function priceForDuration(hours) {
  return durationPrices[hours] || hours * 20;
}

function bookingKey(dayOffset, station, slot) {
  return `${dayOffset}-${station}-${slot}`;
}

function isPastSlot(slot) {
  if (state.selectedDay !== 0) {
    return false;
  }

  const [hour, minute] = slot.split(":").map(Number);
  const slotDate = new Date();
  slotDate.setHours(hour, minute, 0, 0);
  return slotDate <= new Date();
}

function bookingOccupiesSlot(booking, slot) {
  const key = bookingKey(state.selectedDay, state.selectedStation, slot);
  if (Array.isArray(booking.keys)) {
    return booking.keys.includes(key);
  }
  return booking.key === key;
}

function isBusy(slot) {
  const seeded = busySeed[state.selectedStation].includes(slot) && state.selectedDay === 0;
  const reserved = state.bookings.some((booking) => bookingOccupiesSlot(booking, slot));
  return seeded || reserved;
}

function selectedSlotsForDuration() {
  if (!state.selectedSlot) {
    return [];
  }

  const hours = Number(durationInput.value);
  const startIndex = slots.indexOf(state.selectedSlot);
  if (startIndex < 0) {
    return [];
  }

  return slots.slice(startIndex, startIndex + hours);
}

function selectionProblem() {
  const hours = Number(durationInput.value);
  const selectedSlots = selectedSlotsForDuration();
  if (!selectedSlots.length) {
    return "Escolha um horario antes de reservar.";
  }
  if (selectedSlots.length < hours) {
    return "Nao ha horarios suficientes em sequencia para essa duracao.";
  }
  if (selectedSlots.some((slot) => isBusy(slot) || isPastSlot(slot))) {
    return "Um dos horarios desse periodo ja esta ocupado. Escolha outro inicio.";
  }
  return "";
}

function selectedSlotRange() {
  const selectedSlots = selectedSlotsForDuration();
  if (!selectedSlots.length) {
    return "";
  }
  return selectedSlots.join(", ");
}

function buildReservationMessage({ customerName = "", customerPhone = "" } = {}) {
  const hours = Number(durationInput.value);
  const total = priceForDuration(hours);
  const selectedSlots = selectedSlotRange();
  const nameLine = customerName ? `Nome: ${customerName}.` : "";
  const phoneLine = customerPhone ? `WhatsApp do cliente: ${customerPhone}.` : "";

  if (!state.selectedSlot) {
    return "Ola, NT Informatica. Quero saber quais horarios estao disponiveis para jogar na Arena Gamer.";
  }

  return [
    "Ola, NT Informatica. Quero confirmar uma pre-reserva na Arena Gamer.",
    nameLine,
    phoneLine,
    `Estacao: ${stationName(state.selectedStation)}.`,
    `Dia: ${fullDateLabel(state.selectedDay)}.`,
    `Horarios: ${selectedSlots}.`,
    `Duracao: ${hours} ${hours === 1 ? "hora" : "horas"}.`,
    `Valor: R$ ${total}.`,
    "Forma de pagamento: Pix/loja.",
    "Pode me enviar os dados para pagamento e confirmar a reserva?"
  ].filter(Boolean).join("\n");
}

function whatsappHref(message) {
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
}

function renderDays() {
  dayStrip.innerHTML = "";
  for (let index = 0; index < 3; index += 1) {
    const date = formatDate(index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-card${state.selectedDay === index ? " active" : ""}`;
    button.innerHTML = `<strong>${dayLabel(date)}</strong><span>${dateLabel(date)}</span>`;
    button.addEventListener("click", () => {
      state.selectedDay = index;
      state.selectedSlot = "";
      render();
    });
    dayStrip.appendChild(button);
  }
}

function renderSlots() {
  const highlightedSlots = selectedSlotsForDuration();
  slotGrid.innerHTML = "";
  slots.forEach((slot) => {
    const busy = isBusy(slot);
    const past = isPastSlot(slot);
    const selected = highlightedSlots.includes(slot);
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = busy || past;
    button.className = `slot-button${busy ? " busy" : ""}${past ? " past" : ""}${selected ? " selected" : ""}`;
    button.textContent = slot;
    button.addEventListener("click", () => {
      state.selectedSlot = slot;
      renderSlots();
      renderSummary();
    });
    slotGrid.appendChild(button);
  });
}

function renderSummary() {
  if (!state.selectedSlot) {
    selectedSummary.textContent = "Selecione um horario";
    updateWhatsapp();
    return;
  }

  const hours = Number(durationInput.value);
  const total = priceForDuration(hours);
  const slotsText = selectedSlotRange();
  const problem = selectionProblem();
  selectedSummary.textContent = problem
    ? problem
    : `${stationName(state.selectedStation)} em ${fullDateLabel(state.selectedDay)}, ${slotsText} - ${hours}h - R$ ${total}`;
  updateWhatsapp();
}

function renderBookings() {
  bookingList.innerHTML = "";
  if (!state.bookings.length) {
    bookingList.innerHTML = '<div class="empty-state">Nenhuma reserva salva ainda.</div>';
    return;
  }

  state.bookings.forEach((booking) => {
    const card = document.createElement("article");
    card.className = "booking-card";
    card.innerHTML = `
      <span>${booking.customerName} - ${booking.customerPhone}</span>
      <strong>${booking.station} - ${booking.day}, ${booking.slotRange || booking.slot}</strong>
      <span>${booking.duration} ${booking.duration === 1 ? "hora" : "horas"} - R$ ${booking.total}</span>
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
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function switchView(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#${view}-view`).classList.add("active");
  if (view === "bookings") {
    renderBookings();
  }
}

function applyStationTheme() {
  document.body.classList.toggle("theme-pc", state.selectedStation === "pc");
  document.body.classList.toggle("theme-ps5", state.selectedStation === "ps5");
}

function render() {
  applyStationTheme();
  renderDays();
  renderSlots();
  renderSummary();
  renderBookings();
}

document.querySelectorAll("[data-view]").forEach((control) => {
  control.addEventListener("click", () => switchView(control.dataset.view));
});

document.querySelectorAll(".station-card").forEach((card) => {
  card.addEventListener("click", () => {
    state.selectedStation = card.dataset.station;
    state.selectedSlot = "";
    applyStationTheme();
    document.querySelectorAll(".station-card").forEach((item) => item.classList.toggle("active", item === card));
    renderSlots();
    renderSummary();
  });
});

document.querySelector("#todayButton").addEventListener("click", () => {
  state.selectedDay = 0;
  state.selectedSlot = "";
  render();
});

durationInput.addEventListener("change", () => {
  renderSlots();
  renderSummary();
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const problem = selectionProblem();
  if (problem) {
    showToast(problem);
    return;
  }

  const form = new FormData(bookingForm);
  const hours = Number(durationInput.value);
  const selectedSlots = selectedSlotsForDuration();
  const customerName = form.get("customerName");
  const customerPhone = form.get("customerPhone");
  const booking = {
    key: bookingKey(state.selectedDay, state.selectedStation, state.selectedSlot),
    keys: selectedSlots.map((slot) => bookingKey(state.selectedDay, state.selectedStation, slot)),
    customerName,
    customerPhone,
    station: stationName(state.selectedStation),
    day: fullDateLabel(state.selectedDay),
    slot: state.selectedSlot,
    slotRange: selectedSlots.join(", "),
    duration: hours,
    total: priceForDuration(hours),
    status: "Pre-reserva aguardando pagamento"
  };

  state.bookings.unshift(booking);
  localStorage.setItem("nt-bookings", JSON.stringify(state.bookings));

  const message = buildReservationMessage({ customerName, customerPhone });
  window.open(whatsappHref(message), "_blank", "noopener,noreferrer");

  state.selectedSlot = "";
  bookingForm.reset();
  render();
  switchView("bookings");
  showToast("Pre-reserva salva. Confirme o pagamento pelo WhatsApp.");
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

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/arena/sw.js?v=20260706-1010", { scope: "/arena/" }).catch(() => {
      showToast("Modo instalavel indisponivel neste navegador.");
    });
  });
}
