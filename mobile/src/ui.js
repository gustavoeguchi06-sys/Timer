// Componentes de interface reutilizáveis (cards, botões, stepper, toggle, chips).
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Pressable from "./Touch";
import * as Haptics from "expo-haptics";
import Icon from "./icons";
import { C, F, R, S, TOUCH, textOn } from "./theme";

export const tap = () => { Haptics.selectionAsync().catch(() => {}); };

export function Eyebrow({ children, color = C.cyan400, style }) {
  return <Text style={[st.eyebrow, { color }, style]}>{children}</Text>;
}

export function PageHead({ eyebrow, title, sub, right, brand }) {
  const { width } = useWindowDimensions();
  const size = width < 360 ? 22 : width < 420 ? 26 : 30;
  return (
    <View style={st.pageHead}>
      <Eyebrow color={brand}>{eyebrow}</Eyebrow>
      <Text style={[st.pageTitle, { fontSize: size, lineHeight: size * 1.1 }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
      {sub ? <Text style={st.pageSub}>{sub}</Text> : null}
      {right ? <View style={{ flexDirection: "row", marginTop: S[3] }}>{right}</View> : null}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function SectionHead({ title, sub }) {
  return (
    <View style={st.sectionHead}>
      <Text style={st.sectionTitle}>{title}</Text>
      {sub ? <Text style={st.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

export function Btn({ label, icon, variant = "primary", onPress, style, brand = C.cyan400, small, disabled }) {
  const bg = variant === "primary" ? brand : variant === "secondary" ? C.petrol700 : "transparent";
  const fg = variant === "primary" ? textOn(brand) : C.white;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tap(); onPress && onPress(); }}
      style={({ pressed }) => [
        st.btn,
        small && st.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === "ghost" && st.btnGhost,
        pressed && { opacity: 0.8, transform: [{ translateY: 1 }] },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
      {label ? <Text style={[st.btnText, small && st.btnTextSmall, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, color = C.text2, style, label }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => { tap(); onPress && onPress(); }}
      style={({ pressed }) => [st.iconBtn, pressed && { backgroundColor: C.navy700 }, style]}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

// Botão que repete enquanto está pressionado (segurar + ou −)
function RepeatButton({ label, onStep, accessibilityLabel }) {
  const hold = useRef(null);
  const touched = useRef(false);
  const stop = () => { clearTimeout(hold.current); clearInterval(hold.current); };
  useEffect(() => stop, []);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        touched.current = true;
        tap(); onStep();
        hold.current = setTimeout(() => { hold.current = setInterval(onStep, 90); }, 420);
      }}
      onPressOut={stop}
      // botão OK do controle remoto: dispara onPress sem passar por onPressIn
      onPress={() => { if (!touched.current) onStep(); touched.current = false; }}
      style={({ pressed }) => [st.step, pressed && { backgroundColor: C.cyan400 }]}
    >
      {({ pressed }) => <Text style={[st.stepText, pressed && { color: C.onCyan }]}>{label}</Text>}
    </Pressable>
  );
}

export function Stepper({ value, display, onChange, min, max, step, bigStepAbove, label }) {
  const ref = useRef(value);
  ref.current = value;
  const change = (dir) => {
    const s = bigStepAbove && ref.current >= bigStepAbove ? step * 6 : step;
    const v = Math.min(max, Math.max(min, ref.current + dir * s));
    ref.current = v;
    onChange(v);
  };
  return (
    <View style={st.stepper}>
      <RepeatButton label="−" onStep={() => change(-1)} accessibilityLabel={`Diminuir ${label}`} />
      <Text style={st.stepValue} numberOfLines={1} adjustsFontSizeToFit>{display(value)}</Text>
      <RepeatButton label="+" onStep={() => change(1)} accessibilityLabel={`Aumentar ${label}`} />
    </View>
  );
}

export function Chips({ options, value, onChange, format = String, brand = C.cyan400 }) {
  return (
    <View style={st.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => { tap(); onChange(o); }}
            style={[st.chip, on && { backgroundColor: brand, borderColor: brand }]}
          >
            <Text style={[st.chipText, on && { color: textOn(brand) }]}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, brand = C.cyan400 }) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={10}
      onPress={() => { tap(); onChange(!value); }}
      style={[st.track, value && { backgroundColor: brand, borderColor: brand }]}
    >
      <Animated.View
        style={[
          st.knob,
          { backgroundColor: value ? textOn(brand) : C.text2 },
          { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] },
        ]}
      />
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onChange, brand }) {
  return (
    <View style={st.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{label}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      <Toggle value={value} onChange={onChange} brand={brand} />
    </View>
  );
}

export function FieldHead({ label, hint, value }) {
  return (
    <View style={st.fieldHead}>
      <Text style={st.label}>{label}</Text>
      {value != null ? <Text style={st.fieldValue}>{value}</Text> : hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
}

export const st = StyleSheet.create({
  eyebrow: { fontFamily: F.xbold, fontSize: 12, letterSpacing: 1.9, textTransform: "uppercase" },
  pageHead: { marginBottom: S[5] },
  pageTitle: { fontFamily: F.wide, fontSize: 30, lineHeight: 32, color: C.white, textTransform: "uppercase", marginTop: S[2] },
  pageSub: { fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.text2, marginTop: S[2] },
  card: { backgroundColor: C.navy850, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: S[4], gap: S[4] },
  sectionHead: { paddingBottom: S[3], borderBottomWidth: 1, borderBottomColor: C.line },
  sectionTitle: { fontFamily: F.wideX, fontSize: 16, color: C.white, textTransform: "uppercase", letterSpacing: 0.3 },
  sectionSub: { fontFamily: F.medium, fontSize: 13, color: C.text3, marginTop: 2 },
  btn: {
    minHeight: TOUCH, paddingHorizontal: S[5], borderRadius: R.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S[2],
  },
  btnSmall: { minHeight: 48, paddingHorizontal: S[4] },
  btnGhost: { borderWidth: 1, borderColor: C.lineStrong },
  btnText: { fontFamily: F.wideX, fontSize: 14, letterSpacing: 0.6, textTransform: "uppercase" },
  btnTextSmall: { fontSize: 12 },
  iconBtn: {
    width: 48, height: 48, borderRadius: R.md, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.line,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: S[3] },
  step: { width: 60, height: 60, borderRadius: R.md, backgroundColor: C.petrol700, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: F.bold, fontSize: 30, color: C.white, lineHeight: 34 },
  stepValue: { flex: 1, textAlign: "center", fontFamily: F.narrow, fontSize: 48, color: C.white, fontVariant: ["tabular-nums"] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: S[2] },
  chip: {
    minHeight: 44, minWidth: 56, paddingHorizontal: S[3], borderRadius: R.md,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.navy900, borderWidth: 1, borderColor: C.lineStrong,
  },
  chipText: { fontFamily: F.xbold, fontSize: 14, color: C.white, fontVariant: ["tabular-nums"] },
  track: { width: 56, height: 32, borderRadius: 16, backgroundColor: C.navy700, borderWidth: 1, borderColor: C.lineStrong, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: S[4], minHeight: TOUCH },
  label: { fontFamily: F.xbold, fontSize: 15, color: C.white },
  hint: { fontFamily: F.medium, fontSize: 13, color: C.text3, marginTop: 1 },
  fieldHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: S[3] },
  fieldValue: { fontFamily: F.xbold, fontSize: 15, color: C.text2, fontVariant: ["tabular-nums"] },
});
