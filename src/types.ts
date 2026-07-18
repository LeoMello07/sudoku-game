/**
 * Tipos e constantes compartilhados por todos os módulos do jogo.
 */

/** Dificuldades disponíveis. */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** Rótulos exibidos na interface para cada dificuldade. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
  expert: 'Expert',
};

/** Grade 9x9 achatada em 81 posições; 0 representa célula vazia. */
export type Grid = number[];

/** Preferências do jogador (persistidas no LocalStorage). */
export interface Settings {
  /** Destacar números incorretos imediatamente. */
  autoCheck: boolean;
  /** Efeitos sonoros ligados. */
  sound: boolean;
  /** Modo escuro ativo. */
  dark: boolean;
}

/** Estado completo de uma partida. */
export interface GameState {
  /** Enunciado original (células fixas). */
  puzzle: Grid;
  /** Solução única do puzzle. */
  solution: Grid;
  /** Grade atual, com as jogadas do jogador. */
  grid: Grid;
  /**
   * Anotações de cada célula. Cada posição contém dígitos únicos de 1 a 9,
   * exibidos como uma pequena grade 3x3.
   */
  notes: number[][];
  difficulty: Difficulty;
  /** Tempo decorrido em segundos. */
  seconds: number;
  /** Dicas restantes na partida. */
  hintsLeft: number;
  /** Partida encerrada (vitória ou "Resolver"). */
  finished: boolean;
  /** Posições marcadas como erradas pelo botão "Verificar". */
  checkedErrors: number[];
}
