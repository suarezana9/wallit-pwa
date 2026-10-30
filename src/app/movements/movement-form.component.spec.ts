import { TestBed } from '@angular/core/testing';
import { MovementFormComponent, toMovementInput } from './movement-form.component';

describe('MovementFormComponent', () => {
  function create() {
    const fixture = TestBed.createComponent(MovementFormComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('un gasto pide categoría y no fuente', () => {
    const form = create();
    form.model.update((m) => ({ ...m, amount: 100 }));
    expect(form.movementForm.category().invalid()).toBe(true);
    expect(form.movementForm.fuente().hidden()).toBe(true);
  });

  it('un ingreso pide fuente y oculta la categoría', () => {
    const form = create();
    form.model.update((m) => ({ ...m, tipo: 'ingreso', amount: 100 }));
    expect(form.movementForm.category().hidden()).toBe(true);
    expect(form.movementForm.fuente().invalid()).toBe(true);
    form.model.update((m) => ({ ...m, fuente: 'sueldo' }));
    expect(form.movementForm().valid()).toBe(true);
  });

  it('no emite si el monto es cero', async () => {
    const form = create();
    const emitted = vi.fn();
    form.save.subscribe(emitted);
    form.model.update((m) => ({ ...m, amount: 0, category: 'Ocio' }));
    await form.onSubmit(new Event('submit'));
    expect(emitted).not.toHaveBeenCalled();
  });

  it('emite el movimiento listo para guardar', async () => {
    const form = create();
    const emitted = vi.fn();
    form.save.subscribe(emitted);
    form.model.update((m) => ({ ...m, amount: 1500, category: 'Ocio', description: '  cine ' }));
    await form.onSubmit(new Event('submit'));
    expect(emitted).toHaveBeenCalledWith({
      input: expect.objectContaining({ amount: 1500, category: 'Ocio', description: 'cine', fuente: null }),
      receipt: null,
    });
  });

  it('la foto que leyó la IA queda como comprobante y varios movimientos van a la revisión en lote', () => {
    const form = create();
    const multiple = vi.fn();
    form.multiple.subscribe(multiple);
    const m = { tipo: 'gasto' as const, monto: 800, descripcion: 'Kiosco', categoria: 'Otros', fuente: null, fecha: '2026-10-20' };
    form.applyAi({ movements: [m], receipt: 'data:image/jpeg;base64,AAA' });
    expect(form.receipt()).toEqual({ kind: 'new', dataUrl: 'data:image/jpeg;base64,AAA' });
    expect(form.model().amount).toBe(800);
    form.applyAi({ movements: [m, m] });
    expect(multiple).toHaveBeenCalledOnce();
    form.removeReceipt();
    expect(form.receipt()).toBeNull();
  });

  it('un ingreso se guarda con categoría Otros', () => {
    const input = toMovementInput({ tipo: 'ingreso', amount: 10, category: 'Ocio', fuente: 'sueldo', description: '', date: '2026-10-01', isPrivate: true });
    expect(input).toMatchObject({ category: 'Otros', fuente: 'sueldo', is_private: false });
  });
});
