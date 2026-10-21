import { Component, inject } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { MovementsStore } from '../movements/movements-store';
import { TranslatePipe } from '../core/i18n/i18n';

@Component({
  selector: 'app-month-nav',
  imports: [IonButton, IonIcon, TranslatePipe],
  template: `
    <nav [attr.aria-label]="'month' | t">
      <ion-button fill="clear" size="small" (click)="store.previousMonth()" [attr.aria-label]="'previousMonth' | t">
        <ion-icon slot="icon-only" name="chevron-back-outline" />
      </ion-button>
      <span class="label">{{ store.label() }}</span>
      <ion-button
        fill="clear"
        size="small"
        [disabled]="store.range().isCurrent"
        (click)="store.nextMonth()"
        [attr.aria-label]="'nextMonth' | t"
      >
        <ion-icon slot="icon-only" name="chevron-forward-outline" />
      </ion-button>
    </nav>
  `,
  styles: `
    nav { display: flex; align-items: center; justify-content: space-between; }
    .label { font-weight: 600; }
    @media (min-width: 992px) {
      nav { gap: 4px; padding: 2px; border-radius: 12px; border: 1px solid var(--wl-field-border); }
      .label { min-width: 128px; text-align: center; }
    }
  `,
})
export class MonthNavComponent {
  readonly store = inject(MovementsStore);

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline });
  }
}
