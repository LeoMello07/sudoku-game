# Sudoku — Aplicativo mobile em TypeScript

Jogo de Sudoku completo e moderno para **Android e iOS** (via Capacitor), com
interface mobile-first no padrão dos apps das lojas. Escrito em TypeScript puro,
sem bibliotecas de runtime. Todos os puzzles são gerados em tempo real com
**garantia de solução única** — nada de tabuleiros fixos.

## Rodar como aplicativo (Android/iOS)

```bash
npm install
npm run sync            # compila o TS, monta www/ e sincroniza os projetos nativos

# Android — APK de debug (requer Android Studio ou SDK + JDK 17+)
cd android && ./gradlew assembleDebug
# APK gerado em android/app/build/outputs/apk/debug/app-debug.apk

# ou abrir nas IDEs para rodar em emulador/dispositivo:
npx cap open android
npx cap open ios        # requer Xcode com a plataforma iOS instalada
```

Os ícones/splash nativos são gerados a partir de `assets/*.svg` com
`npx capacitor-assets generate`.

## Rodar no navegador

Abra o arquivo **`index.html`** — o jogo também roda 100% local, sem servidor.

## Recursos

- **Gerador real de puzzles**: backtracking com máscaras de bits + heurística
  MRV; a escavação desfaz qualquer remoção que quebre a unicidade da solução.
- **4 dificuldades** (pistas iniciais): Fácil 30–36 · Médio 26–30 ·
  Difícil 22–26 · Expert 17–22.
- **Destaques inteligentes**: célula selecionada, linha/coluna/bloco e números
  iguais.
- **Erros**: destaque automático configurável ("Mostrar erros") ou sob demanda
  no botão **Verificar**.
- **Dicas**: até 3 por partida, sempre corretas.
- **Cronômetro** com pausa automática (vitória ou aba oculta).
- **Modo escuro**, com detecção da preferência do sistema.
- **Salvamento automático** no LocalStorage — recarregue a página e continue
  exatamente de onde parou.
- **Sons sintetizados** via Web Audio (acerto, erro, vitória) com botão
  liga/desliga.
- **Teclado físico** (dígitos, numpad, setas, Backspace/Delete) e **teclado em
  tela** com contador de dígitos restantes.

## Desenvolvimento

```bash
npm install        # instala esbuild + typescript (dev only)
npm run build      # compila src/ para dist/bundle.js
npm run watch      # recompila a cada alteração
npm run typecheck  # checagem estrita de tipos
```

O bundle é gerado em formato IIFE (script clássico) justamente para funcionar
abrindo o `index.html` direto do disco (`file://`), onde módulos ES não
carregam.

## Estrutura

```
├── index.html          # marcação da interface
├── styles.css          # tema claro/escuro com variáveis CSS
├── dist/bundle.js      # código compilado (gerado pelo build)
└── src/
    ├── main.ts         # controlador: eventos, orquestração
    ├── types.ts        # tipos e constantes compartilhados
    ├── core/
    │   ├── solver.ts   # backtracking bitmask: resolver/contar soluções
    │   └── generator.ts# escavação com checagem de unicidade
    ├── game/
    │   ├── state.ts    # regras da partida (sem DOM)
    │   ├── timer.ts    # cronômetro
    │   ├── storage.ts  # LocalStorage
    │   └── audio.ts    # sons Web Audio
    └── ui/
        └── view.ts     # renderização do tabuleiro e widgets
```
