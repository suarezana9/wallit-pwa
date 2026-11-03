import { TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(AvatarComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra la inicial si no hay foto ni emoji', () => {
    expect(render({ name: 'ana' }).textContent?.trim()).toBe('A');
  });

  it('el emoji gana a la inicial y la foto gana a todo', () => {
    expect(render({ name: 'Casa', emoji: '🏠' }).textContent?.trim()).toBe('🏠');
    const el = render({ name: 'Casa', emoji: '🏠', url: 'https://x.test/a.jpg' });
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://x.test/a.jpg');
  });

  it('si la foto no carga, vuelve a la inicial', () => {
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('name', 'Sol');
    fixture.componentRef.setInput('url', 'https://x.test/rota.jpg');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('S');
  });
});
