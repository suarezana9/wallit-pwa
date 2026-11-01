import { Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * En el celular, el botón "+" flotante se esconde al bajar (para no tapar gráficos ni montos)
 * y vuelve apenas subís un poco o llegás arriba de todo.
 * Uso: <ion-content wlFabAutoHide>…<ion-fab>…</ion-fab></ion-content>
 */
@Directive({
  selector: 'ion-content[wlFabAutoHide]',
  host: {
    '[class.wl-fab-hidden]': 'hidden()',
    '(ionScroll)': 'onScroll($event.detail)',
  },
})
export class FabAutoHideDirective {
  readonly hidden = signal(false);

  constructor() {
    // ion-content solo emite ionScroll con scrollEvents activado.
    (inject(ElementRef).nativeElement as HTMLIonContentElement).scrollEvents = true;
  }

  onScroll({ scrollTop, deltaY }: { scrollTop: number; deltaY: number }): void {
    if (scrollTop < 40) this.hidden.set(false);
    else if (deltaY > 6) this.hidden.set(true);
    else if (deltaY < -6) this.hidden.set(false);
  }
}
