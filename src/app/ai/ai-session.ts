import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { I18n } from '../core/i18n/i18n';
import { AiErrorKey, AiResult } from './ai.model';
import { AiError, AiService } from './ai.service';
import { VoiceRecorder, imageToJpegDataUrl, isTouchDevice, supportedAudioType } from './media';

export type AiMode = 'idle' | 'text' | 'recording' | 'busy';

const MAX_SECONDS = 60;
const WAVE_BARS = 28;

/**
 * Estado y acciones de una carga con IA (texto, voz o imagen).
 * Se provee por componente: el modal y la barra de Inicio tienen cada uno su propia sesión.
 */
@Injectable()
export class AiSession {
  private readonly ai = inject(AiService);
  private readonly i18n = inject(I18n);
  private readonly recorder = new VoiceRecorder();

  readonly mode = signal<AiMode>('idle');
  readonly busyLabel = signal('');
  readonly preview = signal<string | null>(null);
  readonly seconds = signal(0);
  readonly wave = signal<number[]>(Array(WAVE_BARS).fill(0.08));
  readonly error = signal<string | null>(null);
  readonly canRecord = supportedAudioType() !== null;
  readonly isTouch = isTouchDevice();

  readonly timer = computed(() => {
    const s = this.seconds();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private onResult: (result: AiResult) => void = () => undefined;
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  listen(handler: (result: AiResult) => void): void {
    this.onResult = handler;
  }

  async fromText(text: string): Promise<boolean> {
    const clean = text.trim();
    if (!clean) return false;
    return this.run(this.i18n.t('aiProcessing'), () => this.ai.fromText(clean));
  }

  async fromImage(file: File): Promise<boolean> {
    this.error.set(null);
    this.busyLabel.set(this.i18n.t('aiReadingReceipt'));
    this.mode.set('busy');
    let dataUrl: string;
    try {
      dataUrl = await imageToJpegDataUrl(file);
    } catch {
      this.fail('errAiImage');
      return false;
    }
    this.preview.set(dataUrl);
    return this.run(this.i18n.t('aiReadingReceipt'), async () => ({ ...(await this.ai.fromImage(dataUrl)), receipt: dataUrl }));
  }

  async startVoice(): Promise<void> {
    this.error.set(null);
    try {
      await this.recorder.start();
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      this.fail(denied ? 'errMicDenied' : 'errMicUnsupported');
      return;
    }
    this.mode.set('recording');
    this.seconds.set(0);
    this.interval = setInterval(() => {
      this.seconds.update((s) => s + 1);
      if (this.seconds() >= MAX_SECONDS) void this.stopVoice();
    }, 1000);
    this.animateWave();
  }

  async stopVoice(): Promise<boolean> {
    this.stopTimers();
    const audio = await this.recorder.stop().catch(() => null);
    if (!audio || !audio.size) {
      this.fail('errAiAudio');
      return false;
    }
    return this.run(this.i18n.t('aiProcessing'), () => this.ai.fromAudio(audio));
  }

  openText(): void {
    this.error.set(null);
    this.mode.set('text');
  }

  cancel(): void {
    this.stopTimers();
    this.recorder.cancel();
    this.mode.set('idle');
    this.preview.set(null);
  }

  private async run(label: string, task: () => Promise<AiResult>): Promise<boolean> {
    this.busyLabel.set(label);
    this.mode.set('busy');
    try {
      const result = await task();
      this.mode.set('idle');
      this.preview.set(null);
      this.onResult(result);
      return true;
    } catch (error) {
      this.fail(error instanceof AiError ? error.key : 'errAi');
      return false;
    }
  }

  private fail(key: AiErrorKey): void {
    this.stopTimers();
    this.mode.set('idle');
    this.preview.set(null);
    this.error.set(this.i18n.t(key));
  }

  private animateWave(): void {
    let tick = 0;
    const step = () => {
      if (this.mode() !== 'recording') return;
      if (tick++ % 3 === 0) {
        const idle = 0.12 + Math.abs(Math.sin(tick / 9)) * 0.14;
        const level = Math.max(idle, this.recorder.level());
        this.wave.update((bars) => [...bars.slice(1), level]);
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private stopTimers(): void {
    if (this.interval) clearInterval(this.interval);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.interval = null;
    this.frame = null;
    this.wave.set(Array(WAVE_BARS).fill(0.08));
  }
}
