/**
 * Efeitos sonoros sintetizados com Web Audio — nenhum arquivo externo.
 * O AudioContext é criado sob demanda porque navegadores só permitem
 * áudio após um gesto do usuário.
 */
export class SoundPlayer {
  enabled = true;
  private ctx: AudioContext | null = null;

  /** Toque curto e neutro ao inserir um número (sem revelar acerto/erro). */
  place(): void {
    this.tone(520, 0.06, 'sine', 0.05);
  }

  /** Confirmação sutil de acerto. */
  correct(): void {
    this.tone(660, 0.09, 'sine', 0.06);
  }

  /** Aviso grave de erro. */
  error(): void {
    this.tone(165, 0.18, 'triangle', 0.08);
  }

  /** Arpejo ascendente de vitória (C5–E5–G5–C6). */
  win(): void {
    [523, 659, 784, 1047].forEach((freq, i) => this.tone(freq, 0.22, 'sine', 0.07, i * 0.13));
  }

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null; // navegador sem suporte — jogo segue mudo
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0
  ): void {
    const ctx = this.context();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    // Envelope de ataque/decaimento para evitar estalos.
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(gain, start + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }
}
