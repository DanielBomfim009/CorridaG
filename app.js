const STORAGE_KEY = "corridag-personal-v1";

const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const DAY_BY_DATE = { 0: "DOM", 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB" };
const IMPACT_RESTRICTIONS = ["joelho", "canela", "tornozelo", "coluna"];
const CARDIO_RESTRICTIONS = ["pressao alta", "diabetes"];

const LEVELS = {
  "nunca treinou": { label: "nunca treinou", baseKm: 2.5, runRatio: 0, idealDays: 2 },
  "retorno": { label: "retornando", baseKm: 3.5, runRatio: 0.14, idealDays: 3 },
  "pouco ativo": { label: "pouco ativo", baseKm: 4, runRatio: 0.24, idealDays: 3 },
  "intermediario": { label: "intermediário", baseKm: 5, runRatio: 0.42, idealDays: 4 },
  "avancado": { label: "avançado", baseKm: 6.5, runRatio: 0.58, idealDays: 5 }
};

const LABELS = {
  goal: {
    emagrecimento: "emagrecimento",
    saude: "saúde",
    condicionamento: "condicionamento",
    "correr 5 km": "correr 5 km",
    "correr 10 km": "correr 10 km"
  },
  schedule: {
    manha: "manhã",
    tarde: "tarde",
    noite: "noite",
    "apos 18h": "após 18h"
  },
  restriction: {
    nenhuma: "nenhuma",
    joelho: "joelho",
    canela: "canela",
    tornozelo: "tornozelo",
    coluna: "coluna",
    "pressao alta": "pressão alta",
    diabetes: "diabetes"
  }
};

const defaultDecision = () => ({
  status: "Aguardando",
  text: "Preencha o perfil para que o personal digital avalie seu ponto de partida."
});

const initialState = () => ({
  profile: null,
  analysis: null,
  plan: null,
  selectedDay: null,
  feedbacks: [],
  decision: defaultDecision(),
  water: { date: todayKey(), amount: 0, history: [] },
  fasting: "0",
  weights: []
});

let state = loadState();

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

function loadState() {
  try {
    return mergeState(initialState(), JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch {
    return initialState();
  }
}

function mergeState(base, saved) {
  return {
    ...base,
    ...saved,
    water: { ...base.water, ...(saved.water || {}) },
    decision: { ...base.decision, ...(saved.decision || {}) }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function currentWeekId(date = new Date()) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  const week = Math.ceil((((date - firstDay) / dayMs) + firstDay.getDay() + 1) / 7);
  return `${date.getFullYear()}-S${String(week).padStart(2, "0")}`;
}

function normalizeDailyState() {
  if (state.water.date !== todayKey()) {
    state.water.history.push({ date: state.water.date, amount: state.water.amount });
    state.water.date = todayKey();
    state.water.amount = 0;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}

function formatKm(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")} km`;
}

function formatWeight(value) {
  return value ? `${Number(value).toFixed(1).replace(".", ",")} kg` : "-";
}

function firstName() {
  return state.profile?.name?.trim().split(/\s+/)[0] || "Você";
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bmi(profile) {
  if (!profile?.height || !profile?.weight) return 0;
  return profile.weight / (profile.height * profile.height);
}

function parsePaceSeconds(pace) {
  if (!pace) return 0;
  const [minutes, seconds = "0"] = String(pace).split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return (minutes * 60) + seconds;
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function waterGoal(profile) {
  if (!profile?.weight) return { min: 0, max: 0, target: 0 };
  const min = clamp(Math.round((profile.weight * 33) / 250) * 250, 1800, 4500);
  const max = clamp(Math.round((profile.weight * 37) / 250) * 250, min, 5000);
  const target = Math.round(((min + max) / 2) / 250) * 250;
  return { min, max, target };
}

function buildProfile(form) {
  const data = new FormData(form);
  return {
    name: String(data.get("name") || "").trim(),
    age: Number(data.get("age")),
    weight: Number(data.get("weight")),
    height: Number(data.get("height")),
    targetWeight: Number(data.get("targetWeight") || 0),
    level: data.get("level"),
    goal: data.get("goal"),
    schedule: data.get("schedule"),
    restriction: data.get("restriction"),
    days: data.getAll("days"),
    walksNow: data.get("walksNow"),
    runsNow: data.get("runsNow"),
    lastPace: String(data.get("lastPace") || "").trim()
  };
}

function analyzeProfile(profile) {
  const level = LEVELS[profile.level] || LEVELS["nunca treinou"];
  const profileBmi = bmi(profile);
  const reasons = [];
  let risk = 0;
  let distance = level.baseKm;
  let runRatio = level.runRatio;

  if (profileBmi >= 35) {
    risk += 3;
    runRatio -= 0.12;
    reasons.push("seu peso atual aumenta o impacto nas articulações");
  } else if (profileBmi >= 30) {
    risk += 2;
    runRatio -= 0.08;
    reasons.push("o IMC pede uma evolução mais conservadora");
  }

  if (profile.age >= 55) {
    risk += 1;
    distance -= 0.3;
    runRatio -= 0.06;
    reasons.push("sua idade pede um pouco mais de margem de recuperação");
  }

  if (IMPACT_RESTRICTIONS.includes(profile.restriction)) {
    risk += 4;
    distance -= 0.8;
    runRatio -= 0.22;
    reasons.push(`a restrição em ${LABELS.restriction[profile.restriction]} exige reduzir impacto`);
  }

  if (CARDIO_RESTRICTIONS.includes(profile.restriction)) {
    risk += 2;
    distance -= 0.3;
    runRatio -= 0.08;
    reasons.push(`${LABELS.restriction[profile.restriction]} pede intensidade controlada`);
  }

  if (profile.level === "nunca treinou" || profile.level === "retorno") {
    reasons.push("o corpo precisa de uma fase curta de adaptação antes de aumentar volume");
  }

  if (profile.goal === "emagrecimento") {
    reasons.push("para emagrecimento, constância vale mais que intensidade alta no início");
  }

  if (profile.goal === "correr 5 km") {
    runRatio += 0.06;
    reasons.push("o objetivo de 5 km entra por blocos curtos, não por corrida contínua imediata");
  }

  if (profile.goal === "correr 10 km") {
    distance += 0.4;
    runRatio += 0.08;
    reasons.push("o objetivo de 10 km exige volume, mas a progressão precisa ser semanal");
  }

  if (profile.walksNow === "sim" && profileBmi < 35 && !IMPACT_RESTRICTIONS.includes(profile.restriction)) {
    distance += 0.3;
  }

  if (profile.runsNow === "sim" && risk < 4) {
    runRatio += 0.08;
  }

  const recentPace = parsePaceSeconds(profile.lastPace);
  if (recentPace >= 660) {
    runRatio -= 0.05;
    reasons.push("o pace recente indica que a prioridade deve ser base aeróbica");
  }

  if (profile.days.length <= 2) {
    reasons.push("com poucos dias disponíveis, a semana precisa ser simples e repetível");
  }

  if (profileBmi >= 35 || IMPACT_RESTRICTIONS.includes(profile.restriction)) {
    distance = Math.min(distance, level.baseKm);
  }

  const riskLevel = risk >= 5 ? "alto" : risk >= 2 ? "moderado" : "baixo";
  const frequency = Math.max(1, Math.min(profile.days.length, level.idealDays));
  distance = clamp(roundHalf(distance), 2, 8);
  runRatio = clamp(runRatio, 0, 0.65);

  const pace = paceGuide({ riskLevel, runRatio, level: profile.level });
  const type = runRatio <= 0.05 || riskLevel === "alto" ? "Caminhada orientada" : "Corrida + Caminhada";

  return {
    bmi: profileBmi,
    riskLevel,
    distance,
    frequency,
    runRatio,
    pace,
    type,
    reasons,
    text: buildPersonalAnalysis(profile, {
      distance,
      frequency,
      type,
      pace,
      riskLevel,
      reasons
    }),
    distanceReason: distanceReason(profile, riskLevel),
    paceReason: paceReason(riskLevel, runRatio),
    frequencyReason: frequencyReason(profile, frequency)
  };
}

function paceGuide({ riskLevel, runRatio, level }) {
  if (riskLevel === "alto" || runRatio <= 0.05) {
    return { walk: "11:00-12:00", run: "9:40-10:40", recovery: "10:00-11:00" };
  }
  if (riskLevel === "moderado") {
    return { walk: "10:30-11:30", run: "8:50-9:50", recovery: "9:40-10:40" };
  }
  if (level === "avancado") {
    return { walk: "9:40-10:40", run: "7:30-8:30", recovery: "9:10-10:10" };
  }
  return { walk: "10:50-11:50", run: "8:30-9:30", recovery: "9:30-10:30" };
}

function buildPersonalAnalysis(profile, analysis) {
  const reasons = analysis.reasons.length
    ? analysis.reasons.map((reason) => `- ${reason}.`).join("\n")
    : "- seu perfil permite começar com carga controlada.";

  const continuousRun = analysis.type === "Caminhada orientada"
    ? "Não coloquei corrida contínua porque o foco agora é segurança articular e adaptação."
    : "A corrida aparece em blocos curtos para treinar sem transformar o treino em esforço contínuo.";

  return `${firstNameFromProfile(profile)}, aqui está minha leitura:

Você está em nível ${LEVELS[profile.level].label}, com objetivo de ${LABELS.goal[profile.goal]}.

Plano atual:
${formatKm(analysis.distance)}
${analysis.frequency} treino(s) por semana
${analysis.type}

Por que esse plano:
${reasons}

Pace de caminhada: ${analysis.pace.walk}
Pace de corrida leve: ${analysis.pace.run}

${continuousRun}

Nesta semana, a meta é executar bem e voltar com feedback. Se não houver dor articular nem fadiga extrema, o plano é mantido.`;
}

function firstNameFromProfile(profile) {
  return profile.name?.trim().split(/\s+/)[0] || "Você";
}

function distanceReason(profile, riskLevel) {
  if (riskLevel === "alto") return "Distância reduzida para proteger articulações e criar consistência.";
  if (profile.goal === "emagrecimento") return "Volume suficiente para gasto calórico sem forçar intensidade.";
  return "Distância inicial definida pelo nível atual e pela disponibilidade semanal.";
}

function paceReason(riskLevel, runRatio) {
  if (riskLevel === "alto" || runRatio <= 0.05) return "Pace confortável para manter respiração controlada.";
  return "Pace leve para permitir alternância entre corrida e caminhada sem quebrar o treino.";
}

function frequencyReason(profile, frequency) {
  if (frequency <= 2) return "Poucos dias disponíveis: melhor repetir bem do que acumular carga.";
  if (profile.goal === "emagrecimento") return "Frequência pensada para constância, que é o centro do emagrecimento.";
  return "Frequência suficiente para evolução semanal sem mudar o plano todos os dias.";
}

function buildPlan(profile, analysis, basis = "MANTER") {
  const adjustment = basis === "EVOLUIR" ? 0.5 : basis === "REDUZIR" ? -0.5 : 0;
  const targetDistance = clamp(roundHalf(analysis.distance + adjustment), 1.5, 9);
  const selectedDays = profile.days.slice(0, analysis.frequency);
  const days = selectedDays.map((day) => ({
    day,
    title: analysis.type,
    targetDistance,
    blocks: buildBlocks(targetDistance, analysis),
    status: "pendente"
  }));

  return {
    id: currentWeekId(),
    createdAt: new Date().toISOString(),
    basis,
    days
  };
}

function buildBlocks(distance, analysis) {
  const blocks = [];
  let current = 0;

  const addBlock = (size, title, pace) => {
    const start = current;
    const end = Math.min(distance, current + size);
    if (end - start < 0.05) return;
    blocks.push({
      range: `${start.toFixed(1).replace(".", ",")} → ${end.toFixed(1).replace(".", ",")} km`,
      title,
      pace,
      done: false
    });
    current = end;
  };

  addBlock(0.5, "Caminhada aquecimento", analysis.pace.walk);

  if (analysis.type === "Caminhada orientada") {
    while (current < distance - 0.5) addBlock(0.8, "Caminhada ativa", analysis.pace.recovery);
    addBlock(distance - current, "Caminhada final", analysis.pace.recovery);
    return blocks;
  }

  while (current < distance - 0.65) {
    addBlock(0.3, "Corrida leve", analysis.pace.run);
    addBlock(0.7, "Caminhada recuperação", analysis.pace.recovery);
  }

  addBlock(distance - current, "Caminhada final", analysis.pace.recovery);
  return blocks;
}

function currentWorkout() {
  if (!state.plan?.days.length) return null;
  if (state.selectedDay && state.plan.days.some((item) => item.day === state.selectedDay)) {
    return state.plan.days.find((item) => item.day === state.selectedDay);
  }
  const today = DAY_BY_DATE[new Date().getDay()];
  const todayWorkout = state.plan.days.find((item) => item.day === today);
  const pendingWorkout = state.plan.days.find((item) => item.status !== "feito");
  state.selectedDay = (todayWorkout || pendingWorkout || state.plan.days[0]).day;
  return state.plan.days.find((item) => item.day === state.selectedDay);
}

function evaluateFeedback(feedback) {
  if (!feedback.completed || feedback.fatigue >= 8 || feedback.jointPain >= 4) {
    return {
      status: "REDUZIR",
      text: feedback.jointPain >= 4
        ? `Foi detectada dor articular relevante.\n\nPor segurança, vou reduzir os próximos treinos da semana para caminhada orientada. A prioridade agora é proteger a articulação.`
        : `O treino mostrou dificuldade acima do ideal.\n\nVamos reduzir a carga dos próximos treinos da semana para recuperar controle e evitar que o cansaço vire lesão.`
    };
  }

  const weekFeedbacks = [...state.feedbacks, feedback].filter((item) => item.planId === state.plan?.id);
  const plannedDays = state.plan?.days.length || 0;
  const allDone = plannedDays > 0 && weekFeedbacks.length >= plannedDays && weekFeedbacks.every((item) => item.completed);
  const noJointPain = weekFeedbacks.every((item) => item.jointPain <= 1);
  const fatigueOk = average(weekFeedbacks.map((item) => item.fatigue)) <= 5;

  if (allDone && noJointPain && fatigueOk) {
    return {
      status: "EVOLUIR",
      text: `Semana concluída com segurança.\n\nVocê completou todos os treinos, manteve o cansaço controlado e não registrou dor articular relevante.\n\nA evolução entra apenas na próxima semana. Não vou mexer no plano no meio da semana.`
    };
  }

  if (feedback.completed && feedback.fatigue <= 6 && feedback.jointPain <= 2) {
    return {
      status: "MANTER",
      text: `Treino bem executado.\n\nVocê completou ${formatKm(feedback.distance)}.\n\nO cansaço ficou controlado e não houve sinal articular relevante.\n\nNão existe necessidade de alterar o plano atual.`
    };
  }

  return {
    status: "MANTER",
    text: `Feedback registrado.\n\nAinda não existe sinal forte para mudar o plano. No próximo treino, mantenha o pace proposto e observe cansaço e articulações.`
  };
}

function reducePendingWorkouts() {
  if (!state.plan || !state.analysis) return;
  state.plan.days.forEach((workout) => {
    if (workout.status === "feito") return;
    workout.title = "Caminhada orientada";
    workout.targetDistance = clamp(roundHalf(workout.targetDistance - 0.7), 1.5, 9);
    workout.blocks = buildBlocks(workout.targetDistance, { ...state.analysis, type: "Caminhada orientada" });
  });
}

function fastingAdvice() {
  if (!state.profile) return "A orientação aparece após o perfil.";
  if (state.fasting === "0") return "Sem jejum registrado. Para começar, foque em hidratação e refeição leve antes do treino.";

  if (state.profile.schedule === "apos 18h" || state.profile.schedule === "noite") {
    return `Como você treina ${LABELS.schedule[state.profile.schedule]}, ${state.fasting === "16" ? "16h pode ser pesado no início. Prefira 12h ou 14h se sentir queda de energia." : `${state.fasting}h é um ponto inicial razoável, desde que o treino mantenha qualidade.`}`;
  }

  return `Jejum de ${state.fasting}h registrado. Se o treino perder qualidade, reduza antes de tentar evoluir.`;
}

function activateScreen(screenId) {
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === screenId));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === screenId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  normalizeDailyState();
  renderProfile();
  renderHome();
  renderTraining();
  renderPersonal();
  renderHealth();
  saveState();
}

function renderHome() {
  const startButton = $(".hero-card .primary-button");

  if (!state.profile || !state.analysis || !state.plan) {
    $("#home-title").textContent = "Monte seu plano cardio";
    $("#home-subtitle").textContent = "Preencha o perfil para receber uma análise objetiva e um treino semanal seguro.";
    startButton.textContent = "Começar avaliação";
    startButton.dataset.tab = "profile-screen";
    $("#home-decision").textContent = "Aguardando perfil";
    $("#home-coach-text").textContent = "O CorridaG vai analisar seu perfil antes de sugerir distância, pace e frequência.";
    $("#home-workout-day").textContent = "Treino de hoje";
    $("#home-workout-distance").textContent = "-";
    $("#home-workout-type").textContent = "O treino aparecerá após a avaliação.";
  } else {
    const workout = currentWorkout();
    $("#home-title").textContent = `Olá, ${firstName()}`;
    $("#home-subtitle").textContent = "Seu personal digital já decidiu o treino. Execute o plano e volte com feedback.";
    startButton.textContent = "Ver treino";
    startButton.dataset.tab = "training-screen";
    $("#home-decision").textContent = state.decision.status;
    $("#home-coach-text").textContent = state.decision.text || state.analysis.text;
    $("#home-workout-day").textContent = workout ? workout.day : "Treino";
    $("#home-workout-distance").textContent = workout ? formatKm(workout.targetDistance) : "-";
    $("#home-workout-type").textContent = workout ? workout.title : "Plano não gerado.";
  }

  const water = waterGoal(state.profile);
  const waterPercent = water.target ? Math.round((state.water.amount / water.target) * 100) : 0;
  $("#home-water").textContent = water.target ? `${clamp(waterPercent, 0, 100)}%` : "0%";
  $("#home-water-goal").textContent = water.target ? `${(water.target / 1000).toFixed(1).replace(".", ",")} L/dia` : "Sem meta";
  $("#home-fasting").textContent = state.fasting === "0" ? "Não" : `${state.fasting}h`;
  $("#home-fasting-status").textContent = state.profile ? "Orientado" : "Sem orientação";
  $("#home-weight").textContent = formatWeight(state.profile?.weight);
  $("#home-weight-goal").textContent = state.profile?.targetWeight ? `Meta ${formatWeight(state.profile.targetWeight)}` : "Meta não definida";
}

function renderTraining() {
  const selector = $("#day-selector");
  const steps = $("#training-steps");
  const finishButton = $("#finish-workout-btn");
  const feedbackForm = $("#feedback-form");

  if (!state.plan?.days.length) {
    selector.innerHTML = "";
    $("#training-day").textContent = "-";
    $("#training-distance").textContent = "Plano não gerado";
    $("#training-type").textContent = "Preencha o perfil para montar sua semana.";
    $("#training-progress").style.setProperty("--progress", "0%");
    $("#training-progress-text").textContent = "0% concluído";
    steps.innerHTML = "";
    finishButton.classList.add("hidden");
    feedbackForm.classList.add("hidden");
    return;
  }

  const workout = currentWorkout();
  selector.innerHTML = state.plan.days.map((item) => `
    <button type="button" class="${item.day === workout.day ? "active" : ""}" data-day="${item.day}">${item.day}</button>
  `).join("");

  const done = workout.blocks.filter((block) => block.done).length;
  const progress = Math.round((done / workout.blocks.length) * 100);
  $("#training-day").textContent = workout.day;
  $("#training-distance").textContent = formatKm(workout.targetDistance);
  $("#training-type").textContent = workout.title;
  $("#training-progress").style.setProperty("--progress", `${progress}%`);
  $("#training-progress-text").textContent = `${progress}% concluído`;

  steps.innerHTML = workout.blocks.map((block, index) => `
    <button type="button" class="step-card ${block.done ? "done" : ""}" data-step="${index}">
      <span>
        <small>${block.range}</small>
        <strong>${block.title}</strong>
        Pace ${block.pace}
      </span>
      <span>${block.done ? "✓" : "+"}</span>
    </button>
  `).join("");

  finishButton.classList.toggle("hidden", progress < 100);
}

function renderPersonal() {
  if (!state.analysis) {
    $("#personal-analysis").textContent = "Preencha o perfil para receber a análise do personal.";
    $("#reason-distance").textContent = "-";
    $("#reason-distance-text").textContent = "Aguardando perfil.";
    $("#reason-pace").textContent = "-";
    $("#reason-pace-text").textContent = "Aguardando perfil.";
    $("#reason-frequency").textContent = "-";
    $("#reason-frequency-text").textContent = "Aguardando perfil.";
    $("#personal-decision").textContent = state.decision.status;
    $("#personal-decision-text").textContent = state.decision.text;
    return;
  }

  $("#personal-analysis").textContent = state.analysis.text;
  $("#reason-distance").textContent = formatKm(state.analysis.distance);
  $("#reason-distance-text").textContent = state.analysis.distanceReason;
  $("#reason-pace").textContent = state.analysis.pace.walk;
  $("#reason-pace-text").textContent = state.analysis.paceReason;
  $("#reason-frequency").textContent = `${state.analysis.frequency}x`;
  $("#reason-frequency-text").textContent = state.analysis.frequencyReason;
  $("#personal-decision").textContent = state.decision.status;
  $("#personal-decision-text").textContent = state.decision.text;
}

function renderHealth() {
  const goal = waterGoal(state.profile);
  const waterPercent = goal.target ? clamp(Math.round((state.water.amount / goal.target) * 100), 0, 100) : 0;
  $("#water-goal").textContent = goal.target ? `${(goal.min / 1000).toFixed(1).replace(".", ",")} a ${(goal.max / 1000).toFixed(1).replace(".", ",")} L` : "-";
  $("#water-advice").textContent = goal.target
    ? `Meta prática de ${(goal.target / 1000).toFixed(1).replace(".", ",")} L para hoje.`
    : "Preencha o perfil para calcular sua meta.";
  $("#water-total").textContent = `${state.water.amount} ml registrados hoje`;
  $("#water-progress").style.setProperty("--progress", `${waterPercent}%`);

  $("#fasting-choice").textContent = state.fasting === "0" ? "Sem jejum" : `${state.fasting}h`;
  $("#fasting-advice").textContent = fastingAdvice();
  $$("#fasting-options button").forEach((button) => {
    button.classList.toggle("active", button.dataset.fasting === state.fasting);
  });

  $("#weight-current").textContent = formatWeight(state.profile?.weight);
  $("#weight-history").innerHTML = state.weights.slice(-4).reverse().map((item) => `
    <p><span>${item.date}</span><strong>${formatWeight(item.weight)}</strong></p>
  `).join("");
}

function renderProfile() {
  if (!state.profile) return;
  const form = $("#profile-form");
  Object.entries(state.profile).forEach(([key, value]) => {
    if (key === "days") {
      $$('input[name="days"]', form).forEach((input) => {
        input.checked = value.includes(input.value);
      });
      return;
    }
    if (form.elements[key]) form.elements[key].value = value || "";
  });
}

function bindEvents() {
  $$("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateScreen(button.dataset.tab));
  });

  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const profile = buildProfile(event.currentTarget);
    if (!profile.days.length) {
      alert("Selecione pelo menos um dia disponível.");
      return;
    }

    state.profile = profile;
    state.analysis = analyzeProfile(profile);
    state.plan = buildPlan(profile, state.analysis);
    state.selectedDay = state.plan.days[0]?.day || null;
    state.decision = {
      status: "PLANO INICIAL",
      text: "Plano gerado. Execute a semana sem aumentar distância ou pace por conta própria. O feedback decide o próximo passo."
    };
    if (profile.weight) state.weights.push({ date: todayKey(), weight: profile.weight });
    render();
    activateScreen("home-screen");
  });

  $("#day-selector").addEventListener("click", (event) => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    state.selectedDay = button.dataset.day;
    $("#feedback-form").classList.add("hidden");
    render();
  });

  $("#training-steps").addEventListener("click", (event) => {
    const button = event.target.closest("[data-step]");
    const workout = currentWorkout();
    if (!button || !workout) return;
    const block = workout.blocks[Number(button.dataset.step)];
    if (!block) return;
    block.done = !block.done;
    render();
  });

  $("#finish-workout-btn").addEventListener("click", () => {
    const workout = currentWorkout();
    if (!workout) return;
    const form = $("#feedback-form");
    form.classList.remove("hidden");
    form.elements.distance.value = workout.targetDistance.toFixed(2);
  });

  $("#feedback-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const workout = currentWorkout();
    if (!workout) return;
    const data = new FormData(event.currentTarget);
    const feedback = {
      id: uniqueId(),
      planId: state.plan.id,
      day: workout.day,
      completed: data.get("completed") === "true",
      distance: Number(data.get("distance")),
      duration: String(data.get("duration") || "").trim(),
      fatigue: Number(data.get("fatigue")),
      jointPain: Number(data.get("jointPain")),
      notes: String(data.get("notes") || "").trim(),
      createdAt: new Date().toISOString()
    };

    const decision = evaluateFeedback(feedback);
    state.feedbacks.push({ ...feedback, decision: decision.status });
    state.decision = decision;
    workout.status = feedback.completed ? "feito" : "pendente";
    if (feedback.completed) workout.blocks.forEach((block) => { block.done = true; });
    if (decision.status === "REDUZIR") reducePendingWorkouts();
    event.currentTarget.reset();
    event.currentTarget.classList.add("hidden");
    render();
    activateScreen("personal-screen");
  });

  $$("[data-water]").forEach((button) => {
    button.addEventListener("click", () => {
      normalizeDailyState();
      state.water.amount += Number(button.dataset.water);
      render();
    });
  });

  $("#fasting-options").addEventListener("click", (event) => {
    const button = event.target.closest("[data-fasting]");
    if (!button) return;
    state.fasting = button.dataset.fasting;
    render();
  });

  $("#weight-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("weight"));
    if (!value) return;
    state.weights.push({ date: todayKey(), weight: value });
    if (state.profile) {
      state.profile.weight = value;
      state.analysis = analyzeProfile(state.profile);
    }
    event.currentTarget.reset();
    render();
  });

  $("#new-week-btn").addEventListener("click", () => {
    if (!state.profile) {
      activateScreen("profile-screen");
      return;
    }
    const basis = state.decision.status === "EVOLUIR" || state.decision.status === "REDUZIR"
      ? state.decision.status
      : "MANTER";
    state.analysis = analyzeProfile(state.profile);
    state.plan = buildPlan(state.profile, state.analysis, basis);
    state.selectedDay = state.plan.days[0]?.day || null;
    state.decision = {
      status: basis === "EVOLUIR" ? "EVOLUÇÃO APLICADA" : basis === "REDUZIR" ? "SEMANA REDUZIDA" : "MANTER",
      text: basis === "EVOLUIR"
        ? "A semana anterior permitiu evolução. Aumentei pouco o volume para manter segurança."
        : basis === "REDUZIR"
          ? "A semana foi reduzida por segurança. O objetivo agora é voltar a executar sem dor."
          : "Nova semana gerada sem mudança agressiva. O foco continua sendo consistência."
    };
    render();
    activateScreen("training-screen");
  });

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `corridag-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#import-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state = mergeState(initialState(), JSON.parse(await file.text()));
      render();
      activateScreen("home-screen");
    } catch {
      alert("Não foi possível importar este arquivo.");
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
registerServiceWorker();
