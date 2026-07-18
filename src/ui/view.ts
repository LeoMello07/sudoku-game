/**
 * Camada de apresentação: constrói o tabuleiro e o teclado numérico e
 * reflete o estado do jogo na tela. Nenhuma regra de jogo vive aqui.
 */
import type { GameState, Settings } from "../types";
import { DIFFICULTY_LABELS } from "../types";
import { isFixed, remainingByDigit, wrongPositions } from "../game/state";
import { formatTime } from "../game/timer";

/** Ações que a interface dispara de volta para o controlador. */
export interface ViewCallbacks {
  onCellClick(pos: number): void;
  onDigit(digit: number): void;
  onErase(): void;
}

/** Busca um elemento obrigatório do HTML (falha cedo se o markup mudar). */
export function query<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
  return element;
}

export class View {
  private readonly board = query<HTMLDivElement>("#board");
  private readonly numpad = query<HTMLDivElement>("#numpad");
  private readonly timerLabel = query<HTMLSpanElement>("#stat-timer");
  private readonly hintsLabel = query<HTMLSpanElement>("#stat-hints");
  private readonly difficultyLabel = query<HTMLSpanElement>("#stat-difficulty");
  private readonly autoCheckInput = query<HTMLInputElement>("#auto-check");
  private readonly soundButton = query<HTMLButtonElement>("#btn-sound");
  private readonly themeButton = query<HTMLButtonElement>("#btn-theme");
  private readonly annotationButton =
    query<HTMLButtonElement>("#btn-annotation");
  private readonly toast = query<HTMLDivElement>("#toast");
  private readonly modalOverlay = query<HTMLDivElement>("#modal-overlay");
  private readonly winTime = query<HTMLSpanElement>("#win-time");
  private readonly winDifficulty = query<HTMLSpanElement>("#win-difficulty");

  private readonly cells: HTMLButtonElement[] = [];
  private readonly cellValues: HTMLSpanElement[] = [];
  private readonly noteSlots: HTMLSpanElement[][] = [];
  /** Botões de dígito indexados de 1 a 9. */
  private readonly digitButtons: HTMLButtonElement[] = new Array(10);
  private toastTimeout: number | null = null;

  constructor(private readonly callbacks: ViewCallbacks) {
    this.buildBoard();
    this.buildNumpad();
    // Clicar fora do cartão fecha o modal mantendo o tabuleiro visível.
    this.modalOverlay.addEventListener("click", (event) => {
      if (event.target === this.modalOverlay) this.hideWinModal();
    });
  }

  /** Cria as 81 células uma única vez; o render só atualiza classes/texto. */
  private buildBoard(): void {
    for (let pos = 0; pos < 81; pos++) {
      const row = Math.floor(pos / 9);
      const col = pos % 9;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      const value = document.createElement("span");
      value.className = "cell-value";
      const notes = document.createElement("span");
      notes.className = "cell-notes";
      notes.setAttribute("aria-hidden", "true");
      const slots: HTMLSpanElement[] = [];
      for (let digit = 1; digit <= 9; digit++) {
        const slot = document.createElement("span");
        slot.className = "cell-note";
        notes.appendChild(slot);
        slots.push(slot);
      }
      cell.append(value, notes);
      // Bordas grossas que desenham a separação dos blocos 3x3.
      if (col === 2 || col === 5) cell.classList.add("edge-right");
      if (row === 2 || row === 5) cell.classList.add("edge-bottom");
      cell.setAttribute("aria-label", `Linha ${row + 1}, coluna ${col + 1}`);
      cell.addEventListener("click", () => this.callbacks.onCellClick(pos));
      this.cells.push(cell);
      this.cellValues.push(value);
      this.noteSlots.push(slots);
      this.board.appendChild(cell);
    }
  }

  /** Teclado numérico em tela com contador de dígitos restantes. */
  private buildNumpad(): void {
    for (let digit = 1; digit <= 9; digit++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.setAttribute("aria-label", `Inserir ${digit}`);
      button.innerHTML = `<span class="key-digit">${digit}</span><span class="key-count">9</span>`;
      button.addEventListener("click", () => this.callbacks.onDigit(digit));
      this.digitButtons[digit] = button;
      this.numpad.appendChild(button);
    }
    const erase = document.createElement("button");
    erase.type = "button";
    erase.className = "key key-erase";
    erase.setAttribute("aria-label", "Apagar número");
    erase.innerHTML = '<span class="key-digit">⌫</span>';
    erase.addEventListener("click", () => this.callbacks.onErase());
    this.numpad.appendChild(erase);
  }

  /** Atualiza tabuleiro, teclado e estatísticas a partir do estado. */
  render(
    state: GameState,
    selected: number | null,
    autoCheck: boolean,
    annotationMode: boolean,
  ): void {
    const wrong = new Set(
      autoCheck ? wrongPositions(state) : state.checkedErrors,
    );
    const selectedValue = selected !== null ? state.grid[selected] : 0;

    for (let pos = 0; pos < 81; pos++) {
      const cell = this.cells[pos];
      const value = state.grid[pos];
      const notes = state.notes[pos];
      this.cellValues[pos].textContent = value === 0 ? "" : String(value);
      const noteSet = new Set(notes);
      for (let digit = 1; digit <= 9; digit++) {
        this.noteSlots[pos][digit - 1].textContent = noteSet.has(digit)
          ? String(digit)
          : "";
      }
      cell.setAttribute(
        "aria-label",
        cellAriaLabel(pos, value, notes),
      );
      cell.classList.toggle("has-value", value !== 0);
      cell.classList.toggle("has-notes", value === 0 && notes.length > 0);
      cell.classList.toggle("fixed", isFixed(state, pos));
      cell.classList.toggle("user", !isFixed(state, pos) && value !== 0);
      cell.classList.toggle("selected", pos === selected);
      cell.classList.toggle(
        "peer",
        selected !== null && pos !== selected && isPeer(pos, selected),
      );
      cell.classList.toggle(
        "same",
        selectedValue !== 0 && value === selectedValue && pos !== selected,
      );
      cell.classList.toggle("error", wrong.has(pos));
    }

    const remaining = remainingByDigit(state);
    for (let digit = 1; digit <= 9; digit++) {
      const button = this.digitButtons[digit];
      button.querySelector(".key-count")!.textContent = String(
        remaining[digit],
      );
      button.disabled =
        state.finished || (!annotationMode && remaining[digit] === 0);
    }

    this.annotationButton.classList.toggle(
      "active",
      annotationMode && !state.finished,
    );
    this.annotationButton.setAttribute(
      "aria-pressed",
      String(annotationMode && !state.finished),
    );
    this.annotationButton.disabled = state.finished;
    this.hintsLabel.textContent = String(state.hintsLeft);
    this.difficultyLabel.textContent = DIFFICULTY_LABELS[state.difficulty];
  }

  updateTimer(seconds: number): void {
    this.timerLabel.textContent = formatTime(seconds);
  }

  /** Reaplica uma animação CSS em uma célula (pop de dígito, shake de erro). */
  animateCell(pos: number, animation: "pop" | "shake"): void {
    const cell = this.cells[pos];
    cell.classList.remove(animation);
    void cell.offsetWidth; // força reflow para a animação reiniciar
    cell.classList.add(animation);
    cell.addEventListener(
      "animationend",
      () => cell.classList.remove(animation),
      {
        once: true,
      },
    );
  }

  /** Sincroniza tema, botões de som/tema e o toggle de erros. */
  applySettings(settings: Settings): void {
    document.documentElement.dataset.theme = settings.dark ? "dark" : "light";
    this.themeButton.textContent = settings.dark ? "☀️" : "🌙";
    this.themeButton.setAttribute(
      "aria-label",
      settings.dark ? "Ativar modo claro" : "Ativar modo escuro",
    );
    this.soundButton.textContent = settings.sound ? "🔊" : "🔇";
    this.soundButton.setAttribute(
      "aria-label",
      settings.sound ? "Desligar sons" : "Ligar sons",
    );
    this.autoCheckInput.checked = settings.autoCheck;
  }

  showToast(
    message: string,
    kind: "info" | "success" | "error" = "info",
  ): void {
    this.toast.textContent = message;
    this.toast.className = `toast visible ${kind}`;
    if (this.toastTimeout !== null) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.toast.classList.remove("visible");
    }, 2400);
  }

  showWinModal(timeText: string, difficultyLabel: string): void {
    this.winTime.textContent = timeText;
    this.winDifficulty.textContent = difficultyLabel;
    this.modalOverlay.classList.add("visible");
  }

  hideWinModal(): void {
    this.modalOverlay.classList.remove("visible");
  }
}

function cellAriaLabel(pos: number, value: number, notes: number[]): string {
  const row = Math.floor(pos / 9) + 1;
  const col = (pos % 9) + 1;
  if (value !== 0) return `Linha ${row}, coluna ${col}, valor ${value}`;
  if (notes.length > 0) {
    return `Linha ${row}, coluna ${col}, anotações ${notes.join(", ")}`;
  }
  return `Linha ${row}, coluna ${col}, vazia`;
}

/** Duas posições se "veem" quando dividem linha, coluna ou bloco 3x3. */
function isPeer(a: number, b: number): boolean {
  const rowA = Math.floor(a / 9);
  const colA = a % 9;
  const rowB = Math.floor(b / 9);
  const colB = b % 9;
  const sameBox =
    Math.floor(rowA / 3) === Math.floor(rowB / 3) &&
    Math.floor(colA / 3) === Math.floor(colB / 3);
  return rowA === rowB || colA === colB || sameBox;
}
