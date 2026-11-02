import { StyleSheet, Text, View } from "react-native";
import { MODES, fmt, totalSeconds } from "../engine";
import { C, F, R, S } from "../theme";
import { Card, Chips, Eyebrow, FieldHead, PageHead, Stepper, ToggleRow } from "../ui";

export default function Session({ cfg, setCfg, brand, wide }) {
  const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }));
  const total = totalSeconds(cfg);
  const label = (MODES[cfg.mode] || MODES.custom).label;

  const fields = (
    <View style={{ gap: S[3], flex: wide ? 1 : undefined }}>
      <Card>
        <FieldHead label="Duração do round" hint="Tempo de luta" />
        <Stepper label="duração do round" value={cfg.work} display={fmt} onChange={set("work")} min={5} max={6 * 3600} step={5} bigStepAbove={600} />
        <Chips options={[60, 120, 180, 300, 360, 600]} value={cfg.work} onChange={set("work")} format={fmt} brand={brand} />
      </Card>
      <Card>
        <FieldHead label="Duração do descanso" hint="Entre rounds" />
        <Stepper label="descanso" value={cfg.rest} display={fmt} onChange={set("rest")} min={0} max={600} step={5} />
        <Chips options={[0, 10, 30, 60, 90, 120]} value={cfg.rest} onChange={set("rest")} format={fmt} brand={brand} />
      </Card>
      <Card>
        <FieldHead label="Quantidade de rounds" hint="1 a 30" />
        <Stepper label="rounds" value={cfg.rounds} display={String} onChange={set("rounds")} min={1} max={30} step={1} />
        <Chips options={[1, 3, 5, 8, 10, 12]} value={cfg.rounds} onChange={set("rounds")} brand={brand} />
      </Card>
      <Card style={{ paddingVertical: S[3] }}>
        <ToggleRow label="Aviso dos 10 segundos" hint="Beep a cada segundo de 10 até 1" value={cfg.warn} onChange={set("warn")} brand={brand} />
      </Card>
    </View>
  );

  const summary = (
    <Card style={wide ? { width: 340 } : null}>
      <View>
        <Eyebrow color={brand}>Duração total</Eyebrow>
        <Text style={st.total}>{fmt(total)}</Text>
      </View>
      <View style={st.timeline}>
        {Array.from({ length: cfg.rounds }).map((_, i) => (
          <View key={i} style={{ flexDirection: "row", flex: cfg.work + (cfg.rest && i < cfg.rounds - 1 ? cfg.rest : 0), gap: 3 }}>
            <View style={{ flex: cfg.work, backgroundColor: brand, borderRadius: 2 }} />
            {cfg.rest && i < cfg.rounds - 1 ? <View style={{ flex: cfg.rest, backgroundColor: C.petrol500, borderRadius: 2, minWidth: 3 }} /> : null}
          </View>
        ))}
      </View>
      <View style={st.legend}>
        <View style={st.lg}><View style={[st.dot, { backgroundColor: brand }]} /><Text style={st.lgText}>Round</Text></View>
        <View style={st.lg}><View style={[st.dot, { backgroundColor: C.petrol500 }]} /><Text style={st.lgText}>Descanso</Text></View>
      </View>
      <Text style={st.sumText}>
        {cfg.rounds} round{cfg.rounds > 1 ? "s" : ""} de {fmt(cfg.work)}
        {cfg.rest ? ` com ${fmt(cfg.rest)} de descanso entre eles.` : " sem descanso."}
      </Text>
    </Card>
  );

  return (
    <View>
      <PageHead
        eyebrow="02 · Sessão"
        title="Configuração"
        brand={brand}
        sub="Use + e − (segure para ir rápido) ou toque num atalho."
        right={<View style={[st.tag, { backgroundColor: C.petrol700 }]}><Text style={st.tagText}>{label}</Text></View>}
      />
      {wide ? (
        <View style={{ flexDirection: "row", gap: S[4], alignItems: "flex-start" }}>{fields}{summary}</View>
      ) : (
        <View style={{ gap: S[3] }}>{summary}{fields}</View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm },
  tagText: { fontFamily: F.xbold, fontSize: 12, color: C.white, letterSpacing: 1, textTransform: "uppercase" },
  total: { fontFamily: F.narrow, fontSize: 56, lineHeight: 60, color: C.white, fontVariant: ["tabular-nums"], marginTop: 4 },
  timeline: { flexDirection: "row", gap: 3, height: 24, borderRadius: R.sm, overflow: "hidden" },
  legend: { flexDirection: "row", gap: S[4] },
  lg: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 2 },
  lgText: { fontFamily: F.bold, fontSize: 13, color: C.text2 },
  sumText: { fontFamily: F.medium, fontSize: 14, color: C.text2, paddingTop: S[3], borderTopWidth: 1, borderTopColor: C.line },
});

