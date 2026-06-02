const STORAGE_KEY = "corridag-state";
const GOALS = [
  "emagrecimento",
  "saude",
  "condicionamento",
  "esporte",
  "correr 5 km",
  "correr 10 km",
  "sair do sedentarismo"
];
const RESTRICTIONS = [
  "nenhuma",
  "joelho",
  "canela",
  "tornozelo",
  "coluna",
  "pressao alta",
  "diabetes",
  "falta de ar excessiva"
];
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const DAY_INDEX = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 0: "DOM" };
let charts = {};

const initialState = () => ({
  profile: null,
  waterToday: 0,
  waterHistory: [],
  fastingSessions: [],
  weightHistory: [],
  weeklyPlan: null,
  workoutHistory: [],
  decisions: [],
  generatedAt: null,
  version: 1
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...initialState(), ...JSON.parse(raw) } : initialState();
  } catch {
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function currentWeekId(date = new Date()) {
  const first = new Date(date.getFullYear(), 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  return `${date.getFullYear()}-W${Math.ceil((((date - first) / dayMs) + first.getDay() + 1) / 7)}`;
}

function currentDayLabel() {
  return DAY_INDEX[new Date().getDay()];
}

function formatNumber(value, suffix = "") {
  return value || value === 0 ? `${String(value).replace(".", ",")}${suffix}` : "-";
}

function average(items) {
  return items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : 0;
}

function calculateBMI(weight, height) {
  if (!weight || !height) return 0;
  return weight / (height * height);
}

function getLatestWeight() {
  const last = state.weightHistory[state.weightHistory.length - 1];
  return last ? last.value : state.profile?.weight || 0;
}

function getActiveFast() {
  return [...state.fastingSessions].reverse().find((session) => !session.end);
}

function getFastingHours() {
  const active = getActiveFast();
  if (!active) return 0;
  return Math.max(0, (Date.now() - new Date(active.start).getTime()) / 3600000);
}

function getTodayWorkout() {
  const day = currentDayLabel();
  return state.weeklyPlan?.days?.find((item) => item.day === day) || null;
}

function getLastWeekFeedback() {
  const weekId = state.weeklyPlan?.weekId;
  return state.workoutHistory.filter((item) => item.weekId === weekId);
}

function classifyDecision(feedbacks) {
  if (!feedbacks.length) {
    return {
      decision: "MANTER",
      reason: "Ainda nao ha feedback suficiente para ajustar o plano."
    };
  }

  const avgFatigue = average(feedbacks.map((item) => item.fatigue));
  const avgMusclePain = average(feedbacks.map((item) => item.musclePain));
  const jointPainMax = Math.max(...feedbacks.map((item) => Math.max(item.kneePain, item.shinPain, item.anklePain)), 0);
  const incomplete = feedbacks.some((item) => item.completed === false);

  if (jointPainMax >= 4 || avgFatigue >= 8 || incomplete) {
    return {
      decision: "REDUZIR",
      reason: "O historico recente mostrou dor articular relevante, fadiga alta ou incapacidade de concluir o treino."
    };
  }

  if (feedbacks.length >= Math.max(1, state.profile?.days?.length || 0) &&
      jointPainMax === 0 &&
      avgFatigue <= 5) {
    return {
      decision: "EVOLUIR",
      reason: "A semana foi concluida com boa tolerancia, sem dor articular e com cansaco controlado."
    };
  }

  if (avgFatigue <= 6 && avgMusclePain <= 3 && jointPainMax === 0) {
    return {
      decision: "MANTER",
      reason: "Treino bem executado, cansaco controlado e ausencia de dor articular."
    };
  }

  return {
    decision: "MANTER",
    reason: "O sistema vai manter a carga ate consolidar mais sinais de recuperacao."
  };
}

function createBlocks(type, distance, restriction) {
  const lowImpact = ["joelho", "canela", "tornozelo", "coluna"].includes(restriction);

  if (type === "caminhada longa") {
    return [
      { range: "0,0 -> 0,7 km", label: "Caminhada de aquecimento", pace: "10:30-11:30" },
      { range: `0,7 -> ${Math.max(1.5, distance - 0.7).toFixed(1).replace(".", ",")} km`, label: "Caminhada longa sustentada", pace: "9:40-10:40" },
      { range: `${Math.max(1.5, distance - 0.7).toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Desaceleracao e respiracao", pace: "10:50-11:50" }
    ];
  }

  if (lowImpact) {
    return [
      { range: "0,0 -> 0,6 km", label: "Caminhada de aquecimento", pace: "10:50-11:50" },
      { range: `0,6 -> ${Math.max(1.2, distance - 0.6).toFixed(1).replace(".", ",")} km`, label: "Corrida + caminhada de baixo impacto", pace: "9:40-10:40" },
      { range: `${Math.max(1.2, distance - 0.6).toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Caminhada de recuperacao", pace: "10:40-11:20" }
    ];
  }

  if (type === "corrida leve") {
    return [
      { range: "0,0 -> 0,5 km", label: "Caminhada aquecimento", pace: "11:00-12:00" },
      { range: `0,5 -> ${Math.max(0.8, distance * 0.55).toFixed(1).replace(".", ",")} km`, label: "Corrida leve", pace: "8:30-9:30" },
      { range: `${Math.max(0.8, distance * 0.55).toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Caminhada recuperacao", pace: "9:40-10:40" }
    ];
  }

  return [
    { range: "0,0 -> 0,5 km", label: "Caminhada aquecimento", pace: "10:40-11:40" },
    { range: `0,5 -> ${Math.max(1.0, distance * 0.6).toFixed(1).replace(".", ",")} km`, label: "Corrida + caminhada", pace: "8:50-10:00" },
    { range: `${Math.max(1.0, distance * 0.6).toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Caminhada de recuperacao", pace: "9:40-10:40" }
  ];
}

function baseDistance(profile) {
  const levelMap = {
    "iniciante": 2.2,
    "pouco ativo": 4.0,
    "intermediario": 5.0,
    "avancado": 7.0
  };
  let distance = levelMap[profile.level] || 3;

  if (profile.primaryGoal === "emagrecimento") distance += 0.4;
  if (profile.secondaryGoal === "correr 5 km") distance += 0.2;
  if (["joelho", "canela", "tornozelo", "coluna"].includes(profile.restriction)) distance -= 0.8;
  if (profile.age >= 50) distance -= 0.4;

  return Math.max(1.8, Number(distance.toFixed(1)));
}

function planTypeForDay(index, totalDays, profile) {
  const lowImpact = ["joelho", "canela", "tornozelo", "coluna"].includes(profile.restriction);
  if (lowImpact) return index === totalDays - 1 ? "caminhada longa" : "corrida + caminhada";
  if (index === totalDays - 1 && totalDays > 2) return "caminhada longa";
  return index === 1 ? "corrida leve" : "corrida + caminhada";
}

function buildWeeklyPlan(profile) {
  const decisionContext = classifyDecision(getLastWeekFeedback());
  const delta = decisionContext.decision === "EVOLUIR" ? 0.5 : decisionContext.decision === "REDUZIR" ? -0.7 : 0;
  const distance = Math.max(1.8, Number((baseDistance(profile) + delta).toFixed(1)));
  const weekId = currentWeekId();
  const days = (profile.days || []).map((day, index, list) => {
    const type = planTypeForDay(index, list.length, profile);
    const dayDistance = index === list.length - 1 ? distance + 0.4 : distance;
    return {
      day,
      type,
      targetDistance: Number(dayDistance.toFixed(1)),
      status: "pendente",
      blocks: createBlocks(type, dayDistance, profile.restriction)
    };
  });

  return {
    weekId,
    createdAt: new Date().toISOString(),
    decisionBasis: decisionContext.decision,
    decisionReason: decisionContext.reason,
    days
  };
}

function generateCoachMessage() {
  const profile = state.profile;
  if (!profile) {
    return "Preencha seu perfil para que o personal digital calcule risco, regularidade e gere seu primeiro plano semanal.";
  }

  const todayWorkout = getTodayWorkout();
  const waterGap = Math.max(0, 4000 - state.waterToday);
  const fastingHours = getFastingHours();
  const recentDecision = state.decisions[state.decisions.length - 1];

  let message = todayWorkout
    ? `Hoje o foco e ${todayWorkout.type} com alvo de ${todayWorkout.targetDistance.toFixed(1).replace(".", ",")} km.`
    : "Hoje nao ha treino previsto; o sistema pode usar o dia para recuperacao e consolidacao.";

  if (waterGap > 2000) {
    message += " Sua ingestao de agua esta abaixo do recomendado para uma boa recuperacao.";
  }

  if (fastingHours >= 14) {
    message += " O periodo de jejum pode estar impactando energia e recuperacao.";
  }

  if (recentDecision?.decision === "REDUZIR") {
    message += " Como houve sinal de risco recente, a prioridade agora e proteger articulacoes e manter constancia.";
  }

  return message;
}

function generateRecommendations() {
  const recs = [];
  const bmi = calculateBMI(getLatestWeight(), state.profile?.height || 0);
  if (bmi >= 30) recs.push("Prioridade em consistencia e baixo impacto");
  if (state.waterToday < 2000) recs.push("Aumentar hidratacao hoje");
  if (getFastingHours() >= 14) recs.push("Observar energia antes do treino");
  if (state.weeklyPlan?.decisionBasis) recs.push(`Base semanal: ${state.weeklyPlan.decisionBasis}`);
  return recs.length ? recs : ["Plano estavel", "Seguranca primeiro", "Evolucao semanal"];
}

function generateWeeklySummary() {
  const currentFeedbacks = getLastWeekFeedback();
  const decision = classifyDecision(currentFeedbacks);
  const totalKm = currentFeedbacks.reduce((sum, item) => sum + item.distance, 0);
  const avgPace = currentFeedbacks.length ? currentFeedbacks[currentFeedbacks.length - 1].pace : "-";
  const completed = currentFeedbacks.filter((item) => item.completed !== false).length;

  const summary = {
    weekId: state.weeklyPlan?.weekId || currentWeekId(),
    createdAt: new Date().toISOString(),
    decision: decision.decision,
    reason: decision.reason,
    stats: {
      totalKm: Number(totalKm.toFixed(1)),
      avgPace,
      completed,
      waterAverage: Math.round(average(state.waterHistory.slice(-7).map((entry) => entry.amount || 0))),
      currentWeight: getLatestWeight()
    }
  };

  state.decisions.push(summary);
  saveState();
  renderApp();
}

function createDanielDemoState() {
  const demo = initialState();
  demo.profile = {
    name: "Daniel",
    age: 22,
    sex: "masculino",
    weight: 120.5,
    height: 1.8,
    level: "pouco ativo",
    schedule: "apos 18h",
    primaryGoal: "emagrecimento",
    secondaryGoal: "correr 5 km",
    restriction: "nenhuma",
    days: ["SEG", "QUA", "SEX", "DOM"]
  };
  demo.weightHistory = [{ date: todayKey(), value: 120.5 }];
  demo.waterToday = 2500;
  demo.waterHistory = [{ date: todayKey(), amount: 2500 }];
  demo.weeklyPlan = buildWeeklyPlan(demo.profile);
  demo.workoutHistory = [{
    id: crypto.randomUUID(),
    weekId: demo.weeklyPlan.weekId,
    date: todayKey(),
    day: "SEG",
    distance: 4.4,
    duration: "39:54",
    pace: "9:03",
    fatigue: 5,
    musclePain: 2,
    kneePain: 0,
    shinPain: 0,
    anklePain: 0,
    notes: "Cansou um pouco mas controlado. Dor muscular leve. Sem dor articular.",
    completed: true
  }];
  demo.decisions = [{
    weekId: demo.weeklyPlan.weekId,
    createdAt: new Date().toISOString(),
    decision: "MANTER",
    reason: "Treino bem executado. Cansaco controlado e sem dor articular. Nao ha necessidade de alterar o plano da semana.",
    stats: {
      totalKm: 4.4,
      avgPace: "9:03",
      completed: 1,
      waterAverage: 2500,
      currentWeight: 120.5
    }
  }];
  return demo;
}

function setSelectOptions() {
  const goalOptions = GOALS.map((value) => `<option value="${value}">${value}</option>`).join("");
  const restrictionOptions = RESTRICTIONS.map((value) => `<option value="${value}">${value}</option>`).join("");
  document.querySelector('select[name="primaryGoal"]').innerHTML = goalOptions;
  document.querySelector('select[name="secondaryGoal"]').innerHTML = goalOptions;
  document.querySelector('select[name="restriction"]').innerHTML = restrictionOptions;
}

function populateProfileForm() {
  const form = document.getElementById("profile-form");
  if (!state.profile) return form.reset();
  Object.entries(state.profile).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (key === "days") {
      [...form.querySelectorAll('input[name="days"]')].forEach((box) => {
        box.checked = value.includes(box.value);
      });
      return;
    }
    field.value = value;
  });
}

function populateFeedbackDays() {
  const select = document.querySelector('#feedback-form select[name="day"]');
  const days = state.weeklyPlan?.days || [];
  select.innerHTML = days.map((item) => `<option value="${item.day}">${item.day}</option>`).join("");
}

function renderMetrics() {
  const weight = getLatestWeight();
  const bmi = calculateBMI(weight, state.profile?.height || 0);
  const fastHours = getFastingHours();
  const todayWorkout = getTodayWorkout();
  document.getElementById("metric-weight").textContent = weight ? `${weight.toFixed(1).replace(".", ",")} kg` : "-";
  document.getElementById("metric-bmi").textContent = bmi ? `IMC ${bmi.toFixed(1).replace(".", ",")}` : "IMC -";
  document.getElementById("metric-water").textContent = `${state.waterToday} ml`;
  document.getElementById("metric-fasting").textContent = `${fastHours.toFixed(1).replace(".", ",")}h`;
  document.getElementById("metric-fasting-status").textContent = getActiveFast() ? "Sessao ativa" : "Sem sessao ativa";
  document.getElementById("metric-today-type").textContent = todayWorkout ? todayWorkout.type : "Sem plano";
  document.getElementById("metric-today-distance").textContent = todayWorkout ? `${todayWorkout.targetDistance.toFixed(1).replace(".", ",")} km alvo` : "0 km";
}

function renderCoach() {
  document.getElementById("hero-analysis").textContent = generateCoachMessage();
  document.getElementById("coach-message").textContent = generateCoachMessage();
  document.getElementById("water-analysis").textContent = state.waterToday < 4000
    ? `Faltam ${4000 - state.waterToday} ml para a meta diaria.`
    : "Meta de agua atingida para o dia.";
  document.getElementById("fasting-analysis").textContent = getActiveFast()
    ? `Jejum em andamento ha ${getFastingHours().toFixed(1).replace(".", ",")} horas.`
    : "Nenhum jejum ativo no momento.";

  const tags = document.getElementById("recommendations");
  tags.innerHTML = generateRecommendations().map((item) => `<span>${item}</span>`).join("");
}

function renderPlan() {
  const container = document.getElementById("weekly-plan");
  const badge = document.getElementById("week-badge");
  const plan = state.weeklyPlan;

  if (!plan) {
    badge.textContent = "Sem semana ativa";
    container.innerHTML = '<div class="list-item">Gere o plano semanal apos salvar o perfil.</div>';
    return;
  }

  badge.textContent = `${plan.weekId} • ${plan.decisionBasis}`;
  container.innerHTML = plan.days.map((day) => `
    <article class="timeline-item">
      <strong>${day.day} • ${day.type}</strong>
      <p>Meta: ${day.targetDistance.toFixed(1).replace(".", ",")} km</p>
      <div class="timeline-blocks">
        ${day.blocks.map((block, index) => `
          <button class="timeline-block ${block.done ? "done" : ""}" data-day="${day.day}" data-block="${index}">
            <strong>${block.range}</strong><br>${block.label}<br>Pace ${block.pace}
          </button>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderHistory() {
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = state.workoutHistory.length
    ? [...state.workoutHistory].reverse().map((item) => `
      <article class="list-item">
        <strong>${item.day} • ${item.distance.toFixed(1).replace(".", ",")} km</strong>
        <p>${item.duration} • pace ${item.pace}</p>
        <p>Fadiga ${item.fatigue}/10 • Dor muscular ${item.musclePain}/10 • Joelho ${item.kneePain}/10</p>
        <p>${item.notes || "Sem observacoes."}</p>
      </article>
    `).join("")
    : '<article class="list-item">Nenhum treino registrado ainda.</article>';

  const decisionList = document.getElementById("decision-list");
  decisionList.innerHTML = state.decisions.length
    ? [...state.decisions].reverse().map((item) => `
      <article class="list-item">
        <strong>${item.weekId} • ${item.decision}</strong>
        <p>${item.reason}</p>
        <p>${item.stats.totalKm} km na semana • pace ${item.stats.avgPace}</p>
      </article>
    `).join("")
    : '<article class="list-item">Nenhuma decisao semanal registrada.</article>';
}

function destroyCharts() {
  Object.values(charts).forEach((chart) => chart.destroy());
  charts = {};
}

function renderCharts() {
  destroyCharts();
  const weightCtx = document.getElementById("weight-chart");
  const performanceCtx = document.getElementById("performance-chart");
  const recoveryCtx = document.getElementById("recovery-chart");

  charts.weight = new Chart(weightCtx, {
    type: "line",
    data: {
      labels: state.weightHistory.map((item) => item.date),
      datasets: [{ label: "Peso", data: state.weightHistory.map((item) => item.value), borderColor: "#29d3c0", tension: 0.3 }]
    },
    options: baseChartOptions("Peso")
  });

  charts.performance = new Chart(performanceCtx, {
    type: "bar",
    data: {
      labels: state.workoutHistory.map((item) => item.day),
      datasets: [{ label: "Km por treino", data: state.workoutHistory.map((item) => item.distance), backgroundColor: "#3f8cff" }]
    },
    options: baseChartOptions("Performance")
  });

  charts.recovery = new Chart(recoveryCtx, {
    type: "radar",
    data: {
      labels: ["Agua media", "Cansaco", "Dor muscular", "Dor articular"],
      datasets: [{
        label: "Recuperacao",
        data: [
          average(state.waterHistory.slice(-7).map((item) => item.amount || 0)) / 400,
          average(state.workoutHistory.slice(-7).map((item) => item.fatigue || 0)),
          average(state.workoutHistory.slice(-7).map((item) => item.musclePain || 0)),
          average(state.workoutHistory.slice(-7).map((item) => Math.max(item.kneePain || 0, item.shinPain || 0, item.anklePain || 0)))
        ],
        borderColor: "#8ef0a0",
        backgroundColor: "rgba(142, 240, 160, 0.18)"
      }]
    },
    options: baseChartOptions("Recuperacao")
  });
}

function baseChartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#eef7ff" } },
      title: { display: true, text: title, color: "#eef7ff" }
    },
    scales: {
      r: { angleLines: { color: "rgba(255,255,255,0.12)" }, grid: { color: "rgba(255,255,255,0.12)" }, pointLabels: { color: "#eef7ff" }, ticks: { color: "#99abc4" } },
      x: { ticks: { color: "#99abc4" }, grid: { color: "rgba(255,255,255,0.08)" } },
      y: { ticks: { color: "#99abc4" }, grid: { color: "rgba(255,255,255,0.08)" } }
    }
  };
}

function renderApp() {
  populateProfileForm();
  populateFeedbackDays();
  renderMetrics();
  renderCoach();
  renderPlan();
  renderHistory();
  renderCharts();
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });
}

function bindForms() {
  document.getElementById("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    state.profile = {
      name: data.get("name"),
      age: Number(data.get("age")),
      sex: data.get("sex"),
      weight: Number(data.get("weight")),
      height: Number(data.get("height")),
      level: data.get("level"),
      schedule: data.get("schedule"),
      primaryGoal: data.get("primaryGoal"),
      secondaryGoal: data.get("secondaryGoal"),
      restriction: data.get("restriction"),
      days: data.getAll("days")
    };
    state.weightHistory.push({ date: todayKey(), value: state.profile.weight });
    saveState();
    renderApp();
  });

  document.getElementById("feedback-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.weeklyPlan) return;
    const data = new FormData(event.currentTarget);
    const distance = Number(data.get("distance"));
    const entry = {
      id: crypto.randomUUID(),
      weekId: state.weeklyPlan.weekId,
      date: todayKey(),
      day: data.get("day"),
      distance,
      duration: data.get("duration"),
      pace: data.get("pace"),
      fatigue: Number(data.get("fatigue")),
      musclePain: Number(data.get("musclePain")),
      kneePain: Number(data.get("kneePain")),
      shinPain: Number(data.get("shinPain")),
      anklePain: Number(data.get("anklePain")),
      notes: data.get("notes"),
      completed: true
    };
    state.workoutHistory.push(entry);
    const plannedDay = state.weeklyPlan.days.find((item) => item.day === entry.day);
    if (plannedDay) plannedDay.status = "concluido";
    saveState();
    renderApp();
    event.currentTarget.reset();
    populateFeedbackDays();
  });

  document.getElementById("weight-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("weightValue"));
    if (!value) return;
    state.weightHistory.push({ date: todayKey(), value });
    saveState();
    renderApp();
    event.currentTarget.reset();
  });
}

function bindActions() {
  document.getElementById("generate-plan-btn").addEventListener("click", () => {
    if (!state.profile) return;
    state.weeklyPlan = buildWeeklyPlan(state.profile);
    state.generatedAt = new Date().toISOString();
    saveState();
    renderApp();
  });

  document.getElementById("generate-summary-btn").addEventListener("click", generateWeeklySummary);

  document.getElementById("load-demo-btn").addEventListener("click", () => {
    state = createDanielDemoState();
    saveState();
    renderApp();
  });

  document.querySelectorAll(".water-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const amount = Number(button.dataset.amount);
      state.waterToday += amount;
      state.waterHistory.push({ date: todayKey(), amount: state.waterToday });
      saveState();
      renderApp();
    });
  });

  document.getElementById("start-fast-btn").addEventListener("click", () => {
    if (getActiveFast()) return;
    state.fastingSessions.push({ start: new Date().toISOString(), end: null });
    saveState();
    renderApp();
  });

  document.getElementById("end-fast-btn").addEventListener("click", () => {
    const active = getActiveFast();
    if (!active) return;
    active.end = new Date().toISOString();
    active.durationHours = Number(((new Date(active.end) - new Date(active.start)) / 3600000).toFixed(1));
    saveState();
    renderApp();
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `corridag-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    state = { ...initialState(), ...data };
    saveState();
    renderApp();
  });

  document.getElementById("weekly-plan").addEventListener("click", (event) => {
    const button = event.target.closest(".timeline-block");
    if (!button || !state.weeklyPlan) return;
    const day = state.weeklyPlan.days.find((item) => item.day === button.dataset.day);
    const block = day?.blocks?.[Number(button.dataset.block)];
    if (!block) return;
    block.done = !block.done;
    saveState();
    renderPlan();
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

function init() {
  setSelectOptions();
  bindTabs();
  bindForms();
  bindActions();
  renderApp();
  registerServiceWorker();
}

init();
