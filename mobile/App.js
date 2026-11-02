// CT MAX TIMER — app Android (React Native / Expo). Funciona sozinho, sem servidor.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, AppState, BackHandler, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from "react-native";
import Pressable from "./src/Touch";
import { Pressable as RNPressable } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import DisplayView from "./src/DisplayView";
import Icon from "./src/icons";
import * as E from "./src/engine";
import { initSounds, play } from "./src/sound";
import { DEFAULT_SETTINGS, defaultScore, usePersisted } from "./src/store";
import { C, F, R, S, fontFiles, textOn } from "./src/theme";
import { Btn, tap } from "./src/ui";
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
  const ready = r1 && r2 && r3 && r4 && r5;

  const isTV = Platform.isTV === true;
  const [view, setView] = useState("modes");
  // na TV Box o app abre direto na tela de exibição (o "voltar" do controle leva aos menus)
  const [displayOpen, setDisplayOpen] = useState(isTV);
  const [scoreFull, setScoreFull] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [nameModal, setNameModal] = useState(null);
  const scroller = useRef(null);
  const brand = settings.brand_color || C.cyan400;

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  useEffect(() => { initSounds(); }, []);

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

  // ao voltar do segundo plano, recalcula na hora
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

  // modo imersivo na exibição
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync(displayOpen || scoreFull ? "hidden" : "visible").catch(() => {});
  }, [displayOpen, scoreFull]);

  // botão voltar do Android fecha a tela cheia
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (displayOpen) { setDisplayOpen(false); return true; }
      if (scoreFull) { setScoreFull(false); return true; }
      if (view !== "modes") { setView("modes"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [displayOpen, scoreFull, view]);

  // ---------- ações ----------
  // ações manuais: atualiza o estado e já registra a etapa, para o relógio não tocar som atrasado
  const act = (fn) => {
    const t0 = Date.now();
    const prev = E.tick(timer, t0);
    const n = fn(prev, t0);
    if ((prev.phase === "idle" || prev.phase === "done") && n.phase === "work" && n.running) play("start", settings);
    last.current = { key: `${n.phase}:${n.round}`, sec: null };
    setTimer(n);
    setNow(t0);
  };
  const goto = (v) => {
    if (v === "display") { setDisplayOpen(true); return; }
    setView(v);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

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
    setTimer(E.start(E.configure(cfg.mode, cfg.work, cfg.rest, cfg.rounds, cfg.warn), t));
    setNow(t);
    setDisplayOpen(true);
  };

  const saveTemplate = (name) => {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    setTemplates((l) => [...l, { id: Math.random().toString(36).slice(2, 10), name: n, ...cfg }]);
    setNameModal(null);
  };

  const addScore = (side, key, delta) =>
    setScore((s) => ({ ...s, [side]: { ...s[side], [key]: Math.max(0, s[side][key] + delta) } }));
  const nameScore = (side, name) => setScore((s) => ({ ...s, [side]: { ...s[side], name } }));
  const resetScore = () =>
    Alert.alert("Zerar o placar?", "Pontos, vantagens e punições voltam a zero.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Zerar", style: "destructive", onPress: () => setScore((s) => {
        const d = defaultScore(); d.red.name = s.red.name; d.blue.name = s.blue.name; return d;
      }) },
    ]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.navy900 }} />;

  const tabH = 64;
  const sessionBar = view === "config";

  return (
    <View style={{ flex: 1, backgroundColor: C.navy900 }}>
      <StatusBar style={displayOpen && settings.high_contrast ? "dark" : "light"} hidden={displayOpen || scoreFull} />

      {/* barra superior */}
      <View style={[st.appbar, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <View style={[st.mark, { backgroundColor: brand }]}><Text style={[st.markText, { color: textOn(brand) }]}>CT</Text></View>
        <Text numberOfLines={1} style={st.brandName}>{settings.gym_name || "CT MAX TIMER"}</Text>
        {timer.phase === "work" || timer.phase === "rest" ? (
          <Pressable onPress={() => { tap(); setDisplayOpen(true); }} style={[st.livePill, { borderColor: brand }]}>
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
            paddingBottom: S[6] + (sessionBar ? 84 : 0),
            maxWidth: 1100, width: "100%", alignSelf: "center",
          }}
        >
          {view === "modes" && (
            <Modes
              selected={cfg.mode} onSelect={selectMode} templates={templates} brand={brand}
              onUseTemplate={(t) => { setCfg({ mode: t.mode, work: t.work, rest: t.rest, rounds: t.rounds, warn: t.warn }); goto("config"); }}
              onDeleteTemplate={(t) => Alert.alert("Excluir modelo?", `“${t.name}” será removido.`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Excluir", style: "destructive", onPress: () => setTemplates((l) => l.filter((x) => x.id !== t.id)) },
              ])}
            />
          )}
          {view === "config" && <Session cfg={cfg} setCfg={setCfg} brand={brand} wide={wide} />}
          {view === "custom" && <Academy settings={settings} setSettings={setSettings} timer={timer} now={now} width={Math.min(width, 1100)} wide={wide} />}
          {view === "score" && <Score score={score} onAdd={addScore} onName={nameScore} onReset={resetScore} onFullscreen={() => setScoreFull(true)} brand={brand} wide={wide || width > height} />}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ações da sessão, no alcance do polegar */}
      {sessionBar ? (
        <View style={st.actionBar}>
          <Btn label="Salvar" icon="save" variant="secondary" style={{ flex: 1, paddingHorizontal: S[2] }} onPress={() => setNameModal(`${(E.MODES[cfg.mode] || E.MODES.custom).label} ${E.fmt(cfg.work)}`)} />
          <Btn label="Iniciar sessão" icon="play" brand={brand} style={{ flex: 1.3, paddingHorizontal: S[2] }} onPress={startSession} />
        </View>
      ) : null}

      {/* abas */}
      <View style={[st.tabbar, { paddingBottom: insets.bottom, height: tabH + insets.bottom }]}>
        {TABS.map((t) => {
          const on = t.key === view && t.key !== "display";
          const isDisplay = t.key === "display";
          const color = on || isDisplay ? brand : C.text2;
          return (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }}
              onPress={() => { tap(); goto(t.key); }} style={st.tab}>
              {on ? <View style={[st.tabBar, { backgroundColor: brand }]} /> : null}
              <View style={isDisplay ? [st.tabDisplay, { backgroundColor: brand }] : null}>
                <Icon name={t.icon} size={22} color={isDisplay ? textOn(brand) : color} />
              </View>
              <Text style={[st.tabText, { color }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* exibição em tela cheia */}
      <Modal visible={displayOpen} animationType="fade" onRequestClose={() => setDisplayOpen(false)} statusBarTranslucent navigationBarTranslucent supportedOrientations={["portrait", "landscape"]}>
        <DisplayScreen tv={isTV} timer={timer} now={now} settings={settings} width={width} height={height} onClose={() => setDisplayOpen(false)}
          onToggle={() => act(E.toggle)} onReset={() => act(E.reset)} onSkip={() => act(E.skip)} />
      </Modal>

      {/* placar em tela cheia */}
      <Modal visible={scoreFull} animationType="fade" onRequestClose={() => setScoreFull(false)} statusBarTranslucent navigationBarTranslucent supportedOrientations={["portrait", "landscape"]}>
        <View style={{ flex: 1, backgroundColor: C.navy950, padding: S[3], gap: S[3], flexDirection: width > height ? "row" : "column" }}>
          {["red", "blue"].map((side) => (
            <Athlete key={side} side={side} big height={width > height ? height : height / 2} data={score[side]} onAdd={(k, d) => addScore(side, k, d)} onName={(n) => nameScore(side, n)} />
          ))}
          <Pressable onPress={() => setScoreFull(false)} style={st.closeFab} accessibilityLabel="Fechar tela cheia">
            <Icon name="x" size={22} color={C.white} />
          </Pressable>
        </View>
      </Modal>

      {/* nome do modelo */}
      <Modal visible={nameModal !== null} transparent animationType="fade" onRequestClose={() => setNameModal(null)}>
        <NameDialog initial={nameModal || ""} brand={brand} onCancel={() => setNameModal(null)} onSave={saveTemplate} />
      </Modal>
    </View>
  );
}

function DisplayScreen({ tv, timer, now, settings, width, height, onClose, onToggle, onReset, onSkip }) {
  const sa = useSafeAreaInsets();
  // TVs costumam cortar as bordas da imagem: usa as margens seguras do Android TV
  const insets = tv ? { top: 27, bottom: 27, left: 40, right: 40 } : sa;
  const [ui, setUi] = useState(true);
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

  const hc = settings.high_contrast;
  const ctlBg = hc ? "#EEF4F8" : C.navy950;
  const btnBg = hc ? C.white : C.navy800;
  const ink = hc ? C.navy900 : C.white;
  const mainBg = timer.running ? (hc ? C.navy900 : C.petrol700) : (hc ? C.navy900 : C.cyan400);
  const mainInk = timer.running ? C.white : (hc ? C.white : C.onCyan);

  const Ctl = ({ icon, onPress, main, label }) => (
    <Pressable accessibilityLabel={label} onPress={() => { if (!ui) { wake(); return; } tap(); onPress(); wake(); }} onFocus={wake}
      hasTVPreferredFocus={!!main}
      style={({ pressed }) => [st.ctl, landscapeShort && st.ctlSmall, { backgroundColor: main ? mainBg : btnBg, borderColor: hc ? "rgba(10,26,51,0.16)" : C.line }, main && (landscapeShort ? { height: 64 } : { flex: 1.6 }), pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={26} color={main ? mainInk : ink} />
    </Pressable>
  );

  return (
    <RNPressable style={{ flex: 1 }} onPress={wake} focusable={false}>
      <DisplayView timer={timer} now={now} settings={settings} width={width} height={height}
        insets={{ top: Math.max(insets.top, 8), bottom: insets.bottom, left: insets.left, right: insets.right }}
        reserveRight={landscapeShort ? 76 : 0} reserveBottom={landscapeShort ? 0 : 88} />
      {/* os controles continuam focáveis pelo controle remoto mesmo esmaecidos */}
      {(
        <View style={[{ opacity: ui ? 1 : 0.08 },
          st.ctls, { backgroundColor: ctlBg, borderColor: hc ? "rgba(10,26,51,0.16)" : C.lineStrong },
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
    </RNPressable>
  );
}

function NameDialog({ initial, brand, onCancel, onSave }) {
  const [v, setV] = useState(initial);
  return (
    <View style={st.dialogWrap}>
      <View style={st.dialog}>
        <Text style={st.dialogTitle}>Salvar modelo</Text>
        <Text style={st.dialogSub}>Dê um nome para encontrar depois na tela Modos.</Text>
        <TextInput autoFocus value={v} onChangeText={setV} maxLength={40} selectTextOnFocus
          style={st.dialogInput} placeholder="Ex.: Muay Thai 3x3" placeholderTextColor={C.text3} onSubmitEditing={() => onSave(v)} />
        <View style={{ flexDirection: "row", gap: S[2] }}>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onCancel} />
          <Btn label="Salvar" brand={brand} style={{ flex: 1 }} onPress={() => onSave(v)} disabled={!v.trim()} />
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  appbar: { flexDirection: "row", alignItems: "center", gap: S[3], paddingHorizontal: S[4], backgroundColor: C.navy950, borderBottomWidth: 1, borderBottomColor: C.line },
  mark: { width: 36, height: 36, borderRadius: R.sm, alignItems: "center", justifyContent: "center" },
  markText: { fontFamily: F.wide, fontSize: 14 },
  brandName: { flex: 1, fontFamily: F.wide, fontSize: 16, color: C.white, textTransform: "uppercase" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, height: 36 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: F.narrow, fontSize: 18, color: C.white, fontVariant: ["tabular-nums"] },
  tabbar: { flexDirection: "row", backgroundColor: C.navy950, borderTopWidth: 1, borderTopColor: C.lineStrong },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  tabBar: { position: "absolute", top: 0, left: "30%", right: "30%", height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  tabDisplay: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.sm },
  tabText: { fontFamily: F.bold, fontSize: 11 },
  actionBar: { flexDirection: "row", gap: S[2], paddingHorizontal: S[4], paddingVertical: S[3], backgroundColor: C.navy950, borderTopWidth: 1, borderTopColor: C.line },
  ctls: { position: "absolute", flexDirection: "row", gap: S[2], padding: S[2], borderRadius: R.lg, borderWidth: 1 },
  ctl: { flex: 1, height: 64, borderRadius: R.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ctlSmall: { flex: 0, width: 52, height: 52 },
  closeFab: { position: "absolute", top: S[4], left: "50%", marginLeft: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(4,11,24,0.85)", borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  dialogWrap: { flex: 1, backgroundColor: "rgba(2,6,17,0.7)", justifyContent: "center", padding: S[5] },
  dialog: { backgroundColor: C.navy850, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineStrong, padding: S[5], gap: S[4], maxWidth: 440, width: "100%", alignSelf: "center" },
  dialogTitle: { fontFamily: F.wide, fontSize: 20, color: C.white, textTransform: "uppercase" },
  dialogSub: { fontFamily: F.medium, fontSize: 14, color: C.text2, marginTop: -S[2] },
  dialogInput: { minHeight: 52, paddingHorizontal: S[4], borderRadius: R.md, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.navy900, color: C.white, fontFamily: F.medium, fontSize: 16 },
});
