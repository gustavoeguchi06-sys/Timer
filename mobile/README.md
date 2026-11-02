# CT MAX TIMER — app Android

App nativo em React Native (Expo SDK 54). Funciona sozinho no celular, sem servidor e sem internet:
o timer, os sons, o placar, os modelos e a personalização ficam salvos no aparelho.

## Baixar o APK

O APK é gerado automaticamente pelo GitHub Actions a cada mudança na pasta `mobile/`.
Baixe a versão mais recente em **Releases** no GitHub e instale no celular
(o Android vai pedir para permitir a instalação de apps de fontes desconhecidas).

## Telas

| Tela | Função |
|---|---|
| Modos | Round Timer, Tabata, Circuito, Open Mat, Placar BJJ, Personalizado e modelos salvos |
| Sessão | Duração do round, descanso, rounds e aviso dos 10s (stepper + atalhos) |
| Academia | Nome, logo (da galeria), cor de destaque, sons, frases, alto contraste e prévia |
| Placar | Vermelho × Azul com pontos, vantagens e punições; tela cheia |
| Exibição | Tela cheia, tela sempre ligada, funciona em pé e deitado |

## Desenvolvimento

```
cd mobile
npm install
npx expo start          # abre no Expo Go ou emulador
npx expo run:android    # build local (precisa do Android SDK)
```

## Estrutura

```
mobile/
├── App.js              # navegação, relógio, sons, telas cheias
├── src/
│   ├── engine.js       # motor do timer (porte do app.py)
│   ├── DisplayView.js  # tela de exibição
│   ├── screens/        # Modos, Sessão, Academia, Placar
│   ├── ui.js           # componentes (botões, stepper, toggle)
│   ├── sound.js        # sons com expo-audio
│   ├── store.js        # armazenamento local
│   └── theme.js        # cores e fontes
└── assets/             # fontes Archivo, sons WAV, ícone
```
