// Ícones (mesmo desenho da versão web), em react-native-svg.
import Svg, { Circle, Path, Rect } from "react-native-svg";

const P = (d, fill) => ({ t: "p", d, fill });
const ICONS = {
  round: [{ t: "c", cx: 12, cy: 13, r: 8 }, P("M12 9v4l2.5 2.5M9 2h6M12 2v3")],
  bolt: [P("M13 2 4 14h7l-1 8 9-12h-7z")],
  loop: [P("M17 2l4 4-4 4"), P("M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"), P("M21 13v1a4 4 0 0 1-4 4H3")],
  mat: [{ t: "r", x: 3, y: 3, w: 18, h: 18, rx: 1 }, P("M3 12h18M12 3v18"), { t: "c", cx: 12, cy: 12, r: 3 }],
  score: [{ t: "r", x: 2, y: 5, w: 20, h: 14, rx: 1 }, P("M12 5v14M6 10v4M16 10h2v2h-2v2h2")],
  sliders: [P("M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"), { t: "c", cx: 16, cy: 6, r: 2 }, { t: "c", cx: 10, cy: 12, r: 2 }, { t: "c", cx: 18, cy: 18, r: 2 }],
  grid: [{ t: "r", x: 3, y: 3, w: 7, h: 7 }, { t: "r", x: 14, y: 3, w: 7, h: 7 }, { t: "r", x: 3, y: 14, w: 7, h: 7 }, { t: "r", x: 14, y: 14, w: 7, h: 7 }],
  clock: [{ t: "c", cx: 12, cy: 12, r: 9 }, P("M12 7v5l3 2")],
  flag: [P("M5 21V4M5 4h11l-2 4 2 4H5")],
  tv: [{ t: "r", x: 2, y: 4, w: 20, h: 13, rx: 1 }, P("M8 21h8M12 17v4"), P("M10 8.5v5l4-2.5z", true)],
  play: [P("M7 4v16l13-8z", true)],
  pause: [P("M7 4h4v16H7zM13 4h4v16h-4z", true)],
  reset: [P("M3 12a9 9 0 1 0 3-6.7L3 8"), P("M3 3v5h5")],
  skip: [P("M5 4v16l10-8z", true), P("M19 4v16")],
  expand: [P("M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5")],
  x: [P("M6 6l12 12M18 6 6 18")],
  trash: [P("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3")],
  save: [P("M5 3h11l3 3v15H5z"), P("M8 3v5h7V3M8 21v-7h8v7")],
  upload: [P("M12 16V4M7 9l5-5 5 5M4 20h16")],
  volume: [P("M4 9v6h4l5 4V5L8 9z"), P("M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12")],
  check: [P("M5 12l5 5L20 7")],
};

export default function Icon({ name, size = 20, color = "#fff", stroke = 2 }) {
  const parts = ICONS[name] || [];
  const common = { stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {parts.map((p, i) => {
        if (p.t === "c") return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="none" {...common} />;
        if (p.t === "r") return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx || 0} fill="none" {...common} />;
        return <Path key={i} d={p.d} fill={p.fill ? color : "none"} {...common} />;
      })}
    </Svg>
  );
}
