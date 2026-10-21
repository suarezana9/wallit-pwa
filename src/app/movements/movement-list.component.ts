import { Component, input, output } from '@angular/core';
import {
  IonButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonList,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import type { Movimiento } from '../core/database.types';
import { MovementItemComponent } from './movement-item.component';

@Component({
  selector: 'app-movement-list',
  imports: [IonButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonList, MovementItemComponent],
  template: `
    <ion-list lines="none">
      @for (movement of movements(); track movement.id) {
        <ion-item-sliding #sliding>
          <ion-item
            class="row"
            tabindex="0"
            [detail]="false"
            (click)="selected.emit(movement)"
            (keydown.enter)="selected.emit(movement)"
          >
            <app-movement-item [movement]="movement" />
            <ion-button
              slot="end"
              class="row-delete ion-hide-lg-down"
              fill="clear"
              color="medium"
              aria-label="Eliminar movimiento"
              (click)="$event.stopPropagation(); removed.emit(movement.id)"
            >
              <ion-icon slot="icon-only" name="trash-outline" />
            </ion-button>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" (click)="sliding.close(); removed.emit(movement.id)">
              <ion-icon slot="icon-only" name="trash-outline" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      } @empty {
        <div class="empty">
          <p class="empty-title">{{ emptyTitle() }}</p>
          @if (emptyHint()) {
            <p>{{ emptyHint() }}</p>
          }
        </div>
      }
    </ion-list>
  `,
  styles: `
    ion-list { background: transparent; padding: 0; }
    ion-item { --background: transparent; --padding-start: 0; --inner-padding-end: 0; cursor: pointer; }
    .empty { padding: 28px 8px; text-align: center; color: var(--wl-muted); }
    .empty p { margin: 0 0 6px; }
    .empty-title { font-weight: 600; color: var(--ion-text-color); }
    @media (min-width: 992px) {
      .row {
        --background-hover: var(--wl-field-bg);
        --background-hover-opacity: 1;
        --padding-start: 12px;
        --inner-padding-end: 4px;
        margin: 0 -12px;
        border-radius: 12px;
      }
      .row-delete { opacity: 0; transition: opacity 0.15s ease; }
      .row:hover .row-delete, .row:focus-within .row-delete { opacity: 1; }
    }
  `,
})
export class MovementListComponent {
  readonly movements = input.required<readonly Movimiento[]>();
  readonly emptyTitle = input('No hay movimientos');
  readonly emptyHint = input('');

  readonly selected = output<Movimiento>();
  readonly removed = output<string>();

  constructor() {
    addIcons({ trashOutline });
  }
}
