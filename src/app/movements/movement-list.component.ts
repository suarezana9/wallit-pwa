import { Component, computed, inject, input, output } from '@angular/core';
import {
  IonButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonList,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import type { Movimiento } from '../core/database.types';
import { AuthStore } from '../core/auth-store';
import { TranslatePipe } from '../core/i18n/i18n';
import { GroupsStore } from '../groups/groups-store';
import { payerOf } from '../groups/balances.model';
import { MovementItemComponent } from './movement-item.component';

@Component({
  selector: 'app-movement-list',
  imports: [IonButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonList, MovementItemComponent, TranslatePipe],
  template: `
    <ion-list lines="none">
      @for (movement of movements(); track movement.id) {
        <ion-item-sliding #sliding [disabled]="readonly() || movement.user_id !== userId()">
          <ion-item
            class="row"
            tabindex="0"
            [detail]="false"
            (click)="selected.emit(movement)"
            (keydown.enter)="selected.emit(movement)"
          >
            <app-movement-item [movement]="movement" [author]="authorOf(movement)" [showDate]="showDate()" />
            @if (!readonly() && movement.user_id === userId()) {
            <ion-button
              slot="end"
              class="row-delete ion-hide-lg-down"
              fill="clear"
              color="medium"
              [attr.aria-label]="'deleteMovement' | t"
              (click)="$event.stopPropagation(); removed.emit(movement)"
            >
              <ion-icon slot="icon-only" name="trash-outline" />
            </ion-button>
            }
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" [attr.aria-label]="'deleteMovement' | t" (click)="sliding.close(); removed.emit(movement)">
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
        --inner-padding-end: 8px;
        border-radius: 12px;
      }
      ion-item-sliding { margin: 0 -12px; border-radius: 12px; }
      .row-delete { opacity: 0; transition: opacity 0.15s ease; }
      .row:hover .row-delete, .row:focus-within .row-delete { opacity: 1; }
    }
  `,
})
export class MovementListComponent {
  readonly movements = input.required<readonly Movimiento[]>();
  readonly emptyTitle = input.required<string>();
  readonly emptyHint = input('');
  readonly readonly = input(false);
  readonly showDate = input(true);
  readonly authors = input<Record<string, string> | null>(null);

  private readonly groups = inject(GroupsStore);
  private readonly auth = inject(AuthStore);
  readonly userId = computed(() => this.auth.user()?.id);

  readonly selected = output<Movimiento>();
  readonly removed = output<Movimiento>();

  constructor() {
    addIcons({ trashOutline });
  }

  /** En un grupo se muestra quién pagó (si no fuiste vos). */
  authorOf(movement: Movimiento): string | null {
    const payer = payerOf(movement);
    if (payer === this.userId()) return null;
    const authors = this.authors() ?? (this.groups.activeGroupId() ? this.groups.memberNames() : null);
    return authors?.[payer] ?? null;
  }
}
