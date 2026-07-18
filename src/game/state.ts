/**
 * Estado da partida e regras de manipulação. Este módulo não toca o DOM:
 * toda a apresentação fica em `ui/view.ts` e a orquestração em `main.ts`.
 */
import type { Difficulty, GameState } from '../types';
import { generatePuzzle } from '../core/generator';

/** Dicas disponíveis por partida. */
export const MAX_HINTS = 3;

/** Cria as 81 listas independentes usadas pelas anotações. */
function emptyNotes(): number[][] {
  return Array.from({ length: 81 }, () => []);
}

/** Cria uma partida nova com um puzzle recém-gerado. */
export function newGame(difficulty: Difficulty): GameState {
  const { puzzle, solution } = generatePuzzle(difficulty);
  return {
    puzzle,
    solution,
    grid: puzzle.slice(),
    notes: emptyNotes(),
    difficulty,
    seconds: 0,
    hintsLeft: MAX_HINTS,
    finished: false,
    checkedErrors: [],
  };
}

/** Células do enunciado original não podem ser alteradas. */
export function isFixed(state: GameState, pos: number): boolean {
  return state.puzzle[pos] !== 0;
}

/**
 * Escreve um dígito (ou apaga, com value = 0) na posição indicada.
 * Devolve true se a grade mudou; células fixas e partidas encerradas
 * são ignoradas.
 */
export function setCell(state: GameState, pos: number, value: number): boolean {
  if (state.finished || isFixed(state, pos) || state.grid[pos] === value) return false;
  state.grid[pos] = value;
  state.notes[pos] = [];
  if (value !== 0) removeNoteFromPeers(state, pos, value);
  // Ao editar, a marcação de erro do "Verificar" deixa de valer para a célula.
  state.checkedErrors = state.checkedErrors.filter((p) => p !== pos);
  if (value !== 0 && isComplete(state)) state.finished = true;
  return true;
}

/**
 * Liga/desliga um dígito nas anotações de uma célula vazia. As notas são
 * mantidas ordenadas e nunca contêm valores repetidos.
 */
export function toggleNote(state: GameState, pos: number, digit: number): boolean {
  if (
    state.finished ||
    isFixed(state, pos) ||
    state.grid[pos] !== 0 ||
    !Number.isInteger(digit) ||
    digit < 1 ||
    digit > 9
  ) {
    return false;
  }

  const notes = state.notes[pos];
  const existing = notes.indexOf(digit);
  if (existing >= 0) {
    notes.splice(existing, 1);
  } else {
    notes.push(digit);
    notes.sort((a, b) => a - b);
  }
  return true;
}

/** Apaga o valor normal e todas as anotações de uma célula editável. */
export function eraseCell(state: GameState, pos: number): boolean {
  if (state.finished || isFixed(state, pos)) return false;
  const changed = state.grid[pos] !== 0 || state.notes[pos].length > 0;
  if (!changed) return false;

  state.grid[pos] = 0;
  state.notes[pos] = [];
  state.checkedErrors = state.checkedErrors.filter((p) => p !== pos);
  return true;
}

/** A partida está correta e completa? */
export function isComplete(state: GameState): boolean {
  return state.grid.every((value, i) => value === state.solution[i]);
}

/** Posições preenchidas pelo jogador com valor diferente da solução. */
export function wrongPositions(state: GameState): number[] {
  const wrong: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (state.grid[i] !== 0 && !isFixed(state, i) && state.grid[i] !== state.solution[i]) {
      wrong.push(i);
    }
  }
  return wrong;
}

/**
 * Preenche uma célula com o valor correto da solução. Prioriza a célula
 * selecionada (se editável e vazia); caso contrário sorteia uma vazia —
 * e, na falta delas, corrige uma errada. Devolve a posição preenchida
 * ou null se não houver dica disponível.
 */
export function applyHint(state: GameState, selected: number | null): number | null {
  if (state.finished || state.hintsLeft <= 0) return null;

  let pos: number | null = null;
  if (selected !== null && !isFixed(state, selected) && state.grid[selected] === 0) {
    pos = selected;
  }
  if (pos === null) {
    const empty: number[] = [];
    for (let i = 0; i < 81; i++) if (state.grid[i] === 0) empty.push(i);
    const pool = empty.length > 0 ? empty : wrongPositions(state);
    if (pool.length === 0) return null;
    pos = pool[Math.floor(Math.random() * pool.length)];
  }

  state.grid[pos] = state.solution[pos];
  state.notes[pos] = [];
  removeNoteFromPeers(state, pos, state.solution[pos]);
  state.checkedErrors = state.checkedErrors.filter((p) => p !== pos);
  state.hintsLeft--;
  if (isComplete(state)) state.finished = true;
  return pos;
}

/** Copia a solução armazenada para a grade e encerra a partida. */
export function solveAll(state: GameState): void {
  state.grid = state.solution.slice();
  state.notes = emptyNotes();
  state.checkedErrors = [];
  state.finished = true;
}

/** Volta exatamente ao estado inicial do puzzle atual. */
export function restart(state: GameState): void {
  state.grid = state.puzzle.slice();
  state.notes = emptyNotes();
  state.seconds = 0;
  state.hintsLeft = MAX_HINTS;
  state.finished = false;
  state.checkedErrors = [];
}

/**
 * Quantas casas de cada dígito 1..9 ainda faltam preencher (9 menos as
 * ocorrências atuais). Usado nos contadores do teclado numérico.
 */
export function remainingByDigit(state: GameState): number[] {
  const remaining = new Array<number>(10).fill(9);
  for (const value of state.grid) {
    if (value !== 0) remaining[value]--;
  }
  return remaining.map((count) => Math.max(0, count));
}

/**
 * Quando um dígito é preenchido, ele deixa de ser candidato nas células da
 * mesma linha, coluna e bloco 3x3.
 */
function removeNoteFromPeers(
  state: GameState,
  filledPos: number,
  digit: number,
): void {
  const filledRow = Math.floor(filledPos / 9);
  const filledCol = filledPos % 9;

  for (let pos = 0; pos < 81; pos++) {
    if (pos === filledPos || state.notes[pos].length === 0) continue;

    const row = Math.floor(pos / 9);
    const col = pos % 9;
    const sharesRow = row === filledRow;
    const sharesCol = col === filledCol;
    const sharesBox =
      Math.floor(row / 3) === Math.floor(filledRow / 3) &&
      Math.floor(col / 3) === Math.floor(filledCol / 3);

    if (sharesRow || sharesCol || sharesBox) {
      state.notes[pos] = state.notes[pos].filter((note) => note !== digit);
    }
  }
}
