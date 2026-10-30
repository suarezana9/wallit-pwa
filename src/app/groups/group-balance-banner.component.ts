import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronForward, swapHorizontalOutline } from 'ionicons/icons';
import { TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { injectGroupAccounts } from './group-accounts';
import { GroupsStore } from './groups-store';

/** Franja en Inicio cuando estás en un grupo: tu saldo y acceso directo a las cuentas. */
@Component({
  selector: 'app-group-balance-banner',
  imports: [IonIcon, MoneyPipe, RouterLink, TranslatePipe],
  template: `
    @if (groupId(); as id) {
      @if (accounts.data.hasValue() && visible()) {
        <a class="banner" [class.owed]="net() > 0" [class.owes]="net() < 0" [routerLink]="['/grupos', id]">
          <span class="icon" aria-hidden="true"><ion-icon name="swap-horizontal-outline" /></span>
          <span class="text">
            @if (net() === 0) {
              <strong>{{ 'allSettled' | t }}</strong>
            } @else {
              <strong>{{ (net() > 0 ? 'youAreOwed' : 'youOwe') | t }} {{ abs(net()) | money }}</strong>
            }
            <span>{{ 'bannerHint' | t }}</span>
          </span>
          <span class="cta">{{ 'seeAccounts' | t }} <ion-icon name="chevron-forward" aria-hidden="true" /></span>
        </a>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .banner {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 16px; text-decoration: none; color: inherit;
      background: rgba(var(--ion-color-primary-rgb), 0.08); border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18);
      --accent: var(--ion-color-primary);
    }
    .banner.owed { --accent: var(--wl-type-ingreso); background: color-mix(in srgb, var(--wl-type-ingreso) 9%, transparent); border-color: color-mix(in srgb, var(--wl-type-ingreso) 25%, transparent); }
    .banner.owes { --accent: var(--wl-type-gasto); background: color-mix(in srgb, var(--wl-type-gasto) 8%, transparent); border-color: color-mix(in srgb, var(--wl-type-gasto) 25%, transparent); }
    .icon { flex: none; width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; font-size: 18px; color: #fff; background: var(--accent); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .text strong { color: var(--accent); font-variant-numeric: tabular-nums; }
    .text span { font-size: 12px; color: var(--wl-muted); }
    .cta { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 600; color: var(--accent); }
  `,
})
export class GroupBalanceBannerComponent {
  private readonly groups = inject(GroupsStore);
  readonly groupId = this.groups.activeGroupId;
  private readonly memberIds = computed(() =>
    this.groups.activeMembers.hasValue() ? this.groups.activeMembers.value().map((m) => m.userId) : [],
  );
  readonly accounts = injectGroupAccounts(() => this.groupId(), () => this.memberIds());
  readonly net = this.accounts.myBalance;
  readonly abs = Math.abs;
  /** En bolsa común no hay cuentas que mostrar, salvo que dividieron algún gasto puntual y quedó un saldo. */
  readonly visible = computed(() => this.groups.active()?.group.divide_gastos !== false || this.net() !== 0);

  constructor() {
    addIcons({ chevronForward, swapHorizontalOutline });
  }
}
