const STORAGE_KEY = "corridag-v1-state";
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const DAY_INDEX = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 0: "DOM" };
const IMPACT_RESTRICTIONS = ["joelho", "canela", "tornozelo", "coluna"];
const CARDIO_RESTRICTIONS = ["pressao alta", "diabetes"];

const LEVELS = {
  "nunca treinou": { baseKm: 2.5, runRatio: 0, label: "nunca treinou" },
  "retorno": { baseKm: 3.5, runRatio: 0.16, label: "retornando às atividades" },
  "pouco ativo": { baseKm: 4, runRatio: 0.25, label: "pouco ativo" },
  "intermediario": { baseKm: 5, runRatio: 0.45, label: "intermediário" },
  "avancado": { baseKm: 6.5, runRatio: 0.62, label: "avançado" }
};

const GOAL_LABELS = {
  "emagrecimento": "emagrecimento",
  "saude": "saúde",
  "condicionamento": "condicionamento",
  "correr 5 km": "correr 5 km",
  "correr 10 km": "correr 10 km"
};

const RESTRICTION_LABELS = {
  "nenhuma": "nenhuma",
  "joelho": "joelho",
  "canela": "canela",
  "tornozelo": "tornozelo",
  "coluna": "coluna",
  "pressao alta": "pressão alta",
  "diabetes": "diabetes"
};

const initialState = () => ({
  profile: null,
  analysis: null,
  weeklyPlan: null,
  selectedDay: null,
  feedbacks: [],
  decisions: [],
  waterDate: todayKey(),
  waterToday: 0,
  waterHistory: [],
  fastingChoice: "0",
  version: 1
});

let state = loadState();

function loadState() {
  try {
    return { ...initialState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
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

function normalizeDailyState() {
  if (state.waterDate !== todayKey()) {
    state.waterDate = todayKey();
    state.waterToday = 0;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundKm(value) {
  return Math.round(value * 2) / 2;
}

function calculateBMI(profile) {
  if (!profile?.weight || !profile?.height) return 0;
  return profile.weight / (profile.height * profile.height);
}

function parsePaceToSeconds(pace) {
  if (!pace) return 0;
  const [minutes, seconds = "0"] = String(pace).split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return (minutes * 60) + seconds;
}

function formatPace(seconds) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function jointPain(feedback) {
  return Math.max(feedback.kneePain || 0, feedback.shinPain || 0, feedback.anklePain || 0);
}

function waterRange(profile) {
  if (!profile?.weight) return { min: 4000, max: 4000, target: 4000 };
  const min = clamp(Math.round((profile.weight * 33) / 250) * 250, 2000, 4500);
  const max = clamp(Math.round((profile.weight * 37) / 250) * 250, min, 5000);
  return { min, max, target: Math.round(((min + max) / 2) / 250) * 250 };
}

function buildProfileFromForm(form) {
  const data = new FormData(form);
  return {
    name: data.get("name").trim(),
    age: Number(data.get("age")),
    sex: data.get("sex"),
    weight: Number(data.get("weight")),
    height: Number(data.get("height")),
    level: data.get("level"),
    goal: data.get("goal"),
    schedule: data.get("schedule"),
    restriction: data.get("restriction"),
    days: data.getAll("days"),
    walksNow: data.get("walksNow"),
    runsNow: data.get("runsNow"),
    walkKm: Number(data.get("walkKm") || 0),
    runKm: Number(data.get("runKm") || 0),
    lastWorkout: data.get("lastWorkout").trim(),
    lastPace: data.get("lastPace").trim()
  };
}

function analyzeProfile(profile) {
  const bmi = calculateBMI(profile);
  const level = LEVELS[profile.level] || LEVELS["nunca treinou"];
  const restriction = profile.restriction;
  let risk = 0;
  let distance = level.baseKm;
  let runRatio = level.runRatio;
  const reasons = [];

  if (bmi >= 35) {
    risk += 3;
    distance -= 0.7;
    runRatio -= 0.16;
    reasons.push("o peso atual aumenta o impacto articular");
  } else if (bmi >= 30) {
    risk += 2;
    distance -= 0.3;
    runRatio -= 0.08;
    reasons.push("o IMC pede progressão conservadora");
  }

  if (profile.age >= 55) {
    risk += 2;
    distance -= 0.4;
    runRatio -= 0.08;
    reasons.push("a idade exige mais margem de recuperação");
  }

  if (IMPACT_RESTRICTIONS.includes(restriction)) {
    risk += 3;
    distance -= 0.8;
    runRatio -= 0.2;
    reasons.push(`há restrição em ${RESTRICTION_LABELS[restriction]}`);
  }

  if (CARDIO_RESTRICTIONS.includes(restriction)) {
    risk += 2;
    distance -= 0.4;
    runRatio -= 0.1;
    reasons.push(`${RESTRICTION_LABELS[restriction]} pede intensidade controlada`);
  }

  if (profile.goal === "emagrecimento") {
    distance += 0.2;
    runRatio -= 0.04;
    reasons.push("emagrecimento combina melhor com constância e baixo impacto no início");
  }

  if (profile.goal === "correr 5 km") {
    distance += 0.4;
    runRatio += 0.08;
    reasons.push("o objetivo de 5 km pede aproximação gradual");
  }

  if (profile.goal === "correr 10 km") {
    distance += 0.7;
    runRatio += 0.08;
    reasons.push("o objetivo de 10 km exige volume semanal progressivo");
  }

  if (profile.walksNow === "sim" && profile.walkKm > 0) {
    distance = Math.max(distance, Math.min(profile.walkKm, distance + 0.8));
  }

  if (profile.runsNow === "sim" && profile.runKm > 0) {
    runRatio += 0.1;
    distance = Math.max(distance, Math.min(profile.runKm + 1, distance + 0.8));
  }

  const lastPace = parsePaceToSeconds(profile.lastPace);
  if (lastPace && lastPace >= 660) {
    runRatio -= 0.06;
    reasons.push("o pace recente indica prioridade em base aeróbica");
  }

  if (profile.days.length <= 2) {
    distance -= 0.2;
    reasons.push("com poucos dias disponíveis, o plano precisa ser simples e consistente");
  }

  if (bmi >= 35 || IMPACT_RESTRICTIONS.includes(restriction)) {
    distance = Math.min(distance, level.baseKm);
  }

  const riskLevel = risk >= 6 ? "alto" : risk >= 3 ? "moderado" : "baixo";
  distance = clamp(roundKm(distance), 2, 8);
  runRatio = clamp(runRatio, 0, 0.65);

  const pace = paceGuide({ riskLevel, runRatio, level: profile.level });
  const frequency = Math.min(profile.days.length, profile.level === "avancado" ? 5 : 4);
  const analysisText = buildAnalysisText(profile, { bmi, level, riskLevel, distance, runRatio, pace, frequency, reasons });

  return { bmi, riskLevel, distance, runRatio, pace, frequency, reasons, text: analysisText };
}

function paceGuide(analysis) {
  if (analysis.riskLevel === "alto" || analysis.runRatio <= 0.05) {
    return { walk: "11:00-12:00", run: "9:40-10:40", recovery: "10:00-11:00" };
  }
  if (analysis.riskLevel === "moderado") {
    return { walk: "10:30-11:30", run: "8:50-9:50", recovery: "9:40-10:40" };
  }
  if (analysis.level === "avancado") {
    return { walk: "9:40-10:40", run: "7:30-8:30", recovery: "9:10-10:10" };
  }
  return { walk: "10:50-11:50", run: "8:30-9:30", recovery: "9:30-10:30" };
}

function buildAnalysisText(profile, analysis) {
  const name = profile.name || "Usuário";
  const goal = GOAL_LABELS[profile.goal] || profile.goal;
  const height = profile.height.toFixed(2).replace(".", ",");
  const weight = profile.weight.toFixed(1).replace(".", ",");
  const reasons = analysis.reasons.length
    ? analysis.reasons.map((reason) => `- ${reason}.`).join("\n")
    : "- seu perfil permite iniciar com uma carga controlada.";

  const runningExplanation = analysis.runRatio <= 0.08
    ? "Não coloquei corrida contínua porque a prioridade inicial é adaptação e proteção articular."
    : "A corrida aparece em blocos curtos para evoluir sem transformar o treino em esforço contínuo.";

  return `${name},

Você possui ${weight} kg, ${height} m de altura e está em nível ${LEVELS[profile.level].label}.

Seu objetivo principal é ${goal}.

Minha decisão para esta primeira semana:

Distância inicial: ${analysis.distance.toFixed(1).replace(".", ",")} km
Frequência: ${analysis.frequency} treino(s) na semana
Pace de caminhada: ${analysis.pace.walk}
Pace de corrida leve: ${analysis.pace.run}

Por que essa escolha:
${reasons}

Coloquei caminhada porque ela cria consistência com menor impacto.
${runningExplanation}

O foco da semana é simples: executar, observar cansaço e evitar dor articular.`;
}

function buildWeeklyPlan(profile, analysis, previousDecision = "MANTER") {
  const weekId = currentWeekId();
  const distanceAdjustment = previousDecision === "EVOLUIR" ? 0.5 : previousDecision === "REDUZIR" ? -0.7 : 0;
  const baseDistance = clamp(roundKm(analysis.distance + distanceAdjustment), 1.5, 10);
  const trainingDays = profile.days.slice(0, analysis.frequency);

  const days = trainingDays.map((day, index) => {
    const isLong = index === trainingDays.length - 1 && trainingDays.length >= 3;
    const distance = isLong ? clamp(roundKm(baseDistance + 0.5), 1.5, 10) : baseDistance;
    const type = chooseWorkoutType(analysis, isLong);
    return {
      day,
      type,
      targetDistance: distance,
      blocks: createWorkoutBlocks(distance, analysis, type),
      status: "pendente"
    };
  });

  return { weekId, createdAt: new Date().toISOString(), decisionBasis: previousDecision, days };
}

function chooseWorkoutType(analysis, isLong) {
  if (isLong) return "Caminhada longa";
  if (analysis.riskLevel === "alto" || analysis.runRatio <= 0.05) return "Caminhada de recuperação";
  return "Corrida + caminhada";
}

function createWorkoutBlocks(distance, analysis, type) {
  const blocks = [];
  let current = 0;
  const addBlock = (length, label, pace) => {
    const start = current;
    const end = Math.min(distance, current + length);
    if (end <= start) return;
    blocks.push({
      range: `${start.toFixed(1).replace(".", ",")} → ${end.toFixed(1).replace(".", ",")} km`,
      label,
      pace,
      done: false
    });
    current = end;
  };

  addBlock(0.5, "Caminhada aquecimento", analysis.pace.walk);

  if (type === "Caminhada de recuperação" || type === "Caminhada longa") {
    addBlock(Math.max(distance - 1, 0.5), type, analysis.pace.recovery);
    addBlock(distance - current, "Caminhada final", analysis.pace.recovery);
    return blocks;
  }

  while (current < distance - 0.7) {
    addBlock(0.3, "Corrida leve", analysis.pace.run);
    addBlock(0.7, "Caminhada recuperação", analysis.pace.recovery);
  }
  addBlock(distance - current, "Caminhada final", analysis.pace.recovery);
  return blocks;
}

function evaluateFeedback(feedback) {
  const pain = jointPain(feedback);
  if (pain >= 4 || feedback.fatigue >= 8 || !feedback.completed) {
    return {
      decision: "REDUZIR",
      text: pain >= 4
        ? "Foi detectada dor articular relevante.\n\nPor segurança, os próximos treinos da semana serão reduzidos para caminhada ativa."
        : "O treino mostrou sinal de fadiga ou dificuldade de conclusão.\n\nPor segurança, o próximo treino será reduzido."
    };
  }

  const weekFeedbacks = [...state.feedbacks, feedback].filter((item) => item.weekId === state.weeklyPlan?.weekId);
  const plannedDays = state.weeklyPlan?.days.length || 0;
  const allDone = plannedDays > 0 && weekFeedbacks.length >= plannedDays && weekFeedbacks.every((item) => item.completed);
  const noPain = weekFeedbacks.every((item) => jointPain(item) === 0);
  const fatigueOk = average(weekFeedbacks.map((item) => item.fatigue)) <= 5;

  if (allDone && noPain && fatigueOk) {
    return {
      decision: "EVOLUIR",
      text: "Semana concluída com sucesso.\n\nVocê completou todos os treinos, manteve o cansaço controlado e não registrou dor articular.\n\nA evolução entra apenas na próxima semana."
    };
  }

  if (feedback.completed && feedback.fatigue <= 6 && pain <= 2) {
    return {
      decision: "MANTER",
      text: "Treino bem executado.\n\nVocê completou a distância proposta.\n\nO cansaço permaneceu controlado.\n\nNão houve sinais de dor articular.\n\nNão há necessidade de alterar o plano da semana."
    };
  }

  return {
    decision: "MANTER",
    text: "O treino foi registrado.\n\nAinda não há motivo para alterar o plano da semana. Continue observando cansaço e sinais articulares."
  };
}

function reducePendingWorkouts() {
  if (!state.weeklyPlan) return;
  state.weeklyPlan.days.forEach((day) => {
    if (day.status === "pendente") {
      day.type = "Caminhada de recuperação";
      day.blocks = createWorkoutBlocks(Math.max(1.5, day.targetDistance - 1), state.analysis, day.type);
      day.targetDistance = Math.max(1.5, day.targetDistance - 1);
    }
  });
}

function fastingGuidance(profile, choice = state.fastingChoice) {
  if (!profile) return "Preencha o perfil para receber uma sugestão.";
  if (choice === "0") return "Sem jejum registrado. Mantenha alimentação leve e hidratação adequada antes do treino.";

  if (profile.schedule === "apos 18h" || profile.schedule === "noite") {
    return `Como você treina ${profile.schedule === "apos 18h" ? "após 18h" : "à noite"}, recomendo começar com ${choice === "16" ? "12h ou 14h" : `${choice}h`} e observar energia no treino.`;
  }

  return `Jejum de ${choice}h registrado. Se o treino perder qualidade, reduza a janela antes de tentar evoluir.`;
}

function activateTab(tabId) {
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  document.getElementById(tabId)?.classList.add("active");
}

function selectedPlanDay() {
  if (!state.weeklyPlan?.days.length) return null;
  if (state.selectedDay && state.weeklyPlan.days.some((day) => day.day === state.selectedDay)) return state.selectedDay;
  const today = DAY_INDEX[new Date().getDay()];
  return state.weeklyPlan.days.some((day) => day.day === today) ? today : state.weeklyPlan.days[0].day;
}

function render() {
  normalizeDailyState();
  renderProfile();
  renderAnalysis();
  renderTraining();
  renderFeedbackDays();
  renderWater();
  renderFasting();
  renderHistory();
  saveState();
}

function renderProfile() {
  if (!state.profile) return;
  const form = document.getElementById("profile-form");
  Object.entries(state.profile).forEach(([key, value]) => {
    if (key === "days") {
      form.querySelectorAll('input[name="days"]').forEach((input) => {
        input.checked = value.includes(input.value);
      });
      return;
    }
    if (form.elements[key]) form.elements[key].value = value;
  });
}

function renderAnalysis() {
  const text = state.analysis?.text || "Preencha o perfil para receber a análise.";
  document.getElementById("personal-analysis").textContent = text;
  document.getElementById("analysis-distance").textContent = state.analysis ? `${state.analysis.distance.toFixed(1).replace(".", ",")} km` : "-";
  document.getElementById("analysis-frequency").textContent = state.analysis ? `${state.analysis.frequency}x/semana` : "-";
  document.getElementById("analysis-pace").textContent = state.analysis ? state.analysis.pace.walk : "-";
}

function renderTraining() {
  const tabs = document.getElementById("week-tabs");
  const card = document.getElementById("weekly-training");
  if (!state.weeklyPlan?.days.length) {
    tabs.innerHTML = "";
    card.innerHTML = "<p>Preencha o perfil para gerar o treino da semana.</p>";
    return;
  }

  const currentDay = selectedPlanDay();
  state.selectedDay = currentDay;
  tabs.innerHTML = state.weeklyPlan.days.map((day) => `
    <button type="button" class="${day.day === currentDay ? "active" : ""}" data-day="${day.day}">${day.day}</button>
  `).join("");

  const workout = state.weeklyPlan.days.find((day) => day.day === currentDay);
  const done = workout.blocks.filter((block) => block.done).length;
  const progress = Math.round((done / workout.blocks.length) * 100);
  card.innerHTML = `
    <h2>${workout.day} — ${workout.type}</h2>
    <p class="training-meta">Meta: ${workout.targetDistance.toFixed(1).replace(".", ",")} km</p>
    <div class="progress-track"><span class="progress-fill" style="--progress:${progress}%"></span></div>
    <p class="training-meta">Progresso: ${progress}%</p>
    <div class="block-list">
      ${workout.blocks.map((block, index) => `
        <button type="button" class="training-block ${block.done ? "done" : ""}" data-day="${workout.day}" data-block="${index}">
          <strong>${block.range}</strong>
          ${block.label}<br>
          Pace ${block.pace}
        </button>
      `).join("")}
    </div>
  `;
}

function renderFeedbackDays() {
  const select = document.querySelector('#feedback-form select[name="day"]');
  select.innerHTML = (state.weeklyPlan?.days || []).map((day) => `<option value="${day.day}">${day.day}</option>`).join("");
}

function renderWater() {
  const range = waterRange(state.profile);
  const percent = clamp(Math.round((state.waterToday / range.target) * 100), 0, 100);
  document.getElementById("water-goal").textContent = state.profile
    ? `${(range.min / 1000).toFixed(1).replace(".", ",")} a ${(range.max / 1000).toFixed(1).replace(".", ",")} L`
    : "-";
  document.getElementById("water-guidance").textContent = state.profile
    ? `Pelo seu peso atual, a meta prática fica em torno de ${(range.target / 1000).toFixed(1).replace(".", ",")} L por dia.`
    : "Preencha o perfil para calcular a meta.";
  document.getElementById("water-total").textContent = `${state.waterToday} ml registrados`;
  document.getElementById("water-progress").style.setProperty("--progress", `${percent}%`);
}

function renderFasting() {
  document.querySelector('#fasting-form select[name="fasting"]').value = state.fastingChoice || "0";
  document.getElementById("fasting-guidance").textContent = fastingGuidance(state.profile);
}

function renderHistory() {
  const list = document.getElementById("history-list");
  if (!state.decisions.length) {
    list.innerHTML = '<article class="history-item"><strong>Nenhum feedback registrado ainda.</strong><p>Após o primeiro treino, a decisão do personal aparecerá aqui.</p></article>';
    return;
  }

  list.innerHTML = [...state.decisions].reverse().map((item) => `
    <article class="history-item">
      <strong>${item.weekId}</strong>
      <p>Treino: ${item.day}</p>
      <p>Meta: ${item.targetDistance.toFixed(1).replace(".", ",")} km</p>
      <p>Realizado: ${item.distance.toFixed(1).replace(".", ",")} km</p>
      <p>Pace: ${item.pace}</p>
      <p>Decisão: ${item.decision}</p>
    </article>
  `).join("");
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.getElementById("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const profile = buildProfileFromForm(event.currentTarget);
    if (!profile.days.length) {
      alert("Selecione pelo menos um dia disponível.");
      return;
    }
    state.profile = profile;
    state.analysis = analyzeProfile(profile);
    state.weeklyPlan = buildWeeklyPlan(profile, state.analysis);
    state.selectedDay = state.weeklyPlan.days[0]?.day || null;
    saveState();
    render();
    activateTab("analysis");
  });

  document.getElementById("week-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    state.selectedDay = button.dataset.day;
    renderTraining();
    saveState();
  });

  document.getElementById("weekly-training").addEventListener("click", (event) => {
    const button = event.target.closest("[data-block]");
    if (!button || !state.weeklyPlan) return;
    const workout = state.weeklyPlan.days.find((day) => day.day === button.dataset.day);
    const block = workout?.blocks[Number(button.dataset.block)];
    if (!block) return;
    block.done = !block.done;
    renderTraining();
    saveState();
  });

  document.getElementById("feedback-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.weeklyPlan) {
      alert("Gere o treino da semana antes de registrar feedback.");
      return;
    }
    const data = new FormData(event.currentTarget);
    const day = data.get("day");
    const workout = state.weeklyPlan.days.find((item) => item.day === day);
    const feedback = {
      id: uniqueId(),
      weekId: state.weeklyPlan.weekId,
      day,
      completed: data.get("completed") === "true",
      distance: Number(data.get("distance")),
      duration: data.get("duration"),
      pace: data.get("pace"),
      fatigue: Number(data.get("fatigue")),
      musclePain: Number(data.get("musclePain")),
      kneePain: Number(data.get("kneePain")),
      shinPain: Number(data.get("shinPain")),
      anklePain: Number(data.get("anklePain")),
      notes: data.get("notes"),
      createdAt: new Date().toISOString()
    };
    const response = evaluateFeedback(feedback);
    feedback.decision = response.decision;
    feedback.response = response.text;
    state.feedbacks.push(feedback);
    if (workout) workout.status = "feito";
    if (response.decision === "REDUZIR") reducePendingWorkouts();
    state.decisions.push({
      weekId: feedback.weekId,
      day,
      targetDistance: workout?.targetDistance || 0,
      distance: feedback.distance,
      pace: feedback.pace,
      decision: response.decision
    });
    document.getElementById("coach-response").classList.remove("hidden");
    document.getElementById("coach-response").textContent = response.text;
    event.currentTarget.reset();
    saveState();
    render();
  });

  document.querySelectorAll(".water-btn").forEach((button) => {
    button.addEventListener("click", () => {
      normalizeDailyState();
      state.waterToday += Number(button.dataset.amount);
      state.waterHistory.push({ date: todayKey(), amount: state.waterToday });
      render();
    });
  });

  document.getElementById("fasting-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.fastingChoice = new FormData(event.currentTarget).get("fasting");
    render();
  });

  document.getElementById("reset-week-btn").addEventListener("click", () => {
    if (!state.profile) {
      activateTab("profile");
      return;
    }
    state.analysis = analyzeProfile(state.profile);
    const lastDecision = state.feedbacks.at(-1)?.decision || "MANTER";
    state.weeklyPlan = buildWeeklyPlan(state.profile, state.analysis, lastDecision === "EVOLUIR" ? "EVOLUIR" : "MANTER");
    state.selectedDay = state.weeklyPlan.days[0]?.day || null;
    render();
    activateTab("training");
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
    try {
      state = { ...initialState(), ...JSON.parse(await file.text()) };
      render();
    } catch {
      alert("Não foi possível importar este arquivo JSON.");
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

bindEvents();
render();
if (state.profile) activateTab("analysis");
registerServiceWorker();
