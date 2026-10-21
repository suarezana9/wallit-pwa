import { TestBed } from '@angular/core/testing';
import { I18n } from './i18n/i18n';
import { formatMoney } from './money';
import { PreferencesStore } from './preferences-store';

describe('PreferencesStore + I18n', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('ion-palette-dark');
  });

  it('arranca en español y con la moneda del navegador', () => {
    const prefs = TestBed.inject(PreferencesStore);
    expect(prefs.language()).toBe('es');
    expect(prefs.currency()).toBe('ARS');
    expect(prefs.theme()).toBe('system');
  });

  it('traduce y reacciona al cambio de idioma', () => {
    const prefs = TestBed.inject(PreferencesStore);
    const i18n = TestBed.inject(I18n);
    expect(i18n.t('navHome')).toBe('Inicio');
    expect(i18n.t('hello', 'Ana')).toBe('Hola, Ana');
    prefs.language.set('en');
    expect(i18n.t('navHome')).toBe('Home');
    expect(i18n.category('Supermercado')).toBe('Groceries');
  });

  it('persiste y aplica el tema oscuro', () => {
    const prefs = TestBed.inject(PreferencesStore);
    prefs.theme.set('dark');
    prefs.currency.set('USD');
    TestBed.tick();
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(localStorage.getItem('wallit_tema')).toBe('dark');
    expect(localStorage.getItem('wallit_moneda')).toBe('USD');
  });

  it('formatea montos con el locale de la moneda', () => {
    expect(formatMoney(1500, 'USD')).toBe('$1,500');
    expect(formatMoney(15000.5, 'EUR')).toMatch(/15\.000,50\s€/);
  });
});
