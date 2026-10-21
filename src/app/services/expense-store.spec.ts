import { TestBed } from '@angular/core/testing';
import { ExpenseStore } from './expense-store';

describe('ExpenseStore', () => {
  let service: ExpenseStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExpenseStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
