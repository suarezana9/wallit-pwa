import { Component, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonSkeletonText, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronDown, chevronForward, enterOutline, peopleOutline } from 'ionicons/icons';
import { MoneyPipe } from '../core/money';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { Grupo } from '../core/database.types';
import { formatTripRange } from './trip.model';
import { spaceColor } from './space-color';
import { GroupDialogComponent } from './group-dialog.component';
import { GroupsStore } from './groups-store';
import { MemberAvatarsComponent } from './member-avatars.component';

@Component({
  selector: 'app-groups',
  templateUrl: 'groups.page.html',
  styleUrls: ['groups.page.scss'],
  imports: [
    GroupDialogComponent, IonButton, IonContent, IonHeader, IonIcon, IonSkeletonText, IonTitle, IonToolbar,
    MemberAvatarsComponent, MoneyPipe, RouterLink, TranslatePipe,
  ],
})
export class GroupsPage {
  readonly groups = inject(GroupsStore);
  private readonly router = inject(Router);
  readonly dialog = viewChild.required(GroupDialogComponent);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  readonly showArchived = signal(false);
  readonly String = String;

  constructor() {
    addIcons({ add, chevronDown, chevronForward, enterOutline, peopleOutline });
  }

  readonly color = spaceColor;

  tripLabel(group: Grupo): string {
    return formatTripRange(group.fecha_inicio, group.fecha_fin, this.preferences.locale(), this.i18n.t('since')) || this.i18n.t('tripLabel');
  }

  summary(groupId: string) {
    return this.groups.summaries.hasValue() ? this.groups.summaries.value()[groupId] : undefined;
  }

  async useGroup(groupId: string, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.groups.setContext(groupId);
    await this.router.navigateByUrl('/inicio');
  }

  async onCreated(groupId: string): Promise<void> {
    await this.router.navigate(['/grupos', groupId]);
  }
}
