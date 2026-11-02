import { Alert, Image, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../Touch";
import * as ImagePicker from "expo-image-picker";
import DisplayView from "../DisplayView";
import Icon from "../icons";
import { play } from "../sound";
import { BRAND_SWATCHES, C, F, R, S, textOn } from "../theme";
import { Btn, Card, FieldHead, PageHead, SectionHead, ToggleRow, tap } from "../ui";

const VW = 960, VH = 540;

export default function Academy({ settings, setSettings, timer, now, width, wide }) {
  const brand = settings.brand_color;
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const pickLogo = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, quality: 0.6, base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const a = res.assets[0];
      if (a.base64.length > 2_500_000) {
        Alert.alert("Imagem muito grande", "Escolha uma imagem menor para o logo.");
        return;
      }
      set({ logo: `data:${a.mimeType || "image/jpeg"};base64,${a.base64}` });
    } catch (e) {
      Alert.alert("Não foi possível abrir as fotos", String(e?.message || e));
    }
  };

  const previewW = wide ? Math.min(560, (width - S[4] * 3) * 0.55) : width - S[4] * 2;
  const previewH = previewW * (9 / 16);

  const preview = (
    <View style={{ gap: S[2] }}>
      <View style={st.previewLabel}>
        <Text style={[st.eyebrow, { color: brand }]}>Prévia da TV</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.cyan400 }} />
          <Text style={st.live}>Ao vivo</Text>
        </View>
      </View>
      <View style={[st.frame, { width: previewW, height: previewH }]}>
        {/* renderiza numa "TV virtual" 960x540 e reduz, para ficar idêntica à exibição real */}
        <View pointerEvents="none" style={{ width: VW, height: VH, transform: [{ translateX: previewW / 2 - VW / 2 }, { translateY: previewH / 2 - VH / 2 }, { scale: previewW / VW }] }}>
          <DisplayView timer={timer} now={now} settings={settings} width={VW} height={VH} />
        </View>
      </View>
    </View>
  );

  const cards = (
    <View style={{ gap: S[3], flex: wide ? 1 : undefined }}>
      <Card>
        <SectionHead title="Identidade" sub="Nome, logo e cor de destaque." />
        <View style={{ gap: S[2] }}>
          <FieldHead label="Nome da academia" />
          <TextInput
            value={settings.gym_name}
            onChangeText={(v) => set({ gym_name: v.slice(0, 40) })}
            placeholder="Ex.: CT MAX"
            placeholderTextColor={C.text3}
            style={st.input}
            maxLength={40}
          />
        </View>
        <View style={{ gap: S[2] }}>
          <FieldHead label="Logo" />
          <View style={st.uploadRow}>
            <View style={st.thumb}>
              {settings.logo ? <Image source={{ uri: settings.logo }} style={{ width: "100%", height: "100%", resizeMode: "contain" }} /> : <Text style={st.thumbText}>Sem logo</Text>}
            </View>
            <Btn label="Escolher" icon="upload" variant="secondary" small onPress={pickLogo} />
            {settings.logo ? <Btn label="Remover" variant="ghost" small onPress={() => set({ logo: "" })} /> : null}
          </View>
        </View>
        <View style={{ gap: S[2] }}>
          <FieldHead label="Cor de destaque" />
          <View style={st.swatches}>
            {BRAND_SWATCHES.map((c) => {
              const on = c.toUpperCase() === brand.toUpperCase();
              return (
                <Pressable key={c} accessibilityLabel={`Cor ${c}`} onPress={() => { tap(); set({ brand_color: c }); }}
                  style={[st.swatch, { backgroundColor: c }, on && { borderColor: C.white, borderWidth: 3 }]}>
                  {on ? <Icon name="check" size={22} color={textOn(c)} stroke={3} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card>
        <SectionHead title="Áudio" sub="Sino de início e fim, aviso dos 10 segundos." />
        <ToggleRow label="Sons ativados" value={settings.sound} onChange={(v) => set({ sound: v })} brand={brand} />
        <View style={{ gap: S[2] }}>
          <FieldHead label="Volume" value={`${settings.volume}%`} />
          <View style={st.volRow}>
            <Btn label="−" variant="secondary" small style={st.volBtn} onPress={() => set({ volume: Math.max(0, settings.volume - 10) })} />
            <View style={st.volTrack}><View style={[st.volFill, { width: `${settings.volume}%`, backgroundColor: brand }]} /></View>
            <Btn label="+" variant="secondary" small style={st.volBtn} onPress={() => set({ volume: Math.min(100, settings.volume + 10) })} />
          </View>
        </View>
        <Btn label="Testar som" icon="volume" variant="secondary" small style={{ alignSelf: "flex-start" }}
          onPress={() => { play("warning", settings); setTimeout(() => play("start", settings), 1600); }} />
      </Card>

      <Card>
        <SectionHead title="Exibição" sub="O que aparece na tela de exibição." />
        <ToggleRow label="Frases motivacionais" value={settings.show_phrases} onChange={(v) => set({ show_phrases: v })} brand={brand} />
        <ToggleRow label="Próxima etapa" value={settings.show_next} onChange={(v) => set({ show_next: v })} brand={brand} />
        <ToggleRow label="Alto contraste" hint="Fundo branco para ambientes muito claros" value={settings.high_contrast} onChange={(v) => set({ high_contrast: v })} brand={brand} />
        <View style={{ gap: S[2] }}>
          <FieldHead label="Frases" hint="uma por linha" />
          <TextInput
            multiline
            value={settings.phrases.join("\n")}
            onChangeText={(v) => set({ phrases: v.split("\n").map((l) => l.slice(0, 120)) })}
            onEndEditing={() => set({ phrases: settings.phrases.map((l) => l.trim()).filter(Boolean) })}
            style={[st.input, { minHeight: 140, textAlignVertical: "top", paddingTop: S[3] }]}
            placeholderTextColor={C.text3}
          />
        </View>
      </Card>
    </View>
  );

  return (
    <View>
      <PageHead eyebrow="03 · Marca" title="Academia" sub="As alterações aparecem na prévia e na exibição na hora." brand={brand} />
      {wide ? (
        <View style={{ flexDirection: "row", gap: S[4], alignItems: "flex-start" }}>{preview}{cards}</View>
      ) : (
        <View style={{ gap: S[4] }}>{preview}{cards}</View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  eyebrow: { fontFamily: F.xbold, fontSize: 12, letterSpacing: 1.9, textTransform: "uppercase" },
  previewLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  live: { fontFamily: F.bold, fontSize: 12, color: C.text2, letterSpacing: 1.2, textTransform: "uppercase" },
  frame: { borderRadius: R.lg, borderWidth: 1, borderColor: C.lineStrong, overflow: "hidden", backgroundColor: C.navy950 },
  input: {
    minHeight: 52, paddingHorizontal: S[4], borderRadius: R.md, borderWidth: 1, borderColor: C.lineStrong,
    backgroundColor: C.navy900, color: C.white, fontFamily: F.medium, fontSize: 16,
  },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: S[2], flexWrap: "wrap" },
  thumb: { width: 72, height: 52, borderRadius: R.md, borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong, backgroundColor: C.navy900, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbText: { fontFamily: F.bold, fontSize: 11, color: C.text3 },
  swatches: { flexDirection: "row", gap: S[3], flexWrap: "wrap" },
  swatch: { width: 48, height: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  volRow: { flexDirection: "row", alignItems: "center", gap: S[3] },
  volBtn: { width: 52, paddingHorizontal: 0 },
  volTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.navy700, overflow: "hidden" },
  volFill: { height: "100%" },
});
