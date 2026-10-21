import { Component, inject } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { MovementsStore } from '../movements/movements-store';

@Component({
  selector: 'app-month-nav',
  imports: [IonButton, IonIcon],
  template: `
    <nav aria-label="Mes">
      <ion-button fill="clear" size="small" (click)="store.previousMonth()" aria-label="Mes anterior">
        <ion-icon slot="icon-only" name="chevron-back-outline" />
      </ion-button>
      <span class="label">{{ store.range().label }}</span>
      <ion-button
        fill="clear"
        size="small"
        [disabled]="store.range().isCurrent"
        (click)="store.nextMonth()"
        aria-label="Mes siguiente"
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
