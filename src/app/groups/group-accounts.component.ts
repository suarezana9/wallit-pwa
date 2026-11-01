import { Component, computed, inject, input, output } from '@angular/core';
import { AlertController, IonButton, IonIcon, IonSkeletonText, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, checkmarkCircle, informationCircleOutline, trashOutline } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { parseIsoDate } from '../core/dates';
import { MEMBER_COLORS } from '../movements/explorer/movement-explorer.component';
import type { Transfer } from './balances.model';
import { injectGroupAccounts } from './group-accounts';
import type { GroupMember } from './groups-store';
import type { Grupo } from '../core/database.types';
import { TripSummaryComponent } from './trip-summary.component';

interface Person {
  name: string;
  initial: string;
  color: string;
  isMe: boolean;
}

/** Pestaña "Cuentas" del grupo: tu saldo, cómo saldar con pocas transferencias y los pagos registrados. */
import { amountForClipboard, parseAmount } from '../core/amount';
@Component({
  selector: 'app-group-accounts',
  imports: [IonButton, IonIcon, IonSkeletonText, MoneyPipe, TranslatePipe, TripSummaryComponent],
  template: `
    @if (accounts.data.isLoading() && !accounts.data.hasValue()) {
      <ion-skeleton-text [animated]="true" class="skeleton" />
    } @else {
      @if (group()?.tipo === 'viaje') {
        <app-trip-summary
          [group]="group()!"
          [movements]="accounts.movements()"
          [memberCount]="members().length"
          [pendingDebts]="transfers().length > 0"
          [isAdmin]="isAdmin()"
          (archive)="archive.emit()"
        />
      }
      @if (sharedMode() && !transfers().length) {
        <section class="wl-panel shared">
          <span class="shared-emoji" aria-hidden="true">🫙</span>
          <div>
            <h2>{{ 'sharedPotTitle' | t }}</h2>
            <p>{{ 'sharedPotText' | t }}</p>
          </div>
        </section>
      } @else {
        <section class="hero" [class.owed]="myBalance() > 0" [class.owes]="myBalance() < 0">
          @if (myBalance() === 0) {
            <ion-icon name="checkmark-circle" class="hero-icon" aria-hidden="true" />
            <div>
              <h2>{{ 'allSettled' | t }}</h2>
              <p>{{ (transfers().length ? 'allSettledOthers' : 'allSettledText') | t }}</p>
            </div>
          } @else {
            <div>
              <span class="hero-label">{{ (myBalance() > 0 ? 'youAreOwed' : 'youOwe') | t }}</span>
              <strong class="hero-amount">{{ abs(myBalance()) | money }}</strong>
              <p>{{ (myBalance() > 0 ? 'youAreOwedHint' : 'youOweHint') | t }}</p>
            </div>
          }
        </section>

        <div class="columns">
          <section class="wl-panel">
            <h2>{{ 'settleTitle' | t }}</h2>
            @if (transfers().length) {
              <p class="hint">{{ 'settleHint' | t }}</p>
              <ul class="transfers">
                @for (transfer of transfers(); track transfer.from + transfer.to) {
                  @let from = person(transfer.from);
                  @let to = person(transfer.to);
                  <li [class.mine]="from.isMe || to.isMe">
                    <span class="avatar" [style.background]="from.color" aria-hidden="true">{{ from.initial }}</span>
                    <span class="who">
                      <span class="names">{{ from.name }} <ion-icon name="arrow-forward" aria-hidden="true" /> {{ to.name }}</span>
                      <strong>{{ transfer.amount | money }}</strong>
                    </span>
                    @if (from.isMe || to.isMe) {
                      <ion-button class="wl-btn" size="small" fill="outline" (click)="register(transfer)">
                        {{ 'registerPayment' | t }}
                      </ion-button>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p class="empty">{{ 'settleEmpty' | t }}</p>
            }
          </section>

          <section class="wl-panel">
            <h2>{{ 'balancesTitle' | t }}</h2>
            <ul class="balances">
              @for (balance of accounts.balances(); track balance.userId) {
                @let who = person(balance.userId);
                <li>
                  <span class="avatar" [style.background]="who.color" aria-hidden="true">{{ who.initial }}</span>
                  <span class="who">
                    <span class="names">{{ who.name }}</span>
                    <span class="bar" aria-hidden="true">
                      <span [class.neg]="balance.net < 0" [style.width.%]="barWidth(balance.net)"></span>
                    </span>
                  </span>
                  <span class="net" [class.pos]="balance.net > 0" [class.neg]="balance.net < 0">
                    {{ balance.net > 0 ? '+' : '' }}{{ balance.net | money }}
                  </span>
                </li>
              }
            </ul>
            <p class="hint small">{{ 'balancesHint' | t }}</p>
          </section>
        </div>
      }

      @if (accounts.payments().length) {
        <section class="wl-panel">
          <h2>{{ 'paymentsTitle' | t }}</h2>
          <ul class="payments">
            @for (payment of accounts.payments(); track payment.id) {
              <li>
                <span class="pay-text">
                  {{ 'paymentLine' | t: person(payment.from_user).name : person(payment.to_user).name }}
                  <span class="date">{{ formatDate(payment.date) }}</span>
                </span>
                <strong>{{ payment.amount | money }}</strong>
                @if (payment.created_by === userId()) {
                  <ion-button fill="clear" color="medium" size="small" (click)="remove(payment.id)" [attr.aria-label]="'delete' | t">
                    <ion-icon slot="icon-only" name="trash-outline" />
                  </ion-button>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (accounts.unsplitCount() > 0 && !sharedMode()) {
        <p class="note">
          <ion-icon name="information-circle-outline" aria-hidden="true" />
          {{ 'unsplitNote' | t: String(accounts.unsplitCount()) }}
        </p>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .shared { display: flex; align-items: flex-start; gap: 14px; }
    .shared h2 { margin: 0 0 4px; }
    .shared p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--wl-muted); }
    .shared-emoji { font-size: 28px; line-height: 1; }
    .skeleton { height: 140px; border-radius: 20px; }
    .hero {
      display: flex; align-items: center; gap: 16px; padding: 22px 24px; border-radius: 20px; color: #fff;
      background: linear-gradient(135deg, #6c47ff, #8b5cf6);
    }
    .hero.owed { background: linear-gradient(135deg, #059669, #10b981); }
    .hero.owes { background: linear-gradient(135deg, #dc2626, #f97316); }
    .hero h2 { margin: 0; font-size: 20px; }
    .hero p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .hero-icon { font-size: 40px; flex: none; }
    .hero-label { font-size: 14px; font-weight: 600; opacity: 0.9; }
    .hero-amount { display: block; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .columns { display: grid; gap: 16px; }
    @media (min-width: 900px) { .columns { grid-template-columns: 1fr 1fr; align-items: start; } }
    h2 { margin: 0 0 4px; font-size: 17px; }
    .hint { margin: 0 0 12px; font-size: 13px; color: var(--wl-muted); }
    .hint.small { margin: 12px 0 0; }
    .empty { margin: 8px 0 0; color: var(--wl-muted); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .transfers li { padding: 10px 12px; border-radius: 14px; background: var(--wl-field-bg); }
    .transfers li.mine { background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .avatar {
      flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
      font-size: 14px; font-weight: 700; color: #fff;
    }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .names { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .names ion-icon { flex: none; color: var(--wl-muted); }
    .who strong, .net, .payments strong { font-variant-numeric: tabular-nums; }
    .bar { height: 6px; border-radius: 3px; background: var(--wl-field-bg); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 3px; background: var(--wl-type-ingreso); }
    .bar span.neg { background: var(--wl-type-gasto); }
    .net { flex: none; font-weight: 700; }
    .net.pos { color: var(--wl-type-ingreso); }
    .net.neg { color: var(--wl-type-gasto); }
    .payments li { border-bottom: 1px solid var(--wl-field-border); }
    .payments li:last-child { border-bottom: 0; }
    .pay-text { flex: 1; min-width: 0; font-size: 14px; display: flex; flex-direction: column; }
    .date { font-size: 12px; color: var(--wl-muted); }
    .note { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; color: var(--wl-muted); }
    .note ion-icon { flex: none; font-size: 18px; }
  `,
})
export class GroupAccountsComponent {
  readonly groupId = input.required<string>();
  readonly members = input<readonly GroupMember[]>([]);
  readonly group = input<Grupo | null>(null);
  readonly isAdmin = input(false);
  readonly archive = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly accounts = injectGroupAccounts(
    () => this.groupId(),
    () => this.members().map((m) => m.userId),
  );
  readonly userId = computed(() => this.auth.user()?.id ?? '');
  readonly myBalance = this.accounts.myBalance;
  readonly transfers = this.accounts.transfers;
  readonly sharedMode = computed(() => this.group()?.divide_gastos === false);
  readonly String = String;
  readonly abs = Math.abs;

  private readonly people = computed(() => {
    const map = new Map<string, Person>();
    this.members().forEach((member, i) => {
      const isMe = member.userId === this.userId();
      map.set(member.userId, {
        name: isMe ? this.i18n.t('youCap') : member.name,
        initial: member.name.charAt(0).toUpperCase(),
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
        isMe,
      });
    });
    return map;
  });

  private readonly maxAbs = computed(() => Math.max(1, ...this.accounts.balances().map((b) => Math.abs(b.net))));

  constructor() {
    addIcons({ arrowForward, checkmarkCircle, informationCircleOutline, trashOutline });
  }

  person(userId: string): Person {
    return this.people().get(userId) ?? { name: this.i18n.t('formerMember'), initial: '?', color: '#9ca3af', isMe: false };
  }

  barWidth(net: number): number {
    return Math.round((Math.abs(net) / this.maxAbs()) * 100);
  }

  formatDate(iso: string): string {
    return parseIsoDate(iso).toLocaleDateString(this.preferences.locale(), { day: 'numeric', month: 'short' });
  }

  async register(transfer: Transfer): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('registerPayment'),
      message: this.i18n.t('paymentConfirm', this.person(transfer.from).name, this.person(transfer.to).name),
      inputs: [{ name: 'amount', type: 'text', value: amountForClipboard(transfer.amount, this.preferences.language()), attributes: { inputmode: 'decimal' } }],
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        {
          text: this.i18n.t('registerPayment'),
          handler: (values: { amount: string }) => {
            const amount = parseAmount(values.amount, this.preferences.language()) ?? NaN;
            if (!Number.isFinite(amount) || amount <= 0) return false;
            void this.save(transfer.from, transfer.to, amount);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async remove(paymentId: string): Promise<void> {
    const error = await this.accounts.removePayment(paymentId);
    await this.toast(error ?? this.i18n.t('deleted'), error ? 'danger' : 'dark');
  }

  private async save(from: string, to: string, amount: number): Promise<void> {
    const error = await this.accounts.registerPayment(from, to, amount);
    await this.toast(error ?? this.i18n.t('paymentSaved'), error ? 'danger' : 'dark');
  }

  private async toast(message: string, color: 'dark' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
