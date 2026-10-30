import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonIcon, IonModal } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add, checkmark, chevronExpandOutline, enterOutline, personOutline, settingsOutline,
} from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { GroupDialogComponent } from './group-dialog.component';
import { GroupsStore, PERSONAL, injectSpaceSwitcher } from './groups-store';
import { spaceColor } from './space-color';

interface SpaceOption {
  id: string;
  name: string;
  hint: string;
  letter: string;
  color: string | null;
}

/**
 * Selector de espacio (Personal o un grupo), al estilo del selector de workspace de Slack o Notion.
 * - "sidebar": tarjeta arriba de la navegación de escritorio, con menú desplegable.
 * - "inline": botón compacto en las páginas de celular, que abre una hoja desde abajo.
 * Crear o unirse a un grupo se hace desde acá mismo, sin ir a otra pantalla.
 */
@Component({
  selector: 'app-context-switcher',
  imports: [GroupDialogComponent, IonIcon, IonModal, NgTemplateOutlet, RouterLink, TranslatePipe],
  host: {
    '[class]': 'variant()',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <button
      type="button"
      class="trigger"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'spaceSwitch' | t"
      (click)="toggle()"
    >
      <ng-container [ngTemplateOutlet]="avatar" [ngTemplateOutletContext]="{ $implicit: current() }" />
      <span class="text">
        <span class="label">{{ 'spaceViewing' | t }}</span>
        <span class="name">{{ current().name }}</span>
      </span>
      <ion-icon name="chevron-expand-outline" class="chevron" aria-hidden="true" />
    </button>

    @if (variant() === 'sidebar') {
      @if (open()) {
        <div class="menu dropdown">
          <ng-container [ngTemplateOutlet]="menu" />
        </div>
      }
    } @else {
      <ion-modal
        class="space-sheet"
        [isOpen]="open()"
        [initialBreakpoint]="1"
        [breakpoints]="[0, 1]"
        (didDismiss)="open.set(false)"
      >
        <ng-template>
          <div class="menu sheet">
            <ng-container [ngTemplateOutlet]="menu" />
          </div>
        </ng-template>
      </ion-modal>
    }

    <ng-template #menu>
      <p class="menu-title">{{ 'spaceSwitch' | t }}</p>
      <div role="listbox" [attr.aria-label]="'spaceSwitch' | t">
        @for (option of options(); track option.id) {
          <button
            type="button"
            role="option"
            class="option"
            [class.selected]="option.id === groups.contextId()"
            [attr.aria-selected]="option.id === groups.contextId()"
            (click)="choose(option.id)"
          >
            <ng-container [ngTemplateOutlet]="avatar" [ngTemplateOutletContext]="{ $implicit: option }" />
            <span class="text">
              <span class="name">{{ option.name }}</span>
              <span class="hint">{{ option.hint }}</span>
            </span>
            @if (option.id === groups.contextId()) {
              <ion-icon name="checkmark" class="check" aria-hidden="true" />
            }
          </button>
        }
      </div>
      <div class="divider"></div>
      <button type="button" class="action" (click)="openDialog('create')">
        <ion-icon name="add" aria-hidden="true" />
        {{ 'createGroup' | t }}
      </button>
      <button type="button" class="action" (click)="openDialog('join')">
        <ion-icon name="enter-outline" aria-hidden="true" />
        {{ 'joinGroup' | t }}
      </button>
      @if (groups.list().length) {
        <a class="action" routerLink="/grupos" (click)="close()">
          <ion-icon name="settings-outline" aria-hidden="true" />
          {{ 'spaceManage' | t }}
        </a>
      }
    </ng-template>

    <ng-template #avatar let-space>
      @if (space.color) {
        <span class="avatar" [style.--space-color]="space.color" aria-hidden="true">{{ space.letter }}</span>
      } @else {
        <span class="avatar personal" aria-hidden="true"><ion-icon name="person-outline" /></span>
      }
    </ng-template>

    <app-group-dialog (done)="onGroupReady($event)" />
  `,
  styleUrl: 'context-switcher.component.scss',
})
export class ContextSwitcherComponent {
  readonly variant = input<'sidebar' | 'inline'>('inline');

  readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18n);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly select = injectSpaceSwitcher();
  private readonly dialog = viewChild.required(GroupDialogComponent);

  readonly open = signal(false);

  readonly options = computed<SpaceOption[]>(() => [
    { id: PERSONAL, name: this.i18n.t('personal'), hint: this.i18n.t('spacePersonalHint'), letter: '', color: null },
    ...this.groups.list().map(({ group, role }) => ({
      id: group.id,
      name: group.name,
      hint: this.i18n.t(role === 'admin' ? 'spaceGroupAdmin' : 'spaceGroupMember'),
      letter: group.name.trim().charAt(0).toUpperCase() || '?',
      color: spaceColor(group.id),
    })),
  ]);

  readonly current = computed(() => this.options().find((o) => o.id === this.groups.contextId()) ?? this.options()[0]);

  constructor() {
    addIcons({ add, checkmark, chevronExpandOutline, enterOutline, personOutline, settingsOutline });
  }

  toggle(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  choose(id: string): void {
    this.select(id);
    this.close();
  }

  openDialog(mode: 'create' | 'join'): void {
    this.close();
    this.dialog().open(mode);
  }

  /** Grupo creado o al que te uniste: pasa a ser el espacio activo y se abre su detalle para invitar gente. */
  async onGroupReady(groupId: string): Promise<void> {
    this.groups.setContext(groupId);
    await this.router.navigate(['/grupos', groupId]);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.variant() === 'sidebar' && this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
