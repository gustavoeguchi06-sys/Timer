// Diálogos próprios (texto e confirmação). Substituem o Alert do sistema, que não funciona
// na versão web/iPhone e é ruim de usar com controle remoto.
import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { C, F, R, S } from "./theme";
import { Btn } from "./ui";

export function Dialogs({ dialog, onClose, brand }) {
  if (!dialog) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait", "landscape"]}>
      <View style={st.wrap}>
        {dialog.type === "text" ? <TextDialog d={dialog} onClose={onClose} brand={brand} /> : <ConfirmDialog d={dialog} onClose={onClose} brand={brand} />}
      </View>
    </Modal>
  );
}

function TextDialog({ d, onClose, brand }) {
  const [v, setV] = useState(d.initial || "");
  const save = () => { if (!v.trim() && d.required !== false) return; d.onSave(v.trim().slice(0, d.max || 40)); onClose(); };
  return (
    <View style={st.box}>
      <Text style={st.title}>{d.title}</Text>
      {d.sub ? <Text style={st.sub}>{d.sub}</Text> : null}
      <TextInput
        autoFocus value={v} onChangeText={setV} maxLength={d.max || 40} selectTextOnFocus
        style={st.input} placeholder={d.placeholder} placeholderTextColor={C.text3}
        returnKeyType="done" onSubmitEditing={save}
      />
      <View style={st.row}>
        <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={d.okLabel || "Salvar"} brand={brand} style={{ flex: 1 }} onPress={save} disabled={!v.trim() && d.required !== false} />
      </View>
    </View>
  );
}

function ConfirmDialog({ d, onClose, brand }) {
  return (
    <View style={st.box}>
      <Text style={st.title}>{d.title}</Text>
      {d.message ? <Text style={st.sub}>{d.message}</Text> : null}
      <View style={st.row}>
        {d.okLabel ? <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} /> : null}
        <Btn
          label={d.okLabel || "OK"} brand={d.destructive ? C.red500 : brand} style={{ flex: 1 }}
          onPress={() => { onClose(); d.onOk && d.onOk(); }}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(2,6,17,0.75)", justifyContent: "center", padding: S[5] },
  box: { backgroundColor: C.navy850, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineStrong, padding: S[5], gap: S[4], maxWidth: 460, width: "100%", alignSelf: "center" },
  title: { fontFamily: F.wide, fontSize: 20, color: C.white, textTransform: "uppercase" },
  sub: { fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.text2, marginTop: -S[2] },
  input: { minHeight: 52, paddingHorizontal: S[4], borderRadius: R.md, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.navy900, color: C.white, fontFamily: F.medium, fontSize: 16 },
  row: { flexDirection: "row", gap: S[2] },
});
