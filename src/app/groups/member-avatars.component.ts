import { Component, computed, inject, input, resource } from '@angular/core';
import { TranslatePipe } from '../core/i18n/i18n';
import { GroupsStore } from './groups-store';

const COLORS = ['#6c47ff', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ef4444'];

@Component({
  selector: 'app-member-avatars',
  imports: [TranslatePipe],
  template: `
    @if (members().length) {
      <div class="stack" aria-hidden="true">
        @for (member of visible(); track member.userId; let i = $index) {
          <span class="avatar" [style.background]="colors[i % colors.length]" [title]="member.name">
            {{ member.name.charAt(0).toUpperCase() }}
          </span>
        }
        @if (members().length > max) {
          <span class="avatar more">+{{ members().length - max }}</span>
        }
      </div>
      <span class="count">{{ 'membersCount' | t: '' + members().length }}</span>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .stack { display: flex; }
    .avatar {
      width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
      font-size: 12px; font-weight: 700; color: #fff; border: 2px solid var(--ion-background-color);
      margin-left: -8px;
    }
    .avatar:first-child { margin-left: 0; }
    .more { color: var(--wl-muted); background: var(--wl-field-bg); }
    .count { font-size: 13px; color: var(--wl-muted); white-space: nowrap; }
  `,
})
export class MemberAvatarsComponent {
  private readonly groups = inject(GroupsStore);
  readonly groupId = input.required<string>();
  readonly max = 5;
  readonly colors = COLORS;

  private readonly data = resource({
    params: () => this.groupId(),
    loader: ({ params }) => this.groups.fetchMembers(params),
  });

  readonly members = computed(() => (this.data.hasValue() ? this.data.value() : []));
  readonly visible = computed(() => this.members().slice(0, this.max));
}
