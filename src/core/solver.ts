/**
 * Núcleo lógico do Sudoku: resolução, contagem de soluções e geração de
 * grades completas via backtracking com máscaras de bits.
 *
 * As máscaras (um inteiro de 9 bits por linha/coluna/bloco) e a heurística
 * MRV (escolher sempre a célula com menos candidatos) tornam a busca rápida
 * o bastante para escavar puzzles Expert com garantia de solução única.
 */
import type { Grid } from '../types';

/** Máscara com os 9 dígitos possíveis (bit 0 = dígito 1 ... bit 8 = dígito 9). */
const ALL_CANDIDATES = 0x1ff;

/* Pré-cálculo de linha, coluna e bloco 3x3 de cada uma das 81 posições. */
const ROW_OF = new Array<number>(81);
const COL_OF = new Array<number>(81);
const BOX_OF = new Array<number>(81);
for (let i = 0; i < 81; i++) {
  ROW_OF[i] = Math.floor(i / 9);
  COL_OF[i] = i % 9;
  BOX_OF[i] = Math.floor(ROW_OF[i] / 3) * 3 + Math.floor(COL_OF[i] / 3);
}

/** Dígitos já usados em cada linha, coluna e bloco. */
interface Masks {
  rows: number[];
  cols: number[];
  boxes: number[];
}

/** Monta as máscaras a partir da grade; devolve null se houver conflito. */
function buildMasks(grid: Grid): Masks | null {
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const value = grid[i];
    if (value === 0) continue;
    const bit = 1 << (value - 1);
    if (rows[ROW_OF[i]] & bit || cols[COL_OF[i]] & bit || boxes[BOX_OF[i]] & bit) {
      return null;
    }
    rows[ROW_OF[i]] |= bit;
    cols[COL_OF[i]] |= bit;
    boxes[BOX_OF[i]] |= bit;
  }
  return { rows, cols, boxes };
}

/** Conta quantos bits estão ligados na máscara. */
function popCount(mask: number): number {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

function place(grid: Grid, masks: Masks, pos: number, digit: number): void {
  const bit = 1 << (digit - 1);
  grid[pos] = digit;
  masks.rows[ROW_OF[pos]] |= bit;
  masks.cols[COL_OF[pos]] |= bit;
  masks.boxes[BOX_OF[pos]] |= bit;
}

function unplace(grid: Grid, masks: Masks, pos: number, digit: number): void {
  const bit = 1 << (digit - 1);
  grid[pos] = 0;
  masks.rows[ROW_OF[pos]] &= ~bit;
  masks.cols[COL_OF[pos]] &= ~bit;
  masks.boxes[BOX_OF[pos]] &= ~bit;
}

type Pick = { pos: number; candidates: number } | 'solved' | 'dead';

/** Escolhe a célula vazia com menos candidatos (heurística MRV). */
function pickCell(grid: Grid, masks: Masks): Pick {
  let bestPos = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const mask =
      ALL_CANDIDATES & ~(masks.rows[ROW_OF[i]] | masks.cols[COL_OF[i]] | masks.boxes[BOX_OF[i]]);
    if (mask === 0) return 'dead'; // célula sem candidatos: beco sem saída
    const count = popCount(mask);
    if (count < bestCount) {
      bestCount = count;
      bestPos = i;
      bestMask = mask;
      if (count === 1) break; // não existe escolha melhor que candidato único
    }
  }
  if (bestPos === -1) return 'solved';
  return { pos: bestPos, candidates: bestMask };
}

/** Busca a primeira solução; devolve true deixando `grid` resolvida. */
function searchFirst(grid: Grid, masks: Masks, randomize: boolean): boolean {
  const picked = pickCell(grid, masks);
  if (picked === 'dead') return false;
  if (picked === 'solved') return true;

  const digits: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if (picked.candidates & (1 << (digit - 1))) digits.push(digit);
  }
  if (randomize) shuffle(digits);

  for (const digit of digits) {
    place(grid, masks, picked.pos, digit);
    if (searchFirst(grid, masks, randomize)) return true;
    unplace(grid, masks, picked.pos, digit);
  }
  return false;
}

/** Conta soluções recursivamente, parando assim que atingir `limit`. */
function countRecursive(grid: Grid, masks: Masks, limit: number): number {
  const picked = pickCell(grid, masks);
  if (picked === 'dead') return 0;
  if (picked === 'solved') return 1;

  let found = 0;
  for (let digit = 1; digit <= 9; digit++) {
    if (!(picked.candidates & (1 << (digit - 1)))) continue;
    place(grid, masks, picked.pos, digit);
    found += countRecursive(grid, masks, limit - found);
    unplace(grid, masks, picked.pos, digit);
    if (found >= limit) break; // já sabemos o suficiente (ex.: não é única)
  }
  return found;
}

/** Resolve a grade; devolve uma cópia resolvida ou null se impossível. */
export function solve(grid: Grid): Grid | null {
  const work = grid.slice();
  const masks = buildMasks(work);
  if (!masks) return null;
  return searchFirst(work, masks, false) ? work : null;
}

/**
 * Conta soluções até `limit`. Com o padrão 2, responde "zero, uma ou
 * mais de uma?" — tudo que a checagem de unicidade precisa.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const work = grid.slice();
  const masks = buildMasks(work);
  if (!masks) return 0;
  return countRecursive(work, masks, limit);
}

/** Gera uma grade completa e válida aleatória. */
export function generateSolvedGrid(): Grid {
  const grid: Grid = new Array(81).fill(0);
  const masks = buildMasks(grid)!;
  searchFirst(grid, masks, true);
  return grid;
}

/** Embaralhamento Fisher–Yates in place; devolve o próprio array. */
export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
