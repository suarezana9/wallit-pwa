import { Component, inject, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonSkeletonText, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronForward, enterOutline, peopleOutline } from 'ionicons/icons';
import { MoneyPipe } from '../core/money';
import { TranslatePipe } from '../core/i18n/i18n';
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

  constructor() {
    addIcons({ add, chevronForward, enterOutline, peopleOutline });
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
