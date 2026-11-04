import { legalText } from './legal.content';

describe('textos legales', () => {
  it('privacidad y términos en los dos idiomas, con la misma cantidad de secciones', () => {
    for (const doc of ['privacy', 'terms'] as const) {
      const es = legalText(doc, 'es');
      const en = legalText(doc, 'en');
      expect(es.sections.length).toBeGreaterThan(5);
      expect(en.sections.length).toBe(es.sections.length);
    }
  });

  it('sin email configurado, el contacto es Enviar comentarios (nunca queda un dato a completar a la vista)', () => {
    const all = JSON.stringify([legalText('privacy', 'es'), legalText('terms', 'es')]);
    expect(all).toContain('Enviar comentarios');
    expect(all).not.toMatch(/completar|TODO|\[\s*\]/i);
    expect(all).toContain('Ley N° 25.326');
  });
});
