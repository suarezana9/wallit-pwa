import { Component, computed, input, linkedSignal } from '@angular/core';

/**
 * Avatar de persona o de grupo: la foto si hay (y carga bien), si no el emoji, si no la inicial sobre un color.
 * Uso: <app-avatar [url]="..." [emoji]="..." [name]="..." color="#10b981" [size]="40" shape="circle" />
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (url() && !failed()) {
      <img [src]="url()" alt="" (error)="failed.set(true)" />
    } @else if (emoji()) {
      <span class="emoji">{{ emoji() }}</span>
    } @else {
      <span class="initial">{{ initial() }}</span>
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[class.rounded]': "shape() === 'rounded'",
    '[class.has-photo]': 'url() && !failed()',
    '[class.has-emoji]': '!(url() && !failed()) && !!emoji()',
    '[style.--avatar-size.px]': 'size()',
    '[style.--avatar-color]': 'color()',
  },
  styles: `
    :host {
      flex: none;
      display: inline-grid;
      place-items: center;
      width: var(--avatar-size);
      height: var(--avatar-size);
      border-radius: 50%;
      overflow: hidden;
      font-weight: 700;
      font-size: calc(var(--avatar-size) * 0.42);
      line-height: 1;
      color: #fff;
      background: var(--avatar-color);
      user-select: none;
    }
    :host(.rounded) { border-radius: calc(var(--avatar-size) * 0.3); }
    :host(.has-emoji) {
      font-size: calc(var(--avatar-size) * 0.52);
      background: color-mix(in srgb, var(--avatar-color) 18%, var(--wl-field-bg, #f3f4f6));
    }
    :host(.has-photo) { background: var(--wl-field-bg, #f3f4f6); }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  `,
})
export class AvatarComponent {
  readonly url = input<string | null | undefined>(null);
  readonly emoji = input<string | null | undefined>(null);
  readonly name = input('');
  readonly color = input('var(--ion-color-primary)');
  readonly size = input(40);
  readonly shape = input<'circle' | 'rounded'>('circle');

  /** Si la foto no carga se muestra la inicial; con otra URL se vuelve a intentar. */
  readonly failed = linkedSignal({ source: this.url, computation: () => false });
  readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '?');
}
