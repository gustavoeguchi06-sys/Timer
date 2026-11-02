// Paleta e tipografia do CT MAX TIMER — mesmos tokens da versão web.
export const C = {
  navy950: "#040B18",
  navy900: "#0A1A33",
  navy850: "#0C1F3C",
  navy800: "#0F2442",
  navy700: "#163054",
  petrol700: "#0B4A57",
  petrol600: "#0E5E6E",
  petrol500: "#137385",
  petrol300: "#5FB0C0",
  cyan400: "#22D3EE",
  cyan300: "#67E8F9",
  white: "#FFFFFF",
  red600: "#B91C1C",
  red500: "#DC2626",
  blue600: "#1D4ED8",
  blue500: "#2563EB",
  text2: "#B4C6D9",
  text3: "#7F96B1",
  line: "rgba(180,198,217,0.12)",
  lineStrong: "rgba(180,198,217,0.24)",
  onCyan: "#04202B",
};

// Famílias geradas a partir da Archivo variável (ver assets/fonts)
export const F = {
  medium: "Archivo-Medium",
  bold: "Archivo-Bold",
  xbold: "Archivo-ExtraBold",
  black: "Archivo-Black",
  wideX: "ArchivoWide-ExtraBold",
  wide: "ArchivoWide-Black",
  narrowX: "ArchivoNarrow-ExtraBold",
  narrow: "ArchivoNarrow-Black",
};

export const fontFiles = {
  "Archivo-Medium": require("../assets/fonts/Archivo-Medium.ttf"),
  "Archivo-Bold": require("../assets/fonts/Archivo-Bold.ttf"),
  "Archivo-ExtraBold": require("../assets/fonts/Archivo-ExtraBold.ttf"),
  "Archivo-Black": require("../assets/fonts/Archivo-Black.ttf"),
  "ArchivoWide-ExtraBold": require("../assets/fonts/ArchivoWide-ExtraBold.ttf"),
  "ArchivoWide-Black": require("../assets/fonts/ArchivoWide-Black.ttf"),
  "ArchivoNarrow-ExtraBold": require("../assets/fonts/ArchivoNarrow-ExtraBold.ttf"),
  "ArchivoNarrow-Black": require("../assets/fonts/ArchivoNarrow-Black.ttf"),
};

export const S = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 };
export const R = { sm: 6, md: 8, lg: 12 };
export const TOUCH = 52;

// Texto escuro ou branco sobre a cor de destaque, conforme o contraste
export function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.18 ? C.onCyan : C.white;
}

// Logos fixos exibidos ao lado do nome (academia e parceiro)
export const PARTNER_LOGOS = [
  require("../assets/images/ct-angelo.png"),
  require("../assets/images/acai.png"),
];

export const BRAND_SWATCHES = ["#22D3EE", "#67E8F9", "#5FB0C0", "#137385", "#FFFFFF"];
