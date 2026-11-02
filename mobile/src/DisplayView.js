// Tela de exibição (TV). Recebe a largura/altura disponíveis, então o mesmo
// componente serve para a tela cheia e para a prévia em miniatura.
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { STATUS, fmt, nextStep, remainingMs, visualState } from "./engine";
import { C, F, PARTNER_LOGOS } from "./theme";

export function palette(hc) {
  return hc
    ? { bg: C.white, t1: "#071327", t2: "#1E3A5C", t3: "#3D5A7C", work: "#0E7490", workTxt: "#0B5E73", rest: C.petrol700, restTxt: C.petrol700, line: "rgba(10,26,51,0.16)", done: C.navy900 }
    : { bg: C.navy900, t1: C.white, t2: C.text2, t3: C.text3, work: C.cyan400, workTxt: C.cyan400, rest: C.petrol500, restTxt: C.petrol300, line: "rgba(180,198,217,0.14)", done: C.white };
}

export default function DisplayView({ timer, now, settings, width, height, insets = { top: 0, bottom: 0, left: 0, right: 0 }, reserveRight = 0, reserveBottom = 0 }) {
  const p = palette(settings.high_contrast);
  const state = visualState(timer);
  const ms = remainingMs(timer, now);
  const shown = Math.ceil(ms / 1000 - 0.001);
  const final = timer.running && timer.phase === "work" && shown <= 10;
  const [icon, label] = STATUS[state];

  const stateColor = { work: p.work, rest: p.rest, paused: p.t3, done: p.done, idle: p.t3 }[state];
  const stateTxt = { work: p.workTxt, rest: p.restTxt, paused: p.t2, done: p.done, idle: p.t2 }[state];
  const timeColor =
    state === "done" ? p.done : !timer.running ? p.t3 : timer.phase === "rest" ? p.restTxt : p.t1;

  const phaseDur = (timer.phase === "rest" ? timer.rest : timer.work) * 1000;
  const progress = timer.phase === "done" ? 1 : timer.phase === "idle" ? 0 : Math.min(1, Math.max(0, 1 - ms / Math.max(1, phaseDur)));

  // dimensões proporcionais à área (como cqmin/cqw na versão web)
  const vmin = Math.min(width, height) / 100;
  const portrait = height > width * 1.2;
  const short = !portrait && height < 520;
  const padX = Math.max(16, 4.4 * vmin) + Math.max(insets.left, 0);
  const padTop = Math.max(16, 3.6 * vmin) + insets.top;
  const padBottom = Math.max(14, 3.6 * vmin) + insets.bottom + reserveBottom;
  const innerW = width - padX * 2 - reserveRight - insets.right;
  const timeText = fmt(shown);
  const chars = timeText.length;
  // ~0.58em por dígito na Archivo condensada
  const timeSize = Math.min((innerW * 0.9) / (chars * 0.53), (height - padTop - padBottom) * 0.5);
  const base = Math.max(portrait ? 15 : 13, 2.6 * vmin);

  // contorno pulsando enquanto o round roda
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.stopAnimation();
    if (!timer.running) { pulse.setValue(0); return; }
    const d = final ? 250 : 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: d, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: d, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [timer.running, final, pulse]);

  const next = nextStep(timer);
  const roundTxt = timer.rounds > 1
    ? ["ROUND ", String(Math.min(timer.round, timer.rounds)), ` DE ${timer.rounds}`]
    : [timer.mode === "openmat" ? "OPEN MAT" : "ROUND ÚNICO", "", ""];

  return (
    <View style={{ width, height, backgroundColor: p.bg, overflow: "hidden" }}>
      <View style={{ height: Math.max(4, 0.8 * vmin), backgroundColor: stateColor }} />

      <View style={{ flex: 1, paddingTop: padTop - Math.max(4, 0.8 * vmin), paddingBottom: padBottom, paddingLeft: padX, paddingRight: padX + reserveRight }}>
        {/* topo */}
        <View style={s.row}>
          <View style={[s.row, { gap: 1.4 * vmin, flexShrink: 1 }]}>
            {settings.logo ? <Image source={{ uri: settings.logo }} style={{ height: Math.max(28, 5 * vmin), width: Math.max(28, 5 * vmin) * 1.6, resizeMode: "contain" }} /> : null}
            <Text numberOfLines={1} style={{ fontFamily: F.wide, color: p.t1, fontSize: Math.max(15, 2.8 * vmin), textTransform: "uppercase", flexShrink: 1 }}>
              {settings.gym_name || "CT MAX TIMER"}
            </Text>
            {PARTNER_LOGOS.map((src, i) => (
              <Image key={i} source={src} style={{ width: Math.max(36, 8 * vmin), height: Math.max(36, 8 * vmin), resizeMode: "contain" }} />
            ))}
          </View>
          <View style={[s.row, { gap: 2 * vmin }]}>
            {!portrait ? (
              <Text style={{ fontFamily: F.xbold, color: p.t2, fontSize: Math.max(11, 1.7 * vmin), letterSpacing: 2, borderWidth: 1, borderColor: p.line, paddingHorizontal: 1.2 * vmin, paddingVertical: 0.6 * vmin, borderRadius: 6 }}>
                {modeLabel(timer.mode)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* centro */}
        <View style={[s.center, { gap: short ? 4 : 2 * vmin }]}>
          <Text style={{ fontFamily: F.wideX, color: p.t2, fontSize: short ? 15 : Math.max(16, 3.6 * vmin), letterSpacing: Math.max(2, 0.5 * vmin) }}>
            {roundTxt[0]}<Text style={{ color: p.t1, fontFamily: F.wide }}>{roundTxt[1]}</Text>{roundTxt[2]}
          </Text>

          <View style={{ paddingHorizontal: 2.4 * vmin, borderRadius: 2 * vmin }}>
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {
                borderRadius: 2 * vmin, borderWidth: Math.max(2, (final ? 0.3 : 0.2) * vmin), borderColor: stateColor,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: final ? [0.1, 0.5] : [0, 0.18] }),
              }]}
            />
            <Text
              allowFontScaling={false}
              style={{ fontFamily: F.narrowX, color: timeColor, fontSize: timeSize, lineHeight: timeSize * 1.02, letterSpacing: timeSize * 0.02, fontVariant: ["tabular-nums"], includeFontPadding: false }}
            >
              {timeText}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: base * 0.6, borderWidth: Math.max(2, 0.2 * vmin), borderColor: stateColor, borderRadius: 999, paddingHorizontal: base * 1.1, paddingVertical: base * 0.4 }}>
            <Text style={{ color: stateTxt, fontSize: base * 0.8, fontFamily: F.black }}>{icon}</Text>
            <Text style={{ color: stateTxt, fontSize: short ? 14 : base * 1.15, fontFamily: F.wide, letterSpacing: base * 0.2 }}>{label}</Text>
          </View>

        </View>

        {/* rodapé */}
        <View style={{ gap: Math.max(8, 1.8 * vmin) }}>
          <View style={{ height: Math.max(6, vmin), borderRadius: 999, backgroundColor: p.line, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: stateColor }} />
          </View>
          {settings.show_next ? (
            <Text style={{ fontFamily: F.bold, color: p.t2, fontSize: Math.max(14, 2.4 * vmin), textAlign: portrait ? "center" : "right" }}>
              {next.label}{next.time ? " | " : ""}<Text style={{ fontFamily: F.black, color: p.t1 }}>{next.time}</Text>
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const LABELS = { round: "ROUND TIMER", tabata: "TABATA", circuit: "CIRCUITO", openmat: "OPEN MAT", custom: "PERSONALIZADO" };
const modeLabel = (m) => LABELS[m] || "ROUND TIMER";

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
