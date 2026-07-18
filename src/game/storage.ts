/**
 * Salvamento automático no LocalStorage: a partida e as preferências são
 * gravadas a cada mudança, e restauradas ao recarregar a página.
 */
import type { GameState, Settings } from '../types';

const STORAGE_KEY = 'sudoku-ts:save:v1';

export interface SavedData {
  state: GameState;
  settings: Settings;
}

export function save(data: SavedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia) — o jogo segue sem salvar.
  }
}

export function load(): SavedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedData;
    if (!isValid(data)) return null;

    // Migração transparente dos salvamentos anteriores à funcionalidade.
    if (!Array.isArray(data.state.notes)) {
      data.state.notes = Array.from({ length: 81 }, () => []);
    }
    return data;
  } catch {
    return null;
  }
}

/** Validação defensiva: descarta salvamentos corrompidos ou de versões antigas. */
function isValid(data: SavedData): boolean {
  const grids = [data?.state?.puzzle, data?.state?.solution, data?.state?.grid];
  const notes = data?.state?.notes;
  const notesAreValid =
    notes === undefined ||
    (Array.isArray(notes) &&
      notes.length === 81 &&
      notes.every(
        (cellNotes) =>
          Array.isArray(cellNotes) &&
          cellNotes.every(
            (digit, index) =>
              Number.isInteger(digit) &&
              digit >= 1 &&
              digit <= 9 &&
              cellNotes.indexOf(digit) === index,
          ),
      ));
  return (
    grids.every((grid) => Array.isArray(grid) && grid.length === 81) &&
    notesAreValid &&
    typeof data.state.seconds === 'number' &&
    typeof data.state.hintsLeft === 'number' &&
    Array.isArray(data.state.checkedErrors) &&
    typeof data.settings?.autoCheck === 'boolean' &&
    typeof data.settings?.sound === 'boolean' &&
    typeof data.settings?.dark === 'boolean'
  );
}
