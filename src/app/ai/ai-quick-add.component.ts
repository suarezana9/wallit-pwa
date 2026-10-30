import { Component, inject, output, signal } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowUp, attachOutline, cameraOutline, closeOutline, micOutline, sparkles, stop } from 'ionicons/icons';
import { TranslatePipe } from '../core/i18n/i18n';
import type { AiResult } from './ai.model';
import { AiSession } from './ai-session';
import { imageFromClipboard, imageFromDrop } from './media';

@Component({
  selector: 'app-ai-quick-add',
  templateUrl: 'ai-quick-add.component.html',
  styleUrls: ['ai-quick-add.component.scss'],
  imports: [IonIcon, IonSpinner, TranslatePipe],
  providers: [AiSession],
})
export class AiQuickAddComponent {
  readonly session = inject(AiSession);
  readonly result = output<AiResult>();

  readonly text = signal('');
  readonly dragging = signal(false);

  constructor() {
    addIcons({ arrowUp, attachOutline, cameraOutline, closeOutline, micOutline, sparkles, stop });
    this.session.listen((result) => {
      this.text.set('');
      this.result.emit(result);
    });
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    await this.session.fromText(this.text());
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.session.fromImage(file);
  }

  async onPaste(event: ClipboardEvent): Promise<void> {
    const file = imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    await this.session.fromImage(file);
  }

  onDragOver(event: DragEvent): void {
    if (this.session.mode() !== 'idle') return;
    event.preventDefault();
    this.dragging.set(true);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    const file = imageFromDrop(event);
    if (file) await this.session.fromImage(file);
  }
}
