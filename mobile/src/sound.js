// Sons do timer (sino de ringue e batidas de madeira), tocados com expo-audio.
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const FILES = {
  start: require("../assets/sounds/start.wav"),     // 1 toque: início do round
  end: require("../assets/sounds/end.wav"),         // 3 toques: fim do round
  done: require("../assets/sounds/done.wav"),       // 5 toques: fim da sessão
  beep: require("../assets/sounds/beep.wav"),       // contagem dos 10 segundos finais
};

let players = null;

export async function initSounds() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers", shouldPlayInBackground: false });
  } catch (_) {}
  if (players) return;
  players = {};
  for (const [k, src] of Object.entries(FILES)) {
    try { players[k] = createAudioPlayer(src); } catch (_) {}
  }
}

// Safari (iPhone) só libera o áudio depois de um toque: no primeiro toque,
// cada som é tocado sem volume e pausado, e a partir daí todos podem tocar sozinhos.
let unlocked = Platform.OS !== "web";
const playedSinceUnlock = new Set();
export function unlockAudio() {
  if (unlocked || !players) return;
  unlocked = true;
  playedSinceUnlock.clear();
  for (const [name, p] of Object.entries(players)) {
    try {
      p.volume = 0;
      p.play();
      setTimeout(() => {
        // se o som foi tocado de verdade nesse meio-tempo, não interrompe
        if (playedSinceUnlock.has(name)) return;
        try { p.pause(); p.seekTo(0); } catch (_) {}
      }, 80);
    } catch (_) {}
  }
}

export async function play(name, settings) {
  if (!settings?.sound || !players?.[name]) return;
  const p = players[name];
  playedSinceUnlock.add(name);
  try {
    p.volume = Math.max(0, Math.min(1, (settings.volume ?? 80) / 100));
    await p.seekTo(0);
    p.play();
  } catch (_) {}
}
