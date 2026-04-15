import { Transaction, Budget, FinancialState, Person, PERSONS, DEFAULT_BUDGETS, EXPENSE_CATEGORIES, ACCOUNTS, DEBT_EXPENSE_CATEGORIES, HomeOrDebt } from './types';

const STORAGE_KEY = 'family-finance-data';

const defaultState: FinancialState = {
  transactions: [],
  budgets: [],
  recurringEntries: [],
  monthData: [],
  initialBalances: { Appa: 0, Amma: 0, Ajai: 0, Mauli: 0 },
  accountBalances: {},
};

export function loadState(): FinancialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    // Migrate: add accountBalances if missing
    if (!parsed.accountBalances) parsed.accountBalances = {};
    // Migrate: add homeOrDebt to transactions if missing
    if (parsed.transactions) {
      parsed.transactions = parsed.transactions.map((t: any) => ({
        ...t,
        homeOrDebt: t.homeOrDebt || 'home',
      }));
    }
    return parsed;
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

// Get account balance for a specific account
export function getAccountBalance(
  txns: Transaction[],
  accountId: string,
  year: number,
  month: number,
  accountBalances: Record<string, number>
): { opening: number; income: number; expense: number; closing: number } {
  const initial = accountBalances[accountId] || 0;

  let opening = initial;
  for (const t of txns) {
    const tYM = t.year * 12 + t.month;
    const targetYM = year * 12 + month;
    if (tYM >= targetYM) continue;

    if (t.accountId === accountId) {
      if (t.type === 'income') opening += t.amount;
      if (t.type === 'expense') opening -= t.amount;
      if (t.type === 'transfer') opening -= t.amount;
    }
    if (t.transferToAccountId === accountId) {
      opening += t.amount;
    }
  }

  const monthTxns = getMonthTransactions(txns, year, month);
  let income = 0, expense = 0;
  for (const t of monthTxns) {
    if (t.accountId === accountId) {
      if (t.type === 'income') income += t.amount;
      if (t.type === 'expense') expense += t.amount;
      if (t.type === 'transfer') expense += t.amount;
    }
    if (t.transferToAccountId === accountId) {
      income += t.amount;
    }
  }

  return { opening, income, expense, closing: opening + income - expense };
}

export function getPersonBalance(
  txns: Transaction[],
  person: Person,
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances?: Record<string, number>
): { opening: number; income: number; expense: number; closing: number } {
  // If we have account balances, sum up all accounts for this person
  if (accountBalances) {
    const personAccounts = ACCOUNTS.filter(a => a.person === person);
    let totalOpening = 0, totalIncome = 0, totalExpense = 0;
    for (const acc of personAccounts) {
      const bal = getAccountBalance(txns, acc.id, year, month, accountBalances);
      totalOpening += bal.opening;
      totalIncome += bal.income;
      totalExpense += bal.expense;
    }
    // Also include transactions without accountId (legacy)
    const initial = initialBalances[person] || 0;
    let legacyOpening = initial;
    for (const t of txns) {
      if (t.accountId) continue; // skip account-tracked txns
      const tYM = t.year * 12 + t.month;
      const targetYM = year * 12 + month;
      if (tYM >= targetYM) continue;
      if (t.type === 'income' && t.person === person) legacyOpening += t.amount;
      if (t.type === 'expense' && t.person === person) legacyOpening -= t.amount;
      if (t.type === 'transfer') {
        if (t.person === person) legacyOpening -= t.amount;
        if (t.transferTo === person) legacyOpening += t.amount;
      }
    }
    const legacyMonth = getMonthTransactions(txns, year, month).filter(t => !t.accountId);
    let legacyIncome = 0, legacyExpense = 0;
    for (const t of legacyMonth) {
      if (t.type === 'income' && t.person === person) legacyIncome += t.amount;
      if (t.type === 'expense' && t.person === person) legacyExpense += t.amount;
      if (t.type === 'transfer') {
        if (t.person === person) legacyExpense += t.amount;
        if (t.transferTo === person) legacyIncome += t.amount;
      }
    }
    totalOpening += legacyOpening;
    totalIncome += legacyIncome;
    totalExpense += legacyExpense;
    return { opening: totalOpening, income: totalIncome, expense: totalExpense, closing: totalOpening + totalIncome - totalExpense };
  }

  // Legacy fallback
  const initial = initialBalances[person] || 0;
  let opening = initial;
  for (const t of txns) {
    const tYM = t.year * 12 + t.month;
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
      if (t.person === person) expense += t.amount;
      if (t.transferTo === person) income += t.amount;
    }
  }
  return { opening, income, expense, closing: opening + income - expense };
}

export function getTotalBalance(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances?: Record<string, number>
) {
  const monthTxns = getMonthTransactions(txns, year, month);
  const realIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const realExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Opening from all accounts + legacy
  let opening = 0;
  if (accountBalances) {
    for (const acc of ACCOUNTS) {
      opening += accountBalances[acc.id] || 0;
    }
  }
  opening += Object.values(initialBalances).reduce((s, v) => s + v, 0);

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

// Home vs Debt split for monthly summary
export function getHomeDebtSummary(txns: Transaction[], year: number, month: number) {
  const monthTxns = getMonthTransactions(txns, year, month);

  const homeIncome = monthTxns.filter(t => t.type === 'income' && t.homeOrDebt === 'home').reduce((s, t) => s + t.amount, 0);
  const debtIncome = monthTxns.filter(t => t.type === 'income' && t.homeOrDebt === 'debt').reduce((s, t) => s + t.amount, 0);
  const homeExpense = monthTxns.filter(t => t.type === 'expense' && t.homeOrDebt === 'home').reduce((s, t) => s + t.amount, 0);
  const debtExpense = monthTxns.filter(t => t.type === 'expense' && t.homeOrDebt === 'debt').reduce((s, t) => s + t.amount, 0);

  return {
    homeIncome, debtIncome,
    homeExpense, debtExpense,
    homeBalance: homeIncome - homeExpense,
    debtBalance: debtIncome - debtExpense,
    totalIncome: homeIncome + debtIncome,
    totalExpense: homeExpense + debtExpense,
    totalBalance: (homeIncome + debtIncome) - (homeExpense + debtExpense),
  };
}

// Expected vs Actual for income
export function getExpectedVsActualIncome(txns: Transaction[], year: number, month: number) {
  const monthTxns = getMonthTransactions(txns, year, month).filter(t => t.type === 'income');
  const result: Record<string, { expected: number; actual: number }> = {};
  for (const t of monthTxns) {
    if (!result[t.category]) result[t.category] = { expected: 0, actual: 0 };
    result[t.category].actual += t.amount;
    if (t.expectedAmount) result[t.category].expected = t.expectedAmount;
  }
  return result;
}

// Missing money: difference between expected closing and actual cash/bank totals
export function getMissingMoney(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances: Record<string, number>
) {
  // Total expected closing (all income - all expenses from opening)
  const totals = getTotalBalance(txns, year, month, initialBalances, accountBalances);

  // Sum of all account ending balances
  let accountTotal = 0;
  for (const acc of ACCOUNTS) {
    const bal = getAccountBalance(txns, acc.id, year, month, accountBalances);
    accountTotal += bal.closing;
  }
  // Add legacy person balances
  for (const p of PERSONS) {
    const legacyTxns = txns.filter(t => !t.accountId);
    const bal = getPersonBalance(legacyTxns, p, year, month, initialBalances);
    accountTotal += bal.closing;
  }

  return {
    expectedClosing: totals.closing,
    actualClosing: accountTotal,
    missingMoney: totals.closing - accountTotal,
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
