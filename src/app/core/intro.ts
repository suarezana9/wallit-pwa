/** Las pantallas de bienvenida se muestran una sola vez por dispositivo. */
const INTRO_KEY = 'wallit_intro_vista';

export function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    // Sin acceso al almacenamiento (modo privado estricto): no insistimos con la bienvenida.
    return true;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_KEY, '1');
  } catch {
    return;
  }
}
