/**
 * Cronômetro da partida: inicia automaticamente, pausa ao encerrar o jogo
 * (ou quando a aba fica oculta) e reinicia a cada novo puzzle.
 */
export class Timer {
  seconds = 0;
  private intervalId: number | null = null;

  constructor(private readonly onTick: (seconds: number) => void) {}

  /** Retoma a contagem a partir do valor atual. */
  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => {
      this.seconds++;
      this.onTick(this.seconds);
    }, 1000);
  }

  pause(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Para o cronômetro e zera (ou restaura um tempo salvo). */
  reset(seconds = 0): void {
    this.pause();
    this.seconds = seconds;
    this.onTick(this.seconds);
  }

  get running(): boolean {
    return this.intervalId !== null;
  }
}

/** Formata segundos como MM:SS (os minutos podem passar de 59). */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
