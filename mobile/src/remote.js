// Teclas do controle remoto. No Android, chegam do código nativo (plugins/withAndroidTV.js)
// como evento "ctmaxKey". Na web (PWA / testes no computador), vêm do teclado.
import { DeviceEventEmitter, Platform } from "react-native";

export const K = {
  BACK: 4, UP: 19, DOWN: 20, LEFT: 21, RIGHT: 22, CENTER: 23, SPACE: 62, ENTER: 66,
  MENU: 82, PLAY_PAUSE: 85, NEXT: 87, PREVIOUS: 88, REWIND: 89, FAST_FORWARD: 90,
  PLAY: 126, PAUSE: 127, NUMPAD_ENTER: 160,
};

const WEB = {
  ArrowUp: K.UP, ArrowDown: K.DOWN, ArrowLeft: K.LEFT, ArrowRight: K.RIGHT,
  Enter: K.ENTER, " ": K.SPACE, Escape: K.BACK, MediaPlayPause: K.PLAY_PAUSE,
  MediaTrackNext: K.NEXT, MediaTrackPrevious: K.PREVIOUS, MediaFastForward: K.FAST_FORWARD,
  MediaRewind: K.REWIND, MediaPlay: K.PLAY, MediaPause: K.PAUSE,
};

export const isOk = (c) => c === K.CENTER || c === K.ENTER || c === K.NUMPAD_ENTER || c === K.SPACE;
export const isDpad = (c) => c >= K.UP && c <= K.CENTER;

// handler({ code, repeat }) — retorna true quando a tecla foi usada (web: evita o padrão do navegador)
export function onRemoteKey(handler) {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return () => {};
    const f = (e) => {
      const code = WEB[e.key];
      if (code == null) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (handler({ code, repeat: e.repeat ? 1 : 0 })) e.preventDefault();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }
  const sub = DeviceEventEmitter.addListener("ctmaxKey", (e) => handler({ code: e.keyCode, repeat: e.repeat || 0 }));
  return () => sub.remove();
}
