// Persistência local (AsyncStorage). O app funciona sem servidor e sem internet.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

export const DEFAULT_PHRASES = [
  "Disciplina vence talento quando o talento não treina.",
  "Um round de cada vez.",
  "Respire. Ajuste. Continue.",
  "A faixa é só um pedaço de pano. O que importa é o treino.",
  "Cansaço é parte do caminho.",
  "Técnica primeiro, força depois.",
];

export const DEFAULT_SETTINGS = {
  gym_name: "CT MAX TIMER",
  logo: "",
  brand_color: "#22D3EE",
  sound: true,
  volume: 80,
  show_phrases: true,
  show_next: true,
  high_contrast: false,
  phrases: DEFAULT_PHRASES,
};

export const defaultScore = () => ({
  red: { name: "Atleta Vermelho", pts: 0, adv: 0, pen: 0 },
  blue: { name: "Atleta Azul", pts: 0, adv: 0, pen: 0 },
});

// Estado que é salvo automaticamente no aparelho
export function usePersisted(key, initial) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive || raw == null) return;
        try {
          const parsed = JSON.parse(raw);
          setValue((cur) =>
            cur && typeof cur === "object" && !Array.isArray(cur) ? { ...cur, ...parsed } : parsed
          );
        } catch (_) {}
      })
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
    }, 300);
  }, [key, value, ready]);

  return [value, setValue, ready];
}
