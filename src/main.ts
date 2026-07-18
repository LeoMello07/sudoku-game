/**
 * Controlador do jogo: liga estado, cronômetro, sons, salvamento e
 * interface, e concentra todos os manipuladores de eventos.
 */
import type { Difficulty, GameState, Settings } from "./types";
import { DIFFICULTY_LABELS } from "./types";
import {
  applyHint,
  eraseCell,
  isFixed,
  newGame,
  restart,
  setCell,
  solveAll,
  toggleNote,
  wrongPositions,
} from "./game/state";
import { Timer, formatTime } from "./game/timer";
import { SoundPlayer } from "./game/audio";
import { load, save } from "./game/storage";
import { View, query } from "./ui/view";

// ---------------------------------------------------------------------------
// Estado global do controlador
// ---------------------------------------------------------------------------

let state: GameState;
let selected: number | null = null;
let annotationMode = false;
const settings: Settings = {
  autoCheck: true,
  sound: true,
  dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
};

const sound = new SoundPlayer();

const view = new View({
  onCellClick(pos) {
    selected = pos;
    renderAll();
  },
  onDigit: inputDigit,
  onErase: eraseSelected,
});

const timer = new Timer((seconds) => {
  state.seconds = seconds;
  view.updateTimer(seconds);
  persist(); // mantém o tempo salvo mesmo se a aba fechar sem aviso
});

const difficultySelect = query<HTMLSelectElement>("#difficulty");

// ---------------------------------------------------------------------------
// Inicialização: restaura a partida salva ou começa uma nova
// ---------------------------------------------------------------------------

const saved = load();
if (saved) {
  state = saved.state;
  Object.assign(settings, saved.settings);
} else {
  state = newGame("easy");
}
sound.enabled = settings.sound;
difficultySelect.value = state.difficulty;

view.applySettings(settings);
renderAll();
timer.reset(state.seconds);
if (!state.finished) timer.start();

// ---------------------------------------------------------------------------
// Ações do jogo
// ---------------------------------------------------------------------------

function persist(): void {
  save({ state, settings });
}

function renderAll(): void {
  view.render(state, selected, settings.autoCheck, annotationMode);
}

/** Insere um dígito na célula selecionada (teclado físico ou em tela). */
function inputDigit(digit: number): void {
  if (state.finished || selected === null) return;
  if (isFixed(state, selected)) {
    view.animateCell(selected, "shake");
    return;
  }
  if (annotationMode) {
    if (!toggleNote(state, selected, digit)) return;
    renderAll();
    view.animateCell(selected, "pop");
    sound.place();
    persist();
    return;
  }
  if (!setCell(state, selected, digit)) return;

  renderAll();
  view.animateCell(selected, "pop");
  persist();

  if (state.finished) {
    celebrateWin();
    return;
  }
  if (settings.autoCheck) {
    const correct = state.grid[selected] === state.solution[selected];
    if (correct) {
      sound.correct();
    } else {
      sound.error();
      view.animateCell(selected, "shake");
    }
  } else {
    // Sem verificação automática o som não pode denunciar erro/acerto.
    sound.place();
  }
}

/** Apaga o conteúdo da célula selecionada (botão, ⌫, Backspace, Delete). */
function eraseSelected(): void {
  if (selected === null) return;
  if (eraseCell(state, selected)) {
    renderAll();
    persist();
  }
}

/** Alterna entre a entrada normal e a entrada de pequenas anotações. */
function toggleAnnotationMode(): void {
  if (state.finished) return;
  annotationMode = !annotationMode;
  renderAll();
  view.showToast(
    annotationMode ? "Modo anotação ativado." : "Modo anotação desativado.",
  );
}

/** Pausa o cronômetro, celebra e mostra o modal de vitória. */
function celebrateWin(): void {
  timer.pause();
  sound.win();
  persist();
  view.showWinModal(
    formatTime(state.seconds),
    DIFFICULTY_LABELS[state.difficulty],
  );
}

/** Gera uma partida nova; o aviso dá tempo de o navegador pintar antes do trabalho pesado. */
function startNewGame(difficulty: Difficulty): void {
  view.showToast("Gerando novo jogo…");
  document.body.classList.add("busy");
  window.setTimeout(() => {
    state = newGame(difficulty);
    selected = null;
    annotationMode = false;
    view.hideWinModal();
    timer.reset(0);
    timer.start();
    renderAll();
    persist();
    document.body.classList.remove("busy");
  }, 30);
}

function restartGame(): void {
  restart(state);
  selected = null;
  annotationMode = false;
  view.hideWinModal();
  timer.reset(0);
  timer.start();
  renderAll();
  persist();
  view.showToast("Puzzle reiniciado.");
}

function giveHint(): void {
  if (state.hintsLeft <= 0) {
    view.showToast("Dicas esgotadas nesta partida.", "error");
    return;
  }
  const pos = applyHint(state, selected);
  if (pos === null) {
    view.showToast("Nada para preencher.", "info");
    return;
  }
  selected = pos;
  renderAll();
  view.animateCell(pos, "pop");
  persist();
  if (state.finished) {
    celebrateWin();
  } else {
    sound.correct();
  }
}

function checkErrors(): void {
  if (state.finished) return;
  const wrong = wrongPositions(state);
  state.checkedErrors = wrong;
  renderAll();
  persist();
  if (wrong.length === 0) {
    sound.correct();
    view.showToast("Nenhum erro até aqui! 👏", "success");
  } else {
    sound.error();
    const plural = wrong.length > 1 ? "s" : "";
    view.showToast(
      `${wrong.length} erro${plural} encontrado${plural}.`,
      "error",
    );
  }
}

function solveGame(): void {
  if (state.finished) return;
  solveAll(state);
  selected = null;
  annotationMode = false;
  timer.pause();
  renderAll();
  persist();
  view.showToast("Puzzle resolvido com a solução armazenada.");
}

// ---------------------------------------------------------------------------
// Eventos de interface
// ---------------------------------------------------------------------------

query<HTMLButtonElement>("#btn-new").addEventListener("click", () => {
  startNewGame(difficultySelect.value as Difficulty);
});
query<HTMLButtonElement>("#btn-restart").addEventListener("click", restartGame);
query<HTMLButtonElement>("#btn-solve").addEventListener("click", solveGame);
query<HTMLButtonElement>("#btn-annotation").addEventListener(
  "click",
  toggleAnnotationMode,
);
query<HTMLButtonElement>("#btn-hint").addEventListener("click", giveHint);
query<HTMLButtonElement>("#btn-check").addEventListener("click", checkErrors);
query<HTMLButtonElement>("#btn-erase").addEventListener("click", eraseSelected);
query<HTMLButtonElement>("#btn-play-again").addEventListener("click", () => {
  startNewGame(difficultySelect.value as Difficulty);
});

query<HTMLInputElement>("#auto-check").addEventListener("change", (event) => {
  settings.autoCheck = (event.target as HTMLInputElement).checked;
  renderAll();
  persist();
});

query<HTMLButtonElement>("#btn-theme").addEventListener("click", () => {
  settings.dark = !settings.dark;
  view.applySettings(settings);
  persist();
});

query<HTMLButtonElement>("#btn-sound").addEventListener("click", () => {
  settings.sound = !settings.sound;
  sound.enabled = settings.sound;
  view.applySettings(settings);
  persist();
});

// Teclado físico: dígitos (linha superior e numpad), setas e apagar.
const ARROW_DELTAS: Record<string, number> = {
  ArrowUp: -9,
  ArrowDown: 9,
  ArrowLeft: -1,
  ArrowRight: 1,
};

document.addEventListener("keydown", (event) => {
  // Não interceptar digitação em controles de formulário (select, checkbox).
  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
    return;

  if (event.key >= "1" && event.key <= "9") {
    inputDigit(Number(event.key));
  } else if (
    event.key === "Backspace" ||
    event.key === "Delete" ||
    event.key === "0"
  ) {
    event.preventDefault();
    eraseSelected();
  } else if (event.key in ARROW_DELTAS) {
    event.preventDefault();
    const next =
      (selected ?? 0) + (selected === null ? 0 : ARROW_DELTAS[event.key]);
    selected = Math.min(80, Math.max(0, next));
    renderAll();
  }
});

// Pausa o cronômetro quando a aba perde visibilidade; retoma ao voltar.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    timer.pause();
    persist();
  } else if (!state.finished) {
    timer.start();
  }
});

// ---------------------------------------------------------------------------
// Gancho de depuração para testes manuais/automatizados (sem uso no jogo).
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __sudoku?: {
      getState(): GameState;
      almostWin(): void;
    };
  }
}

window.__sudoku = {
  getState: () => state,
  /** Preenche tudo corretamente exceto uma célula — útil para testar a vitória. */
  almostWin() {
    let kept = -1;
    for (let i = 80; i >= 0; i--) {
      if (state.grid[i] !== state.solution[i]) {
        kept = i;
        break;
      }
    }
    if (kept === -1) return;
    for (let i = 0; i < 81; i++) {
      if (i !== kept && !isFixed(state, i)) state.grid[i] = state.solution[i];
    }
    state.grid[kept] = 0;
    state.checkedErrors = [];
    renderAll();
    persist();
  },
};
