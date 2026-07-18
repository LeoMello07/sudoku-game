/**
 * Geração de puzzles: parte de uma grade resolvida aleatória e "escava"
 * células em ordem aleatória, desfazendo qualquer remoção que quebre a
 * garantia de solução única.
 */
import type { Difficulty, Grid } from '../types';
import { countSolutions, generateSolvedGrid, shuffle } from './solver';

/** Faixa de pistas (células preenchidas) por dificuldade. */
export const CLUE_RANGES: Record<Difficulty, [number, number]> = {
  easy: [30, 36],
  medium: [26, 30],
  hard: [22, 26],
  expert: [17, 22],
};

/** Tempo máximo gasto escavando um puzzle (evita travar a interface). */
const TIME_BUDGET_MS = 1500;

/** Gera um puzzle inédito com solução única para a dificuldade pedida. */
export function generatePuzzle(difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const solution = generateSolvedGrid();
  const [minClues, maxClues] = CLUE_RANGES[difficulty];
  // Alvo sorteado dentro da faixa para variar o "peso" dos puzzles.
  const target = minClues + Math.floor(Math.random() * (maxClues - minClues + 1));
  const deadline = performance.now() + TIME_BUDGET_MS;

  // Escavações independentes até caber na faixa ou estourar o orçamento;
  // guarda sempre a melhor tentativa (menos pistas) como resultado.
  let best: Grid = solution;
  let bestClues = 82;
  do {
    const { puzzle, clues } = dig(solution, target, deadline);
    if (clues < bestClues) {
      best = puzzle;
      bestClues = clues;
    }
  } while (bestClues > maxClues && performance.now() < deadline);

  return { puzzle: best, solution };
}

/** Remove células mantendo unicidade, até atingir o alvo de pistas. */
function dig(
  solution: Grid,
  targetClues: number,
  deadline: number
): { puzzle: Grid; clues: number } {
  const puzzle = solution.slice();
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let clues = 81;

  for (const pos of positions) {
    if (clues <= targetClues || performance.now() > deadline) break;
    const removed = puzzle[pos];
    puzzle[pos] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clues--;
    } else {
      puzzle[pos] = removed; // a remoção permitiria uma segunda solução
    }
  }
  return { puzzle, clues };
}
