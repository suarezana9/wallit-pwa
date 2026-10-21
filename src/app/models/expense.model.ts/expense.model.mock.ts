// import { faker } from '@faker-js/faker';

import { Expense } from './expense.model';

// ===== Simple Mock ====== //
export const MOCK_Expense: Expense = {
  id: 'string',
  amount: 100,
  category: 'food',
  date: '2021-01-01',
  description: 'description',
};

export const MOCK_Expense_Array: Expense[] = [MOCK_Expense];

// ===== Advanced Mock with https://v9.fakerjs.dev/api/ ====== //
// export function createMock_Expense.model.ts(): Expense.model.ts {
//   return {
//     id: faker.string.uuid(),
//   };
// }

// export function createMock_Expense.model.ts_Array(count: number): Expense.model.ts[] {
//   return faker.helpers.multiple(createMock_Expense.model.ts, { count });
// }

// export const MOCK_Expense.model.ts: Expense.model.ts = createMock_Expense.model.ts();
// export const MOCK_Expense.model.ts_Array: Expense.model.ts[] = createMock_Expense.model.ts_Array(5);
