// Pressable com anel de foco visível — necessário para navegar com as setas
// do controle remoto da TV Box. No celular (toque) o anel não aparece.
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { C } from "./theme";

const Touch = forwardRef(function Touch({ style, children, ringRadius = 10, focusable = true, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      focusable={focusable}
      onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
      onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
      style={(state) => (typeof style === "function" ? style({ ...state, focused }) : style)}
      {...props}
    >
      {(state) => (
        <>
          {typeof children === "function" ? children({ ...state, focused }) : children}
          {focused ? <View pointerEvents="none" style={[st.ring, { borderRadius: ringRadius + 3 }]} /> : null}
        </>
      )}
    </Pressable>
  );
});

const st = StyleSheet.create({
  ring: { ...StyleSheet.absoluteFillObject, margin: -3, borderWidth: 3, borderColor: C.cyan300 },
});

export default Touch;
