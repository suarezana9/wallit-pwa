import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput,
  IonSkeletonText, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  archiveOutline, arrowBack, checkmark, closeOutline, copyOutline, exitOutline, linkOutline, logoWhatsapp, pencilOutline,
  shareSocialOutline, trashOutline,
} from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MEMBER_COLORS } from '../movements/explorer/movement-explorer.component';
import { GroupAccountsComponent } from './group-accounts.component';
import { GroupActivityComponent } from './group-activity.component';
import { formatTripRange } from './trip.model';
import { PreferencesStore } from '../core/preferences-store';
import type { TipoGrupo } from '../core/database.types';
import { spaceColor } from './space-color';
import { GroupsStore } from './groups-store';
import { SplitModePickerComponent } from './split-mode-picker.component';

@Component({
  selector: 'app-group-detail',
  templateUrl: 'group-detail.page.html',
  styleUrls: ['group-detail.page.scss'],
  imports: [
    GroupAccountsComponent, GroupActivityComponent, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput,
    IonSkeletonText, IonTitle, IonToolbar, RouterLink, SplitModePickerComponent, TranslatePipe,
  ],
})
export class GroupDetailPage {
  readonly id = input.required<string>();

  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly groups = inject(GroupsStore);
  readonly colors = MEMBER_COLORS;
  /** En bolsa común no hay saldos que mirar: arranca en la actividad. */
  readonly tab = linkedSignal<'accounts' | 'activity' | 'members'>(() =>
    this.group()?.divide_gastos === false ? 'activity' : 'accounts',
  );

  readonly entry = computed(() => this.groups.list().find((g) => g.group.id === this.id()) ?? null);
  readonly group = computed(() => this.entry()?.group ?? null);
  readonly color = computed(() => spaceColor(this.id()));
  private readonly preferences = inject(PreferencesStore);

  readonly tripLabel = computed(() => {
    const group = this.group();
    const dates = group ? formatTripRange(group.fecha_inicio, group.fecha_fin, this.preferences.locale(), this.i18n.t('since')) : '';
    return dates || this.i18n.t('tripLabel');
  });

  // Borrador de la configuración (tipo y fechas); se reinicia si cambia el grupo.
  readonly draftKind = linkedSignal<TipoGrupo>(() => this.group()?.tipo ?? 'hogar');
  readonly draftFrom = linkedSignal(() => this.group()?.fecha_inicio ?? '');
  readonly draftTo = linkedSignal(() => this.group()?.fecha_fin ?? '');
  readonly draftDivide = linkedSignal(() => this.group()?.divide_gastos ?? true);
  readonly settingsChanged = computed(() => {
    const group = this.group();
    if (!group) return false;
    return this.draftKind() !== group.tipo
      || this.draftDivide() !== group.divide_gastos
      || (this.draftKind() === 'viaje' && ((this.draftFrom() || null) !== group.fecha_inicio || (this.draftTo() || null) !== group.fecha_fin));
  });
  readonly isAdmin = computed(() => this.entry()?.role === 'admin');
  readonly isActive = computed(() => this.groups.contextId() === this.id());
  readonly userId = computed(() => this.auth.user()?.id);

  readonly members = resource({
    params: () => this.id(),
    loader: ({ params }) => this.groups.fetchMembers(params),
  });
  readonly memberList = computed(() => (this.members.hasValue() ? this.members.value() : []));

  readonly inviteLink = computed(() => {
    const code = this.group()?.invite_code;
    return code ? `${window.location.origin}/unirse/${code}` : '';
  });
  readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  readonly whatsappLink = computed(() => {
    const name = this.group()?.name ?? 'Wallit';
    return `https://wa.me/?text=${encodeURIComponent(`${this.i18n.t('inviteShareText', name)} ${this.inviteLink()}`)}`;
  });

  /** QR para invitar en persona. La librería se carga recién al abrir Miembros (no pesa en el inicio). */
  readonly qr = resource({
    params: () => (this.tab() === 'members' && this.inviteLink() ? this.inviteLink() : undefined),
    loader: async ({ params: link }) => {
      const { default: qrcode } = await import('qrcode-generator');
      const code = qrcode(0, 'M');
      code.addData(link);
      code.make();
      return code.createDataURL(6, 2);
    },
  });

  readonly editing = signal(false);
  readonly draftName = signal('');
  readonly copied = signal<'code' | 'link' | null>(null);

  constructor() {
    addIcons({
      archiveOutline, arrowBack, checkmark, closeOutline, copyOutline, exitOutline, linkOutline, logoWhatsapp, pencilOutline,
      shareSocialOutline, trashOutline,
    });
  }

  startRename(): void {
    this.draftName.set(this.group()?.name ?? '');
    this.editing.set(true);
  }

  async saveName(event?: Event): Promise<void> {
    event?.preventDefault();
    const name = this.draftName().trim();
    if (!name || name === this.group()?.name) {
      this.editing.set(false);
      return;
    }
    const error = await this.groups.rename(this.id(), name);
    if (error) {
      await this.toast(error, 'danger');
      return;
    }
    this.editing.set(false);
  }

  async copy(kind: 'code' | 'link'): Promise<void> {
    const text = kind === 'code' ? this.group()?.invite_code ?? '' : this.inviteLink();
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(kind);
      setTimeout(() => this.copied.set(null), 1800);
    } catch {
      await this.toast(text);
    }
  }

  async share(): Promise<void> {
    const name = this.group()?.name ?? 'Wallit';
    try {
      await navigator.share({ title: name, text: this.i18n.t('inviteShareText', name), url: this.inviteLink() });
    } catch {
      return;
    }
  }

  async saveSettings(): Promise<void> {
    const trip = this.draftKind() === 'viaje';
    const from = trip ? this.draftFrom() || null : null;
    const to = trip ? this.draftTo() || null : null;
    if (from && to && to < from) {
      await this.toast(this.i18n.t('errTripDates'), 'danger');
      return;
    }
    const error = await this.groups.updateSettings(this.id(), {
      tipo: this.draftKind(), divide_gastos: this.draftDivide(), fecha_inicio: from, fecha_fin: to,
    });
    await this.toast(error ?? this.i18n.t('changesSaved'), error ? 'danger' : 'dark');
  }

  async setArchived(archivado: boolean): Promise<void> {
    if (archivado) {
      const name = this.group()?.name ?? '';
      await this.confirm(this.i18n.t('archiveConfirm', name), this.i18n.t('archiveText'), this.i18n.t('archiveGroup'), async () => {
        const error = await this.groups.updateSettings(this.id(), { archivado: true });
        await this.toast(error ?? this.i18n.t('groupArchived'), error ? 'danger' : 'dark');
      });
      return;
    }
    const error = await this.groups.updateSettings(this.id(), { archivado: false });
    await this.toast(error ?? this.i18n.t('groupUnarchived'), error ? 'danger' : 'dark');
  }

  async useInHome(): Promise<void> {
    this.groups.setContext(this.id());
    await this.router.navigateByUrl('/inicio');
  }

  async confirmLeave(): Promise<void> {
    const name = this.group()?.name ?? '';
    await this.confirm(this.i18n.t('leaveConfirm', name), this.i18n.t('leaveText'), this.i18n.t('leave'), async () => {
      const error = await this.groups.leave(this.id());
      await this.afterExit(error, this.i18n.t('leftGroup'));
    });
  }

  async confirmClose(): Promise<void> {
    const name = this.group()?.name ?? '';
    await this.confirm(this.i18n.t('closeConfirm', name), this.i18n.t('closeText'), this.i18n.t('closeGroup'), async () => {
      const error = await this.groups.close(this.id());
      await this.afterExit(error, this.i18n.t('groupClosed'));
    });
  }

  private async afterExit(error: string | null, message: string): Promise<void> {
    if (error) {
      await this.toast(error, 'danger');
      return;
    }
    await this.router.navigateByUrl('/grupos', { replaceUrl: true });
    await this.toast(message);
  }

  private async confirm(header: string, message: string, action: string, handler: () => Promise<void>): Promise<void> {
    const alert = await this.alerts.create({
      header,
      message,
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        { text: action, role: 'destructive', handler: () => void handler() },
      ],
    });
    await alert.present();
  }

  private async toast(message: string, color: 'dark' | 'danger' = 'dark'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
