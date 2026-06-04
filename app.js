const STORAGE_KEY = "corridag_tracking_v2";
const LEGACY_STORAGE_KEY = "corridag_official_v1";
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const FEELINGS = {
  muito_dificil: "Muito difícil",
  dificil: "Difícil",
  controlado: "Controlado",
  facil: "Fácil"
};

function freshState() {
  return {
    plan: null,
    selectedDay: null,
    feedbackDraftDay: null,
    feedbacks: [],
    profile: {},
    blockProgress: {},
    weights: [],
    water: {
      date: null,
      amount: 0,
      history: []
    },
    fasting: {
      mode: "none",
      startedAt: null,
      history: []
    },
    lastImport: null,
    lastMessage: null,
    activeHealthTab: "water"
  };
}

function normalizeState(raw = {}) {
  const base = freshState();
  const next = { ...base, ...raw };
  next.profile = { ...base.profile, ...(raw.profile || {}) };
  next.blockProgress = raw.blockProgress || {};
  next.feedbacks = Array.isArray(raw.feedbacks) ? raw.feedbacks : [];
  next.weights = Array.isArray(raw.weights) ? raw.weights : [];
  next.water = { ...base.water, ...(raw.water || {}) };
  next.water.history = Array.isArray(next.water.history) ? next.water.history : [];
  next.fasting = { ...base.fasting, ...(raw.fasting || {}) };
  next.fasting.history = Array.isArray(next.fasting.history) ? next.fasting.history : [];
  return next;
}

function loadState() {
  const keys = [STORAGE_KEY, LEGACY_STORAGE_KEY];

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
const choices = {
  completed: "sim",
  feeling: "controlado",
  fastingMode: state.fasting.mode || "none"
};

const $ = (id) => document.getElementById(id);

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function parseDecimal(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
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

function formatMl(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("pt-BR")} ml`;
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
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (!total) return "--";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  if (minutes) return `${minutes}min ${String(remaining).padStart(2, "0")}s`;
  return `${remaining}s`;
}

function formatPace(seconds) {
  const total = Math.round(seconds || 0);
  if (!total) return "--";
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
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

function hasFeedback(day) {
  const planKey = getPlanKey();
  return state.feedbacks.some((feedback) => feedback.day === day && (!feedback.planKey || feedback.planKey === planKey));
}

function getWorkoutProgress(workout) {
  if (!workout || !Array.isArray(workout.blocks) || workout.blocks.length === 0) {
    return { done: 0, total: 0, percent: 0 };
  }

  const done = workout.blocks.filter((_, index) => isBlockDone(workout.day, index)).length;
  const total = workout.blocks.length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

function isWorkoutComplete(workout) {
  if (isRestWorkout(workout)) return false;
  if (hasFeedback(workout.day)) return true;
  const progress = getWorkoutProgress(workout);
  return progress.total > 0 && progress.done === progress.total;
}

function plannedWorkouts() {
  return getWorkouts().filter((workout) => !isRestWorkout(workout));
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

function currentWeight() {
  const lastWeight = state.weights[state.weights.length - 1]?.weight;
  return lastWeight || state.profile.weight || state.plan?.athlete?.weight || null;
}

function waterGoal() {
  const weight = Number(currentWeight() || 0);
  if (!weight) return 3000;
  const goal = Math.round((weight * 35) / 250) * 250;
  return Math.min(4500, Math.max(2000, goal));
}

function syncWaterDay() {
  const today = todayISO();

  if (!state.water.date) {
    state.water.date = today;
    return;
  }

  if (state.water.date !== today) {
    if (state.water.amount > 0) {
      upsertByDate(state.water.history, {
        date: state.water.date,
        amount: state.water.amount,
        goal: state.water.goal || waterGoal()
      });
    }

    state.water.date = today;
    state.water.amount = 0;
    state.water.goal = waterGoal();
    saveState();
  }
}

function upsertByDate(list, item) {
  const index = list.findIndex((entry) => entry.date === item.date);
  if (index >= 0) list[index] = { ...list[index], ...item };
  else list.push(item);
  list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function addWeight(weight, date = todayISO()) {
  if (!weight) return;
  upsertByDate(state.weights, { date, weight: Number(weight) });
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

function normalizeExternalPlan(data) {
  if (!data || !Array.isArray(data.days)) return data;

  const profile = data.userProfile || {};
  const goal = profile.goal || data.objective || "--";

  return {
    app: "CorridaG",
    version: 2,
    mode: "tracking",
    week: data.week || "Semana importada",
    generatedBy: data.generatedBy || "CorridaG Personal",
    objective: data.objective || goal,
    decision: data.decision || null,
    reason: data.reason || null,
    weeklyTargetKm: Number(data.weeklyTargetKm || 0),
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
    workouts: data.days.map((day) => {
      const distance = Number(day.targetDistance ?? day.distance ?? 0);
      const blocks = Array.isArray(day.blocks) ? day.blocks : [];

      return {
        day: day.day,
        title: day.title,
        distance,
        status: distance <= 0 ? "rest" : "pending",
        blocks: blocks.map((block) => ({
          id: block.id || null,
          from: Number(block.startKm ?? block.from ?? 0),
          to: Number(block.endKm ?? block.to ?? 0),
          type: block.activity || block.type || "Bloco de treino",
          pace: block.pace || "Livre"
        }))
      };
    })
  };
}

function normalizePlan(input) {
  const data = normalizeExternalPlan(input);

  if (!data || (data.app && data.app !== "CorridaG")) {
    throw new Error("Arquivo inválido: este arquivo não parece ser um treino do CorridaG.");
  }

  if (!data.week) {
    throw new Error("Arquivo inválido: informe a semana do treino.");
  }

  if (!data.athlete || typeof data.athlete !== "object") {
    throw new Error("Arquivo inválido: dados do atleta ausentes.");
  }

  if (!Array.isArray(data.workouts) || data.workouts.length === 0) {
    throw new Error("Arquivo inválido: lista de treinos ausente.");
  }

  const workouts = data.workouts.map((workout, index) => {
    if (!workout.day || !workout.title) {
      throw new Error(`Treino ${index + 1} inválido: dia ou título ausente.`);
    }

    const distance = Number(workout.distance || 0);
    const isRest = workout.status === "rest" || distance <= 0;
    const blocks = Array.isArray(workout.blocks) ? workout.blocks : [];

    if (!isRest && blocks.length === 0) {
      throw new Error(`Treino ${workout.day} inválido: blocos ausentes.`);
    }

    return {
      ...workout,
      day: String(workout.day).toUpperCase().slice(0, 3),
      title: String(workout.title),
      distance,
      status: isRest ? "rest" : workout.status || "pending",
      blocks: blocks.map((block) => ({
        from: Number(block.from || 0),
        to: Number(block.to || 0),
        type: String(block.type || "Bloco de treino"),
        pace: String(block.pace || "Livre")
      }))
    };
  });

  return { ...data, workouts };
}

function profileFromPlan(plan) {
  const athlete = plan.athlete || {};

  return {
    name: athlete.name || "Atleta",
    goal: athlete.goal || "--",
    weight: athlete.weight ? Number(athlete.weight) : null,
    height: athlete.height ? Number(athlete.height) : null,
    level: athlete.level || "--",
    preferredTime: athlete.preferredTime || "--",
    restrictions: Array.isArray(athlete.restrictions)
      ? athlete.restrictions.join(", ")
      : athlete.restrictions || "--"
  };
}

function importPlan(data, fileName = "treino.json") {
  const plan = normalizePlan(data);
  state.plan = plan;
  state.profile = profileFromPlan(plan);
  state.selectedDay = plannedWorkouts()[0]?.day || plan.workouts[0]?.day || null;
  state.feedbackDraftDay = null;
  state.lastImport = {
    date: nowISO(),
    fileName,
    week: plan.week
  };

  if (state.profile.weight) addWeight(state.profile.weight);
  syncWaterDay();
  state.water.goal = waterGoal();
  saveState();
  renderAll();
  goTo("home");
}

function restoreBackup(payload) {
  const rawState = payload.state || payload;
  state = normalizeState(rawState);
  choices.fastingMode = state.fasting.mode || "none";
  syncWaterDay();
  saveState();
  renderAll();
  goTo("home");
}

function buildFeedbackMessage(entry) {
  const jointPain = Math.max(entry.kneePain, entry.shinPain, entry.anklePain);

  if (jointPain >= 4) {
    return "Foi registrada dor articular relevante. Use esse dado para conversar com o personal antes de repetir estímulos mais fortes.";
  }

  if (entry.fatigue >= 8 || entry.completed === "nao") {
    return "O treino ficou pesado ou não foi concluído. O registro ficou salvo para orientar um ajuste mais seguro.";
  }

  if (entry.fatigue <= 5 && jointPain === 0 && entry.completed === "sim") {
    return "Treino bem executado. Cansaço controlado e sem dor articular relevante.";
  }

  return "Feedback salvo. Continue registrando os treinos para enxergar o padrão da sua evolução.";
}

function renderHome() {
  syncWaterDay();

  const profile = state.profile || {};
  const firstName = String(profile.name || "atleta").split(" ")[0];
  const planned = plannedWorkouts().length;
  const done = completedWorkouts().length;
  const percent = planned ? Math.round((done / planned) * 100) : 0;
  const next = nextWorkout();
  const feedback = latestFeedback();
  const totalDistance = state.feedbacks.reduce((sum, item) => sum + Number(item.distance || 0), 0);
  const totalTime = state.feedbacks.reduce((sum, item) => sum + timeToSeconds(item.time), 0);
  const paces = state.feedbacks.map((item) => timeToSeconds(item.pace)).filter(Boolean);
  const averagePace = paces.length ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : 0;

  setText("home-greeting", `Olá, ${firstName}`);
  setText("coach-note", state.plan?.coachNote || "Importe o treino da semana para começar o acompanhamento.");
  setText("today-title", next ? `${next.day} - ${next.title}` : "Nenhum treino importado");
  setText("today-detail", next ? `${formatKm(next.distance, 1)} planejados` : "Importe um arquivo .json para visualizar os blocos.");
  setText("week-percent", `${percent}%`);
  setText("week-progress", `${done} de ${planned}`);
  setText("week-label", state.plan?.week || "Sem treino importado");
  setText("total-distance", formatKm(totalDistance, 2));
  setText("water-summary", formatMl(state.water.amount));
  setText("water-goal-summary", `Meta: ${formatMl(waterGoal())}`);
  setText("fasting-summary", getFastingSummary());
  setText("fasting-detail", getFastingDetail());

  const ring = $("week-ring");
  if (ring) ring.style.setProperty("--p", `${percent * 3.6}deg`);

  if (feedback) {
    setText("last-feedback-title", `${feedback.day} - ${formatKm(feedback.distance, 2)} em ${feedback.time}`);
    setText("last-feedback-detail", `${formatPace(timeToSeconds(feedback.pace))}/km. ${state.lastMessage || buildFeedbackMessage(feedback)}`);
  } else {
    setText("last-feedback-title", "Nenhum feedback salvo");
    setText("last-feedback-detail", totalTime || averagePace ? "Você já tem dados parciais registrados." : "Finalize um treino para acompanhar sua evolução.");
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
  const feedbackButton = $("feedback-workout-btn");

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
    else if (isRestWorkout(workout)) {
      status.textContent = "Descanso";
      status.classList.add("warning");
    } else if (isWorkoutComplete(workout)) {
      status.textContent = "Registrado";
      status.classList.add("done");
    } else {
      status.textContent = "Em aberto";
    }
  }

  const list = $("blocks-list");
  if (!list) return;
  list.innerHTML = "";

  if (!workout) {
    list.innerHTML = `
      <article class="block-card">
        <div>
          <strong>Nenhum treino importado</strong>
          <p>Importe um arquivo JSON para visualizar a semana.</p>
        </div>
        <div class="check-circle"></div>
      </article>
    `;
    feedbackButton?.classList.add("hidden");
    return;
  }

  if (isRestWorkout(workout)) {
    list.innerHTML = `
      <article class="block-card">
        <div>
          <strong>Dia de descanso</strong>
          <p>Use este dia para recuperação, hidratação e registro de peso se necessário.</p>
        </div>
        <div class="check-circle"></div>
      </article>
    `;
    feedbackButton?.classList.add("hidden");
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
        <p>${block.type}<br />Pace: ${block.pace}</p>
      </div>
      <div class="check-circle">${done ? "OK" : ""}</div>
    `;
    card.addEventListener("click", () => {
      setBlockDone(workout.day, index, !done);
      renderAll();
    });
    list.appendChild(card);
  });

  if (feedbackButton) {
    feedbackButton.classList.remove("hidden");
    feedbackButton.textContent = hasFeedback(workout.day) ? "Atualizar feedback" : "Registrar feedback";
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

  setText("evolution-count", `${feedbacks.length} registros`);
  setText("month-distance", formatKm(totalDistance, 2));
  setText("done-workouts", String(feedbacks.length));
  setText("pace-average", averagePace ? `${formatPace(averagePace)}/km` : "--");
  setText("current-weight-label", formatWeight(currentWeight()));

  const labels = feedbacks.map((item) => item.day || formatDate(item.date));
  drawBarChart("distance-chart", labels, feedbacks.map((item) => Number(item.distance || 0)), "distance");
  drawLineChart("pace-chart", labels, feedbacks.map((item) => timeToSeconds(item.pace) / 60 || 0), "pace");
  drawLineChart("weight-chart", state.weights.map((item) => formatDate(item.date)), state.weights.map((item) => Number(item.weight || 0)), "weight");
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
        <small>${formatDate(item.date)} · ${item.time} · ${formatPace(timeToSeconds(item.pace))}/km</small>
      </div>
      <span>${item.completed === "nao" ? "Parcial" : "Concluído"}</span>
    </article>
  `).join("");
}

function renderHealth() {
  syncWaterDay();
  renderHealthTabs();
  renderWater();
  renderFasting();
  renderWeight();
}

function renderHealthTabs() {
  document.querySelectorAll("[data-health-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.healthTab === state.activeHealthTab);
  });

  document.querySelectorAll(".health-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `health-${state.activeHealthTab}`);
  });
}

function renderWater() {
  const goal = waterGoal();
  const amount = Number(state.water.amount || 0);
  const percent = goal ? Math.min(100, Math.round((amount / goal) * 100)) : 0;
  const ring = $("water-ring");

  state.water.goal = goal;
  setText("water-amount", formatMl(amount));
  setText("water-percent", `${percent}% da meta`);
  setText("water-guidance", getWaterGuidance(amount, goal));
  if (ring) ring.style.setProperty("--p", `${percent * 3.6}deg`);

  const waterHistory = [...state.water.history, { date: state.water.date || todayISO(), amount, goal }];
  const last = waterHistory.slice(-7);
  drawBarChart("water-chart", last.map((item) => formatDate(item.date)), last.map((item) => Number(item.amount || 0) / 1000), "water");
}

function getWaterGuidance(amount, goal) {
  const percent = goal ? amount / goal : 0;
  if (percent >= 1) return "Meta diária concluída. Mantenha a consistência sem exagerar.";
  if (percent >= 0.65) return "Boa evolução no dia. Complete a meta aos poucos.";
  return "Sua hidratação ainda está baixa para a meta de hoje.";
}

function getFastingSummary() {
  if (state.fasting.startedAt) return formatDuration((Date.now() - new Date(state.fasting.startedAt).getTime()) / 1000);
  if (state.fasting.mode && state.fasting.mode !== "none") return `${state.fasting.mode}h planejado`;
  return "Não ativo";
}

function getFastingDetail() {
  if (state.fasting.startedAt) return "Jejum em andamento";
  if (state.fasting.mode && state.fasting.mode !== "none") return "Janela configurada";
  return "Configure em Saúde";
}

function renderFasting() {
  setChoice("fastingMode", state.fasting.mode || "none", false);
  setText("fasting-status", getFastingSummary());

  const mode = state.fasting.mode;
  let advice = "Jejum é opcional. Use apenas se fizer sentido para sua rotina e energia no treino.";
  if (mode === "12") advice = "Janela de 12h é a opção mais simples para começar sem comprometer a energia.";
  if (mode === "14") advice = "Janela de 14h exige atenção à hidratação e à refeição próxima do treino.";
  if (mode === "16") advice = "Janela de 16h pode ser mais exigente. Observe energia, humor e recuperação.";
  if (state.fasting.startedAt) advice = "Jejum em andamento. Finalize quando encerrar sua janela real.";
  setText("fasting-advice", advice);

  const history = $("fasting-history");
  if (!history) return;
  const items = [...state.fasting.history].reverse().slice(0, 5);
  history.innerHTML = items.length ? items.map((item) => `
    <article class="history-item">
      <div>
        <strong>${formatDuration(item.durationSeconds)}</strong>
        <small>${formatDate(item.date)} · janela ${item.mode}h</small>
      </div>
      <span>Concluído</span>
    </article>
  `).join("") : `
    <article class="history-item">
      <div>
        <strong>Nenhum jejum registrado</strong>
        <small>Os registros aparecerão aqui.</small>
      </div>
    </article>
  `;
}

function renderWeight() {
  const weight = currentWeight();
  setText("health-weight-current", formatWeight(weight));

  const history = $("weight-history");
  if (!history) return;
  const items = [...state.weights].reverse().slice(0, 7);
  history.innerHTML = items.length ? items.map((item) => `
    <article class="history-item">
      <div>
        <strong>${formatWeight(item.weight)}</strong>
        <small>${formatDate(item.date)}</small>
      </div>
      <span>Peso</span>
    </article>
  `).join("") : `
    <article class="history-item">
      <div>
        <strong>Nenhum peso registrado</strong>
        <small>Registre seu peso na aba Saúde.</small>
      </div>
    </article>
  `;
}

function renderImport() {
  if (state.lastImport) {
    setText("last-import-title", state.lastImport.week || "Treino importado");
    setText("last-import-detail", `${state.lastImport.fileName || "arquivo.json"} · ${new Date(state.lastImport.date).toLocaleString("pt-BR")}`);
  } else {
    setText("last-import-title", "Nenhum treino importado");
    setText("last-import-detail", "Você também pode restaurar um backup exportado pelo próprio app.");
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
  renderHealth();
  renderImport();
  renderProfile();
}

function setupCanvas(id) {
  const canvas = $(id);
  if (!canvas) return null;

  const parentWidth = canvas.parentElement?.clientWidth || 320;
  const cssWidth = Math.max(280, parentWidth - 32);
  const cssHeight = Number(canvas.getAttribute("height")) || 220;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.font = "12px Trebuchet MS, Segoe UI, sans-serif";
  ctx.lineWidth = 2;
  return { canvas, ctx, width: cssWidth, height: cssHeight };
}

function chartColor(type) {
  if (type === "pace") return "#8DF23F";
  if (type === "weight") return "#FFFFFF";
  if (type === "water") return "#00AEEF";
  return "#1E90FF";
}

function drawEmptyChart(ctx, width, height, message) {
  ctx.fillStyle = "rgba(255,255,255,.07)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#9AA4B2";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function drawBarChart(id, labels, values, type = "distance") {
  const chart = setupCanvas(id);
  if (!chart) return;

  const { ctx, width, height } = chart;
  const data = values.map(Number).filter((value) => Number.isFinite(value));
  if (!data.length || data.every((value) => value === 0)) {
    drawEmptyChart(ctx, width, height, "Sem dados suficientes");
    return;
  }

  const padding = { top: 18, right: 10, bottom: 34, left: 34 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data) * 1.15 || 1;
  const barGap = 8;
  const barW = Math.max(12, (plotW - barGap * (data.length - 1)) / data.length);
  const color = chartColor(type);

  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.fillStyle = "#9AA4B2";
  ctx.textAlign = "right";

  for (let line = 0; line <= 3; line += 1) {
    const y = padding.top + (plotH / 3) * line;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  data.forEach((value, index) => {
    const x = padding.left + index * (barW + barGap);
    const h = Math.max(4, (value / max) * plotH);
    const y = padding.top + plotH - h;
    const gradient = ctx.createLinearGradient(0, y, 0, padding.top + plotH);
    gradient.addColorStop(0, type === "distance" ? "#8DF23F" : color);
    gradient.addColorStop(1, "#1E90FF");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = "#C8D0DC";
    ctx.textAlign = "center";
    ctx.fillText(formatDecimal(value, type === "water" ? 1 : 1), x + barW / 2, y - 6);
    ctx.fillStyle = "#9AA4B2";
    ctx.fillText(labels[index] || "", x + barW / 2, height - 10);
  });
}

function drawLineChart(id, labels, values, type = "distance") {
  const chart = setupCanvas(id);
  if (!chart) return;

  const { ctx, width, height } = chart;
  const data = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (data.length < 2) {
    drawEmptyChart(ctx, width, height, "Sem dados suficientes");
    return;
  }

  const padding = { top: 18, right: 14, bottom: 34, left: 34 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const color = chartColor(type);
  const points = data.map((value, index) => ({
    x: padding.left + (plotW / Math.max(1, data.length - 1)) * index,
    y: padding.top + plotH - ((value - min) / range) * plotH
  }));

  ctx.strokeStyle = "rgba(255,255,255,.08)";
  for (let line = 0; line <= 3; line += 1) {
    const y = padding.top + (plotH / 3) * line;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = color;
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9AA4B2";
    ctx.textAlign = "center";
    ctx.fillText(labels[index] || "", point.x, height - 10);
    ctx.fillStyle = color;
  });
}

function goTo(id, persist = true) {
  const target = $(id);
  if (!target) return;

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.goto === id);
  });

  if (persist) {
    state.activeScreen = id;
    saveState();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => {
    if (id === "evolution") renderEvolution();
    if (id === "health") renderHealth();
  });
}

function setChoice(group, value, updateState = true) {
  choices[group] = value;
  document.querySelectorAll(`[data-choice-group="${group}"] button`).forEach((button) => {
    button.classList.toggle("selected", button.dataset.value === value);
  });

  if (updateState && group === "fastingMode") {
    state.fasting.mode = value;
    if (value === "none") state.fasting.startedAt = null;
    saveState();
    renderAll();
  }
}

function prepareFeedbackForm(workout) {
  const form = $("feedback-form");
  if (!form) return;
  form.reset();
  form.elements.distance.value = workout?.distance ? String(workout.distance).replace(".", ",") : "";
  form.elements.fatigue.value = "4";
  setText("fatigue-value", "4");
  setChoice("completed", "sim", false);
  setChoice("feeling", "controlado", false);
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
    const data = JSON.parse(await file.text());
    if (data.type === "backup" || data.state) restoreBackup(data);
    else importPlan(data, file.name);
    alert("Arquivo importado com sucesso.");
  } catch (error) {
    alert(error.message || "Não foi possível importar o arquivo.");
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
  $("load-sample-btn-import")?.addEventListener("click", loadSamplePlan);
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

  $("feedback-workout-btn")?.addEventListener("click", () => {
    const workout = getWorkout();
    if (!workout) return;
    const progress = getWorkoutProgress(workout);
    if (progress.total && progress.done < progress.total) {
      const proceed = confirm("Ainda existem blocos não marcados. Deseja registrar o feedback mesmo assim?");
      if (!proceed) return;
    }
    state.feedbackDraftDay = workout.day;
    saveState();
    prepareFeedbackForm(workout);
    renderFeedbackScreen();
    goTo("feedback");
  });

  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;
      setChoice(group.dataset.choiceGroup, button.dataset.value);
    });
  });

  $("fatigue")?.addEventListener("input", (event) => {
    setText("fatigue-value", event.target.value);
  });

  $("feedback-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const workout = getWorkout(state.feedbackDraftDay || state.selectedDay);
    const data = new FormData(form);
    const entry = {
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
      date: todayISO(),
      planKey: getPlanKey(),
      week: state.plan?.week || "--",
      day: workout?.day || state.selectedDay || "--",
      workoutTitle: workout?.title || "",
      plannedDistance: Number(workout?.distance || 0),
      completed: choices.completed,
      distance: parseDecimal(data.get("distance")),
      time: String(data.get("time") || "").trim(),
      pace: String(data.get("pace") || "").trim(),
      feeling: choices.feeling,
      feelingLabel: FEELINGS[choices.feeling] || "Controlado",
      fatigue: Number(data.get("fatigue") || 0),
      musclePain: Number(data.get("musclePain") || 0),
      kneePain: Number(data.get("kneePain") || 0),
      shinPain: Number(data.get("shinPain") || 0),
      anklePain: Number(data.get("anklePain") || 0),
      influence: String(data.get("influence") || "nada"),
      notes: String(data.get("notes") || "").trim()
    };

    state.feedbacks.push(entry);
    state.lastMessage = buildFeedbackMessage(entry);
    saveState();
    renderAll();
    goTo("home");
    alert("Feedback salvo com sucesso.");
  });

  document.querySelectorAll("[data-health-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeHealthTab = button.dataset.healthTab;
      saveState();
      renderHealth();
    });
  });

  document.querySelectorAll(".water-add").forEach((button) => {
    button.addEventListener("click", () => {
      syncWaterDay();
      state.water.amount = Number(state.water.amount || 0) + Number(button.dataset.amount || 0);
      state.water.goal = waterGoal();
      saveState();
      renderAll();
    });
  });

  $("start-fasting-btn")?.addEventListener("click", () => {
    if (!state.fasting.mode || state.fasting.mode === "none") {
      alert("Escolha uma janela de jejum antes de iniciar.");
      return;
    }
    state.fasting.startedAt = nowISO();
    saveState();
    renderAll();
  });

  $("end-fasting-btn")?.addEventListener("click", () => {
    if (!state.fasting.startedAt) {
      alert("Nenhum jejum em andamento.");
      return;
    }
    const durationSeconds = Math.round((Date.now() - new Date(state.fasting.startedAt).getTime()) / 1000);
    state.fasting.history.push({
      date: todayISO(),
      mode: state.fasting.mode,
      startedAt: state.fasting.startedAt,
      endedAt: nowISO(),
      durationSeconds
    });
    state.fasting.startedAt = null;
    saveState();
    renderAll();
  });

  $("weight-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = parseDecimal(new FormData(event.currentTarget).get("weight"));
    if (!value) return;
    addWeight(value);
    if (state.profile) state.profile.weight = value;
    state.water.goal = waterGoal();
    saveState();
    event.currentTarget.reset();
    renderAll();
  });

  $("export-data-btn")?.addEventListener("click", () => {
    downloadJson(`corridag-backup-${todayISO()}.json`, {
      app: "CorridaG",
      type: "backup",
      exportedAt: nowISO(),
      state
    });
  });

  $("clear-data-btn")?.addEventListener("click", () => {
    const proceed = confirm("Apagar todos os dados salvos neste aparelho?");
    if (!proceed) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    state = freshState();
    choices.completed = "sim";
    choices.feeling = "controlado";
    choices.fastingMode = "none";
    renderAll();
    goTo("onboarding");
  });

  window.addEventListener("resize", () => {
    renderEvolution();
    renderHealth();
  });
}

function init() {
  bindEvents();
  syncWaterDay();
  renderAll();
  goTo(state.plan ? state.activeScreen || "home" : "onboarding", false);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init();
