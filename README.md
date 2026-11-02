# CT MAX TIMER

Timer de rounds para academias de luta. O backend é em Python (Flask) e o frontend é HTML/CSS/JS puro.

## Como rodar

Windows: dê dois cliques em `iniciar.bat`. Na primeira vez ele cria o ambiente virtual e instala o Flask.

Manual:

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

O terminal mostra os endereços:

| Endereço | Uso |
|---|---|
| `http://localhost:5000` | Controle neste PC |
| `http://<IP-do-PC>:5000` | Controle pelo celular (mesma rede Wi-Fi) |
| `http://<IP-do-PC>:5000/tv` | Tela da TV (abre direto no modo exibição) |

Todos os dispositivos ficam sincronizados. Se o Windows perguntar sobre o firewall, permita o acesso em redes privadas.

## Telas

| Tela | Função |
|---|---|
| Modos | Round Timer, Tabata, Circuito, Open Mat, Placar BJJ, Personalizado + modelos salvos |
| Sessão | Duração do round, descanso, quantidade de rounds, aviso dos últimos 10s |
| Academia | Nome, logo, cor de destaque, sons, frases, alto contraste, prévia ao vivo da TV |
| Placar | Vermelho x Azul com pontos (+2/+3/+4), vantagens e punições |
| Exibição | Tela cheia para TV |

Atalhos na exibição: `Espaço` iniciar/pausar, `R` reiniciar, `→` pular etapa, `F` tela cheia, `Esc` sair.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/state` | Timer + placar + versões (consultado a cada 0,5s) |
| GET | `/api/info` | Modos pré-definidos e URL do controle remoto |
| POST | `/api/timer/configure` | `{mode, work, rest, rounds, warn}` (segundos) |
| POST | `/api/timer/start` · `pause` · `toggle` · `reset` · `skip` | Controle do timer |
| GET / PUT | `/api/settings` | Personalização da academia |
| GET / POST | `/api/templates` | Lista / cria modelo |
| DELETE | `/api/templates/<id>` | Remove modelo |
| POST | `/api/score` | `{action:"add", side, key, delta}` · `{action:"name", side, name}` · `{action:"reset"}` |

Configurações, modelos e placar ficam em `data.json`, criado automaticamente. O som toca somente no dispositivo que está na tela de exibição.

## Estrutura

```
timer/
├── app.py            # backend Flask + motor do timer
├── requirements.txt
├── iniciar.bat
└── static/
    ├── index.html
    ├── style.css
    ├── app.js
    └── fonts/        # Archivo variável (SIL OFL), funciona sem internet
```
