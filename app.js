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
const GOAL_LABELS = {
  "emagrecimento": "Emagrecimento",
  "saude": "Saúde",
  "condicionamento": "Condicionamento",
  "esporte": "Esporte",
  "correr 5 km": "Correr 5 km",
  "correr 10 km": "Correr 10 km",
  "sair do sedentarismo": "Sair do sedentarismo"
};
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
const RESTRICTION_LABELS = {
  "nenhuma": "Nenhuma",
  "joelho": "Joelho",
  "canela": "Canela",
  "tornozelo": "Tornozelo",
  "coluna": "Coluna",
  "pressao alta": "Pressão alta",
  "diabetes": "Diabetes",
  "falta de ar excessiva": "Falta de ar excessiva"
};
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const DAY_INDEX = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 0: "DOM" };
const IMPACT_RESTRICTIONS = ["joelho", "canela", "tornozelo", "coluna"];
const CARDIO_RESTRICTIONS = ["pressao alta", "diabetes", "falta de ar excessiva"];
const LEVEL_RULES = {
  "iniciante": { distance: 2.0, runRatio: 0.12, minDays: 2, maxProgression: 0.3, label: "base inicial" },
  "pouco ativo": { distance: 3.6, runRatio: 0.28, minDays: 3, maxProgression: 0.5, label: "base gradual" },
  "intermediario": { distance: 5.0, runRatio: 0.55, minDays: 3, maxProgression: 0.7, label: "base estruturada" },
  "avancado": { distance: 7.0, runRatio: 0.72, minDays: 4, maxProgression: 1.0, label: "base avançada" }
};
const GOAL_RULES = {
  "emagrecimento": { distanceDelta: 0.3, runRatioDelta: -0.04, longWalk: true, reason: "maior gasto com impacto controlado" },
  "saude": { distanceDelta: 0, runRatioDelta: -0.08, longWalk: true, reason: "estabilidade cardiovascular" },
  "condicionamento": { distanceDelta: 0.4, runRatioDelta: 0.06, longWalk: false, reason: "melhora gradual de capacidade" },
  "esporte": { distanceDelta: 0.6, runRatioDelta: 0.08, longWalk: false, reason: "preparação física geral" },
  "correr 5 km": { distanceDelta: 0.4, runRatioDelta: 0.1, longWalk: false, reason: "aproximação progressiva dos 5 km" },
  "correr 10 km": { distanceDelta: 0.8, runRatioDelta: 0.08, longWalk: true, reason: "volume semanal para distância maior" },
  "sair do sedentarismo": { distanceDelta: -0.4, runRatioDelta: -0.16, longWalk: true, reason: "retorno seguro à rotina ativa" }
};
const WORKOUT_LABELS = {
  "caminhada longa": "Caminhada longa",
  "caminhada de recuperacao": "Caminhada de recuperação",
  "corrida leve": "Corrida leve",
  "corrida + caminhada": "Corrida + caminhada"
};
let charts = {};
let selectedPlanDay = null;

const initialState = () => ({
  profile: null,
  waterToday: 0,
  waterDate: todayKey(),
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

function normalizeDailyState() {
  const today = todayKey();
  if (state.waterDate !== today) {
    state.waterToday = 0;
    state.waterDate = today;
    saveState();
  }
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

function weekKeyFromDate(dateValue) {
  return currentWeekId(new Date(`${dateValue}T12:00:00`));
}

function dailyWaterTotals() {
  const totals = new Map();
  state.waterHistory.forEach((entry) => {
    totals.set(entry.date, Math.max(totals.get(entry.date) || 0, entry.amount || 0));
  });
  return [...totals.entries()].map(([date, amount]) => ({ date, amount }));
}

function weeklyWorkoutStats() {
  const groups = new Map();
  state.workoutHistory.forEach((workout) => {
    const key = workout.weekId || weekKeyFromDate(workout.date);
    if (!groups.has(key)) {
      groups.set(key, { week: key, km: 0, completed: 0, paceValues: [], fatigueValues: [], jointPainValues: [] });
    }
    const group = groups.get(key);
    group.km += workout.distance || 0;
    if (workout.completed !== false) group.completed += 1;
    const pace = parsePaceToSeconds(workout.pace);
    if (pace) group.paceValues.push(pace);
    group.fatigueValues.push(workout.fatigue || 0);
    group.jointPainValues.push(jointPain(workout));
  });

  return [...groups.values()].map((group) => ({
    week: group.week,
    km: Number(group.km.toFixed(1)),
    completed: group.completed,
    avgPaceSeconds: average(group.paceValues),
    avgFatigue: Number(average(group.fatigueValues).toFixed(1)),
    avgJointPain: Number(average(group.jointPainValues).toFixed(1))
  }));
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

function getNextWorkout() {
  const planDays = state.weeklyPlan?.days || [];
  if (!planDays.length) return null;
  const today = currentDayLabel();
  const todayOrder = DAYS.indexOf(today);
  return planDays.find((item) => DAYS.indexOf(item.day) >= todayOrder && item.status !== "concluido") ||
    planDays.find((item) => item.status !== "concluido") ||
    planDays[0];
}

function getLastWeekFeedback() {
  const weekId = state.weeklyPlan?.weekId;
  return state.workoutHistory.filter((item) => item.weekId === weekId);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parsePaceToSeconds(pace) {
  if (!pace || typeof pace !== "string") return 0;
  const [minutes, seconds = "0"] = pace.split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return (minutes * 60) + seconds;
}

function formatPace(seconds) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function workoutLabel(type) {
  return WORKOUT_LABELS[type] || type;
}

function jointPain(item) {
  return Math.max(item.kneePain || 0, item.shinPain || 0, item.anklePain || 0);
}

function analyzeProfile(profile) {
  if (!profile) {
    return {
      score: 0,
      riskLevel: "indefinido",
      flags: ["perfil pendente"],
      levelRule: LEVEL_RULES.iniciante,
      primaryGoalRule: GOAL_RULES.saude,
      secondaryGoalRule: GOAL_RULES.saude,
      runRatio: 0.12,
      distance: 2
    };
  }

  const weight = getLatestWeight() || profile.weight;
  const bmi = calculateBMI(weight, profile.height);
  const levelRule = LEVEL_RULES[profile.level] || LEVEL_RULES.iniciante;
  const primaryGoalRule = GOAL_RULES[profile.primaryGoal] || GOAL_RULES.saude;
  const secondaryGoalRule = GOAL_RULES[profile.secondaryGoal] || GOAL_RULES.saude;
  const daysCount = profile.days?.length || 0;
  const walkKm = Number(profile.walkKm || 0);
  const runKm = Number(profile.runKm || 0);
  const sleepHours = Number(profile.sleepHours || 0);
  const lastPaceSeconds = parsePaceToSeconds(profile.lastPace);
  const flags = [];
  let score = 0;
  let distance = levelRule.distance + primaryGoalRule.distanceDelta + (secondaryGoalRule.distanceDelta * 0.45);
  let runRatio = levelRule.runRatio + primaryGoalRule.runRatioDelta + (secondaryGoalRule.runRatioDelta * 0.45);

  if (bmi >= 40) {
    score += 4;
    distance -= 1.1;
    runRatio -= 0.22;
    flags.push("IMC muito elevado: reduzir impacto e priorizar caminhadas");
  } else if (bmi >= 35) {
    score += 3;
    distance -= 0.8;
    runRatio -= 0.16;
    flags.push("IMC elevado: progressão mais conservadora");
  } else if (bmi >= 30) {
    score += 2;
    distance -= 0.4;
    runRatio -= 0.1;
    flags.push("sobrepeso relevante: controlar impacto");
  } else if (bmi >= 25) {
    score += 1;
    distance -= 0.1;
    runRatio -= 0.03;
    flags.push("atenção ao volume inicial");
  }

  if (profile.age < 18) {
    score += 1;
    distance -= 0.2;
    flags.push("usuário jovem: progressão moderada");
  } else if (profile.age >= 60) {
    score += 3;
    distance -= 0.7;
    runRatio -= 0.12;
    flags.push("idade alta: recuperação ampliada");
  } else if (profile.age >= 45) {
    score += 1;
    distance -= 0.2;
    runRatio -= 0.04;
    flags.push("monitorar resposta cardiovascular");
  }

  if (IMPACT_RESTRICTIONS.includes(profile.restriction)) {
    score += 4;
    distance -= 1;
    runRatio -= 0.28;
    flags.push(`restrição em ${RESTRICTION_LABELS[profile.restriction] || profile.restriction}: baixo impacto obrigatório`);
  }

  if (CARDIO_RESTRICTIONS.includes(profile.restriction)) {
    score += 3;
    distance -= 0.6;
    runRatio -= 0.18;
    flags.push(`${profile.restriction}: intensidade conservadora`);
  }

  if (profile.level === "iniciante") {
    score += 2;
    flags.push("iniciante: adaptar antes de evoluir");
  } else if (profile.level === "pouco ativo") {
    score += 1;
    flags.push("pouco ativo: consolidar rotina semanal");
  }

  if (profile.walkPractice === "sim" && walkKm >= 2) {
    distance += clamp(walkKm * 0.16, 0.2, 0.8);
    flags.push("base de caminhada aproveitada no plano");
  } else if (profile.walkPractice === "nao") {
    score += 1;
    distance -= 0.2;
    runRatio -= 0.08;
    flags.push("sem rotina de caminhada: adaptação inicial");
  }

  if (profile.runPractice === "sim" && runKm > 0) {
    distance += clamp(runKm * 0.12, 0.1, 0.9);
    runRatio += clamp(runKm * 0.03, 0.04, 0.16);
    flags.push("experiência de corrida considerada");
  } else if (profile.runPractice === "nao") {
    runRatio -= 0.1;
  }

  if (profile.recentInjury === "sim") {
    score += 3;
    distance -= 0.6;
    runRatio -= 0.18;
    flags.push("lesão recente: reduzir carga e impacto");
  }

  if (profile.abandonedBefore === "sim") {
    score += 1;
    distance -= 0.2;
    flags.push("histórico de abandono: plano mais aderente");
  }

  if (sleepHours && sleepHours < 6) {
    score += 2;
    distance -= 0.3;
    runRatio -= 0.08;
    flags.push("sono baixo: recuperação limitada");
  } else if (sleepHours >= 7.5) {
    distance += 0.1;
    flags.push("sono favorável para recuperação");
  }

  if (lastPaceSeconds >= 720) {
    runRatio -= 0.08;
    flags.push("pace recente indica prioridade em base aeróbica");
  } else if (lastPaceSeconds && lastPaceSeconds <= 540 && profile.runPractice === "sim") {
    runRatio += 0.06;
    flags.push("pace recente permite corrida leve controlada");
  }

  if (daysCount <= 1) {
    score += 2;
    distance -= 0.3;
    flags.push("baixa disponibilidade: plano enxuto");
  } else if (daysCount >= 5 && profile.level !== "avancado") {
    score += 1;
    distance -= 0.2;
    flags.push("muitos dias: inserir recuperação ativa");
  }

  if (profile.schedule === "noite" || profile.schedule === "apos 18h") {
    flags.push("treino noturno: observar sono e jejum");
  }

  const riskLevel = score >= 9 ? "alto" : score >= 5 ? "moderado" : "baixo";

  return {
    score,
    riskLevel,
    flags,
    bmi,
    levelRule,
    primaryGoalRule,
    secondaryGoalRule,
    distance: clamp(Number(distance.toFixed(1)), 1.4, 10),
    runRatio: clamp(Number(runRatio.toFixed(2)), 0, 0.82),
    recommendedDays: clamp(levelRule.minDays, 2, 5)
  };
}

function analyzeTrainingContext(feedbacks, profile = state.profile) {
  const profileAnalysis = analyzeProfile(profile);
  const scheduled = Math.max(1, profile?.days?.length || 0);
  const completed = feedbacks.filter((item) => item.completed !== false).length;
  const incomplete = feedbacks.length - completed;
  const paceValues = feedbacks.map((item) => parsePaceToSeconds(item.pace)).filter(Boolean);
  const firstPace = paceValues[0] || 0;
  const lastPace = paceValues[paceValues.length - 1] || 0;
  const avgFatigue = average(feedbacks.map((item) => item.fatigue || 0));
  const avgMusclePain = average(feedbacks.map((item) => item.musclePain || 0));
  const jointPainMax = Math.max(...feedbacks.map(jointPain), 0);
  const totalKm = feedbacks.reduce((sum, item) => sum + (item.distance || 0), 0);
  const influenceLoad = feedbacks.reduce((sum, item) => {
    const influence = item.influence || "nada diferente";
    if (["dormi mal", "comi pouco", "treinei em jejum", "dor antes do treino"].includes(influence)) return sum + 8;
    if (["trabalhei muito", "calor forte", "estresse"].includes(influence)) return sum + 5;
    return sum;
  }, 0);
  const waterAverage = average(state.waterHistory.slice(-7).map((entry) => entry.amount || 0));
  const fastingAverage = average(state.fastingSessions.slice(-7).map((entry) => entry.durationHours || 0));
  const activeFastHours = getFastingHours();
  const performanceDrop = firstPace && lastPace ? lastPace > firstPace * 1.08 : false;
  const adherence = completed / scheduled;
  const recoveryScore = 100
    - (avgFatigue * 6)
    - (avgMusclePain * 5)
    - (jointPainMax * 10)
    - (incomplete * 12)
    - (performanceDrop ? 14 : 0)
    - influenceLoad
    - (waterAverage && waterAverage < 2500 ? 8 : 0)
    - (Math.max(fastingAverage, activeFastHours) >= 16 ? 8 : 0)
    - (profileAnalysis.score * 2);

  const signals = [];
  if (jointPainMax >= 4) signals.push("dor articular relevante");
  if (avgFatigue >= 8) signals.push("fadiga alta");
  if (avgMusclePain >= 6) signals.push("dor muscular acima do ideal");
  if (incomplete > 0) signals.push("treino incompleto");
  if (performanceDrop) signals.push("queda de desempenho");
  feedbacks
    .map((item) => item.influence)
    .filter((item) => item && item !== "nada diferente")
    .forEach((item) => signals.push(`contexto do treino: ${item}`));
  if (waterAverage && waterAverage < 2500) signals.push("hidratação baixa");
  if (Math.max(fastingAverage, activeFastHours) >= 16) signals.push("jejum longo afetando recuperação");
  if (profileAnalysis.riskLevel === "alto") signals.push("perfil de risco alto");

  return {
    profileAnalysis,
    scheduled,
    completed,
    incomplete,
    adherence,
    avgFatigue,
    avgMusclePain,
    jointPainMax,
    totalKm,
    avgPace: formatPace(average(paceValues)),
    performanceDrop,
    waterAverage,
    fastingAverage: Math.max(fastingAverage, activeFastHours),
    recoveryScore: clamp(Math.round(recoveryScore), 0, 100),
    signals
  };
}

function classifyDecision(feedbacks, profile = state.profile) {
  const context = analyzeTrainingContext(feedbacks, profile);

  if (!feedbacks.length) {
    return {
      decision: "MANTER",
      reason: `Plano inicial calibrado para risco ${context.profileAnalysis.riskLevel}. A primeira semana deve servir como leitura de segurança e constância.`,
      context
    };
  }

  if (context.jointPainMax >= 4 || context.avgFatigue >= 8 || context.incomplete > 0 || context.performanceDrop) {
    return {
      decision: "REDUZIR",
      reason: `Reduzir por segurança: ${context.signals.join(", ") || "sinais de recuperação insuficiente"}.`,
      context
    };
  }

  if (context.adherence >= 0.9 &&
      context.jointPainMax === 0 &&
      context.avgFatigue <= 5 &&
      context.avgMusclePain <= 3 &&
      context.recoveryScore >= 70 &&
      context.profileAnalysis.riskLevel !== "alto") {
    return {
      decision: "EVOLUIR",
      reason: "Evoluir na próxima semana: boa frequência, cansaço controlado, recuperação adequada e ausência de dor articular.",
      context
    };
  }

  if (context.avgFatigue <= 6 && context.avgMusclePain <= 4 && context.jointPainMax <= 2) {
    return {
      decision: "MANTER",
      reason: "Treino bem executado. Cansaço controlado e sem dor articular. Não há necessidade de alterar o plano da semana.",
      context
    };
  }

  return {
    decision: "MANTER",
    reason: `Manter com cautela: ${context.signals.join(", ") || "sinais mistos de adaptação"}.`,
    context
  };
}

function paceGuide(type, analysis) {
  if (analysis.profileAnalysis?.riskLevel === "alto" || type.includes("recuperacao")) {
    return { walk: "11:00-12:30", run: "9:50-11:00", recovery: "10:50-12:00" };
  }

  if (analysis.profileAnalysis?.riskLevel === "moderado") {
    return { walk: "10:40-11:50", run: "9:10-10:20", recovery: "10:20-11:20" };
  }

  if (analysis.profileAnalysis?.levelRule?.label === "base avançada") {
    return { walk: "9:40-10:50", run: "7:20-8:40", recovery: "9:30-10:30" };
  }

  return { walk: "10:20-11:30", run: "8:30-9:40", recovery: "9:40-10:50" };
}

function createBlocks(type, distance, profile, analysis) {
  const lowImpact = IMPACT_RESTRICTIONS.includes(profile.restriction) || analysis.profileAnalysis.runRatio <= 0.12;
  const pace = paceGuide(type, analysis);
  const warmup = clamp(distance * 0.16, 0.4, 0.8);
  const mainEnd = clamp(distance * (0.58 + analysis.profileAnalysis.runRatio * 0.2), warmup + 0.5, distance - 0.4);

  if (type === "caminhada longa") {
    return [
      { range: `0,0 -> ${warmup.toFixed(1).replace(".", ",")} km`, label: "Caminhada de aquecimento", pace: pace.walk },
      { range: `${warmup.toFixed(1).replace(".", ",")} -> ${Math.max(warmup + 0.7, distance - 0.6).toFixed(1).replace(".", ",")} km`, label: "Caminhada longa sustentada", pace: pace.recovery },
      { range: `${Math.max(warmup + 0.7, distance - 0.6).toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Desaceleração e respiração", pace: pace.walk }
    ];
  }

  if (type === "caminhada de recuperacao") {
    return [
      { range: `0,0 -> ${warmup.toFixed(1).replace(".", ",")} km`, label: "Caminhada leve", pace: pace.walk },
      { range: `${warmup.toFixed(1).replace(".", ",")} -> ${Math.max(warmup + 0.6, distance - 0.4).toFixed(1).replace(".", ",")} km`, label: "Caminhada de recuperação", pace: pace.recovery },
      { range: `${Math.max(warmup + 0.6, distance - 0.4).toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Respiração e volta à calma", pace: pace.walk }
    ];
  }

  if (lowImpact) {
    return [
      { range: `0,0 -> ${warmup.toFixed(1).replace(".", ",")} km`, label: "Caminhada de aquecimento", pace: pace.walk },
      { range: `${warmup.toFixed(1).replace(".", ",")} -> ${mainEnd.toFixed(1).replace(".", ",")} km`, label: "Corrida + caminhada de baixo impacto", pace: pace.recovery },
      { range: `${mainEnd.toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Caminhada de recuperação", pace: pace.walk }
    ];
  }

  if (type === "corrida leve") {
    return [
      { range: `0,0 -> ${warmup.toFixed(1).replace(".", ",")} km`, label: "Caminhada aquecimento", pace: pace.walk },
      { range: `${warmup.toFixed(1).replace(".", ",")} -> ${mainEnd.toFixed(1).replace(".", ",")} km`, label: "Corrida leve", pace: pace.run },
      { range: `${mainEnd.toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Caminhada de recuperação", pace: pace.recovery }
    ];
  }

  return [
    { range: `0,0 -> ${warmup.toFixed(1).replace(".", ",")} km`, label: "Caminhada aquecimento", pace: pace.walk },
    { range: `${warmup.toFixed(1).replace(".", ",")} -> ${mainEnd.toFixed(1).replace(".", ",")} km`, label: "Corrida + caminhada", pace: pace.run },
    { range: `${mainEnd.toFixed(1).replace(".", ",")} -> ${distance.toFixed(1).replace(".", ",")} km`, label: "Caminhada de recuperação", pace: pace.recovery }
  ];
}

function baseDistance(profile) {
  return analyzeProfile(profile).distance;
}

function planTypeForDay(index, totalDays, profile, decisionContext) {
  const analysis = decisionContext.context.profileAnalysis;
  const lowImpact = IMPACT_RESTRICTIONS.includes(profile.restriction) || CARDIO_RESTRICTIONS.includes(profile.restriction);

  if (decisionContext.decision === "REDUZIR") {
    return index % 2 === 0 ? "caminhada de recuperacao" : "corrida + caminhada";
  }

  if (analysis.riskLevel === "alto") {
    return index === totalDays - 1 && totalDays > 2 ? "caminhada longa" : "caminhada de recuperacao";
  }

  if (lowImpact) {
    return index === totalDays - 1 ? "caminhada longa" : "corrida + caminhada";
  }

  if (profile.primaryGoal === "sair do sedentarismo") {
    return index === totalDays - 1 ? "caminhada longa" : "corrida + caminhada";
  }

  if (index === totalDays - 1 && (GOAL_RULES[profile.primaryGoal]?.longWalk || totalDays > 3)) return "caminhada longa";
  if (index === 1 || analysis.runRatio >= 0.5) return "corrida leve";
  return "corrida + caminhada";
}

function buildWeeklyPlan(profile, feedbacks = getLastWeekFeedback()) {
  const decisionContext = classifyDecision(feedbacks, profile);
  const analysis = decisionContext.context.profileAnalysis;
  const delta = decisionContext.decision === "EVOLUIR"
    ? analysis.levelRule.maxProgression
    : decisionContext.decision === "REDUZIR"
      ? -Math.max(0.5, analysis.levelRule.maxProgression)
      : 0;
  const distance = clamp(Number((baseDistance(profile) + delta).toFixed(1)), 1.4, 12);
  const weekId = currentWeekId();
  const days = (profile.days || []).map((day, index, list) => {
    const type = planTypeForDay(index, list.length, profile, decisionContext);
    const recoveryFactor = type === "caminhada de recuperacao" ? 0.78 : 1;
    const longFactor = type === "caminhada longa" ? 1.12 : 1;
    const dayDistance = clamp(distance * recoveryFactor * longFactor, 1.2, 13);
    return {
      day,
      type,
      targetDistance: Number(dayDistance.toFixed(1)),
      status: "pendente",
      intensity: analysis.riskLevel === "alto" ? "baixa" : type === "corrida leve" ? "moderada" : "controlada",
      rules: [
        analysis.levelRule.label,
        analysis.primaryGoalRule.reason,
        decisionContext.decision.toLowerCase()
      ],
      blocks: createBlocks(type, dayDistance, profile, decisionContext.context)
    };
  });

  return {
    weekId,
    createdAt: new Date().toISOString(),
    decisionBasis: decisionContext.decision,
    decisionReason: decisionContext.reason,
    riskLevel: analysis.riskLevel,
    riskScore: analysis.score,
    rulesApplied: [...analysis.flags, decisionContext.reason],
    days
  };
}

function generateCoachMessage() {
  const profile = state.profile;
  if (!profile) {
    return "Preencha seu perfil para que o personal digital calcule risco, regularidade e gere seu primeiro plano semanal.";
  }

  const analysis = analyzeProfile(profile);
  const todayWorkout = getTodayWorkout();
  const waterGap = Math.max(0, 4000 - state.waterToday);
  const fastingHours = getFastingHours();
  const recentDecision = state.decisions[state.decisions.length - 1];

  let message = todayWorkout
    ? `Hoje o foco é ${workoutLabel(todayWorkout.type)} em intensidade ${todayWorkout.intensity || "controlada"}, com alvo de ${todayWorkout.targetDistance.toFixed(1).replace(".", ",")} km.`
    : "Hoje não há treino previsto; o sistema pode usar o dia para recuperação e consolidação.";

  if (analysis.riskLevel === "alto") {
    message += " O perfil atual pede baixo impacto, leitura de sinais corporais e evolução lenta.";
  } else if (analysis.riskLevel === "moderado") {
    message += " O plano está calibrado para evoluir sem trocar segurança por pressa.";
  }

  if (waterGap > 2000) {
    message += " Sua ingestão de água está abaixo do recomendado para uma boa recuperação.";
  }

  if (fastingHours >= 14) {
    message += " O período de jejum pode estar impactando energia e recuperação.";
  }

  if (recentDecision?.decision === "REDUZIR") {
    message += " Como houve sinal de risco recente, a prioridade agora é proteger articulações e manter constância.";
  }

  return message;
}

function generateRecommendations() {
  const recs = [];
  const analysis = analyzeProfile(state.profile);
  const bmi = analysis.bmi || calculateBMI(getLatestWeight(), state.profile?.height || 0);
  if (bmi >= 30) recs.push("Controlar impacto pelo IMC");
  if (analysis.riskLevel !== "baixo") recs.push(`Risco ${analysis.riskLevel}`);
  if (analysis.flags[0]) recs.push(analysis.flags[0]);
  if (state.waterToday < 2000) recs.push("Aumentar hidratação hoje");
  if (getFastingHours() >= 14) recs.push("Observar energia antes do treino");
  if (state.weeklyPlan?.decisionBasis) recs.push(`Base semanal: ${state.weeklyPlan.decisionBasis}`);
  return recs.length ? recs : ["Plano estável", "Segurança primeiro", "Evolução semanal"];
}

function generateWeeklySummary() {
  const currentFeedbacks = getLastWeekFeedback();
  const decision = classifyDecision(currentFeedbacks, state.profile);
  const context = decision.context;

  const summary = {
    weekId: state.weeklyPlan?.weekId || currentWeekId(),
    createdAt: new Date().toISOString(),
    decision: decision.decision,
    reason: decision.reason,
    signals: context.signals,
    stats: {
      totalKm: Number(context.totalKm.toFixed(1)),
      avgPace: context.avgPace,
      completed: context.completed,
      adherence: Number(context.adherence.toFixed(2)),
      recoveryScore: context.recoveryScore,
      riskLevel: context.profileAnalysis.riskLevel,
      waterAverage: Math.round(context.waterAverage),
      currentWeight: getLatestWeight()
    }
  };

  state.decisions.push(summary);
  saveState();
  renderApp();
}

function maybeGenerateSundaySummary() {
  if (new Date().getDay() !== 0 || !state.weeklyPlan) return;
  const weekId = state.weeklyPlan.weekId || currentWeekId();
  if (state.decisions.some((decision) => decision.weekId === weekId)) return;
  const currentFeedbacks = getLastWeekFeedback();
  if (!currentFeedbacks.length) return;

  const decision = classifyDecision(currentFeedbacks, state.profile);
  const context = decision.context;
  state.decisions.push({
    weekId,
    createdAt: new Date().toISOString(),
    auto: true,
    decision: decision.decision,
    reason: decision.reason,
    signals: context.signals,
    stats: {
      totalKm: Number(context.totalKm.toFixed(1)),
      avgPace: context.avgPace,
      completed: context.completed,
      adherence: Number(context.adherence.toFixed(2)),
      recoveryScore: context.recoveryScore,
      riskLevel: context.profileAnalysis.riskLevel,
      waterAverage: Math.round(context.waterAverage),
      currentWeight: getLatestWeight()
    }
  });
  saveState();
}

function setSelectOptions() {
  const goalOptions = GOALS.map((value) => `<option value="${value}">${GOAL_LABELS[value]}</option>`).join("");
  const restrictionOptions = RESTRICTIONS.map((value) => `<option value="${value}">${RESTRICTION_LABELS[value]}</option>`).join("");
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
  const nextWorkout = getNextWorkout();
  const waterProgress = clamp(state.waterToday / 4000, 0, 1);
  const greetingName = state.profile?.name ? `Olá, ${state.profile.name}` : "Olá";
  document.getElementById("dashboard-greeting").textContent = greetingName;
  document.getElementById("metric-weight").textContent = weight ? `${weight.toFixed(1).replace(".", ",")} kg` : "-";
  document.getElementById("metric-bmi").textContent = bmi ? `IMC ${bmi.toFixed(1).replace(".", ",")}` : "IMC -";
  document.getElementById("metric-target-weight").textContent = state.profile?.targetWeight
    ? `Meta: ${Number(state.profile.targetWeight).toFixed(1).replace(".", ",")} kg`
    : "Meta não definida";
  document.getElementById("metric-water").textContent = `${state.waterToday} ml`;
  document.getElementById("metric-fasting").textContent = `${fastHours.toFixed(1).replace(".", ",")}h`;
  document.getElementById("metric-fasting-status").textContent = getActiveFast() ? "Sessão ativa" : "Sem sessão ativa";
  document.getElementById("metric-today-type").textContent = todayWorkout ? workoutLabel(todayWorkout.type) : "Sem plano";
  document.getElementById("metric-today-distance").textContent = todayWorkout ? `${todayWorkout.targetDistance.toFixed(1).replace(".", ",")} km alvo` : "0 km";
  document.getElementById("water-ring-value").textContent = `${state.waterToday} ml`;
  document.getElementById("water-ring").style.setProperty("--water-progress", `${Math.round(waterProgress * 360)}deg`);
  document.getElementById("fasting-large-value").textContent = `${fastHours.toFixed(1).replace(".", ",")}h`;
  document.getElementById("fasting-state-label").textContent = getActiveFast() ? "Em andamento" : "Jejum";
  document.getElementById("next-workout-title").textContent = nextWorkout
    ? `${nextWorkout.day} - ${workoutLabel(nextWorkout.type)}`
    : "Plano ainda não gerado";
  document.getElementById("next-workout-detail").textContent = nextWorkout
    ? `${nextWorkout.targetDistance.toFixed(1).replace(".", ",")} km em intensidade ${nextWorkout.intensity || "controlada"}`
    : "Preencha o perfil para receber o plano semanal.";
}

function renderCoach() {
  document.getElementById("coach-message").textContent = generateCoachMessage();
  document.getElementById("water-analysis").textContent = state.waterToday < 4000
    ? `Faltam ${4000 - state.waterToday} ml para a meta diária.`
    : "Meta de água atingida para o dia.";
  document.getElementById("fasting-analysis").textContent = getActiveFast()
    ? `Jejum em andamento há ${getFastingHours().toFixed(1).replace(".", ",")} horas.`
    : "Nenhum jejum ativo no momento.";

  const tags = document.getElementById("recommendations");
  tags.innerHTML = generateRecommendations().map((item) => `<span>${item}</span>`).join("");
}

function renderPlan() {
  const container = document.getElementById("weekly-plan");
  const badge = document.getElementById("week-badge");
  const dayFilter = document.getElementById("day-filter");
  const plan = state.weeklyPlan;

  if (!plan) {
    badge.textContent = "Sem semana ativa";
    if (dayFilter) dayFilter.innerHTML = "";
    container.innerHTML = '<div class="list-item">Gere o plano semanal após salvar o perfil.</div>';
    return;
  }

  badge.textContent = `${plan.weekId} - ${plan.decisionBasis} - risco ${plan.riskLevel || "indefinido"}`;
  if (!selectedPlanDay || !plan.days.some((item) => item.day === selectedPlanDay)) {
    selectedPlanDay = getTodayWorkout()?.day || plan.days[0]?.day || null;
  }

  if (dayFilter) {
    dayFilter.innerHTML = plan.days.map((day) => `
      <button class="${day.day === selectedPlanDay ? "active" : ""}" data-plan-day="${day.day}">${day.day}</button>
    `).join("");
  }

  const visibleDays = selectedPlanDay ? plan.days.filter((day) => day.day === selectedPlanDay) : plan.days;
  container.innerHTML = visibleDays.map((day) => `
    <article class="timeline-item">
      <strong>${day.day} - ${workoutLabel(day.type)}</strong>
      <p>Meta: ${day.targetDistance.toFixed(1).replace(".", ",")} km - intensidade ${day.intensity || "controlada"}</p>
      <p>${(day.rules || []).join(" - ")}</p>
      ${renderBlockProgress(day)}
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

function renderBlockProgress(day) {
  const done = day.blocks.filter((block) => block.done).length;
  const total = Math.max(1, day.blocks.length);
  const percent = Math.round((done / total) * 100);
  return `
    <p>Progresso do treino: ${percent}%</p>
    <div class="progress-track" aria-label="Progresso do treino">
      <span class="progress-fill" style="--progress-width: ${percent}%"></span>
    </div>
  `;
}

function renderHistory() {
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = state.workoutHistory.length
    ? [...state.workoutHistory].reverse().map((item) => `
      <article class="list-item">
        <strong>${item.day} - ${item.distance.toFixed(1).replace(".", ",")} km</strong>
        <p>${item.duration} - pace ${item.pace} - ${item.completed === false ? "incompleto" : "concluído"}</p>
        <p>Fadiga ${item.fatigue}/10 - Dor muscular ${item.musclePain}/10 - Dor articular ${jointPain(item)}/10</p>
        <p>${item.notes || "Sem observações."}</p>
      </article>
    `).join("")
    : '<article class="list-item">Nenhum treino registrado ainda.</article>';

  const decisionList = document.getElementById("decision-list");
  decisionList.innerHTML = state.decisions.length
    ? [...state.decisions].reverse().map((item) => `
      <article class="list-item">
        <strong>${item.weekId} - ${item.decision}</strong>
        <p>${item.reason}</p>
        <p>${item.stats.totalKm} km na semana - pace ${item.stats.avgPace} - recuperação ${item.stats.recoveryScore || "-"}%</p>
      </article>
    `).join("")
    : '<article class="list-item">Nenhuma decisão semanal registrada.</article>';

  const fastingHistory = document.getElementById("fasting-history");
  if (fastingHistory) {
    const closedSessions = state.fastingSessions.filter((session) => session.end).slice(-5).reverse();
    fastingHistory.innerHTML = closedSessions.length
      ? closedSessions.map((session) => `
        <article class="list-item">
          <strong>${new Date(session.start).toLocaleDateString("pt-BR")} - ${session.durationHours || 0}h</strong>
          <p>Início ${new Date(session.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - Fim ${new Date(session.end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
        </article>
      `).join("")
      : '<article class="list-item">Nenhum jejum finalizado ainda.</article>';
  }
}

function destroyCharts() {
  Object.values(charts).forEach((chart) => chart.destroy());
  charts = {};
}

function renderCharts() {
  if (typeof Chart === "undefined") return;
  destroyCharts();
  const weightCtx = document.getElementById("weight-chart");
  const performanceCtx = document.getElementById("performance-chart");
  const weeklyCtx = document.getElementById("weekly-chart");
  const paceCtx = document.getElementById("pace-chart");
  const recoveryCtx = document.getElementById("recovery-chart");
  const weeklyStats = weeklyWorkoutStats();
  const waterTotals = dailyWaterTotals().slice(-7);
  const paceLabels = weeklyStats.length ? weeklyStats.map((item) => item.week) : waterTotals.map((item) => item.date);
  const waterByPaceLabel = weeklyStats.length
    ? weeklyStats.map((week) => {
      const entries = dailyWaterTotals().filter((item) => weekKeyFromDate(item.date) === week.week);
      return Number((average(entries.map((item) => item.amount)) / 1000 || 0).toFixed(1));
    })
    : waterTotals.map((item) => Number((item.amount / 1000).toFixed(1)));

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
      datasets: [
        { label: "Km por treino", data: state.workoutHistory.map((item) => item.distance), backgroundColor: "#3f8cff" },
        { label: "Cansaço", data: state.workoutHistory.map((item) => item.fatigue || 0), backgroundColor: "rgba(255, 209, 102, 0.72)" },
        { label: "Dor articular", data: state.workoutHistory.map((item) => jointPain(item)), backgroundColor: "rgba(255, 95, 109, 0.72)" }
      ]
    },
    options: baseChartOptions("Treinos")
  });

  charts.weekly = new Chart(weeklyCtx, {
    type: "line",
    data: {
      labels: weeklyStats.map((item) => item.week),
      datasets: [
        { label: "Km por semana", data: weeklyStats.map((item) => item.km), borderColor: "#1e90ff", backgroundColor: "rgba(30, 144, 255, 0.14)", tension: 0.32 },
        { label: "Frequência", data: weeklyStats.map((item) => item.completed), borderColor: "#8df23f", backgroundColor: "rgba(141, 242, 63, 0.12)", tension: 0.32 }
      ]
    },
    options: baseChartOptions("Evolução cardio")
  });

  charts.pace = new Chart(paceCtx, {
    type: "line",
    data: {
      labels: paceLabels,
      datasets: [
        { label: "Pace médio (min/km)", data: weeklyStats.length ? weeklyStats.map((item) => Number((item.avgPaceSeconds / 60 || 0).toFixed(2))) : waterTotals.map(() => 0), borderColor: "#00e6a8", tension: 0.32 },
        { label: "Água média (L)", data: waterByPaceLabel, borderColor: "#9aaec6", tension: 0.32 }
      ]
    },
    options: baseChartOptions("Pace e água")
  });

  charts.recovery = new Chart(recoveryCtx, {
    type: "radar",
    data: {
      labels: ["Água média", "Cansaço", "Dor muscular", "Dor articular"],
      datasets: [{
        label: "Recuperação",
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
    options: baseChartOptions("Recuperação")
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

function activateTab(tabId) {
  const target = document.getElementById(tabId);
  if (!target) return;
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });
  target.classList.add("active");
  if (tabId !== "onboarding") renderCharts();
}

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
}

function bindSubtabs() {
  document.querySelectorAll(".subtab").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.subtabGroup;
      const subtab = button.dataset.subtab;
      document.querySelectorAll(`.subtab[data-subtab-group="${group}"]`).forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      const groupPanels = {
        training: ["training-plan", "training-feedback"],
        health: ["health-water", "health-fasting", "health-weight"],
        history: ["history-summary", "history-workouts", "history-backup"]
      };
      (groupPanels[group] || []).forEach((id) => {
        document.getElementById(id)?.classList.toggle("active", id === subtab);
      });
      renderCharts();
    });
  });
}

function bindForms() {
  document.getElementById("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedDays = data.getAll("days");
    if (!selectedDays.length) {
      alert("Selecione pelo menos um dia disponível para treino.");
      return;
    }
    state.profile = {
      name: data.get("name"),
      age: Number(data.get("age")),
      sex: data.get("sex"),
      weight: Number(data.get("weight")),
      targetWeight: Number(data.get("targetWeight") || 0),
      height: Number(data.get("height")),
      level: data.get("level"),
      schedule: data.get("schedule"),
      primaryGoal: data.get("primaryGoal"),
      secondaryGoal: data.get("secondaryGoal"),
      restriction: data.get("restriction"),
      walkPractice: data.get("walkPractice"),
      runPractice: data.get("runPractice"),
      walkKm: Number(data.get("walkKm") || 0),
      runKm: Number(data.get("runKm") || 0),
      lastWorkout: data.get("lastWorkout"),
      lastPace: data.get("lastPace"),
      recentInjury: data.get("recentInjury"),
      abandonedBefore: data.get("abandonedBefore"),
      sleepHours: Number(data.get("sleepHours") || 0),
      days: selectedDays
    };
    state.weightHistory.push({ date: todayKey(), value: state.profile.weight });
    saveState();
    renderApp();
    activateTab("dashboard");
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
      influence: data.get("influence"),
      fatigue: Number(data.get("fatigue")),
      musclePain: Number(data.get("musclePain")),
      kneePain: Number(data.get("kneePain")),
      shinPain: Number(data.get("shinPain")),
      anklePain: Number(data.get("anklePain")),
      notes: data.get("notes"),
      completed: data.get("completed") === "true"
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
    if (!state.profile) {
      activateTab("profile");
      return;
    }
    state.weeklyPlan = buildWeeklyPlan(state.profile);
    state.generatedAt = new Date().toISOString();
    selectedPlanDay = getTodayWorkout()?.day || state.weeklyPlan.days[0]?.day || null;
    saveState();
    renderApp();
    activateTab("training");
  });

  document.getElementById("generate-summary-btn").addEventListener("click", generateWeeklySummary);

  document.querySelectorAll(".water-btn").forEach((button) => {
    button.addEventListener("click", () => {
      normalizeDailyState();
      const amount = Number(button.dataset.amount);
      state.waterToday += amount;
      state.waterDate = todayKey();
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

  document.getElementById("day-filter").addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan-day]");
    if (!button) return;
    selectedPlanDay = button.dataset.planDay;
    renderPlan();
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

function init() {
  normalizeDailyState();
  maybeGenerateSundaySummary();
  setSelectOptions();
  bindTabs();
  bindSubtabs();
  bindForms();
  bindActions();
  renderApp();
  activateTab(state.profile ? "dashboard" : "onboarding");
  registerServiceWorker();
}

init();
