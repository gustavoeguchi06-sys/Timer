/* CT MAX TIMER — cliente. O estado vem do backend Python (/api). */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------------------------------------------------------------- API
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  // ---------------------------------------------------------------- Estado local
  const S = {
    modes: {},
    settings: null,
    versions: { settings: 0, score: 0, templates: 0 },
    timer: null,          // último snapshot do servidor
    syncAt: 0,            // performance.now() do snapshot
    online: true,
    cfg: { mode: "round", work: 300, rest: 60, rounds: 5, warn: true },
    lastKey: "",          // phase+round para detectar transições
    lastSec: null,
  };

  const fmt = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------------------------------------------------------------- Áudio
  let actx = null;
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  document.addEventListener("pointerdown", () => { try { audio(); } catch (_) {} }, { once: true });
  document.addEventListener("keydown", () => { try { audio(); } catch (_) {} }, { once: true });

  const masterVol = () => (S.settings?.volume ?? 80) / 100;
  const soundEnabled = () => S.settings && S.settings.sound;

  // Sino de ringue: parciais inarmônicas com decaimento longo
  function bell(delay = 0, base = 620, len = 2.2) {
    if (!soundEnabled()) return;
    try {
      const ctx = audio();
      const t0 = ctx.currentTime + delay;
      const out = ctx.createGain();
      out.gain.value = masterVol() * 0.5;
      out.connect(ctx.destination);
      [[1, 1], [2.76, 0.55], [5.4, 0.3], [8.93, 0.15]].forEach(([ratio, amp], i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = base * ratio;
        const d = len / (1 + i * 0.8);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(amp, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g).connect(out);
        o.start(t0); o.stop(t0 + d + 0.05);
      });
    } catch (_) {}
  }

  // Beep curto (tom puro com ataque rápido)
  function tone(freq = 1046, dur = 0.14, delay = 0) {
    if (!soundEnabled()) return;
    try {
      const ctx = audio();
      const t0 = ctx.currentTime + delay;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(masterVol() * 0.18, t0 + 0.005);
      g.gain.setValueAtTime(masterVol() * 0.18, t0 + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (_) {}
  }

  const sounds = {
    start:   () => bell(0, 620, 2.4),                                   // 1 toque de sino: começa
    end:     () => { bell(0, 620, 1.2); bell(0.35, 620, 1.2); bell(0.7, 620, 2); }, // 3 toques: fim do round
    done:    () => { [0, 0.3, 0.6, 0.9, 1.2].forEach((d) => bell(d, 620, d === 1.2 ? 2.5 : 1)); },
    beep:    () => tone(1046, 0.14),                                     // contagem dos 10s finais
  };
  const soundsOn = () => !$("#display").hidden; // só o dispositivo que está exibindo toca

  // ---------------------------------------------------------------- Views
  const isTv = location.pathname.replace(/\/$/, "") === "/tv";
  function showView(name) {
    if (name === "display") return openDisplay();
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    if (name === "custom") requestAnimationFrame(fitPreview);
    window.scrollTo(0, 0);
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

  function openDisplay() {
    $("#display").hidden = false;
    wakeUi();
  }
  function closeDisplay() {
    if (isTv) return; // a TV fica sempre na exibição
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $("#display").hidden = true;
  }
  function toggleFullscreen(el = document.documentElement) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }

  // ---------------------------------------------------------------- Tela 1 — Modos
  function selectMode(mode) {
    $$(".mode-card").forEach((c) => c.classList.toggle("selected", c.dataset.mode === mode));
    if (mode === "score") return showView("score");
    const p = S.modes[mode];
    if (p) S.cfg = { mode, work: p.work, rest: p.rest, rounds: p.rounds, warn: p.warn };
    renderConfig();
    showView("config");
  }
  $$(".mode-card").forEach((c) => c.addEventListener("click", () => selectMode(c.dataset.mode)));

  async function loadTemplates() {
    const list = await api("GET", "/api/templates");
    const wrap = $("#templatesWrap"), host = $("#templateList");
    wrap.hidden = list.length === 0;
    host.innerHTML = "";
    list.forEach((t) => {
      const row = document.createElement("div");
      row.className = "template";
      row.innerHTML = `
        <div class="template-info">
          <div class="template-name"></div>
          <div class="template-meta">${fmt(t.work)} · ${fmt(t.rest)} desc. · ${t.rounds}x</div>
        </div>
        <button class="btn btn-secondary btn-sm" data-act="use">Usar</button>
        <button class="btn-icon" data-act="del" title="Excluir" aria-label="Excluir modelo"><svg class="i"><use href="#i-trash"/></svg></button>`;
      $(".template-name", row).textContent = t.name;
      $('[data-act="use"]', row).onclick = () => {
        S.cfg = { mode: t.mode, work: t.work, rest: t.rest, rounds: t.rounds, warn: t.warn };
        renderConfig(); showView("config");
      };
      $('[data-act="del"]', row).onclick = async () => {
        if (!confirm(`Excluir o modelo "${t.name}"?`)) return;
        await api("DELETE", `/api/templates/${t.id}`);
        loadTemplates();
      };
      host.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- Tela 2 — Configuração
  const fields = {
    work:   { range: "#workRange",   out: "#workOut",   fmt },
    rest:   { range: "#restRange",   out: "#restOut",   fmt },
    rounds: { range: "#roundsRange", out: "#roundsOut", fmt: (v) => String(v) },
  };

  function renderConfig() {
    const c = S.cfg;
    for (const [k, f] of Object.entries(fields)) {
      const r = $(f.range);
      if (k === "work") r.max = Math.max(3600, c.work);
      r.value = c[k];
      $(f.out).textContent = f.fmt(c[k]);
    }
    $("#warnToggle").checked = c.warn;
    $("#cfgModeLabel").textContent = (S.modes[c.mode] || S.modes.custom || {}).label || "Personalizado";
    const total = c.work * c.rounds + c.rest * Math.max(0, c.rounds - 1);
    $("#sessionSummary").textContent =
      `${c.rounds} round${c.rounds > 1 ? "s" : ""} de ${fmt(c.work)}` +
      (c.rest ? ` com ${fmt(c.rest)} de descanso entre eles.` : " sem descanso.");
    $("#sumTotal").textContent = fmt(total);
    // linha do tempo proporcional: round (ciano) e descanso (petróleo)
    const tl = $("#timeline");
    tl.innerHTML = "";
    for (let i = 0; i < c.rounds; i++) {
      const w = document.createElement("span");
      w.className = "tl-work"; w.style.flex = c.work;
      tl.appendChild(w);
      if (c.rest && i < c.rounds - 1) {
        const r = document.createElement("span");
        r.className = "tl-rest"; r.style.flex = c.rest;
        tl.appendChild(r);
      }
    }
    $$('input[type="range"]').forEach(paintRange);
  }

  // preenchimento da trilha dos sliders (Chrome/Edge usam a variável --p)
  function paintRange(el) {
    const min = +el.min || 0, max = +el.max || 100;
    el.style.setProperty("--p", `${((+el.value - min) / (max - min)) * 100}%`);
  }
  document.addEventListener("input", (e) => { if (e.target.matches('input[type="range"]')) paintRange(e.target); });

  for (const [k, f] of Object.entries(fields)) {
    $(f.range).addEventListener("input", (e) => { S.cfg[k] = +e.target.value; renderConfig(); });
    $$(`.field[data-field="${k}"] .step`).forEach((b) => {
      let hold;
      const step = () => {
        const r = $(f.range);
        let d = +b.dataset.delta;
        if (k === "work" && S.cfg.work >= 600) d *= 6;    // passos de 30s acima de 10 min
        S.cfg[k] = Math.min(+r.max, Math.max(+r.min, S.cfg[k] + d));
        renderConfig();
      };
      b.addEventListener("pointerdown", () => { step(); hold = setTimeout(() => (hold = setInterval(step, 90)), 400); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
        b.addEventListener(ev, () => { clearTimeout(hold); clearInterval(hold); }));
    });
  }
  $("#warnToggle").addEventListener("change", (e) => { S.cfg.warn = e.target.checked; });

  $("#saveTemplateBtn").addEventListener("click", async () => {
    const name = prompt("Nome do modelo:", `${(S.modes[S.cfg.mode] || {}).label || "Treino"} ${fmt(S.cfg.work)}`);
    if (!name) return;
    await api("POST", "/api/templates", { name, ...S.cfg });
    toast("Modelo salvo");
    loadTemplates();
  });

  $("#startSessionBtn").addEventListener("click", async () => {
    applySnapshot(await api("POST", "/api/timer/configure", S.cfg));
    applySnapshot(await api("POST", "/api/timer/start"));
    openDisplay();
  });

  // ---------------------------------------------------------------- Tela 3 — Personalização
  let saveT;
  function saveSettings(patch, delay = 400) {
    Object.assign(S.settings, patch);
    applySettings();
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try {
        S.settings = await api("PUT", "/api/settings", S.settings);
        S.versions.settings++; // evita refetch redundante
      } catch (e) { toast("Erro ao salvar: " + e.message); }
    }, delay);
  }

  function fillSettingsForm() {
    const s = S.settings;
    $("#gymName").value = s.gym_name;
    $("#brandColor").value = s.brand_color;
    $("#soundToggle").checked = s.sound;
    $("#volumeRange").value = s.volume;
    $("#volumeOut").textContent = s.volume + "%";
    $("#nextToggle").checked = s.show_next;
    $("#contrastToggle").checked = s.high_contrast;
  }

  $("#gymName").addEventListener("input", (e) => saveSettings({ gym_name: e.target.value }));
  $("#brandColor").addEventListener("input", (e) => saveSettings({ brand_color: e.target.value }));
  $("#soundToggle").addEventListener("change", (e) => saveSettings({ sound: e.target.checked }, 0));
  $("#volumeRange").addEventListener("input", (e) => {
    $("#volumeOut").textContent = e.target.value + "%";
    saveSettings({ volume: +e.target.value });
  });
  $("#nextToggle").addEventListener("change", (e) => saveSettings({ show_next: e.target.checked }, 0));
  $("#contrastToggle").addEventListener("change", (e) => saveSettings({ high_contrast: e.target.checked }, 0));
  $("#testSound").addEventListener("click", () => { [0, 1, 2].forEach((i) => setTimeout(sounds.beep, i * 1000)); setTimeout(sounds.start, 3000); });
  $("#logoClear").addEventListener("click", () => saveSettings({ logo: "" }, 0));
  $("#logoInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      // reduz para no máximo 256px de altura para manter o data.json leve
      const scale = Math.min(1, 256 / img.height);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      saveSettings({ logo: c.toDataURL("image/png") }, 0);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  });

  // texto escuro (marinho) ou branco sobre a cor de destaque, conforme o contraste
  function textOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.18 ? "#04202B" : "#FFFFFF";
  }

  function applySettings() {
    const s = S.settings;
    document.documentElement.style.setProperty("--brand", s.brand_color);
    document.documentElement.style.setProperty("--on-brand", textOn(s.brand_color));
    document.body.classList.toggle("hc", !!s.high_contrast);
    $("#navName").textContent = s.gym_name || "CT MAX TIMER";
    $("#navLogo").hidden = !s.logo;
    $("#logoThumb").hidden = !s.logo;
    $("#logoEmpty").hidden = !!s.logo;
    if (s.logo) $("#logoThumb").src = s.logo;
    paintRange($("#volumeRange"));
    if (s.logo) $("#navLogo").src = s.logo;
    displays().forEach((root) => {
      $(".d-name", root).textContent = s.gym_name || "CT MAX TIMER";
      const logo = $(".d-logo", root);
      logo.hidden = !s.logo;
      if (s.logo) logo.src = s.logo;
      $(".d-next", root).style.visibility = s.show_next ? "visible" : "hidden";
    });
  }

  // Prévia ao vivo: clone da tela de exibição em escala reduzida
  const previewHost = $("#previewHost");
  const previewRoot = $("#display").cloneNode(true);
  previewRoot.removeAttribute("id");
  previewRoot.hidden = false;
  $$("[id]", previewRoot).forEach((n) => n.removeAttribute("id"));
  previewHost.appendChild(previewRoot);
  const displays = () => [$("#display"), previewRoot];

  function fitPreview() {
    const w = previewHost.parentElement.clientWidth;
    previewHost.style.transform = `scale(${w / 1920})`;
  }
  new ResizeObserver(fitPreview).observe(previewHost.parentElement);

  // ---------------------------------------------------------------- Tela 4 — Placar
  function renderScore(score) {
    for (const side of ["red", "blue"]) {
      const root = $(`.athlete[data-side="${side}"]`);
      const d = score[side];
      $('.athlete-score[data-k="pts"]', root).textContent = d.pts;
      $('b[data-k="adv"]', root).textContent = d.adv;
      $('b[data-k="pen"]', root).textContent = d.pen;
      const name = $(".athlete-name", root);
      if (document.activeElement !== name) name.value = d.name;
    }
  }
  async function scoreAction(payload) {
    try {
      renderScore(await api("POST", "/api/score", payload));
      S.versions.score++;
    } catch (e) { toast("Erro: " + e.message); }
  }
  $$(".athlete").forEach((root) => {
    const side = root.dataset.side;
    $$("[data-add]", root).forEach((b) =>
      b.addEventListener("click", () => scoreAction({ action: "add", side, key: "pts", delta: +b.dataset.add })));
    $$(".pctl button", root).forEach((b) =>
      b.addEventListener("click", () => scoreAction({ action: "add", side, key: b.dataset.k, delta: +b.dataset.d })));
    $(".athlete-name", root).addEventListener("change", (e) =>
      scoreAction({ action: "name", side, name: e.target.value }));
  });
  $("#scoreReset").addEventListener("click", () => { if (confirm("Zerar o placar?")) scoreAction({ action: "reset" }); });
  $("#scoreFull").addEventListener("click", () => toggleFullscreen($("#scoreBoard")));

  // ---------------------------------------------------------------- Sincronização com o servidor
  function applySnapshot(t) {
    const prev = S.timer;
    S.timer = t;
    S.syncAt = performance.now();
    const phaseKey = `${t.phase}:${t.round}`;
    if (prev && phaseKey !== S.lastKey) {
      if (soundsOn()) {
        if (t.phase === "work" && t.running) sounds.start();
        else if (t.phase === "rest") sounds.end();
        else if (t.phase === "done") sounds.done();
      }
    }
    S.lastKey = phaseKey;
  }

  async function poll() {
    try {
      const st = await api("GET", "/api/state");
      S.online = true;
      applySnapshot(st.timer);
      if (st.versions.settings !== S.versions.settings) {
        S.settings = await api("GET", "/api/settings");
        if (!$("#view-custom").classList.contains("active")) fillSettingsForm();
        applySettings();
      }
      if (st.versions.score !== S.versions.score) renderScore(st.score);
      if (st.versions.templates !== S.versions.templates) loadTemplates();
      S.versions = { ...st.versions };
    } catch (_) {
      S.online = false;
    }
    setTimeout(poll, 500);
  }

  function remainingSec() {
    const t = S.timer;
    if (!t) return 0;
    let ms = t.remaining_ms;
    if (t.running) ms -= performance.now() - S.syncAt;
    return Math.max(0, ms) / 1000;
  }

  function nextStepText(t) {
    if (!t) return "";
    const more = t.round < t.rounds;
    if (t.phase === "done") return "Sessão concluída";
    if (t.phase === "idle") return `Próximo: Round 1 | <b>${fmt(t.work)}</b>`;
    if (t.phase === "rest") return `Próximo: Round ${t.round + 1} | <b>${fmt(t.work)}</b>`;
    if (more && t.rest > 0) return `Próximo: Descanso | <b>${fmt(t.rest)}</b>`;
    if (more) return `Próximo: Round ${t.round + 1} | <b>${fmt(t.work)}</b>`;
    return "Próximo: Fim da sessão";
  }

  const STATUS = {
    idle:   ["■", "PRONTO"],
    work:   ["●", "EM ANDAMENTO"],
    paused: ["❚❚", "PAUSADO"],
    rest:   ["○", "DESCANSO"],
    done:   ["✓", "CONCLUÍDO"],
  };



  function render() {
    const t = S.timer;
    if (t) {
      const sec = remainingSec();
      const shown = Math.ceil(sec - 0.001);
      const state = t.phase === "work" && !t.running ? "paused" :
                    t.phase === "rest" && !t.running ? "paused" : t.phase;
      const final = t.running && shown <= 10 && t.phase === "work";
      const phaseDur = t.phase === "rest" ? t.rest : t.work;
      const progress = t.phase === "done" ? 1 : t.phase === "idle" ? 0 :
        Math.min(1, Math.max(0, 1 - sec / Math.max(1, phaseDur)));
      const [icon, label] = STATUS[state];
      const roundTxt = t.rounds > 1
        ? `ROUND <b>${Math.min(t.round, t.rounds)}</b> DE ${t.rounds}`
        : (t.mode === "openmat" ? "OPEN MAT" : "ROUND ÚNICO");

      displays().forEach((root) => {
        root.dataset.state = state;
        root.classList.toggle("running", t.running);
        root.classList.toggle("final", final);
        root.classList.toggle("offline", !S.online);
        $(".d-time", root).textContent = fmt(shown);
        $(".d-round", root).innerHTML = roundTxt;
        $(".d-status-icon", root).textContent = icon;
        $(".d-status-text", root).textContent = label;
        $(".d-mode", root).textContent = t.mode_label.toUpperCase();
        $(".d-conn span", root).textContent = S.online ? "Online" : "Sem conexão";
        $(".d-next", root).innerHTML = nextStepText(t);
        $(".d-progress i", root).style.transform = `scaleX(${progress})`;
      });
      if (S.playIcon !== t.running) {
        S.playIcon = t.running;
        $("#ctlPlay").innerHTML = `<svg class="i"><use href="#i-${t.running ? "pause" : "play"}"/></svg>`;
      }

      // beep a cada segundo nos últimos 10 segundos do round (não toca no descanso)
      if (t.running && t.warn && t.phase === "work" && t.work > 10 &&
          S.lastSec !== null && shown !== S.lastSec && shown <= 10 && shown > 0 && soundsOn()) {
        sounds.beep();
      }
      S.lastSec = shown;
      document.title = `${fmt(shown)} · ${STATUS[state][1]}`;
    }
    requestAnimationFrame(render);
  }

  // ---------------------------------------------------------------- Controles da exibição
  const act = async (a) => {
    try { applySnapshot(await api("POST", `/api/timer/${a}`)); }
    catch (e) { toast("Erro: " + e.message); }
  };
  $("#ctlPlay").addEventListener("click", () => act("toggle"));
  $("#ctlReset").addEventListener("click", () => act("reset"));
  $("#ctlSkip").addEventListener("click", () => act("skip"));
  $("#ctlFull").addEventListener("click", () => toggleFullscreen());
  $("#ctlExit").addEventListener("click", closeDisplay);
  if (isTv) $("#ctlExit").hidden = true;

  let idleT;
  function wakeUi() {
    const d = $("#display");
    d.classList.remove("idle-ui");
    clearTimeout(idleT);
    // no celular de controle (toque) os botões ficam sempre visíveis
    if (!isTv && matchMedia("(hover: none)").matches) return;
    idleT = setTimeout(() => d.classList.add("idle-ui"), 3000);
  }
  ["pointermove", "pointerdown", "keydown"].forEach((ev) => $("#display").addEventListener(ev, wakeUi));
  document.addEventListener("keydown", (e) => {
    if ($("#display").hidden) return;
    if (e.target.matches("input, textarea")) return;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); act("toggle"); }
    else if (k === "r") act("reset");
    else if (k === "arrowright") act("skip");
    else if (k === "f") toggleFullscreen();
    else if (k === "escape" && !document.fullscreenElement) closeDisplay();
    wakeUi();
  });

  // ---------------------------------------------------------------- Início
  async function init() {
    const info = await api("GET", "/api/info");
    S.modes = info.modes;
    displays().forEach((root) => {
      const u = $(".d-url", root);
      if (u) u.textContent = info.remote_url;
    });
    S.settings = await api("GET", "/api/settings");
    fillSettingsForm();
    applySettings();
    const st = await api("GET", "/api/state");
    S.versions = { ...st.versions };
    applySnapshot(st.timer);
    renderScore(st.score);
    const t = st.timer;
    S.cfg = { mode: t.mode, work: t.work, rest: t.rest, rounds: t.rounds, warn: t.warn };
    renderConfig();
    $$(".mode-card").forEach((c) => c.classList.toggle("selected", c.dataset.mode === t.mode));
    await loadTemplates();
    if (isTv) openDisplay();
    requestAnimationFrame(render);
    setTimeout(poll, 500);
  }
  init().catch((e) => {
    document.body.innerHTML =
      `<p style="padding:24px">Não foi possível conectar ao servidor. Rode <code>python app.py</code> e recarregue.<br><small>${e.message}</small></p>`;
  });
})();
