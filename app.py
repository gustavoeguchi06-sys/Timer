"""
CT MAX TIMER — timer de luta. Backend em Python (Flask).

O servidor é a fonte da verdade do timer, do placar, das configurações da
academia e dos modelos salvos. Qualquer dispositivo na mesma rede pode abrir
o app: a TV em /tv (exibição) e o celular em / (controle) ficam sincronizados.

Executar:
    pip install -r requirements.txt
    python app.py
"""

import json
import os
import socket
import threading
import time
import uuid

from flask import Flask, abort, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_FILE = os.path.join(BASE_DIR, "data.json")
PORT = int(os.environ.get("PORT", 5000))

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 3 * 1024 * 1024  # logo em base64 até ~2 MB

lock = threading.RLock()

# --------------------------------------------------------------------------
# Modos pré-definidos
# --------------------------------------------------------------------------
MODES = {
    "round":   {"label": "Round Timer",   "work": 300,  "rest": 60, "rounds": 5,  "warn": True},
    "tabata":  {"label": "Tabata",        "work": 20,   "rest": 10, "rounds": 8,  "warn": True},
    "circuit": {"label": "Circuito",      "work": 45,   "rest": 15, "rounds": 10, "warn": True},
    "openmat": {"label": "Open Mat",      "work": 3600, "rest": 0,  "rounds": 1,  "warn": True},
    "custom":  {"label": "Personalizado", "work": 180,  "rest": 30, "rounds": 3,  "warn": True},
}

DEFAULT_PHRASES = [
    "Disciplina vence talento quando o talento não treina.",
    "Um round de cada vez.",
    "Respire. Ajuste. Continue.",
    "A faixa é só um pedaço de pano. O que importa é o treino.",
    "Cansaço é parte do caminho.",
    "Técnica primeiro, força depois.",
]

DEFAULT_SETTINGS = {
    "gym_name": "CT MAX TIMER",
    "logo": "",               # data URL da imagem
    "brand_color": "#22D3EE",
    "sound": True,
    "volume": 80,
    "show_phrases": True,
    "show_next": True,
    "high_contrast": False,
    "phrases": DEFAULT_PHRASES,
}


def default_score():
    side = {"name": "", "pts": 0, "adv": 0, "pen": 0}
    return {
        "red": {**side, "name": "Atleta Vermelho"},
        "blue": {**side, "name": "Atleta Azul"},
    }


# --------------------------------------------------------------------------
# Persistência simples em JSON
# --------------------------------------------------------------------------
def load_data():
    data = {"settings": dict(DEFAULT_SETTINGS), "templates": [], "score": default_score()}
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, encoding="utf-8") as f:
                saved = json.load(f)
            data["settings"].update(saved.get("settings", {}))
            # migra os padrões da versão anterior (nomes antigos, dourado)
            if data["settings"].get("brand_color", "").upper() == "#B45309":
                data["settings"]["brand_color"] = DEFAULT_SETTINGS["brand_color"]
            if data["settings"].get("gym_name") in ("Sensei Timer", "Hajime"):
                data["settings"]["gym_name"] = DEFAULT_SETTINGS["gym_name"]
            data["templates"] = saved.get("templates", [])
            data["score"] = saved.get("score", data["score"])
        except (OSError, ValueError):
            pass  # arquivo corrompido: volta para o padrão
    return data


def save_data():
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(
            {"settings": store["settings"], "templates": store["templates"], "score": store["score"]},
            f, ensure_ascii=False, indent=2,
        )
    os.replace(tmp, DATA_FILE)


store = load_data()
versions = {"settings": 1, "score": 1, "templates": 1}


# --------------------------------------------------------------------------
# Motor do timer
# --------------------------------------------------------------------------
class Timer:
    """Máquina de estados: idle -> work -> rest -> work ... -> done.

    O avanço de etapas é calculado sob demanda (tick) a cada requisição,
    então não há thread rodando em segundo plano.
    """

    def __init__(self):
        self.configure("round", **{k: MODES["round"][k] for k in ("work", "rest", "rounds", "warn")})

    def configure(self, mode, work, rest, rounds, warn):
        self.mode = mode if mode in MODES else "custom"
        self.work = max(1, int(work))
        self.rest = max(0, int(rest))
        self.rounds = max(1, int(rounds))
        self.warn = bool(warn)
        self.reset()

    def reset(self):
        self.round = 1
        self.phase = "idle"
        self.running = False
        self.remaining = float(self.work)
        self.ends_at = None
        self.version = getattr(self, "version", 0) + 1

    def _duration(self, phase):
        return self.work if phase == "work" else self.rest

    def _advance(self):
        """Vai para a próxima etapa. Retorna a duração dela (0 se terminou)."""
        if self.phase in ("idle", "rest"):
            if self.phase == "rest":
                self.round += 1
            self.phase = "work"
        elif self.phase == "work":
            if self.round >= self.rounds:
                self.phase = "done"
            elif self.rest > 0:
                self.phase = "rest"
            else:
                self.round += 1
                self.phase = "work"
        if self.phase == "done":
            self.running = False
            self.remaining = 0.0
            self.ends_at = None
            return 0
        return self._duration(self.phase)

    def tick(self):
        if not self.running:
            return
        now = time.time()
        while self.running and self.ends_at is not None and now >= self.ends_at:
            prev_end = self.ends_at
            dur = self._advance()
            if self.phase != "done":
                self.ends_at = prev_end + dur
            self.version += 1

    def start(self):
        self.tick()
        if self.phase == "done":
            self.reset()
        if self.phase == "idle":
            self.phase = "work"
            self.remaining = float(self.work)
        if not self.running:
            self.running = True
            self.ends_at = time.time() + self.remaining
            self.version += 1

    def pause(self):
        self.tick()
        if self.running:
            self.remaining = max(0.0, self.ends_at - time.time())
            self.running = False
            self.ends_at = None
            self.version += 1

    def skip(self):
        self.tick()
        if self.phase == "done":
            return
        dur = self._advance()
        if self.phase != "done":
            self.remaining = float(dur)
            if self.running:
                self.ends_at = time.time() + dur
        self.version += 1

    def snapshot(self):
        self.tick()
        if self.running:
            remaining = max(0.0, self.ends_at - time.time())
        else:
            remaining = self.remaining
        return {
            "mode": self.mode,
            "mode_label": MODES.get(self.mode, MODES["custom"])["label"],
            "work": self.work,
            "rest": self.rest,
            "rounds": self.rounds,
            "warn": self.warn,
            "round": self.round,
            "phase": self.phase,
            "running": self.running,
            "remaining_ms": int(remaining * 1000),
            "version": self.version,
        }


timer = Timer()


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def body():
    return request.get_json(silent=True) or {}


def clamp_int(value, lo, hi, default):
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------
# Páginas
# --------------------------------------------------------------------------
@app.get("/")
@app.get("/tv")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------
@app.get("/api/info")
def info():
    return jsonify({"remote_url": f"http://{lan_ip()}:{PORT}", "modes": MODES})


@app.get("/api/state")
def state():
    """Endpoint consultado periodicamente por todos os dispositivos."""
    with lock:
        return jsonify({
            "timer": timer.snapshot(),
            "score": store["score"],
            "versions": versions,
        })


@app.post("/api/timer/configure")
def timer_configure():
    b = body()
    mode = b.get("mode", "custom")
    base = MODES.get(mode, MODES["custom"])
    with lock:
        timer.configure(
            mode,
            clamp_int(b.get("work"), 1, 6 * 3600, base["work"]),
            clamp_int(b.get("rest"), 0, 3600, base["rest"]),
            clamp_int(b.get("rounds"), 1, 99, base["rounds"]),
            b.get("warn", base["warn"]),
        )
        return jsonify(timer.snapshot())


@app.post("/api/timer/<action>")
def timer_action(action):
    actions = {"start": timer.start, "pause": timer.pause, "reset": timer.reset, "skip": timer.skip}
    if action == "toggle":
        with lock:
            timer.tick()
            (timer.pause if timer.running else timer.start)()
            return jsonify(timer.snapshot())
    if action not in actions:
        abort(404)
    with lock:
        actions[action]()
        return jsonify(timer.snapshot())


@app.get("/api/settings")
def get_settings():
    with lock:
        return jsonify(store["settings"])


@app.put("/api/settings")
def put_settings():
    b = body()
    with lock:
        s = store["settings"]
        if "gym_name" in b:
            s["gym_name"] = str(b["gym_name"])[:40]
        if "logo" in b:
            logo = str(b["logo"] or "")
            if logo and not logo.startswith("data:image/"):
                abort(400, "Logo inválido")
            s["logo"] = logo
        if "brand_color" in b:
            color = str(b["brand_color"])
            if len(color) == 7 and color.startswith("#"):
                s["brand_color"] = color
        for key in ("sound", "show_phrases", "show_next", "high_contrast"):
            if key in b:
                s[key] = bool(b[key])
        if "volume" in b:
            s["volume"] = clamp_int(b["volume"], 0, 100, 80)
        if "phrases" in b and isinstance(b["phrases"], list):
            s["phrases"] = [str(p).strip()[:120] for p in b["phrases"] if str(p).strip()][:50]
        versions["settings"] += 1
        save_data()
        return jsonify(s)


@app.get("/api/templates")
def list_templates():
    with lock:
        return jsonify(store["templates"])


@app.post("/api/templates")
def create_template():
    b = body()
    name = str(b.get("name", "")).strip()[:40]
    if not name:
        abort(400, "Informe um nome")
    tpl = {
        "id": uuid.uuid4().hex[:8],
        "name": name,
        "mode": b.get("mode", "custom") if b.get("mode") in MODES else "custom",
        "work": clamp_int(b.get("work"), 1, 6 * 3600, 300),
        "rest": clamp_int(b.get("rest"), 0, 3600, 60),
        "rounds": clamp_int(b.get("rounds"), 1, 99, 5),
        "warn": bool(b.get("warn", True)),
    }
    with lock:
        store["templates"].append(tpl)
        versions["templates"] += 1
        save_data()
    return jsonify(tpl), 201


@app.delete("/api/templates/<tpl_id>")
def delete_template(tpl_id):
    with lock:
        before = len(store["templates"])
        store["templates"] = [t for t in store["templates"] if t["id"] != tpl_id]
        if len(store["templates"]) == before:
            abort(404)
        versions["templates"] += 1
        save_data()
    return "", 204


@app.post("/api/score")
def update_score():
    """Ações: {"action":"add","side":"red","key":"pts","delta":2}
              {"action":"name","side":"blue","name":"João"}
              {"action":"reset"}"""
    b = body()
    action = b.get("action")
    with lock:
        score = store["score"]
        if action == "reset":
            names = {k: score[k]["name"] for k in ("red", "blue")}
            store["score"] = score = default_score()
            for k, n in names.items():
                score[k]["name"] = n
        elif action in ("add", "name"):
            side = b.get("side")
            if side not in ("red", "blue"):
                abort(400, "Lado inválido")
            if action == "add":
                key = b.get("key")
                if key not in ("pts", "adv", "pen"):
                    abort(400, "Campo inválido")
                delta = clamp_int(b.get("delta"), -10, 10, 0)
                score[side][key] = max(0, score[side][key] + delta)
            else:
                score[side]["name"] = str(b.get("name", "")).strip()[:30] or score[side]["name"]
        else:
            abort(400, "Ação inválida")
        versions["score"] += 1
        save_data()
        return jsonify(score)


if __name__ == "__main__":
    ip = lan_ip()
    print("\n  CT MAX TIMER rodando")
    print(f"  Controle (este PC):   http://localhost:{PORT}")
    print(f"  Controle (celular):   http://{ip}:{PORT}")
    print(f"  Tela da TV:           http://{ip}:{PORT}/tv\n")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
