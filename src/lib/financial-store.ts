import { Transaction, Budget, RecurringEntry, MonthData, FinancialState, Person, PERSONS, DEFAULT_BUDGETS, EXPENSE_CATEGORIES } from './types';

const STORAGE_KEY = 'family-finance-data';

const defaultState: FinancialState = {
  transactions: [],
  budgets: [],
  recurringEntries: [],
  monthData: [],
  initialBalances: { Appa: 0, Amma: 0, Ajai: 0, Mauli: 0 },
};

export function loadState(): FinancialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return JSON.parse(raw);
  } catch {
    return defaultState;
  }
}

export function saveState(state: FinancialState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function getMonthTransactions(txns: Transaction[], year: number, month: number): Transaction[] {
  return txns.filter(t => t.year === year && t.month === month);
}

export function getPersonBalance(
  txns: Transaction[],
  person: Person,
  year: number,
  month: number,
  initialBalances: Record<Person, number>
): { opening: number; income: number; expense: number; closing: number } {
  const initial = initialBalances[person] || 0;

  // Calculate balance from all transactions before this month
  let opening = initial;
  for (const t of txns) {
    const tDate = new Date(t.date);
    const tYM = tDate.getFullYear() * 12 + tDate.getMonth();
    const targetYM = year * 12 + month;
    if (tYM >= targetYM) continue;

    if (t.type === 'income' && t.person === person) opening += t.amount;
    if (t.type === 'expense' && t.person === person) opening -= t.amount;
    if (t.type === 'transfer') {
      if (t.person === person) opening -= t.amount;
      if (t.transferTo === person) opening += t.amount;
    }
  }

  const monthTxns = getMonthTransactions(txns, year, month);
  let income = 0, expense = 0;
  for (const t of monthTxns) {
    if (t.type === 'income' && t.person === person) income += t.amount;
    if (t.type === 'expense' && t.person === person) expense += t.amount;
    if (t.type === 'transfer') {
      if (t.person === person) expense += t.amount; // treated as outflow for this calc
      if (t.transferTo === person) income += t.amount; // treated as inflow
    }
  }

  return { opening, income, expense, closing: opening + income - expense };
}

export function getTotalBalance(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>
) {
  let totalOpening = 0, totalIncome = 0, totalExpense = 0;
  for (const p of PERSONS) {
    const b = getPersonBalance(txns, p, year, month, initialBalances);
    totalOpening += b.opening;
    totalIncome += b.income;
    totalExpense += b.expense;
  }
  // For total, transfers cancel out, so recalc without transfer double-counting
  const monthTxns = getMonthTransactions(txns, year, month);
  const realIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const realExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalInitial = Object.values(initialBalances).reduce((s, v) => s + v, 0);

  // Opening = total initial + all income before month - all expense before month
  let opening = totalInitial;
  for (const t of txns) {
    const tYM = t.year * 12 + t.month;
    const targetYM = year * 12 + month;
    if (tYM >= targetYM) continue;
    if (t.type === 'income') opening += t.amount;
    if (t.type === 'expense') opening -= t.amount;
  }

  return {
    opening,
    income: realIncome,
    expense: realExpense,
    closing: opening + realIncome - realExpense,
    savings: realIncome - realExpense,
  };
}

export function getBudgetForCategory(budgets: Budget[], category: string, year: number, month: number): number {
  const found = budgets.find(b => b.category === category && b.year === year && b.month === month);
  if (found) return found.amount;
  return DEFAULT_BUDGETS[category] || 0;
}

export function getCategorySpending(txns: Transaction[], year: number, month: number) {
  const monthTxns = getMonthTransactions(txns, year, month).filter(t => t.type === 'expense');
  const result: Record<string, number> = {};
  for (const t of monthTxns) {
    result[t.category] = (result[t.category] || 0) + t.amount;
  }
  return result;
}

export function getOverspendCategories(
  txns: Transaction[], budgets: Budget[], year: number, month: number
) {
  const spending = getCategorySpending(txns, year, month);
  return EXPENSE_CATEGORIES.map(cat => {
    const budget = getBudgetForCategory(budgets, cat, year, month);
    const actual = spending[cat] || 0;
    const remaining = budget - actual;
    const percent = budget > 0 ? (actual / budget) * 100 : 0;
    return { category: cat, budget, actual, remaining, percent, overspent: actual > budget };
  });
}
