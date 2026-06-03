const STORAGE_KEY = "corridag-motor-v2";

const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const DAY_INDEX = { SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6, DOM: 7 };
const DAY_BY_DATE = { 0: "DOM", 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB" };

const LABELS = {
  goal: {
    emagrecimento: "emagrecimento",
    saude: "saúde",
    condicionamento: "condicionamento",
    correr_5k: "correr 5 km",
    correr_10k: "correr 10 km"
  },
  ageBand: {
    ate_25: "até 25 anos",
    "26_35": "26 a 35 anos",
    "36_45": "36 a 45 anos",
    "46_55": "46 a 55 anos",
    "56_mais": "56 anos ou mais"
  },
  level: {
    sedentario: "sedentário",
    iniciante: "iniciante",
    retorno: "retornando",
    pouco_ativo: "pouco ativo",
    intermediario: "intermediário",
    avancado: "avançado"
  },
  routine: {
    nenhuma: "não faz atividade",
    caminha_as_vezes: "caminha às vezes",
    caminha_frequente: "caminha com frequência",
    corre_as_vezes: "corre às vezes",
    corre_frequente: "corre com frequência"
  },
  schedule: {
    manha: "manhã",
    tarde: "tarde",
    noite: "noite"
  },
  restriction: {
    nenhuma: "nenhuma",
    joelho: "joelho",
    canela: "canela",
    tornozelo: "tornozelo",
    coluna: "coluna",
    pressao_alta: "pressão alta",
    diabetes: "diabetes"
  },
  painLevel: {
    nenhuma: "sem dor",
    leve: "dor leve",
    moderada: "dor moderada",
    forte: "dor forte"
  }
};

const LEVEL_SCORE = {
  sedentario: 0,
  iniciante: 1,
  retorno: 1,
  pouco_ativo: 2,
  intermediario: 3,
  avancado: 4
};

const ROUTINE_SCORE = {
  nenhuma: 0,
  caminha_as_vezes: 0.8,
  caminha_frequente: 1.4,
  corre_as_vezes: 2.3,
  corre_frequente: 3.4
};

const LEVEL_DISTANCE = {
  sedentario: 2,
  iniciante: 2.8,
  retorno: 3,
  pouco_ativo: 3.8,
  intermediario: 5,
  avancado: 6.5
};

const SCORE = {
  effort: { leve: 2, controlado: 5, alto: 8, muito_alto: 10 },
  pain: { nenhuma: 0, leve: 2, moderada: 6, forte: 9 },
  finish: { sobrou: 1, certo: 4, pesado: 8, interrompido: 10 }
};

const IMPACT_RESTRICTIONS = ["joelho", "canela", "tornozelo", "coluna"];
const CARDIO_RESTRICTIONS = ["pressao_alta", "diabetes"];

const initialState = () => ({
  profile: null,
  analysis: null,
  plan: null,
  selectedDay: null,
  feedbacks: [],
  decision: {
    status: "Aguardando",
    text: "Preencha o perfil. O primeiro treino será um diagnóstico personalizado, não um teste de velocidade."
  },
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundDistance(value) {
  return Math.round(value * 10) / 10;
}

function formatKm(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")} km`;
}

function formatWeight(value) {
  return value ? `${Number(value).toFixed(1).replace(".", ",")} kg` : "-";
}

function normalizeDailyState() {
  if (state.water.date !== todayKey()) {
    state.water.history.push({ date: state.water.date, amount: state.water.amount });
    state.water.date = todayKey();
    state.water.amount = 0;
  }
}

function bmi(profile) {
  if (!profile?.height || !profile?.weight) return 0;
  return profile.weight / (profile.height * profile.height);
}

function waterGoal(profile) {
  if (!profile?.weight) return { min: 0, max: 0, target: 0 };
  const min = clamp(Math.round((profile.weight * 33) / 250) * 250, 1800, 4500);
  const max = clamp(Math.round((profile.weight * 37) / 250) * 250, min, 5000);
  return { min, max, target: Math.round(((min + max) / 2) / 250) * 250 };
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildProfile(form) {
  const data = new FormData(form);
  return {
    goal: data.get("goal"),
    weight: Number(data.get("weight")),
    height: Number(data.get("height")),
    ageBand: data.get("ageBand"),
    level: data.get("level"),
    routine: data.get("routine"),
    schedule: data.get("schedule"),
    restriction: data.get("restriction"),
    painLevel: data.get("painLevel"),
    energy: data.get("energy"),
    days: sortDays(data.getAll("days"))
  };
}

function sortDays(days) {
  return [...days].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
}

function analyzeProfile(profile) {
  const profileBmi = bmi(profile);
  const risk = riskProfile(profile, profileBmi);
  const readiness = readinessScore(profile, risk);
  const model = chooseDiagnosticModel(profile, risk, readiness);
  const distance = chooseDiagnosticDistance(profile, risk, readiness, model);
  const pace = paceGuide(model, risk, readiness);
  const week = weekStrategy(profile.days, profile, risk, readiness);

  const analysis = {
    bmi: profileBmi,
    risk,
    readiness,
    model,
    modelLabel: modelLabel(model),
    distance,
    pace,
    expectedPace: pace.expected,
    week,
    text: "",
    modelReason: modelReason(profile, risk, readiness, model),
    distanceReason: distanceReason(profile, risk, distance),
    paceReason: paceReason(model, risk),
    weekReason: week.reason
  };

  analysis.text = personalAnalysisText(profile, analysis);
  return analysis;
}

function riskProfile(profile, profileBmi) {
  let score = 0;
  const flags = [];

  if (profileBmi >= 35) {
    score += 5;
    flags.push("IMC alto aumenta impacto articular");
  } else if (profileBmi >= 30) {
    score += 2;
    flags.push("IMC pede progressão conservadora");
  }

  if (profile.ageBand === "46_55") {
    score += 1;
    flags.push("idade pede recuperação melhor distribuída");
  }

  if (profile.ageBand === "56_mais") {
    score += 2;
    flags.push("idade exige controle maior de intensidade");
  }

  if (IMPACT_RESTRICTIONS.includes(profile.restriction)) {
    score += 4;
    flags.push(`restrição em ${LABELS.restriction[profile.restriction]}`);
  }

  if (CARDIO_RESTRICTIONS.includes(profile.restriction)) {
    score += 3;
    flags.push(`${LABELS.restriction[profile.restriction]} exige esforço controlado`);
  }

  if (profile.painLevel === "moderada") {
    score += 4;
    flags.push("dor atual moderada");
  }

  if (profile.painLevel === "forte") {
    score += 7;
    flags.push("dor atual forte");
  }

  if (profile.energy === "baixa") {
    score += 1;
    flags.push("energia baixa hoje");
  }

  return {
    score,
    flags,
    level: score >= 5 ? "alto" : score >= 3 ? "moderado" : "baixo",
    blocksRun: score >= 8 || profile.painLevel === "forte"
  };
}

function readinessScore(profile, risk) {
  const raw = (LEVEL_SCORE[profile.level] || 0) + (ROUTINE_SCORE[profile.routine] || 0);
  const energyBonus = profile.energy === "boa" ? 0.4 : profile.energy === "baixa" ? -0.4 : 0;
  return clamp(raw + energyBonus - (risk.level === "alto" ? 1.4 : risk.level === "moderado" ? 0.6 : 0), 0, 7.5);
}

function chooseDiagnosticModel(profile, risk, readiness) {
  if (risk.blocksRun || risk.level === "alto") return "caminhada_diagnostica";

  if (profile.goal === "saude") {
    if (readiness < 2.5) return "caminhada_progressiva";
    return "corrida_caminhada_curta";
  }

  if (profile.goal === "emagrecimento") {
    if (readiness < 2) return "caminhada_progressiva";
    if (readiness < 4.4) return "corrida_caminhada_curta";
    return "corrida_leve_continua";
  }

  if (profile.goal === "condicionamento") {
    if (readiness < 2) return "corrida_caminhada_curta";
    if (readiness < 4.5) return "corrida_caminhada_base";
    return "corrida_leve_continua";
  }

  if (profile.goal === "correr_5k") {
    if (readiness < 2) return "corrida_caminhada_curta";
    if (readiness < 4.8) return "corrida_caminhada_base";
    return "corrida_leve_continua";
  }

  if (profile.goal === "correr_10k") {
    if (readiness < 3) return "corrida_caminhada_base";
    if (readiness < 5.4) return "corrida_leve_continua";
    return "progressivo_controlado";
  }

  return "caminhada_progressiva";
}

function chooseDiagnosticDistance(profile, risk, readiness, model) {
  let distance = LEVEL_DISTANCE[profile.level] || 2.5;

  if (profile.routine === "nenhuma") distance -= 0.3;
  if (profile.routine === "caminha_frequente") distance += 0.2;
  if (profile.routine === "corre_as_vezes") distance += 0.5;
  if (profile.routine === "corre_frequente") distance += 0.9;
  if (profile.goal === "correr_10k" && readiness >= 4) distance += 0.6;
  if (profile.goal === "emagrecimento" && readiness >= 3 && risk.level === "baixo") distance += 0.3;
  if (profile.energy === "baixa") distance -= 0.3;

  if (risk.level === "alto") distance = Math.min(distance, 3);
  if (risk.level === "moderado") distance = Math.min(distance, 4.5);
  if (model === "caminhada_diagnostica") distance = Math.min(distance, 3);
  if (model === "progressivo_controlado") distance = Math.max(distance, 5.5);

  return clamp(roundDistance(distance), 1.6, 8);
}

function paceGuide(model, risk, readiness) {
  if (model === "caminhada_diagnostica") return { label: "11:30-13:00 /km", expected: 12.1 };
  if (model === "caminhada_progressiva") return { label: "10:50-12:20 /km", expected: 11.4 };
  if (model === "corrida_caminhada_curta") return { label: "9:40-11:10 /km", expected: 10.3 };
  if (model === "corrida_caminhada_base") return { label: "8:50-10:20 /km", expected: 9.5 };
  if (model === "corrida_leve_continua") return { label: risk.level === "baixo" && readiness > 5 ? "7:30-8:50 /km" : "8:10-9:40 /km", expected: readiness > 5 ? 8.1 : 8.9 };
  if (model === "progressivo_controlado") return { label: "6:50-8:20 /km", expected: 7.6 };
  return { label: "10:00-12:00 /km", expected: 11 };
}

function modelLabel(model) {
  const labels = {
    caminhada_diagnostica: "Caminhada diagnóstica",
    caminhada_progressiva: "Caminhada progressiva",
    corrida_caminhada_curta: "Corrida e caminhada curta",
    corrida_caminhada_base: "Corrida e caminhada base",
    corrida_leve_continua: "Corrida leve contínua",
    progressivo_controlado: "Progressivo controlado",
    recuperacao: "Recuperação ativa"
  };
  return labels[model] || "Treino orientado";
}

function weekStrategy(days, profile, risk, readiness) {
  const count = days.length;
  const hasConsecutive = days.some((day, index) => index > 0 && DAY_INDEX[day] - DAY_INDEX[days[index - 1]] === 1);

  if (count === 1) {
    return { pattern: ["diagnostico"], reason: "com 1 dia disponível, o primeiro passo é avaliar resposta ao treino sem acumular carga." };
  }

  if (count === 2) {
    return { pattern: ["diagnostico", risk.level === "alto" ? "recuperacao" : "base"], reason: "com 2 dias, o plano usa um diagnóstico e um treino controlado." };
  }

  if (hasConsecutive || risk.level === "alto") {
    return { pattern: ["diagnostico", "recuperacao", "base", "recuperacao", "base"], reason: "dias próximos ou risco maior exigem recuperação entre estímulos." };
  }

  if (profile.goal === "correr_10k" && readiness >= 4) {
    return { pattern: ["diagnostico", "base", "progressivo", "recuperacao", "longo"], reason: "objetivo de 10 km precisa de base, ritmo controlado e um treino longo leve." };
  }

  if (profile.goal === "correr_5k" && readiness >= 3) {
    return { pattern: ["diagnostico", "base", "progressivo", "recuperacao", "longo"], reason: "objetivo de 5 km precisa evoluir continuidade sem pressa." };
  }

  return { pattern: ["diagnostico", "recuperacao", "base", "recuperacao", "longo"], reason: "a semana alterna avaliação, treino leve e constância." };
}

function buildPlan(profile, analysis, basis = "MANTER") {
  const selectedDays = profile.days;
  const pattern = analysis.week.pattern.slice(0, selectedDays.length);
  const days = selectedDays.map((day, index) => createWorkout(day, pattern[index] || "base", analysis, basis, index));

  return {
    id: currentWeekId(),
    createdAt: new Date().toISOString(),
    basis,
    days
  };
}

function createWorkout(day, purpose, analysis, basis, index) {
  const model = workoutModelForPurpose(purpose, analysis);
  const distance = workoutDistanceForPurpose(purpose, analysis.distance, basis, index, analysis.risk.level);
  const pace = paceGuide(model, analysis.risk, analysis.readiness);

  return {
    day,
    purpose,
    model,
    title: modelLabel(model),
    targetDistance: distance,
    expectedPace: pace.expected,
    paceLabel: pace.label,
    blocks: buildBlocks(distance, model, pace),
    status: "pendente"
  };
}

function workoutModelForPurpose(purpose, analysis) {
  if (purpose === "diagnostico") return analysis.model;
  if (purpose === "recuperacao") return "recuperacao";
  if (purpose === "progressivo") {
    if (analysis.model === "progressivo_controlado" || analysis.model === "corrida_leve_continua") return "progressivo_controlado";
    return "corrida_caminhada_base";
  }
  if (purpose === "longo") {
    if (analysis.model === "caminhada_diagnostica") return "caminhada_progressiva";
    if (analysis.model === "progressivo_controlado") return "corrida_leve_continua";
    return analysis.model;
  }
  return analysis.model === "caminhada_diagnostica" ? "caminhada_progressiva" : analysis.model;
}

function workoutDistanceForPurpose(purpose, base, basis, index, riskLevel) {
  let distance = base;
  if (purpose === "recuperacao") distance = Math.min(base - 0.6, base * 0.68);
  if (purpose === "longo") distance += riskLevel === "alto" ? 0.2 : 0.7;
  if (purpose === "progressivo") distance += riskLevel === "baixo" ? 0.2 : 0;
  if (basis === "AUMENTAR") distance += index === 0 ? 0 : 0.4;
  if (basis === "REDUZIR") distance -= 0.6;
  return clamp(roundDistance(distance), 1.4, 9);
}

function buildBlocks(distance, model, pace) {
  if (model === "caminhada_diagnostica") {
    return walkingBlocks(distance, [
      ["Caminhada aquecimento", 0.4, "12:00-13:00 /km"],
      ["Caminhada confortável", 0.8, pace.label],
      ["Caminhada firme", 0.8, "10:50-12:00 /km"],
      ["Caminhada final", 99, "12:00-13:00 /km"]
    ]);
  }

  if (model === "caminhada_progressiva") {
    return walkingBlocks(distance, [
      ["Caminhada aquecimento", 0.5, "11:30-12:30 /km"],
      ["Caminhada ativa", 1, pace.label],
      ["Caminhada firme", 1, "10:20-11:20 /km"],
      ["Caminhada final", 99, "11:30-12:30 /km"]
    ]);
  }

  if (model === "corrida_caminhada_curta") {
    return intervalBlocks(distance, 0.18, 0.62, pace, "Corrida leve curta");
  }

  if (model === "corrida_caminhada_base") {
    return intervalBlocks(distance, 0.35, 0.55, pace, "Corrida leve");
  }

  if (model === "corrida_leve_continua") {
    return continuousBlocks(distance, pace, "Corrida leve contínua");
  }

  if (model === "progressivo_controlado") {
    return progressiveBlocks(distance, pace);
  }

  return walkingBlocks(distance, [
    ["Caminhada solta", 0.5, "12:00-13:00 /km"],
    ["Recuperação ativa", 99, "11:30-12:40 /km"]
  ]);
}

function walkingBlocks(distance, template) {
  const blocks = [];
  let current = 0;
  template.forEach(([title, size, pace]) => {
    if (current >= distance) return;
    const end = Math.min(distance, current + size);
    blocks.push(block(current, end, title, pace));
    current = end;
  });
  return blocks;
}

function intervalBlocks(distance, runSize, walkSize, pace, runTitle) {
  const blocks = [];
  let current = 0;
  blocks.push(block(current, Math.min(distance, 0.5), "Caminhada aquecimento", "11:00-12:00 /km"));
  current = Math.min(distance, 0.5);

  while (current < distance - 0.45) {
    const runEnd = Math.min(distance, current + runSize);
    blocks.push(block(current, runEnd, runTitle, pace.label));
    current = runEnd;
    const walkEnd = Math.min(distance, current + walkSize);
    blocks.push(block(current, walkEnd, "Caminhada recuperação", "10:00-11:30 /km"));
    current = walkEnd;
  }

  if (current < distance) blocks.push(block(current, distance, "Caminhada final", "10:30-12:00 /km"));
  return blocks;
}

function continuousBlocks(distance, pace, title) {
  const warmEnd = Math.min(distance, 0.7);
  const coolStart = Math.max(warmEnd, distance - 0.5);
  const blocks = [block(0, warmEnd, "Caminhada aquecimento", "10:30-11:30 /km")];
  if (coolStart > warmEnd) blocks.push(block(warmEnd, coolStart, title, pace.label));
  if (distance > coolStart) blocks.push(block(coolStart, distance, "Caminhada final", "10:40-12:00 /km"));
  return blocks;
}

function progressiveBlocks(distance, pace) {
  const blocks = [];
  const warmEnd = Math.min(distance, 0.8);
  const middle = Math.min(distance, warmEnd + Math.max(1.2, (distance - 1.3) * 0.65));
  const finish = Math.max(middle, distance - 0.5);
  blocks.push(block(0, warmEnd, "Aquecimento leve", "10:00-11:00 /km"));
  if (middle > warmEnd) blocks.push(block(warmEnd, middle, "Corrida leve", "7:40-8:40 /km"));
  if (finish > middle) blocks.push(block(middle, finish, "Ritmo controlado", pace.label));
  if (distance > finish) blocks.push(block(finish, distance, "Desaceleração", "10:00-11:30 /km"));
  return blocks;
}

function block(start, end, title, pace) {
  return {
    range: `${start.toFixed(1).replace(".", ",")} - ${end.toFixed(1).replace(".", ",")} km`,
    title,
    pace,
    done: false
  };
}

function personalAnalysisText(profile, analysis) {
  const riskText = analysis.risk.flags.length
    ? analysis.risk.flags.map((item) => `- ${item}.`).join("\n")
    : "- não há sinal inicial de risco alto.";

  return `Leitura inicial do personal:

Objetivo: ${LABELS.goal[profile.goal]}.
Nível informado: ${LABELS.level[profile.level]}.
Rotina atual: ${LABELS.routine[profile.routine]}.
Disponibilidade: ${profile.days.length} dia(s) por semana.

Eu não vou pedir para você adivinhar quantos km consegue correr. O primeiro treino será diagnóstico e seguro.

Modelo escolhido: ${analysis.modelLabel}.
Distância inicial: ${formatKm(analysis.distance)}.
Ritmo guia: ${analysis.pace.label}.

Condições consideradas:
${riskText}

Depois do feedback, vou comparar distância feita, tempo, esforço e dor para decidir se devo MANTER, REDUZIR ou AUMENTAR os próximos treinos.`;
}

function modelReason(profile, risk, readiness, model) {
  if (model === "caminhada_diagnostica") return "o perfil precisa ser avaliado com baixo impacto antes de qualquer corrida.";
  if (model === "caminhada_progressiva") return "o objetivo é criar base sem exigir que você saiba seu limite atual.";
  if (model === "corrida_caminhada_curta") return "o app vai testar pequenos estímulos de corrida sem transformar o treino em prova.";
  if (model === "corrida_caminhada_base") return "há sinais suficientes para alternar corrida e caminhada com mais estrutura.";
  if (model === "corrida_leve_continua") return "o perfil já permite corrida leve contínua, sem usar caminhada como regra fixa.";
  if (model === "progressivo_controlado") return "o objetivo e a rotina permitem um treino mais voltado a performance.";
  return "modelo escolhido por segurança.";
}

function distanceReason(profile, risk, distance) {
  if (risk.level === "alto") return "a distância foi limitada por segurança e impacto articular.";
  if (profile.goal === "emagrecimento") return "a distância busca gasto calórico com chance real de constância.";
  if (profile.goal === "correr_5k") return "a distância aproxima o corpo do objetivo sem forçar corrida contínua cedo demais.";
  if (profile.goal === "correr_10k") return "a distância inicia base para 10 km, mas ainda depende da resposta real.";
  return "a distância foi estimada por nível, rotina e disponibilidade.";
}

function paceReason(model, risk) {
  if (risk.level === "alto") return "o ritmo é confortável para observar dor e respiração.";
  if (model === "progressivo_controlado") return "o ritmo serve para avaliar controle sem buscar velocidade máxima.";
  if (model === "corrida_leve_continua") return "o ritmo evita intensidade alta no diagnóstico.";
  return "o ritmo guia o treino, mas o feedback decide se ele estava fácil ou pesado.";
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

function buildFeedback(form, workout) {
  const data = new FormData(form);
  const distance = Number(data.get("distance"));
  const minutes = Number(data.get("minutes"));
  return {
    id: uniqueId(),
    planId: state.plan.id,
    day: workout.day,
    completed: data.get("completed"),
    distance,
    minutes,
    actualPace: distance > 0 ? minutes / distance : 99,
    effort: data.get("effort"),
    finishFeeling: data.get("finishFeeling"),
    jointPain: data.get("jointPain"),
    painLocation: data.get("painLocation"),
    musclePain: data.get("musclePain"),
    plannedDistance: workout.targetDistance,
    expectedPace: workout.expectedPace,
    createdAt: new Date().toISOString()
  };
}

function evaluateFeedback(feedback) {
  const pain = SCORE.pain[feedback.jointPain] || 0;
  const effort = SCORE.effort[feedback.effort] || 0;
  const finish = SCORE.finish[feedback.finishFeeling] || 0;
  const completed = feedback.completed === "sim";
  const partial = feedback.completed === "parcial";
  const fasterThanExpected = feedback.actualPace <= feedback.expectedPace - 0.7;
  const muchSlower = feedback.actualPace >= feedback.expectedPace + 1.2;
  const distanceOk = feedback.distance >= feedback.plannedDistance * 0.95;
  const distanceLow = feedback.distance < feedback.plannedDistance * 0.8;

  if (pain >= 6 || !completed && (effort >= 8 || finish >= 8) || distanceLow && effort >= 8) {
    return {
      status: "REDUZIR",
      text: `Vou reduzir os próximos treinos.

O treino mostrou sinal de risco: ${pain >= 6 ? "dor articular relevante" : "dificuldade alta para concluir"}.

Agora o objetivo é recuperar controle, reduzir impacto e voltar a terminar sem dor.`
    };
  }

  if (completed && distanceOk && pain === 0 && effort <= 5 && finish <= 4 && fasterThanExpected) {
    return {
      status: "AUMENTAR",
      text: `Vou aumentar com cuidado.

Você concluiu o treino, ficou sem dor articular e fez um ritmo melhor que o previsto sem esforço alto.

O aumento será pequeno: mais volume ou mais continuidade, não velocidade máxima.`
    };
  }

  if (completed && distanceOk && pain <= 2 && effort <= 5 && finish <= 4) {
    return {
      status: "MANTER",
      text: `Vou manter o plano.

O treino ficou dentro do esperado: distância concluída, esforço controlado e sem sinal articular importante.

Ainda não preciso mexer no treino. O foco é repetir bem.`
    };
  }

  if (partial || muchSlower || effort >= 8 || finish >= 8) {
    return {
      status: "REDUZIR",
      text: `Vou reduzir levemente.

O resultado indica que o treino ficou mais pesado que o ideal para este momento.

Reduzir agora não é regredir. É ajustar a carga para manter constância.`
    };
  }

  return {
    status: "MANTER",
    text: `Vou manter por enquanto.

O feedback não mostrou motivo suficiente para aumentar nem risco claro para reduzir.

No próximo treino, vou observar se esse padrão se repete.`
  };
}

function applyDecisionToPending(decision) {
  if (!state.plan || !state.analysis) return;
  state.plan.days.forEach((workout) => {
    if (workout.status === "feito") return;

    if (decision.status === "REDUZIR") {
      workout.model = "recuperacao";
      workout.title = modelLabel(workout.model);
      workout.targetDistance = clamp(roundDistance(workout.targetDistance - 0.6), 1.4, 9);
      const pace = paceGuide(workout.model, state.analysis.risk, state.analysis.readiness);
      workout.expectedPace = pace.expected;
      workout.paceLabel = pace.label;
      workout.blocks = buildBlocks(workout.targetDistance, workout.model, pace);
    }

    if (decision.status === "AUMENTAR" && state.analysis.risk.level !== "alto") {
      workout.model = upgradeModel(workout.model);
      workout.title = modelLabel(workout.model);
      workout.targetDistance = clamp(roundDistance(workout.targetDistance + 0.3), 1.4, 9);
      const pace = paceGuide(workout.model, state.analysis.risk, state.analysis.readiness + 0.4);
      workout.expectedPace = pace.expected;
      workout.paceLabel = pace.label;
      workout.blocks = buildBlocks(workout.targetDistance, workout.model, pace);
    }
  });
}

function upgradeModel(model) {
  if (model === "caminhada_diagnostica") return "caminhada_progressiva";
  if (model === "caminhada_progressiva") return "corrida_caminhada_curta";
  if (model === "corrida_caminhada_curta") return "corrida_caminhada_base";
  if (model === "corrida_caminhada_base") return "corrida_leve_continua";
  return model;
}

function fastingAdvice() {
  if (!state.profile) return "A orientação aparece após o perfil.";
  if (state.fasting === "0") return "Sem jejum registrado. Para começar, priorize hidratação e refeição leve antes do treino.";
  if (state.profile.schedule === "noite" && state.fasting === "16") return "Jejum de 16h pode pesar para treino à noite. Se o feedback cair, reduza para 12h ou 14h.";
  return `Jejum de ${state.fasting}h registrado. Se o treino perder qualidade, o personal recomenda reduzir a janela.`;
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
  const button = $(".hero-card .primary-button");
  if (!state.profile || !state.analysis || !state.plan) {
    $("#home-title").textContent = "Seu treino começa com avaliação.";
    $("#home-subtitle").textContent = "Responda perguntas fechadas. O app decide o treino, acompanha o resultado e ajusta o plano.";
    button.textContent = "Iniciar avaliação";
    button.dataset.tab = "profile-screen";
    $("#home-decision").textContent = "Aguardando perfil";
    $("#home-coach-text").textContent = "O CorridaG não pergunta quanto você consegue correr. Ele estima com segurança, testa no treino diagnóstico e refina com seu feedback.";
    $("#home-workout-day").textContent = "Próximo treino";
    $("#home-workout-distance").textContent = "-";
    $("#home-workout-type").textContent = "O treino será criado após a avaliação.";
  } else {
    const workout = currentWorkout();
    $("#home-title").textContent = "Treino definido pelo personal.";
    $("#home-subtitle").textContent = "Execute o plano prescrito. Depois do feedback, o motor recalibra os próximos treinos.";
    button.textContent = "Abrir treino";
    button.dataset.tab = "training-screen";
    $("#home-decision").textContent = state.decision.status;
    $("#home-coach-text").textContent = state.decision.text;
    $("#home-workout-day").textContent = workout ? workout.day : "Próximo treino";
    $("#home-workout-distance").textContent = workout ? formatKm(workout.targetDistance) : "-";
    $("#home-workout-type").textContent = workout ? workout.title : "Plano não gerado.";
  }

  const goal = waterGoal(state.profile);
  const percent = goal.target ? clamp(Math.round((state.water.amount / goal.target) * 100), 0, 100) : 0;
  $("#home-water").textContent = goal.target ? `${percent}%` : "0%";
  $("#home-water-goal").textContent = goal.target ? `${(goal.target / 1000).toFixed(1).replace(".", ",")} L/dia` : "Sem meta";
  $("#home-fasting").textContent = state.fasting === "0" ? "Não" : `${state.fasting}h`;
  $("#home-fasting-status").textContent = state.profile ? "Orientado" : "Sem orientação";
  $("#home-weight").textContent = formatWeight(state.profile?.weight);
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
    $("#training-type").textContent = "Preencha o perfil para montar a primeira semana.";
    $("#training-purpose").textContent = "Primeiro treino: diagnóstico seguro.";
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

  const done = workout.blocks.filter((item) => item.done).length;
  const progress = Math.round((done / workout.blocks.length) * 100);
  $("#training-day").textContent = workout.day;
  $("#training-distance").textContent = formatKm(workout.targetDistance);
  $("#training-type").textContent = workout.title;
  $("#training-purpose").textContent = purposeText(workout.purpose);
  $("#training-progress").style.setProperty("--progress", `${progress}%`);
  $("#training-progress-text").textContent = `${progress}% concluído`;
  steps.innerHTML = workout.blocks.map((item, index) => `
    <button type="button" class="step-card ${item.done ? "done" : ""}" data-step="${index}">
      <span>
        <small>${item.range}</small>
        <strong>${item.title}</strong>
        Ritmo guia: ${item.pace}
      </span>
      <span>${item.done ? "OK" : "Fazer"}</span>
    </button>
  `).join("");
  finishButton.classList.toggle("hidden", progress < 100);
}

function purposeText(purpose) {
  const texts = {
    diagnostico: "Objetivo: avaliar sua resposta real ao treino.",
    recuperacao: "Objetivo: recuperar sem perder constância.",
    base: "Objetivo: construir base cardio.",
    progressivo: "Objetivo: testar controle de ritmo.",
    longo: "Objetivo: sustentar volume leve."
  };
  return texts[purpose] || "Objetivo: treino orientado pelo personal.";
}

function renderPersonal() {
  if (!state.analysis) {
    $("#personal-analysis").textContent = "Preencha o perfil para receber a análise inicial.";
    $("#reason-model").textContent = "-";
    $("#reason-model-text").textContent = "Aguardando perfil.";
    $("#reason-distance").textContent = "-";
    $("#reason-distance-text").textContent = "Aguardando perfil.";
    $("#reason-pace").textContent = "-";
    $("#reason-pace-text").textContent = "Aguardando perfil.";
    $("#reason-week").textContent = "-";
    $("#reason-week-text").textContent = "Aguardando disponibilidade.";
  } else {
    $("#personal-analysis").textContent = state.analysis.text;
    $("#reason-model").textContent = state.analysis.modelLabel;
    $("#reason-model-text").textContent = state.analysis.modelReason;
    $("#reason-distance").textContent = formatKm(state.analysis.distance);
    $("#reason-distance-text").textContent = state.analysis.distanceReason;
    $("#reason-pace").textContent = state.analysis.pace.label;
    $("#reason-pace-text").textContent = state.analysis.paceReason;
    $("#reason-week").textContent = `${state.profile.days.length} dia(s)`;
    $("#reason-week-text").textContent = state.analysis.weekReason;
  }

  $("#personal-decision").textContent = state.decision.status;
  $("#personal-decision-text").textContent = state.decision.text;
}

function renderHealth() {
  const goal = waterGoal(state.profile);
  const percent = goal.target ? clamp(Math.round((state.water.amount / goal.target) * 100), 0, 100) : 0;
  $("#water-goal").textContent = goal.target ? `${(goal.min / 1000).toFixed(1).replace(".", ",")} a ${(goal.max / 1000).toFixed(1).replace(".", ",")} L` : "-";
  $("#water-advice").textContent = goal.target ? `Meta prática: ${(goal.target / 1000).toFixed(1).replace(".", ",")} L hoje.` : "Preencha o perfil para calcular a meta.";
  $("#water-total").textContent = `${state.water.amount} ml registrados hoje`;
  $("#water-progress").style.setProperty("--progress", `${percent}%`);
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
    state.feedbacks = [];
    state.decision = {
      status: "DIAGNÓSTICO",
      text: "Primeira semana criada. O treino inicial avalia sua resposta real; depois o motor ajusta os próximos treinos com base no feedback."
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
    const step = workout.blocks[Number(button.dataset.step)];
    if (!step) return;
    step.done = !step.done;
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
    const feedback = buildFeedback(event.currentTarget, workout);
    const decision = evaluateFeedback(feedback);
    state.feedbacks.push({ ...feedback, decision: decision.status });
    state.decision = decision;
    workout.status = feedback.completed === "sim" ? "feito" : "pendente";
    if (feedback.completed === "sim") workout.blocks.forEach((item) => { item.done = true; });
    applyDecisionToPending(decision);
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
    const basis = ["AUMENTAR", "REDUZIR"].includes(state.decision.status) ? state.decision.status : "MANTER";
    state.analysis = analyzeProfile(state.profile);
    state.plan = buildPlan(state.profile, state.analysis, basis);
    state.selectedDay = state.plan.days[0]?.day || null;
    state.decision = {
      status: basis,
      text: basis === "AUMENTAR"
        ? "Nova semana criada com pequeno aumento controlado."
        : basis === "REDUZIR"
          ? "Nova semana criada com redução de carga por segurança."
          : "Nova semana criada mantendo o padrão atual."
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
