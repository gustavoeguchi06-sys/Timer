// Pressable com anel de foco visível — necessário para navegar com as setas
// do controle remoto da TV Box. No celular (toque) o anel não aparece.
import { forwardRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { C } from "./theme";

// Na web (iPhone/PWA), um toque também dá foco ao elemento: só mostra o anel
// quando a última interação foi pelo teclado/controle remoto.
let keyboardMode = Platform.OS !== "web";
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("keydown", () => { keyboardMode = true; }, true);
  window.addEventListener("pointerdown", () => { keyboardMode = false; }, true);
}

const Touch = forwardRef(function Touch({ style, children, ringRadius = 10, ringColor, focusable = true, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      focusable={focusable}
      onFocus={(e) => { if (keyboardMode) setFocused(true); onFocus && onFocus(e); }}
      onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
      style={(state) => (typeof style === "function" ? style({ ...state, focused }) : style)}
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children({ ...state, focused }) : children}
          {focused ? <View pointerEvents="none" style={[st.ring, { borderRadius: ringRadius + 3 }, ringColor && { borderColor: ringColor }]} /> : null}
        </>
      )}
    </Pressable>
  );
});

const st = StyleSheet.create({
  ring: { ...StyleSheet.absoluteFillObject, margin: -3, borderWidth: 3, borderColor: C.cyan300 },
});

export default Touch;
