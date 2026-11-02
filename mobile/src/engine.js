// Motor do timer (porte do app.py). Estado imutável: cada função retorna um novo objeto.
// O avanço de etapas é calculado pelo horário de término (endsAt), então o tempo
// continua correto mesmo se o app ficar em segundo plano.

export const MODES = {
  round:   { label: "Round Timer",   work: 300,  rest: 60, rounds: 5,  warn: true, desc: "Rounds e descanso no formato clássico de luta." },
  tabata:  { label: "Tabata",        work: 20,   rest: 10, rounds: 8,  warn: true, desc: "Intervalado de alta intensidade." },
  circuit: { label: "Circuito",      work: 45,   rest: 15, rounds: 10, warn: true, desc: "Estações com troca rápida entre exercícios." },
  openmat: { label: "Open Mat",      work: 3600, rest: 0,  rounds: 1,  warn: true, desc: "Contagem longa e contínua para treino livre." },
  custom:  { label: "Personalizado", work: 180,  rest: 30, rounds: 3,  warn: true, desc: "Defina seus próprios tempos e rounds." },
};

export function configure(mode, work, rest, rounds, warn) {
  const w = Math.max(1, Math.round(work));
  return {
    mode: MODES[mode] ? mode : "custom",
    work: w,
    rest: Math.max(0, Math.round(rest)),
    rounds: Math.max(1, Math.round(rounds)),
    warn: !!warn,
    round: 1,
    phase: "idle", // idle | work | rest | done
    running: false,
    remaining: w * 1000, // ms (quando pausado)
    endsAt: null, // epoch ms (quando rodando)
  };
}

export const defaultTimer = () => {
  const m = MODES.round;
  return configure("round", m.work, m.rest, m.rounds, m.warn);
};

export function reset(t) {
  return configure(t.mode, t.work, t.rest, t.rounds, t.warn);
}

const dur = (t, phase) => (phase === "rest" ? t.rest : t.work) * 1000;

// próxima etapa a partir da atual
function advance(t) {
  let { phase, round } = t;
  if (phase === "idle" || phase === "rest") {
    if (phase === "rest") round += 1;
    phase = "work";
  } else if (phase === "work") {
    if (round >= t.rounds) phase = "done";
    else if (t.rest > 0) phase = "rest";
    else { round += 1; phase = "work"; }
  }
  if (phase === "done") return { ...t, phase, round, running: false, remaining: 0, endsAt: null };
  return { ...t, phase, round };
}

// aplica as transições vencidas até `now`
export function tick(t, now = Date.now()) {
  let s = t;
  while (s.running && s.endsAt !== null && now >= s.endsAt) {
    const prevEnd = s.endsAt;
    s = advance(s);
    if (s.phase !== "done") s = { ...s, endsAt: prevEnd + dur(s, s.phase) };
  }
  return s;
}

export function start(t, now = Date.now()) {
  let s = tick(t, now);
  if (s.phase === "done") s = reset(s);
  if (s.phase === "idle") s = { ...s, phase: "work", remaining: s.work * 1000 };
  if (!s.running) s = { ...s, running: true, endsAt: now + s.remaining };
  return s;
}

export function pause(t, now = Date.now()) {
  const s = tick(t, now);
  if (!s.running) return s;
  return { ...s, running: false, remaining: Math.max(0, s.endsAt - now), endsAt: null };
}

export function toggle(t, now = Date.now()) {
  const s = tick(t, now);
  return s.running ? pause(s, now) : start(s, now);
}

export function skip(t, now = Date.now()) {
  let s = tick(t, now);
  if (s.phase === "done") return s;
  s = advance(s);
  if (s.phase === "done") return s;
  const d = dur(s, s.phase);
  return s.running ? { ...s, remaining: d, endsAt: now + d } : { ...s, remaining: d };
}

export function remainingMs(t, now = Date.now()) {
  if (t.running && t.endsAt !== null) return Math.max(0, t.endsAt - now);
  return t.remaining;
}

export function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const totalSeconds = (c) => c.work * c.rounds + c.rest * Math.max(0, c.rounds - 1);

// estado visual: idle | work | rest | paused | done
export function visualState(t) {
  if ((t.phase === "work" || t.phase === "rest") && !t.running) return "paused";
  return t.phase;
}

export const STATUS = {
  idle:   ["■", "PRONTO"],
  work:   ["●", "EM ANDAMENTO"],
  paused: ["❚❚", "PAUSADO"],
  rest:   ["○", "DESCANSO"],
  done:   ["✓", "CONCLUÍDO"],
};

export function nextStep(t) {
  const more = t.round < t.rounds;
  if (t.phase === "done") return { label: "Sessão concluída", time: "" };
  if (t.phase === "idle") return { label: "Próximo: Round 1", time: fmt(t.work) };
  if (t.phase === "rest") return { label: `Próximo: Round ${t.round + 1}`, time: fmt(t.work) };
  if (more && t.rest > 0) return { label: "Próximo: Descanso", time: fmt(t.rest) };
  if (more) return { label: `Próximo: Round ${t.round + 1}`, time: fmt(t.work) };
  return { label: "Próximo: Fim da sessão", time: "" };
}
