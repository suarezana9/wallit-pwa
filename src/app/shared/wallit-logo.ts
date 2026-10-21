import { Component, input } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-wallit-logo',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 48 48" role="img" aria-label="Wallit">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8b6cff" />
          <stop offset="1" stop-color="#5a35f0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" [attr.fill]="'url(#' + gradientId + ')'" />
      <rect x="11" y="13" width="23" height="15" rx="4" fill="#fff" fill-opacity="0.4" />
      <rect x="14" y="19" width="23" height="15" rx="4" fill="#fff" />
      <circle cx="31" cy="26.5" r="2.2" fill="#6c47ff" />
    </svg>
  `,
  styles: `:host { display: inline-flex; } svg { display: block; }`,
})
export class WallitLogoComponent {
  readonly size = input(48);
  readonly gradientId = `wallit-logo-bg-${nextId++}`;
}
