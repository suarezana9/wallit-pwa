const MAX_SIDE = 1600;
const QUALITY = 0.85;

/** Achica la foto antes de mandarla: un ticket de 4000px pasa de ~4MB a ~300KB y se lee igual de bien. */
export async function imageToJpegDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('NO_CANVAS');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function supportedAudioType(): string | null {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  return AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function audioExtension(type: string): string {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Graba del micrófono con MediaRecorder: funciona en Chrome, Edge, Firefox y Safari (también en iPhone). */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Uint8Array<ArrayBuffer> | null = null;

  async start(): Promise<void> {
    const type = supportedAudioType();
    if (type === null) throw new Error('UNSUPPORTED');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start();
    this.startAnalyser(this.stream);
  }

  /** Volumen actual entre 0 y 1, para dibujar la onda de voz mientras se graba. */
  level(): number {
    if (!this.analyser || !this.samples) return 0;
    this.analyser.getByteTimeDomainData(this.samples);
    let sum = 0;
    for (const value of this.samples) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 4);
  }

  private startAnalyser(stream: MediaStream): void {
    try {
      this.context = new AudioContext();
      const source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.samples = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      source.connect(this.analyser);
    } catch {
      this.analyser = null;
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) {
        reject(new Error('NOT_RECORDING'));
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.release();
        resolve(blob);
      };
      recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.release();
  }

  private release(): void {
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.analyser = null;
    this.samples = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}

/** Celulares y tablets: la cámara tiene sentido. En la compu se adjunta un archivo. */
export function isTouchDevice(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

export function imageFromClipboard(event: ClipboardEvent): File | null {
  const item = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  return item?.getAsFile() ?? null;
}

export function imageFromDrop(event: DragEvent): File | null {
  const file = event.dataTransfer?.files?.[0];
  return file && file.type.startsWith('image/') ? file : null;
}
