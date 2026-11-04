import { StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../Touch";
import Touch from "../Touch";
import * as Haptics from "expo-haptics";
import { C, F, R, S } from "../theme";
import { Btn, PageHead } from "../ui";

const TEAM = {
  red: { c: C.red600, c2: C.red500, tint: "#2A1F38", btn: "#3A1B2C", label: "Vermelho" },
  blue: { c: C.blue600, c2: C.blue500, tint: "#10275A", btn: "#13306B", label: "Azul" },
};

const buzz = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };

function PBtn({ label, onPress, bg, border, color = C.white, size = 24, h = 64, style }) {
  return (
    <Pressable
      onPress={() => { buzz(); onPress(); }}
      style={({ pressed }) => [st.pbtn, { backgroundColor: pressed ? border : bg, borderColor: border, minHeight: h }, style]}
    >
      <Text style={{ fontFamily: F.black, fontSize: size, color }}>{label}</Text>
    </Pressable>
  );
}

export function Athlete({ side, data, onAdd, onName, onEditName, remote, big, height }) {
  const t = TEAM[side];
  const scoreSize = big ? Math.max(120, (height || 400) * 0.34) : 112;
  return (
    <View style={[st.athlete, { backgroundColor: t.tint }, big && { flex: 1 }]}>
      <View style={[st.head, { backgroundColor: t.c }]}>
        <Text style={st.corner}>{t.label}</Text>
        {remote ? (
          <Touch accessibilityLabel={`Editar nome do atleta ${t.label.toLowerCase()}`} ringColor={C.white} onPress={onEditName} style={{ alignSelf: "flex-start", borderRadius: 6 }}>
            <Text style={[st.name, big && { fontSize: 30 }]} numberOfLines={1}>{data.name}</Text>
          </Touch>
        ) : (
          <TextInput
            value={data.name}
            onChangeText={(v) => onName(v.slice(0, 30))}
            style={[st.name, big && { fontSize: 30 }]}
            selectionColor={C.white}
            accessibilityLabel={`Nome do atleta ${t.label.toLowerCase()}`}
          />
        )}
      </View>
      <Text allowFontScaling={false} style={[st.score, { fontSize: scoreSize, lineHeight: scoreSize * 1.05 }, big && { flex: 1, textAlignVertical: "center" }]}>
        {data.pts}
      </Text>
      <View style={st.pts}>
        {[2, 3, 4].map((n) => (
          <PBtn key={n} label={`+${n}`} bg={t.btn} border={t.c2} onPress={() => onAdd("pts", n)} style={{ flex: 1 }} />
        ))}
        <PBtn label="−1" bg={C.navy800} border={C.lineStrong} color={C.text2} onPress={() => onAdd("pts", -1)} style={{ flex: 1 }} />
      </View>
      <View style={st.partials}>
        {[["adv", "Vantagens"], ["pen", "Punições"]].map(([k, l]) => (
          <View key={k} style={st.partial}>
            <Text style={st.pLabel}>{l}</Text>
            <View style={st.pctl}>
              <PBtn label="−" bg={C.navy700} border={C.line} h={48} size={22} onPress={() => onAdd(k, -1)} style={{ width: 46 }} />
              <Text style={st.pVal}>{data[k]}</Text>
              <PBtn label="+" bg={C.navy700} border={C.line} h={48} size={22} onPress={() => onAdd(k, 1)} style={{ width: 46 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Score({ score, onAdd, onName, onEditName, remote, onReset, onFullscreen, brand, wide }) {
  return (
    <View>
      <PageHead eyebrow="04 · Competição" title="Placar" brand={brand} />
      <View style={st.actions}>
        <Btn label="Zerar" icon="reset" variant="ghost" small style={{ flex: 1 }} onPress={onReset} />
        <Btn label="Tela cheia" icon="expand" variant="secondary" small style={{ flex: 1 }} onPress={onFullscreen} />
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: S[3] }}>
        {["red", "blue"].map((side) => (
          <View key={side} style={wide ? { flex: 1 } : null}>
            <Athlete side={side} remote={remote} data={score[side]} onAdd={(k, d) => onAdd(side, k, d)} onName={(n) => onName(side, n)} onEditName={() => onEditName(side)} />
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  actions: { flexDirection: "row", gap: S[2], marginBottom: S[3] },
  athlete: { borderRadius: R.lg, overflow: "hidden", borderWidth: 1, borderColor: C.line, paddingBottom: S[4] },
  head: { paddingHorizontal: S[4], paddingTop: S[3], paddingBottom: S[3] },
  corner: { fontFamily: F.xbold, fontSize: 12, letterSpacing: 1.9, textTransform: "uppercase", color: "rgba(255,255,255,0.85)" },
  name: { fontFamily: F.wide, fontSize: 22, color: C.white, textTransform: "uppercase", padding: 0, marginTop: 2 },
  score: { fontFamily: F.narrow, color: C.white, textAlign: "center", fontVariant: ["tabular-nums"], paddingVertical: S[3], includeFontPadding: false },
  pts: { flexDirection: "row", gap: S[2], paddingHorizontal: S[4] },
  pbtn: { borderRadius: R.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  partials: { flexDirection: "row", gap: S[2], paddingHorizontal: S[4], marginTop: S[3] },
  partial: { flex: 1, backgroundColor: C.navy900, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: S[2], gap: S[2] },
  pLabel: { fontFamily: F.xbold, fontSize: 11, letterSpacing: 1.5, color: C.text2, textAlign: "center", textTransform: "uppercase" },
  pctl: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pVal: { flex: 1, textAlign: "center", fontFamily: F.narrow, fontSize: 32, color: C.white, fontVariant: ["tabular-nums"] },
});
