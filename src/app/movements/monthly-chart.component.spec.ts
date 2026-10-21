import { TestBed } from '@angular/core/testing';
import { MonthlyChartComponent } from './monthly-chart.component';

describe('MonthlyChartComponent', () => {
  it('dibuja una barra por mes y resalta el actual', () => {
    const fixture = TestBed.createComponent(MonthlyChartComponent);
    fixture.componentRef.setInput('points', [
      { key: '2026-09', label: 'sep', gastos: 100, ingresos: 0, isCurrent: false },
      { key: '2026-10', label: 'oct', gastos: 50, ingresos: 0, isCurrent: true },
    ]);
    fixture.detectChanges();
    const bars = fixture.nativeElement.querySelectorAll('g.bar');
    expect(bars.length).toBe(2);
    expect(fixture.nativeElement.querySelector('g.bar.current .month').textContent).toBe('oct');
  });

  it('sin gastos muestra un mensaje', () => {
    const fixture = TestBed.createComponent(MonthlyChartComponent);
    fixture.componentRef.setInput('points', [{ key: '2026-10', label: 'oct', gastos: 0, ingresos: 0, isCurrent: true }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay gastos');
  });
});
