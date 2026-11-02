import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Pressable from "../Touch";
import Icon from "../icons";
import { MODES, fmt } from "../engine";
import { C, F, R, S, textOn } from "../theme";
import { Btn, IconBtn, PageHead, SectionHead, tap } from "../ui";

const CARDS = [
  { key: "round", icon: "round", spec: "5 × 05:00 · 01:00" },
  { key: "tabata", icon: "bolt", spec: "8 × 00:20 · 00:10" },
  { key: "circuit", icon: "loop", spec: "10 × 00:45 · 00:15" },
  { key: "openmat", icon: "mat", spec: "1 × 60:00" },
  { key: "score", icon: "score", spec: "Vermelho × Azul", label: "Placar BJJ", desc: "Pontos, vantagens e punições por atleta." },
  { key: "custom", icon: "sliders", spec: "Livre" },
];

export default function Modes({ selected, onSelect, templates, onUseTemplate, onDeleteTemplate, brand }) {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 3 : width >= 360 ? 2 : 1;
  const gap = S[3];
  const cardW = (Math.min(width, 1100) - S[4] * 2 - gap * (cols - 1)) / cols;

  return (
    <View>
      <PageHead eyebrow="01 · Treino" title="Escolha o modo" sub="Selecione o formato do treino. Os tempos podem ser ajustados na próxima etapa." brand={brand} />

      <View style={[st.grid, { gap }]}>
        {CARDS.map((c, i) => {
          const on = selected === c.key;
          const m = MODES[c.key];
          return (
            <Pressable
              key={c.key}
              onPress={() => { tap(); onSelect(c.key); }}
              style={({ pressed }) => [
                st.card, { width: cardW },
                on && { borderColor: brand, borderWidth: 2, padding: S[4] - 1, backgroundColor: "#0E2645" },
                pressed && { backgroundColor: C.navy800 },
              ]}
            >
              <View style={st.top}>
                <View style={[st.icon, on && { backgroundColor: brand }]}>
                  <Icon name={c.icon} size={24} color={on ? textOn(brand) : C.cyan300} />
                </View>
                <Text style={st.idx}>{String(i + 1).padStart(2, "0")}</Text>
              </View>
              <Text style={[st.name, cols < 3 && { fontFamily: F.black, fontSize: cardW < 170 ? 15 : 17 }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{c.label || m.label}</Text>
              {cols > 2 || width >= 600 ? <Text style={st.desc}>{c.desc || m.desc}</Text> : null}
              <View style={st.spec}><Text style={st.specText}>{c.spec}</Text></View>
            </Pressable>
          );
        })}
      </View>

      {templates.length ? (
        <View style={{ marginTop: S[6] }}>
          <SectionHead title="Modelos salvos" sub="Toque em “Usar” para carregar a configuração." />
          <View style={{ gap: S[2], marginTop: S[3] }}>
            {templates.map((t) => (
              <View key={t.id} style={st.tpl}>
                <View style={{ flex: 1 }}>
                  <Text style={st.tplName} numberOfLines={1}>{t.name}</Text>
                  <Text style={st.tplMeta}>{fmt(t.work)} · {fmt(t.rest)} desc. · {t.rounds}x</Text>
                </View>
                <Btn label="Usar" variant="secondary" small onPress={() => onUseTemplate(t)} />
                <IconBtn icon="trash" label="Excluir modelo" onPress={() => onDeleteTemplate(t)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { minHeight: 170, padding: S[4], borderRadius: R.lg, backgroundColor: C.navy850, borderWidth: 1, borderColor: C.line, gap: S[2] },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[1] },
  icon: { width: 44, height: 44, borderRadius: R.md, backgroundColor: C.petrol700, alignItems: "center", justifyContent: "center" },
  idx: { fontFamily: F.xbold, fontSize: 13, color: C.text3, letterSpacing: 1 },
  name: { fontFamily: F.wide, fontSize: 17, lineHeight: 20, color: C.white, textTransform: "uppercase" },
  desc: { fontFamily: F.medium, fontSize: 13, color: C.text2, lineHeight: 18 },
  spec: { marginTop: "auto", paddingTop: S[3], borderTopWidth: 1, borderTopColor: C.line },
  specText: { fontFamily: F.xbold, fontSize: 13, color: C.white, fontVariant: ["tabular-nums"] },
  tpl: { flexDirection: "row", alignItems: "center", gap: S[2], backgroundColor: C.navy850, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: S[3], paddingLeft: S[4] },
  tplName: { fontFamily: F.xbold, fontSize: 15, color: C.white },
  tplMeta: { fontFamily: F.medium, fontSize: 13, color: C.text2, fontVariant: ["tabular-nums"] },
});
