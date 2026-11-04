// CT MAX TIMER — app React Native (Expo) para Android, TV Box e iPhone (PWA ou nativo).
// Funciona sozinho, sem servidor. Navegável por toque e por controle remoto.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from "react-native";
import Pressable from "./src/Touch";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import DisplayView from "./src/DisplayView";
import Icon from "./src/icons";
import * as E from "./src/engine";
import { K, isDpad, isOk, onRemoteKey } from "./src/remote";
import { initSounds, play, unlockAudio } from "./src/sound";
import { DEFAULT_SETTINGS, defaultScore, usePersisted } from "./src/store";
import { C, F, PARTNER_LOGOS, R, S, fontFiles, textOn } from "./src/theme";
import { Btn, tap } from "./src/ui";
import { Dialogs } from "./src/dialogs";
import Modes from "./src/screens/Modes";
import Session from "./src/screens/Session";
import Academy from "./src/screens/Academy";
import Score, { Athlete } from "./src/screens/Score";

SplashScreen.preventAutoHideAsync().catch(() => {});

const TABS = [
  { key: "modes", label: "Modos", icon: "grid" },
  { key: "config", label: "Sessão", icon: "clock" },
  { key: "custom", label: "Academia", icon: "flag" },
  { key: "score", label: "Placar", icon: "score" },
  { key: "display", label: "Exibição", icon: "tv" },
];

export default function App() {
  const [fontsLoaded] = useFonts(fontFiles);
  return (
    <SafeAreaProvider>
      {fontsLoaded ? <Main /> : <View style={{ flex: 1, backgroundColor: C.navy900 }} />}
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;

  const [settings, setSettings, r1] = usePersisted("settings", DEFAULT_SETTINGS);
  const [templates, setTemplates, r2] = usePersisted("templates", []);
  const [score, setScore, r3] = usePersisted("score", defaultScore());
  const [timer, setTimer, r4] = usePersisted("timer", E.defaultTimer());
  const [cfg, setCfg, r5] = usePersisted("cfg", { mode: "round", work: 300, rest: 60, rounds: 5, warn: true });
  // modo controle remoto: liga sozinho na Android TV ou ao apertar uma seta/OK
  const [remote, setRemote, r6] = usePersisted("remote", Platform.isTV === true);
  const ready = r1 && r2 && r3 && r4 && r5 && r6;

  const [view, setView] = useState("modes");
  const [displayOpen, setDisplayOpen] = useState(false);
  const [scoreFull, setScoreFull] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState(null);
  const [flash, setFlash] = useState(null); // aviso rápido na exibição
  const scroller = useRef(null);
  const brand = settings.brand_color || C.cyan400;
  const topTabs = remote || wide;

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  useEffect(() => { initSounds(); }, []);

  // no controle remoto (TV Box), o app abre direto na exibição
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    if (remote) setDisplayOpen(true);
  }, [ready, remote]);

  // ---------- relógio: avança etapas e dispara os sons ----------
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const last = useRef({ key: null, sec: null });

  const step = useCallback(() => {
    const t0 = Date.now();
    setNow(t0);
    setTimer((t) => {
      const n = E.tick(t, t0);
      const key = `${n.phase}:${n.round}`;
      const L = last.current;
      if (L.key !== null && key !== L.key) {
        if (n.phase === "work" && n.running) play("start", settingsRef.current);
        else if (n.phase === "rest") play("end", settingsRef.current);
        else if (n.phase === "done") play("done", settingsRef.current);
      }
      L.key = key;
      const sec = Math.ceil(E.remainingMs(n, t0) / 1000 - 0.001);
      // beep a cada segundo nos últimos 10 segundos do round (não toca no descanso)
      if (n.running && n.warn && n.phase === "work" && n.work > 10 && L.sec !== null && sec !== L.sec && sec <= 10 && sec > 0) {
        play("beep", settingsRef.current);
      }
      L.sec = sec;
      return n === t ? t : n;
    });
  }, [setTimer]);

  useEffect(() => {
    if (!ready) return;
    last.current.key = `${timer.phase}:${timer.round}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!timer.running) return;
    step();
    const id = setInterval(step, 200);
    return () => clearInterval(id);
  }, [timer.running, step]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") step(); });
    return () => sub.remove();
  }, [step]);

  // tela sempre ligada enquanto a exibição está aberta ou o timer roda
  const awake = useRef(false);
  useEffect(() => {
    const want = displayOpen || timer.running || scoreFull;
    if (want && !awake.current) { awake.current = true; activateKeepAwakeAsync("ctmax").catch(() => {}); }
    if (!want && awake.current) { awake.current = false; Promise.resolve(deactivateKeepAwake("ctmax")).catch(() => {}); }
  }, [displayOpen, timer.running, scoreFull]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync(displayOpen || scoreFull ? "hidden" : "visible").catch(() => {});
  }, [displayOpen, scoreFull]);

  // botão voltar do Android / controle remoto
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (dialog) { setDialog(null); return true; }
      if (displayOpen) { setDisplayOpen(false); return true; }
      if (scoreFull) { setScoreFull(false); return true; }
      if (view !== "modes") { setView("modes"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [dialog, displayOpen, scoreFull, view]);

  // ---------- ações ----------
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const act = useCallback((fn) => {
    const t0 = Date.now();
    const prev = E.tick(timerRef.current, t0);
    const n = fn(prev, t0);
    if ((prev.phase === "idle" || prev.phase === "done") && n.phase === "work" && n.running) play("start", settingsRef.current);
    last.current = { key: `${n.phase}:${n.round}`, sec: null };
    timerRef.current = n;
    setTimer(n);
    setNow(t0);
  }, [setTimer]);

  const goto = (v) => {
    if (v === "display") { setDisplayOpen(true); return; }
    setView(v);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const showFlash = useCallback((text) => {
    setFlash({ text, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(id);
  }, [flash]);

  // ---------- teclas do controle remoto ----------
  const keyState = useRef({});
  keyState.current = { displayOpen, dialog, remote, scoreFull };
  const resetArm = useRef(0);
  const [wakeSignal, setWakeSignal] = useState(0);

  useEffect(() => onRemoteKey(({ code, repeat }) => {
    const s = keyState.current;
    if (!s.remote && (isDpad(code) || code === K.ENTER)) setRemote(true);
    if (Platform.OS === "web" && code === K.BACK) {
      if (s.dialog) { setDialog(null); return true; }
      if (s.displayOpen) { setDisplayOpen(false); return true; }
      if (s.scoreFull) { setScoreFull(false); return true; }
      return false;
    }
    if (!s.displayOpen || s.dialog || repeat > 0) return false;
    // comandos diretos na tela de exibição
    if (isOk(code) || code === K.PLAY_PAUSE) { tap(); act(E.toggle); setWakeSignal((x) => x + 1); return true; }
    if (code === K.PLAY) { act((t, n) => (t.running ? t : E.start(t, n))); return true; }
    if (code === K.PAUSE) { act(E.pause); return true; }
    if (code === K.RIGHT || code === K.NEXT || code === K.FAST_FORWARD) {
      act(E.skip); showFlash("Etapa pulada"); setWakeSignal((x) => x + 1); return true;
    }
    if (code === K.LEFT || code === K.PREVIOUS || code === K.REWIND) {
      const t = Date.now();
      if (t - resetArm.current < 2500) { resetArm.current = 0; act(E.reset); showFlash("Timer reiniciado"); }
      else { resetArm.current = t; showFlash("Aperte ◀ de novo para reiniciar"); }
      setWakeSignal((x) => x + 1);
      return true;
    }
    if (code === K.UP || code === K.DOWN || code === K.MENU) { setWakeSignal((x) => x + 1); return true; }
    return false;
  }), [act, setRemote, showFlash]);

  const selectMode = (mode) => {
    if (mode === "score") return goto("score");
    const m = E.MODES[mode];
    setCfg({ mode, work: m.work, rest: m.rest, rounds: m.rounds, warn: m.warn });
    goto("config");
  };

  const startSession = () => {
    const t = Date.now();
    play("start", settings);
    last.current = { key: "work:1", sec: null };
    const n = E.start(E.configure(cfg.mode, cfg.work, cfg.rest, cfg.rounds, cfg.warn), t);
    timerRef.current = n;
    setTimer(n);
    setNow(t);
    setDisplayOpen(true);
  };

  const askTemplateName = () => setDialog({
    type: "text", title: "Salvar modelo", sub: "Dê um nome para encontrar depois na tela Modos.",
    placeholder: "Ex.: Muay Thai 3x3", initial: `${(E.MODES[cfg.mode] || E.MODES.custom).label} ${E.fmt(cfg.work)}`,
    onSave: (n) => setTemplates((l) => [...l, { id: Math.random().toString(36).slice(2, 10), name: n, ...cfg }]),
  });

  const addScore = (side, key, delta) =>
    setScore((s) => ({ ...s, [side]: { ...s[side], [key]: Math.max(0, s[side][key] + delta) } }));
  const nameScore = (side, name) => setScore((s) => ({ ...s, [side]: { ...s[side], name } }));
  const editScoreName = (side) => setDialog({
    type: "text", title: side === "red" ? "Atleta vermelho" : "Atleta azul", max: 30,
    initial: score[side].name, placeholder: "Nome do atleta", onSave: (n) => nameScore(side, n),
  });
  const resetScore = () => setDialog({
    type: "confirm", title: "Zerar o placar?", message: "Pontos, vantagens e punições voltam a zero.",
    okLabel: "Zerar", destructive: true,
    onOk: () => setScore((s) => { const d = defaultScore(); d.red.name = s.red.name; d.blue.name = s.blue.name; return d; }),
  });

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.navy900 }} />;

  // ---------- exibição em tela cheia (camada própria, para receber as teclas do controle) ----------
  if (displayOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: settings.high_contrast ? C.white : C.navy900 }} onTouchStart={unlockAudio}>
        <StatusBar style={settings.high_contrast ? "dark" : "light"} hidden />
        <DisplayScreen
          tv={Platform.isTV === true} remote={remote} timer={timer} now={now} settings={settings} width={width} height={height}
          flash={flash} wakeSignal={wakeSignal}
          onClose={() => setDisplayOpen(false)} onToggle={() => act(E.toggle)} onReset={() => act(E.reset)} onSkip={() => act(E.skip)}
        />
        <Dialogs dialog={dialog} onClose={() => setDialog(null)} brand={brand} />
      </View>
    );
  }

  const tabH = 64;
  const sessionBar = view === "config";
  const tabItems = TABS.map((t) => {
    const on = t.key === view;
    const isDisplay = t.key === "display";
    const color = on || isDisplay ? brand : C.text2;
    return (
      <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }}
        onPress={() => { tap(); goto(t.key); }} style={topTabs ? [st.topTab, on && st.topTabOn, isDisplay && { backgroundColor: brand }] : st.tab}>
        {!topTabs && on ? <View style={[st.tabBar, { backgroundColor: brand }]} /> : null}
        <View style={!topTabs && isDisplay ? [st.tabDisplay, { backgroundColor: brand }] : null}>
          <Icon name={t.icon} size={topTabs ? 18 : 22} color={isDisplay ? textOn(brand) : color} />
        </View>
        <Text style={[topTabs ? st.topTabText : st.tabText, { color: isDisplay && topTabs ? textOn(brand) : color }]}>{t.label}</Text>
        {topTabs && on ? <View style={[st.topTabBar, { backgroundColor: brand }]} /> : null}
      </Pressable>
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.navy900 }} onTouchStart={unlockAudio}>
      <StatusBar style="light" hidden={scoreFull} />

      {/* barra superior (com as abas quando é TV ou tela larga) */}
      <View style={[st.appbar, { paddingTop: insets.top, minHeight: 60 + insets.top, paddingLeft: S[4] + insets.left, paddingRight: S[4] + insets.right }]}>
        <View style={[st.mark, { backgroundColor: brand }]}><Text style={[st.markText, { color: textOn(brand) }]}>CT</Text></View>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: S[2], minWidth: 0 }}>
          <Text numberOfLines={1} style={st.brandName}>{settings.gym_name || "CT MAX TIMER"}</Text>
          {PARTNER_LOGOS.map((src, i) => <Image key={i} source={src} style={{ width: 34, height: 34, resizeMode: "contain" }} />)}
        </View>
        {topTabs ? <View style={st.topTabs}>{tabItems}</View> : null}
        {!topTabs && (timer.phase === "work" || timer.phase === "rest") ? (
          <Pressable onPress={() => { tap(); setDisplayOpen(true); }} style={[st.livePill, { borderColor: brand }]} accessibilityLabel="Abrir exibição">
            <View style={[st.liveDot, { backgroundColor: brand }]} />
            <Text style={st.liveText}>{E.fmt(Math.ceil(E.remainingMs(timer, now) / 1000 - 0.001))}</Text>
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scroller}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: S[4], paddingTop: S[5],
            paddingLeft: S[4] + insets.left, paddingRight: S[4] + insets.right,
            paddingBottom: S[6] + (sessionBar ? 84 : 0) + (topTabs ? insets.bottom : 0),
            maxWidth: 1100, width: "100%", alignSelf: "center",
          }}
        >
          {view === "modes" && (
            <Modes
              selected={cfg.mode} onSelect={selectMode} templates={templates} brand={brand}
              onUseTemplate={(t) => { setCfg({ mode: t.mode, work: t.work, rest: t.rest, rounds: t.rounds, warn: t.warn }); goto("config"); }}
              onDeleteTemplate={(t) => setDialog({
                type: "confirm", title: "Excluir modelo?", message: `“${t.name}” será removido.`, okLabel: "Excluir", destructive: true,
                onOk: () => setTemplates((l) => l.filter((x) => x.id !== t.id)),
              })}
            />
          )}
          {view === "config" && <Session cfg={cfg} setCfg={setCfg} brand={brand} wide={wide} />}
          {view === "custom" && (
            <Academy settings={settings} setSettings={setSettings} timer={timer} now={now} width={Math.min(width, 1100)} wide={wide}
              remote={remote} setRemote={setRemote} openDialog={setDialog} />
          )}
          {view === "score" && (
            <Score score={score} onAdd={addScore} onName={nameScore} onEditName={editScoreName} remote={remote}
              onReset={resetScore} onFullscreen={() => setScoreFull(true)} brand={brand} wide={wide || width > height} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {sessionBar ? (
        <View style={[st.actionBar, topTabs && { paddingBottom: S[3] + insets.bottom }]}>
          <Btn label="Salvar" icon="save" variant="secondary" style={{ flex: 1, paddingHorizontal: S[2] }} onPress={askTemplateName} />
          <Btn label="Iniciar sessão" icon="play" brand={brand} style={{ flex: 1.3, paddingHorizontal: S[2] }} onPress={startSession} />
        </View>
      ) : null}

      {!topTabs ? (
        <View style={[st.tabbar, { paddingBottom: insets.bottom, height: tabH + insets.bottom }]}>{tabItems}</View>
      ) : null}

      {/* placar em tela cheia */}
      <Modal visible={scoreFull} animationType="fade" onRequestClose={() => setScoreFull(false)} statusBarTranslucent navigationBarTranslucent supportedOrientations={["portrait", "landscape"]}>
        <View style={{ flex: 1, backgroundColor: C.navy950, padding: S[3], paddingTop: S[3] + insets.top, paddingBottom: S[3] + insets.bottom, gap: S[3], flexDirection: width > height ? "row" : "column" }}>
          {["red", "blue"].map((side) => (
            <Athlete key={side} side={side} big remote={remote} height={width > height ? height : height / 2} data={score[side]}
              onAdd={(k, d) => addScore(side, k, d)} onName={(n) => nameScore(side, n)} onEditName={() => editScoreName(side)} />
          ))}
          <Pressable onPress={() => setScoreFull(false)} style={[st.closeFab, { top: S[4] + insets.top }]} accessibilityLabel="Fechar tela cheia">
            <Icon name="x" size={22} color={C.white} />
          </Pressable>
        </View>
        <Dialogs dialog={scoreFull ? dialog : null} onClose={() => setDialog(null)} brand={brand} />
      </Modal>

      <Dialogs dialog={scoreFull ? null : dialog} onClose={() => setDialog(null)} brand={brand} />
    </View>
  );
}

function DisplayScreen({ tv, remote, timer, now, settings, width, height, flash, wakeSignal, onClose, onToggle, onReset, onSkip }) {
  const sa = useSafeAreaInsets();
  // TVs costumam cortar as bordas da imagem: usa as margens seguras do Android TV
  const insets = tv || remote ? { top: Math.max(sa.top, 27), bottom: Math.max(sa.bottom, 27), left: Math.max(sa.left, 40), right: Math.max(sa.right, 40) } : sa;
  const [ui, setUi] = useState(true);
  // se alguém tocar na tela, mostra os botões de toque mesmo no modo controle remoto
  const [touched, setTouched] = useState(false);
  const legend = remote && !touched;
  const hideT = useRef(null);
  const landscapeShort = width > height && height < 520;
  const colH = 3 * 52 + 64 + 3 * 6 + 12;

  const wake = useCallback(() => {
    setUi(true);
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setUi(false), 4000);
  }, []);
  useEffect(() => { wake(); return () => clearTimeout(hideT.current); }, [wake]);
  useEffect(() => { if (!timer.running) { setUi(true); clearTimeout(hideT.current); } else wake(); }, [timer.running, wake]);
  useEffect(() => { if (wakeSignal) wake(); }, [wakeSignal, wake]);

  const hc = settings.high_contrast;
  const ctlBg = hc ? "#EEF4F8" : C.navy950;
  const btnBg = hc ? C.white : C.navy800;
  const ink = hc ? C.navy900 : C.white;
  const lineC = hc ? "rgba(10,26,51,0.16)" : C.lineStrong;
  const mainBg = timer.running ? (hc ? C.navy900 : C.petrol700) : (hc ? C.navy900 : C.cyan400);
  const mainInk = timer.running ? C.white : (hc ? C.white : C.onCyan);

  // os botões não recebem foco: com o controle remoto, as teclas agem direto (OK, ▶, ◀)
  const Ctl = ({ icon, onPress, main, label }) => (
    <Pressable accessibilityLabel={label} focusable={false} onPress={() => { if (!ui) { wake(); return; } tap(); onPress(); wake(); }}
      style={({ pressed }) => [st.ctl, landscapeShort && st.ctlSmall, { backgroundColor: main ? mainBg : btnBg, borderColor: hc ? "rgba(10,26,51,0.16)" : C.line }, main && (landscapeShort ? { height: 64 } : { flex: 1.6 }), pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={26} color={main ? mainInk : ink} />
    </Pressable>
  );

  const Key = ({ k, label }) => (
    <View style={st.keyItem}>
      <View style={[st.keyCap, { borderColor: lineC, backgroundColor: btnBg }]}><Text style={[st.keyCapText, { color: ink }]}>{k}</Text></View>
      <Text style={[st.keyLabel, { color: hc ? C.navy800 : C.text2 }]}>{label}</Text>
    </View>
  );

  return (
    <Pressable style={{ flex: 1 }} onPress={wake} onTouchStart={() => setTouched(true)} focusable={false}>
      <DisplayView timer={timer} now={now} settings={settings} width={width} height={height}
        insets={{ top: Math.max(insets.top, 8), bottom: insets.bottom, left: insets.left, right: insets.right }}
        reserveRight={!legend && landscapeShort ? 76 : 0} reserveBottom={legend ? 64 : landscapeShort ? 0 : 88} />

      {legend ? (
        // legenda das teclas do controle remoto
        <View pointerEvents="box-none" style={[st.keys, { opacity: ui ? 1 : 0.15, left: insets.left + S[4], right: insets.right + S[4], bottom: insets.bottom + S[2] }]}>
          <Key k="OK" label={timer.running ? "Pausar" : "Iniciar"} />
          <Key k="▶" label="Pular etapa" />
          <Key k="◀ ◀" label="Reiniciar (2x)" />
          <Key k="VOLTAR" label="Menu" />
        </View>
      ) : (
        <View style={[{ opacity: ui ? 1 : 0.08 },
          st.ctls, { backgroundColor: ctlBg, borderColor: lineC },
          landscapeShort
            ? { right: S[3] + insets.right, top: (height - colH) / 2, flexDirection: "column", padding: 6, gap: 6 }
            : { left: S[4] + insets.left, right: S[4] + insets.right, bottom: S[4] + insets.bottom },
        ]}>
          <Ctl icon="x" label="Sair" onPress={onClose} />
          <Ctl icon="reset" label="Reiniciar" onPress={onReset} />
          <Ctl icon={timer.running ? "pause" : "play"} label="Iniciar ou pausar" onPress={onToggle} main />
          <Ctl icon="skip" label="Pular etapa" onPress={onSkip} />
        </View>
      )}

      {flash ? (
        <View pointerEvents="none" style={[st.flash, { top: insets.top + Math.max(60, height * 0.16) }]}>
          <Text style={st.flashText}>{flash.text}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  appbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: S[3], backgroundColor: C.navy950, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: S[2] },
  mark: { width: 36, height: 36, borderRadius: R.sm, alignItems: "center", justifyContent: "center", marginTop: S[2] },
  markText: { fontFamily: F.wide, fontSize: 14 },
  brandName: { flexShrink: 1, fontFamily: F.wide, fontSize: 16, color: C.white, textTransform: "uppercase" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, height: 36, marginTop: S[2] },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: F.narrow, fontSize: 18, color: C.white, fontVariant: ["tabular-nums"] },
  tabbar: { flexDirection: "row", backgroundColor: C.navy950, borderTopWidth: 1, borderTopColor: C.lineStrong },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  tabBar: { position: "absolute", top: 0, left: "30%", right: "30%", height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  tabDisplay: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.sm },
  tabText: { fontFamily: F.bold, fontSize: 11 },
  topTabs: { flexDirection: "row", gap: 4, padding: 4, marginTop: S[2], borderRadius: R.lg, backgroundColor: C.navy850, borderWidth: 1, borderColor: C.line },
  topTab: { height: 48, paddingHorizontal: S[3], borderRadius: R.md, flexDirection: "row", alignItems: "center", gap: S[2] },
  topTabOn: { backgroundColor: C.navy700 },
  topTabBar: { position: "absolute", left: S[3], right: S[3], bottom: 6, height: 2, borderRadius: 2 },
  topTabText: { fontFamily: F.bold, fontSize: 14 },
  actionBar: { flexDirection: "row", gap: S[2], paddingHorizontal: S[4], paddingVertical: S[3], backgroundColor: C.navy950, borderTopWidth: 1, borderTopColor: C.line },
  ctls: { position: "absolute", flexDirection: "row", gap: S[2], padding: S[2], borderRadius: R.lg, borderWidth: 1 },
  ctl: { flex: 1, height: 64, borderRadius: R.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ctlSmall: { flex: 0, width: 52, height: 52 },
  keys: { position: "absolute", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: S[5], minHeight: 48, alignItems: "center" },
  keyItem: { flexDirection: "row", alignItems: "center", gap: S[2] },
  keyCap: { minWidth: 40, height: 36, paddingHorizontal: 10, borderRadius: R.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  keyCapText: { fontFamily: F.wideX, fontSize: 13, letterSpacing: 0.5 },
  keyLabel: { fontFamily: F.bold, fontSize: 15 },
  flash: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(4,11,24,0.92)", borderWidth: 1, borderColor: C.lineStrong, borderRadius: 999, paddingHorizontal: S[5], paddingVertical: S[3] },
  flashText: { fontFamily: F.wideX, fontSize: 18, color: C.white, letterSpacing: 0.5 },
  closeFab: { position: "absolute", left: "50%", marginLeft: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(4,11,24,0.85)", borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
});
