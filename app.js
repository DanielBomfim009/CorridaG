const STORAGE_KEY = "corridag_quality_v1";
const LEGACY_KEYS = ["corridag_tracking_v2", "corridag_official_v1"];

const FEELINGS = {
  leve: "Leve",
  controlado: "Controlado",
  dificil: "Difícil",
  muito_dificil: "Muito difícil"
};

const $ = (id) => document.getElementById(id);

function freshState() {
  return {
    plan: null,
    selectedDay: null,
    feedbackDraftDay: null,
    blockProgress: {},
    feedbacks: [],
    profile: {},
    lastImport: null,
    activeScreen: "home"
  };
}

function normalizeState(raw = {}) {
  const state = { ...freshState(), ...raw };
  state.blockProgress = raw.blockProgress || {};
  state.feedbacks = Array.isArray(raw.feedbacks) ? raw.feedbacks : [];
  state.profile = raw.profile || {};
  return state;
}

function loadState() {
  const keys = [STORAGE_KEY, ...LEGACY_KEYS];

  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);
      if (value) return normalizeState(JSON.parse(value));
    } catch {
      return freshState();
    }
  }

  return freshState();
}

let state = loadState();
const choices = { feeling: "" };

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function parseDecimal(value) {
  const normalized = String(value || "").replace(",", ".").replace(/[^\d.]/g, "");
  const firstDot = normalized.indexOf(".");
  const clean = firstDot === -1
    ? normalized
    : normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function formatDecimal(value, digits = 1) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(digits).replace(".", ",");
}

function formatKm(value, digits = 1) {
  return `${formatDecimal(value, digits)} km`;
}

function formatWeight(value) {
  return value ? `${formatDecimal(value, 1)} kg` : "--";
}

function formatDate(iso) {
  if (!iso) return "--";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

function timeToSeconds(value) {
  if (!value || typeof value !== "string") return 0;
  const parts = value.split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatPace(seconds) {
  const total = Math.round(seconds || 0);
  if (!total) return "--";
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function isValidClock(value, allowHours = false) {
  const match = allowHours
    ? /^(\d{1,2}:)?\d{2}:\d{2}$/.test(value)
    : /^\d{2}:\d{2}$/.test(value);
  if (!match) return false;
  const parts = value.split(":").map(Number);
  const seconds = parts.at(-1);
  const minutes = parts.at(-2);
  return minutes < 60 && seconds < 60;
}

function formatClockDigits(digits, type) {
  if (!digits) return "";

  if (type === "pace") {
    const value = digits.slice(-4).padStart(4, "0");
    return `${value.slice(0, 2)}:${value.slice(2)}`;
  }

  const value = digits.slice(-6);
  if (value.length <= 4) {
    const short = value.padStart(4, "0");
    return `${short.slice(0, 2)}:${short.slice(2)}`;
  }

  const padded = value.padStart(5, "0");
  const hours = padded.slice(0, -4).replace(/^0+(?=\d)/, "");
  return `${hours}:${padded.slice(-4, -2)}:${padded.slice(-2)}`;
}

function applyMask(input, type, rawDigits) {
  const max = type === "pace" ? 4 : 6;
  const digits = String(rawDigits || "").replace(/\D/g, "").slice(0, max);
  input.dataset.rawDigits = digits;
  input.value = formatClockDigits(digits, type);
}

function bindClockMask(input, type) {
  input.dataset.rawDigits = input.value.replace(/\D/g, "");

  input.addEventListener("beforeinput", (event) => {
    const current = input.dataset.rawDigits || "";

    if (event.inputType === "deleteContentBackward") {
      event.preventDefault();
      applyMask(input, type, current.slice(0, -1));
      return;
    }

    if (event.inputType === "insertFromPaste") {
      event.preventDefault();
      applyMask(input, type, `${current}${event.clipboardData?.getData("text") || ""}`);
      return;
    }

    if (event.inputType === "insertText") {
      event.preventDefault();
      if (/^\d$/.test(event.data || "")) applyMask(input, type, `${current}${event.data}`);
    }
  });

  input.addEventListener("input", () => {
    applyMask(input, type, input.value);
  });
}

function bindDistanceMask(input) {
  input.addEventListener("input", () => {
    const raw = input.value.replace(/[^\d,.]/g, "");
    const firstSeparator = raw.search(/[,.]/);

    if (firstSeparator === -1) {
      input.value = raw;
      return;
    }

    input.value = raw.slice(0, firstSeparator + 1) + raw.slice(firstSeparator + 1).replace(/[,.]/g, "");
  });
}

function convertPersonalFormat(data) {
  if (!data || !Array.isArray(data.days)) return data;

  const profile = data.userProfile || {};
  const goal = profile.goal || data.objective || "--";

  return {
    app: "CorridaG",
    version: 2,
    week: data.week || "Semana importada",
    generatedBy: data.generatedBy || "CorridaG Personal",
    objective: data.objective || goal,
    decision: data.decision || null,
    reason: data.reason || null,
    coachNote: data.reason
      ? `Decisão: ${data.decision || "ACOMPANHAR"}. ${data.reason}`
      : "Treino importado. Execute os blocos e registre o feedback real após cada sessão.",
    athlete: {
      name: profile.name || "Atleta",
      age: profile.age || null,
      goal,
      weight: profile.weight || null,
      height: profile.height || null,
      level: profile.level || "--",
      preferredTime: profile.trainingTime || profile.preferredTime || "--",
      restrictions: profile.restrictions || "Nenhuma"
    },
    workouts: data.days.map((day) => ({
      day: day.day,
      title: day.title,
      distance: Number(day.targetDistance ?? day.distance ?? 0),
      status: Number(day.targetDistance ?? day.distance ?? 0) <= 0 ? "rest" : "pending",
      blocks: Array.isArray(day.blocks)
        ? day.blocks.map((block) => ({
            from: Number(block.startKm ?? block.from ?? 0),
            to: Number(block.endKm ?? block.to ?? 0),
            type: block.activity || block.type || "Bloco de treino",
            pace: block.pace || "Livre"
          }))
        : []
    }))
  };
}

function normalizePlan(input) {
  const data = convertPersonalFormat(input);

  if (!data || data.app !== "CorridaG") {
    throw new Error("Arquivo inválido: este não parece ser um treino do CorridaG.");
  }

  if (!data.version) {
    throw new Error("Arquivo inválido: o campo version está ausente.");
  }

  if (!data.week) {
    throw new Error("Arquivo inválido: o campo week está ausente.");
  }

  if (!data.athlete || typeof data.athlete !== "object") {
    throw new Error("Arquivo inválido: os dados do atleta estão ausentes.");
  }

  if (!Array.isArray(data.workouts) || data.workouts.length === 0) {
    throw new Error("Arquivo inválido: a lista workouts está ausente.");
  }

  const workouts = data.workouts.map((workout, index) => {
    if (!workout.day || !workout.title) {
      throw new Error(`Treino ${index + 1} inválido: dia ou título ausente.`);
    }

    if (!Array.isArray(workout.blocks)) {
      throw new Error(`Treino ${workout.day} inválido: lista de blocos ausente.`);
    }

    const distance = Number(workout.distance ?? workout.targetDistance ?? 0);
    const rest = workout.status === "rest" || distance <= 0;
    const blocks = workout.blocks.map((block) => ({
      from: Number(block.from ?? block.startKm ?? 0),
      to: Number(block.to ?? block.endKm ?? 0),
      type: String(block.type || block.activity || "Bloco de treino"),
      pace: String(block.pace || "Livre")
    }));

    if (!rest && blocks.length === 0) {
      throw new Error(`Treino ${workout.day} inválido: blocos ausentes.`);
    }

    return {
      day: String(workout.day).toUpperCase().slice(0, 3),
      title: String(workout.title),
      distance,
      status: rest ? "rest" : workout.status || "pending",
      blocks
    };
  });

  return { ...data, workouts };
}

function profileFromPlan(plan) {
  const athlete = plan.athlete || {};

  return {
    name: athlete.name || "Atleta",
    goal: athlete.goal || plan.objective || "--",
    weight: athlete.weight ? Number(athlete.weight) : null,
    height: athlete.height ? Number(athlete.height) : null,
    level: athlete.level || "--",
    preferredTime: athlete.preferredTime || "--",
    restrictions: Array.isArray(athlete.restrictions)
      ? athlete.restrictions.join(", ")
      : athlete.restrictions || "--"
  };
}

function getPlanKey() {
  return String(state.plan?.id || state.plan?.createdAt || state.plan?.week || "semana");
}

function getWorkouts() {
  return Array.isArray(state.plan?.workouts) ? state.plan.workouts : [];
}

function isRestWorkout(workout) {
  return !workout || workout.status === "rest" || Number(workout.distance || 0) <= 0;
}

function getWorkout(day = state.selectedDay) {
  return getWorkouts().find((workout) => workout.day === day) || null;
}

function blockKey(day, index) {
  return `${getPlanKey()}__${day}__${index}`;
}

function isBlockDone(day, index) {
  return Boolean(state.blockProgress[blockKey(day, index)]);
}

function setBlockDone(day, index, done) {
  state.blockProgress[blockKey(day, index)] = Boolean(done);
  saveState();
}

function plannedWorkouts() {
  return getWorkouts().filter((workout) => !isRestWorkout(workout));
}

function getWorkoutProgress(workout) {
  if (!workout || !Array.isArray(workout.blocks) || workout.blocks.length === 0 || isRestWorkout(workout)) {
    return { done: 0, total: 0, percent: 0 };
  }

  const done = workout.blocks.filter((_, index) => isBlockDone(workout.day, index)).length;
  const total = workout.blocks.length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

function hasFeedback(day) {
  const planKey = getPlanKey();
  return state.feedbacks.some((feedback) => feedback.day === day && feedback.planKey === planKey);
}

function isWorkoutComplete(workout) {
  if (isRestWorkout(workout)) return false;
  if (hasFeedback(workout.day)) return true;
  const progress = getWorkoutProgress(workout);
  return progress.total > 0 && progress.done === progress.total;
}

function completedWorkouts() {
  return plannedWorkouts().filter(isWorkoutComplete);
}

function nextWorkout() {
  const workouts = plannedWorkouts();
  return workouts.find((workout) => !isWorkoutComplete(workout)) || workouts[0] || null;
}

function latestFeedback() {
  return state.feedbacks[state.feedbacks.length - 1] || null;
}

function ensureSelectedDay() {
  const workouts = getWorkouts();

  if (!workouts.length) {
    state.selectedDay = null;
    return;
  }

  if (!state.selectedDay || !workouts.some((workout) => workout.day === state.selectedDay)) {
    state.selectedDay = nextWorkout()?.day || workouts[0].day;
  }
}

function importPlan(data, fileName = "treino.json") {
  const plan = normalizePlan(data);
  const firstWorkout = plan.workouts.find((workout) => !isRestWorkout(workout)) || plan.workouts[0];

  state.plan = plan;
  state.profile = profileFromPlan(plan);
  state.selectedDay = firstWorkout?.day || null;
  state.feedbackDraftDay = null;
  state.blockProgress = {};
  state.lastImport = {
    date: nowISO(),
    fileName,
    week: plan.week
  };

  saveState();
  renderAll();
  goTo("home");
}

function renderHome() {
  const profile = state.profile || {};
  const firstName = String(profile.name || "atleta").split(" ")[0];
  const planned = plannedWorkouts().length;
  const done = completedWorkouts().length;
  const percent = planned ? Math.round((done / planned) * 100) : 0;
  const next = nextWorkout();
  const feedback = latestFeedback();
  const totalDistance = state.feedbacks.reduce((sum, item) => sum + Number(item.distance || 0), 0);
  const paces = state.feedbacks.map((item) => timeToSeconds(item.pace)).filter(Boolean);
  const averagePace = paces.length ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : 0;

  setText("home-greeting", `Olá, ${firstName}`);
  setText("coach-note", state.plan?.coachNote || "Importe o treino da semana para começar o acompanhamento.");
  setText("today-title", next ? `${next.day} - ${next.title}` : "Nenhum treino importado");
  setText("today-detail", next ? `${formatKm(next.distance, 1)} planejados` : "Importe um arquivo JSON para visualizar os blocos.");
  setText("week-percent", `${percent}%`);
  setText("week-progress", `${done} de ${planned}`);
  setText("week-label", state.plan?.week || "Sem treino importado");
  setText("total-distance", formatKm(totalDistance, 2));
  setText("avg-pace", averagePace ? `${formatPace(averagePace)}/km` : "--");
  setText("next-workout", next?.day || "--");

  const ring = $("week-ring");
  if (ring) ring.style.setProperty("--p", `${percent * 3.6}deg`);

  if (feedback) {
    setText("last-feedback-title", `${feedback.day} - ${formatKm(feedback.distance, 2)}`);
    setText("last-feedback-detail", `${feedback.time} · ${feedback.pace}/km · ${feedback.feelingLabel}`);
  } else {
    setText("last-feedback-title", "Nenhum feedback salvo");
    setText("last-feedback-detail", "Finalize um treino para acompanhar sua evolução.");
  }
}

function renderDayTabs() {
  const container = $("day-tabs");
  if (!container) return;
  container.innerHTML = "";

  const workouts = getWorkouts();
  if (!workouts.length) {
    container.innerHTML = '<button class="day-tab active" type="button">--<small>Importe</small></button>';
    return;
  }

  workouts.forEach((workout) => {
    const button = document.createElement("button");
    const complete = isWorkoutComplete(workout);
    button.type = "button";
    button.className = `day-tab ${workout.day === state.selectedDay ? "active" : ""}`;
    button.innerHTML = `${workout.day}<small>${isRestWorkout(workout) ? "Descanso" : complete ? "Feito" : "Aberto"}</small>`;
    button.addEventListener("click", () => {
      state.selectedDay = workout.day;
      saveState();
      renderAll();
    });
    container.appendChild(button);
  });
}

function renderTraining() {
  ensureSelectedDay();
  renderDayTabs();

  const workout = getWorkout();
  const progress = getWorkoutProgress(workout);
  const finishButton = $("finish-workout-btn");

  setText("training-week", state.plan?.week || "Sem plano");
  setText("selected-day", workout?.day || "--");
  setText("selected-title", workout?.title || "Importe um treino");
  setText("selected-distance", workout ? formatKm(workout.distance, 1) : "0 km");
  setText("workout-progress-label", `${progress.percent}% concluído`);

  const bar = $("workout-progress-bar");
  if (bar) bar.style.width = `${progress.percent}%`;

  const status = $("selected-status");
  if (status) {
    status.className = "status-pill";
    if (!workout) status.textContent = "Pendente";
    else if (isRestWorkout(workout)) status.textContent = "Descanso";
    else if (hasFeedback(workout.day)) {
      status.textContent = "Registrado";
      status.classList.add("done");
    } else if (progress.total && progress.done === progress.total) status.textContent = "Pronto";
    else status.textContent = "Em aberto";
  }

  const list = $("blocks-list");
  if (!list) return;
  list.innerHTML = "";

  if (!workout) {
    list.innerHTML = `
      <article class="block-card">
        <div>
          <strong>Nenhum treino importado</strong>
          <p>Importe um arquivo JSON no perfil para visualizar a semana.</p>
        </div>
        <div class="check-circle"></div>
      </article>
    `;
    finishButton?.classList.add("hidden");
    return;
  }

  if (isRestWorkout(workout)) {
    list.innerHTML = `
      <article class="block-card">
        <div>
          <strong>Descanso</strong>
          <p>Dia reservado para recuperação.</p>
        </div>
        <div class="check-circle"></div>
      </article>
    `;
    finishButton?.classList.add("hidden");
    return;
  }

  workout.blocks.forEach((block, index) => {
    const done = isBlockDone(workout.day, index);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `block-card ${done ? "done" : ""}`;
    card.innerHTML = `
      <div>
        <strong>${formatDecimal(block.from, 1)} -> ${formatDecimal(block.to, 1)} km</strong>
        <p>${block.type}<br>Pace: ${block.pace}</p>
      </div>
      <div class="check-circle">${done ? "OK" : ""}</div>
    `;
    card.addEventListener("click", () => {
      setBlockDone(workout.day, index, !done);
      renderAll();
    });
    list.appendChild(card);
  });

  if (finishButton) {
    finishButton.classList.toggle(
      "hidden",
      progress.total === 0 || progress.done !== progress.total || hasFeedback(workout.day)
    );
  }
}

function renderFeedbackScreen() {
  const workout = getWorkout(state.feedbackDraftDay || state.selectedDay);
  setText("feedback-workout-title", workout ? `${workout.day} - ${workout.title}` : "Treino");
  setText("feedback-workout-meta", workout ? `${formatKm(workout.distance, 1)} planejados` : "Preencha os resultados reais do treino.");
}

function renderEvolution() {
  const feedbacks = [...state.feedbacks];
  const totalDistance = feedbacks.reduce((sum, item) => sum + Number(item.distance || 0), 0);
  const paces = feedbacks.map((item) => timeToSeconds(item.pace)).filter(Boolean);
  const averagePace = paces.length ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : 0;
  const bestDistance = feedbacks.reduce((best, item) => Math.max(best, Number(item.distance || 0)), 0);

  setText("evolution-count", `${feedbacks.length} registros`);
  setText("month-distance", formatKm(totalDistance, 2));
  setText("done-workouts", String(feedbacks.length));
  setText("pace-average", averagePace ? `${formatPace(averagePace)}/km` : "--");
  setText("best-distance", bestDistance ? formatKm(bestDistance, 2) : "--");

  const labels = feedbacks.map((item) => item.day || formatDate(item.date));
  drawBarChart("distance-chart", labels, feedbacks.map((item) => Number(item.distance || 0)));
  drawLineChart("pace-chart", labels, feedbacks.map((item) => timeToSeconds(item.pace) / 60 || 0));
  renderHistory();
}

function renderHistory() {
  const container = $("history-list");
  if (!container) return;

  const items = [...state.feedbacks].reverse().slice(0, 8);
  if (!items.length) {
    container.innerHTML = `
      <article class="history-item">
        <div>
          <strong>Nenhum treino registrado</strong>
          <small>Os feedbacks aparecerão aqui.</small>
        </div>
      </article>
    `;
    return;
  }

  container.innerHTML = items.map((item) => `
    <article class="history-item">
      <div>
        <strong>${item.day} - ${formatKm(item.distance, 2)}</strong>
        <small>${formatDate(item.date)} · ${item.time} · ${item.pace}/km</small>
      </div>
      <span>${item.feelingLabel}</span>
    </article>
  `).join("");
}

function renderImport() {
  if (state.lastImport) {
    setText("last-import-title", state.lastImport.week || "Treino importado");
    setText("last-import-detail", `${state.lastImport.fileName || "arquivo.json"} · ${new Date(state.lastImport.date).toLocaleString("pt-BR")}`);
  } else {
    setText("last-import-title", "Nenhum treino importado");
    setText("last-import-detail", "Importe o treino enviado pelo personal.");
  }
}

function renderProfile() {
  const profile = state.profile || {};
  setText("profile-name", profile.name || "Atleta");
  setText("profile-goal", profile.goal || "Importe um treino");
  setText("profile-objective", profile.goal || "--");
  setText("profile-weight", formatWeight(profile.weight));
  setText("profile-height", profile.height ? `${formatDecimal(profile.height, 2)} m` : "--");
  setText("profile-level", profile.level || "--");
  setText("profile-time", profile.preferredTime || "--");
  setText("profile-restrictions", profile.restrictions || "--");
}

function renderAll() {
  ensureSelectedDay();
  renderHome();
  renderTraining();
  renderFeedbackScreen();
  renderEvolution();
  renderImport();
  renderProfile();
}

function setupCanvas(id) {
  const canvas = $(id);
  if (!canvas) return null;
  const width = Math.max(280, (canvas.parentElement?.clientWidth || 320) - 32);
  const height = Number(canvas.getAttribute("height")) || 220;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = "12px Trebuchet MS, Segoe UI, sans-serif";
  return { ctx, width, height };
}

function drawEmptyChart(ctx, width, height) {
  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#9AA4B2";
  ctx.textAlign = "center";
  ctx.fillText("Sem dados suficientes", width / 2, height / 2);
}

function drawGrid(ctx, width, height, padding, plotH) {
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  ctx.lineWidth = 1;
  for (let line = 0; line <= 3; line += 1) {
    const y = padding.top + (plotH / 3) * line;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function drawBarChart(id, labels, values) {
  const chart = setupCanvas(id);
  if (!chart) return;
  const { ctx, width, height } = chart;
  const data = values.map(Number).filter((value) => Number.isFinite(value));
  if (!data.length || data.every((value) => value === 0)) return drawEmptyChart(ctx, width, height);

  const padding = { top: 18, right: 10, bottom: 34, left: 34 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data) * 1.15 || 1;
  const gap = 8;
  const barWidth = Math.max(12, (plotW - gap * (data.length - 1)) / data.length);

  drawGrid(ctx, width, height, padding, plotH);

  data.forEach((value, index) => {
    const x = padding.left + index * (barWidth + gap);
    const barHeight = Math.max(4, (value / max) * plotH);
    const y = padding.top + plotH - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, padding.top + plotH);
    gradient.addColorStop(0, "#8DF23F");
    gradient.addColorStop(1, "#1E90FF");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(formatDecimal(value, 1), x + barWidth / 2, y - 6);
    ctx.fillStyle = "#9AA4B2";
    ctx.fillText(labels[index] || "", x + barWidth / 2, height - 10);
  });
}

function drawLineChart(id, labels, values) {
  const chart = setupCanvas(id);
  if (!chart) return;
  const { ctx, width, height } = chart;
  const data = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (data.length < 2) return drawEmptyChart(ctx, width, height);

  const padding = { top: 18, right: 14, bottom: 34, left: 34 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => ({
    x: padding.left + (plotW / Math.max(1, data.length - 1)) * index,
    y: padding.top + plotH - ((value - min) / range) * plotH
  }));

  drawGrid(ctx, width, height, padding, plotH);
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "#8DF23F";
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00AEEF";
    ctx.fill();
    ctx.fillStyle = "#9AA4B2";
    ctx.textAlign = "center";
    ctx.fillText(labels[index] || "", point.x, height - 10);
  });
}

function navTargetFor(screen) {
  if (screen === "feedback") return "trainings";
  if (screen === "import") return "profile";
  if (screen === "onboarding") return "";
  return screen;
}

function goTo(id, persist = true) {
  const target = $(id);
  if (!target) return;

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });

  const activeNav = navTargetFor(id);
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.goto === activeNav);
  });

  if (persist) {
    state.activeScreen = id;
    saveState();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => {
    if (id === "evolution") renderEvolution();
  });
}

function setChoice(group, value) {
  choices[group] = value;
  document.querySelectorAll(`[data-choice-group="${group}"] button`).forEach((button) => {
    button.classList.toggle("selected", button.dataset.value === value);
  });
}

function resetRangeValues(form) {
  ["fatigue", "musclePain", "kneePain", "shinPain", "anklePain"].forEach((name) => {
    const input = form.elements[name];
    if (input) input.value = "0";
    setText(`${name}-value`, "0");
  });
}

function prepareFeedbackForm() {
  const form = $("feedback-form");
  if (!form) return;
  form.reset();
  form.querySelectorAll("[data-mask]").forEach((input) => {
    input.dataset.rawDigits = "";
  });
  choices.feeling = "";
  document.querySelectorAll('[data-choice-group="feeling"] button').forEach((button) => {
    button.classList.remove("selected");
  });
  resetRangeValues(form);
  setText("form-message", "");
}

function validateFeedback(form) {
  const distance = parseDecimal(form.elements.distance.value);
  const time = form.elements.time.value.trim();
  const pace = form.elements.pace.value.trim();

  if (!distance) return "Informe a distância realizada.";
  if (!isValidClock(time, true)) return "Informe o tempo total no formato MM:SS ou HH:MM:SS.";
  if (!isValidClock(pace, false)) return "Informe o pace médio no formato MM:SS.";
  if (!choices.feeling) return "Selecione a sensação do treino.";
  return "";
}

async function loadSamplePlan() {
  try {
    const response = await fetch("sample-workout.json", { cache: "no-store" });
    importPlan(await response.json(), "sample-workout.json");
  } catch {
    alert("Não foi possível carregar o treino de exemplo.");
  }
}

async function handleFile(file) {
  if (!file) return;

  try {
    importPlan(JSON.parse(await file.text()), file.name);
    alert("Treino importado com sucesso.");
  } catch (error) {
    alert(error.message || "Não foi possível importar o treino. Verifique se o arquivo contém app, version, week, athlete, workouts e blocks.");
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function bindEvents() {
  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => goTo(button.dataset.goto));
  });

  $("load-sample-btn")?.addEventListener("click", loadSamplePlan);
  $("import-file-btn")?.addEventListener("click", () => $("import-file")?.click());
  $("import-file")?.addEventListener("change", (event) => {
    handleFile(event.target.files[0]);
    event.target.value = "";
  });

  const dropZone = $("drop-zone");
  if (dropZone) {
    dropZone.addEventListener("click", (event) => {
      if (event.target.id !== "import-file-btn") $("import-file")?.click();
    });
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
      handleFile(event.dataTransfer.files[0]);
    });
  }

  $("finish-workout-btn")?.addEventListener("click", () => {
    const workout = getWorkout();
    if (!workout) return;
    state.feedbackDraftDay = workout.day;
    saveState();
    prepareFeedbackForm();
    renderFeedbackScreen();
    goTo("feedback");
  });

  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (button) setChoice(group.dataset.choiceGroup, button.dataset.value);
    });
  });

  document.querySelectorAll("[data-mask]").forEach((input) => {
    bindClockMask(input, input.dataset.mask);
  });

  const distanceInput = document.querySelector('[name="distance"]');
  if (distanceInput) bindDistanceMask(distanceInput);

  document.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener("input", () => setText(`${input.name}-value`, input.value));
  });

  $("feedback-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = validateFeedback(form);
    if (message) {
      setText("form-message", message);
      return;
    }

    const workout = getWorkout(state.feedbackDraftDay || state.selectedDay);
    const entry = {
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
      date: todayISO(),
      planKey: getPlanKey(),
      week: state.plan?.week || "--",
      day: workout?.day || state.selectedDay || "--",
      workoutTitle: workout?.title || "",
      plannedDistance: Number(workout?.distance || 0),
      distance: parseDecimal(form.elements.distance.value),
      time: form.elements.time.value.trim(),
      pace: form.elements.pace.value.trim(),
      feeling: choices.feeling,
      feelingLabel: FEELINGS[choices.feeling],
      fatigue: Number(form.elements.fatigue.value || 0),
      musclePain: Number(form.elements.musclePain.value || 0),
      kneePain: Number(form.elements.kneePain.value || 0),
      shinPain: Number(form.elements.shinPain.value || 0),
      anklePain: Number(form.elements.anklePain.value || 0),
      notes: String(form.elements.notes.value || "").trim()
    };

    state.feedbacks.push(entry);
    saveState();
    renderAll();
    goTo("home");
    alert("Feedback salvo com sucesso.");
  });

  $("export-data-btn")?.addEventListener("click", () => {
    downloadJson(`corridag-dados-${todayISO()}.json`, {
      app: "CorridaG",
      type: "backup",
      exportedAt: nowISO(),
      state
    });
  });

  $("clear-data-btn")?.addEventListener("click", () => {
    if (!confirm("Apagar todos os dados salvos neste aparelho?")) return;
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    state = freshState();
    renderAll();
    goTo("onboarding");
  });

  window.addEventListener("resize", () => {
    renderEvolution();
  });
}

function init() {
  bindEvents();
  renderAll();
  goTo(state.plan ? state.activeScreen || "home" : "onboarding", false);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init();
