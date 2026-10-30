import { Component, inject, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowUp, cameraOutline, checkmarkCircle, closeOutline, cloudUploadOutline, createOutline, imagesOutline,
  micOutline, refreshOutline, sparkles, stop,
} from 'ionicons/icons';
import { TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import type { AiResult } from './ai.model';
import { AiSession } from './ai-session';
import { imageFromClipboard, imageFromDrop } from './media';

export interface AiSummary {
  transcript?: string;
  missingAmount: boolean;
}

const EXAMPLES: TranslationKey[] = ['aiExample1', 'aiExample2', 'aiExample3'];

@Component({
  selector: 'app-ai-assist',
  templateUrl: 'ai-assist.component.html',
  styleUrls: ['ai-assist.component.scss'],
  imports: [IonIcon, TranslatePipe],
  providers: [AiSession],
  host: { '(window:paste)': 'onPaste($event)' },
})
export class AiAssistComponent {
  readonly session = inject(AiSession);

  readonly summary = input<AiSummary | null>(null);
  readonly result = output<AiResult>();

  readonly text = signal('');
  readonly dragging = signal(false);
  readonly examples = EXAMPLES;

  constructor() {
    addIcons({
      arrowUp, cameraOutline, checkmarkCircle, closeOutline, cloudUploadOutline, createOutline, imagesOutline,
      micOutline, refreshOutline, sparkles, stop,
    });
    this.session.listen((result) => {
      this.text.set('');
      this.result.emit(result);
    });
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.session.fromImage(file);
  }

  async submitText(event: Event): Promise<void> {
    event.preventDefault();
    await this.session.fromText(this.text());
  }

  async useExample(label: string): Promise<void> {
    this.text.set(label);
    await this.session.fromText(label);
  }

  onDragOver(event: DragEvent): void {
    if (this.session.isTouch || this.session.mode() !== 'idle') return;
    event.preventDefault();
    this.dragging.set(true);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    const file = imageFromDrop(event);
    if (file) await this.session.fromImage(file);
  }

  async onPaste(event: ClipboardEvent): Promise<void> {
    if (this.session.mode() !== 'idle') return;
    const file = imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    await this.session.fromImage(file);
  }
}
