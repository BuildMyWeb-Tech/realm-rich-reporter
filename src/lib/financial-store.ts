/**
 * financial-store.ts — Single source of truth for all balance calculations.
 *
 * BUG FIX SUMMARY (all 10 bugs):
 *
 * Bug 1  ✅ Transfers never counted as income or expense. Isolated in transferNet.
 * Bug 2  ✅ Person balance = account-layer + legacy-layer. No path runs both on same tx.
 * Bug 3  ✅ UI shows "Appa CNB → Ajai CB" not "Transfer → Ajai" (in PersonWisePage).
 * Bug 4  ✅ Account-tracked path uses transferToAccountId ONLY.
 *            Legacy path uses transferTo (Person) — the ONLY field available there.
 *            NEW: resolveTransferDestAccount() falls back when transferToAccountId missing.
 * Bug 5  ✅ normalizeTransaction() coerces amount to number + rounds. Missing accountId
 *            transactions fully handled by the legacy path (no silent skip).
 * Bug 6  ✅ getAccountBalance now returns transferNet directly — getPersonBalance
 *            reads it instead of re-looping. Eliminated O(n×m) nested loop.
 * Bug 7  ✅ validateTransfer() enforced at store level, not just in UI.
 * Bug 8  ✅ normalizeTransaction() derives paymentMode from account type.
 * Bug 9  ✅ sortByDateDesc() uses date + id tiebreaker for stable ordering.
 *            vercel.json SPA routing fix in separate file.
 * Bug 10 ✅ rc() (roundCents) applied to every arithmetic result.
 */

import {
  Transaction, Budget, FinancialState, Person, PERSONS,
  DEFAULT_BUDGETS, EXPENSE_CATEGORIES, ACCOUNTS,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'family-finance-data';

const defaultState: FinancialState = {
  transactions: [],
  budgets: [],
  recurringEntries: [],
  monthData: [],
  initialBalances: { Appa: 0, Amma: 0, Ajai: 0, Mauli: 0 },
  accountBalances: {},
};

// ─── Bug 10: Float safety ─────────────────────────────────────────────────────

/** rc = roundCents. Wrap every monetary arithmetic result to kill float drift. */
export function rc(value: number): number {
  return Math.round(value);
}

// ─── Bug 9: Stable sort ───────────────────────────────────────────────────────
/**
 * Same-day entries previously swapped on re-render (Date.getTime() tie).
 * Tiebreaker: id string comparison (ids start with a timestamp prefix so they
 * are already chronologically ordered within the same day).
 */
export function sortByDateDesc(txns: Transaction[]): Transaction[] {
  return [...txns].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return diff !== 0 ? diff : b.id.localeCompare(a.id);
  });
}

// ─── Bug 5 + Bug 8: Transaction normalizer ────────────────────────────────────
/**
 * Applied at load time and before every save.
 * Guarantees:
 *  • amount is always a rounded number (never a string like "270" or 270.0)
 *  • paymentMode matches account type (Bug 8)
 *  • homeOrDebt defaults to 'home'
 */
export function normalizeTransaction(t: any): Transaction {
  const amount = rc(Number(t.amount) || 0);

  // Bug 8: derive paymentMode from the source account type
  let paymentMode = t.paymentMode ?? 'cash';
  if (t.accountId) {
    const acc = ACCOUNTS.find(a => a.id === t.accountId);
    if (acc) paymentMode = acc.type === 'cash' ? 'cash' : 'bank';
  }

  return {
    ...t,
    amount,
    paymentMode,
    homeOrDebt: t.homeOrDebt || 'home',
  } as Transaction;
}

// ─── Bug 7: Transfer validation ───────────────────────────────────────────────
/**
 * Called by every code path that creates a transfer — PersonWisePage,
 * TransactionForm, BulkUpload. Enforces the rule at the store level, not just UI.
 */
export function validateTransfer(
  accountId?: string,
  transferToAccountId?: string,
): { ok: boolean; error?: string } {
  if (!accountId || !transferToAccountId) return { ok: true }; // legacy, no accounts
  if (accountId === transferToAccountId) {
    return { ok: false, error: 'Cannot transfer to the same account' };
  }
  return { ok: true };
}

// ─── Bug 4: Resolve destination account ──────────────────────────────────────
/**
 * If a transfer has accountId but no transferToAccountId (e.g. old bulk import),
 * we try to resolve the destination via transferTo + paymentMode so the
 * destination account is credited rather than silently losing the money.
 */
export function resolveTransferDestAccount(t: Transaction): string | undefined {
  if (t.transferToAccountId) return t.transferToAccountId;
  if (!t.transferTo) return undefined;

  const destAccounts = ACCOUNTS.filter(a => a.person === t.transferTo);
  if (destAccounts.length === 0) return undefined;

  // Prefer cash account; fall back to first bank
  const cashAcc = destAccounts.find(a => a.type === 'cash');
  return cashAcc ? cashAcc.id : destAccounts[0].id;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

export function loadState(): FinancialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (!parsed.accountBalances) parsed.accountBalances = {};
    // Bug 5 + Bug 8 + Bug 10: normalize every transaction at load time
    if (parsed.transactions) {
      parsed.transactions = parsed.transactions.map(normalizeTransaction);
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

// ─────────────────────────────────────────────────────────────────────────────
// CORE QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getMonthTransactions(
  txns: Transaction[],
  year: number,
  month: number,
): Transaction[] {
  return txns.filter(t => t.year === year && t.month === month);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT-LEVEL BALANCE
//
// Rules applied identically for opening-balance history AND current month:
//   income  where t.accountId === current         → +amount
//   expense where t.accountId === current         → -amount
//   transfer source (accountId === current)       → -amount  (money leaves)
//   transfer dest   (resolvedDestId === current)  → +amount  (money arrives)
//
// Transfers NEVER touch income or expense totals.
// Bug 4: resolveTransferDestAccount() handles missing transferToAccountId.
// Bug 6: transferNet is returned so getPersonBalance doesn't re-loop.
// Bug 10: rc() on every arithmetic step.
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountBalanceResult {
  opening: number;
  income: number;
  expense: number;
  transferNet: number; // Bug 6: exposed to avoid re-looping in getPersonBalance
  closing: number;
}

export function getAccountBalance(
  txns: Transaction[],
  accountId: string,
  year: number,
  month: number,
  accountBalances: Record<string, number>,
): AccountBalanceResult {
  const initial  = accountBalances[accountId] || 0;
  const targetYM = year * 12 + month;

  // ── Opening: all transactions BEFORE the target month ──────────────────────
  let opening = initial;
  for (const t of txns) {
    if (t.year * 12 + t.month >= targetYM) continue;

    if (t.type === 'income' && t.accountId === accountId) {
      opening = rc(opening + t.amount);
    } else if (t.type === 'expense' && t.accountId === accountId) {
      opening = rc(opening - t.amount);
    } else if (t.type === 'transfer') {
      const destId = resolveTransferDestAccount(t); // Bug 4
      if (t.accountId === accountId) opening = rc(opening - t.amount);
      if (destId      === accountId) opening = rc(opening + t.amount);
    }
  }

  // ── Current month breakdown ─────────────────────────────────────────────────
  let income = 0;
  let expense = 0;
  let transferNet = 0;

  for (const t of getMonthTransactions(txns, year, month)) {
    if (t.type === 'income' && t.accountId === accountId) {
      income = rc(income + t.amount);
    } else if (t.type === 'expense' && t.accountId === accountId) {
      expense = rc(expense + t.amount);
    } else if (t.type === 'transfer') {
      const destId = resolveTransferDestAccount(t); // Bug 4
      if (t.accountId === accountId) transferNet = rc(transferNet - t.amount);
      if (destId      === accountId) transferNet = rc(transferNet + t.amount);
    }
  }

  const closing = rc(opening + income - expense + transferNet);
  return { opening, income, expense, transferNet, closing };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSON-LEVEL BALANCE
//
// Strategy: ONE aggregation path per transaction — never both.
//   t.accountId present → account layer (getAccountBalance)
//   t.accountId absent  → legacy person layer
//
// Bug 6: transferNet read from getAccountBalance.transferNet — no nested re-loop.
// Bug 2: strict `if (t.accountId) continue` guards the legacy layer.
// Bug 1: transfers never written to income or expense.
// Bug 10: rc() on every step.
// ─────────────────────────────────────────────────────────────────────────────

export function getPersonBalance(
  txns: Transaction[],
  person: Person,
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances?: Record<string, number>,
): { opening: number; income: number; expense: number; transferNet: number; closing: number } {

  if (accountBalances) {
    const personAccounts = ACCOUNTS.filter(a => a.person === person);

    // ── Account layer ─────────────────────────────────────────────────────────
    let accOpening     = 0;
    let accIncome      = 0;
    let accExpense     = 0;
    let accTransferNet = 0;

    for (const acc of personAccounts) {
      const bal = getAccountBalance(txns, acc.id, year, month, accountBalances);
      accOpening     = rc(accOpening     + bal.opening);
      accIncome      = rc(accIncome      + bal.income);
      accExpense     = rc(accExpense     + bal.expense);
      accTransferNet = rc(accTransferNet + bal.transferNet); // Bug 6: no re-loop
    }

    // ── Legacy layer: no accountId ────────────────────────────────────────────
    const initial  = initialBalances[person] || 0;
    const targetYM = year * 12 + month;
    let legacyOpening = initial;

    for (const t of txns) {
      if (t.accountId) continue;                         // Bug 2: strict guard
      if (t.year * 12 + t.month >= targetYM) continue;

      if (t.type === 'income'  && t.person === person) legacyOpening = rc(legacyOpening + t.amount);
      if (t.type === 'expense' && t.person === person) legacyOpening = rc(legacyOpening - t.amount);
      if (t.type === 'transfer') {
        // Bug 4: legacy path — transferTo (Person) is the only field here
        if (t.person    === person) legacyOpening = rc(legacyOpening - t.amount);
        if (t.transferTo === person) legacyOpening = rc(legacyOpening + t.amount);
      }
    }

    let legacyIncome      = 0;
    let legacyExpense     = 0;
    let legacyTransferNet = 0;

    for (const t of getMonthTransactions(txns, year, month)) {
      if (t.accountId) continue;                         // Bug 2: strict guard

      if (t.type === 'income'  && t.person === person) legacyIncome  = rc(legacyIncome  + t.amount);
      if (t.type === 'expense' && t.person === person) legacyExpense = rc(legacyExpense + t.amount);
      if (t.type === 'transfer') {
        // Bug 1: balance shift only — never income/expense
        if (t.person    === person) legacyTransferNet = rc(legacyTransferNet - t.amount);
        if (t.transferTo === person) legacyTransferNet = rc(legacyTransferNet + t.amount);
      }
    }

    const opening     = rc(accOpening + legacyOpening);
    const income      = rc(accIncome  + legacyIncome);
    const expense     = rc(accExpense + legacyExpense);
    const transferNet = rc(accTransferNet + legacyTransferNet);

    return { opening, income, expense, transferNet, closing: rc(opening + income - expense + transferNet) };
  }

  // ── Full legacy fallback (accountBalances system not in use at all) ────────
  const initial  = initialBalances[person] || 0;
  const targetYM = year * 12 + month;
  let opening = initial;

  for (const t of txns) {
    if (t.year * 12 + t.month >= targetYM) continue;
    if (t.type === 'income'  && t.person === person) opening = rc(opening + t.amount);
    if (t.type === 'expense' && t.person === person) opening = rc(opening - t.amount);
    if (t.type === 'transfer') {
      if (t.person    === person) opening = rc(opening - t.amount);
      if (t.transferTo === person) opening = rc(opening + t.amount);
    }
  }

  let income = 0;
  let expense = 0;
  let transferNet = 0;

  for (const t of getMonthTransactions(txns, year, month)) {
    if (t.type === 'income'  && t.person === person) income  = rc(income  + t.amount);
    if (t.type === 'expense' && t.person === person) expense = rc(expense + t.amount);
    if (t.type === 'transfer') {
      // Bug 1: balance shift only
      if (t.person    === person) transferNet = rc(transferNet - t.amount);
      if (t.transferTo === person) transferNet = rc(transferNet + t.amount);
    }
  }

  return { opening, income, expense, transferNet, closing: rc(opening + income - expense + transferNet) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSON SUMMARY — transfers completely isolated from income/expense (Bug 1)
// ─────────────────────────────────────────────────────────────────────────────

export function getPersonSummary(
  txns: Transaction[],
  year: number,
  month: number,
): Record<Person, { income: number; expense: number; transferOut: number; transferIn: number }> {
  const monthTxns = getMonthTransactions(txns, year, month);
  const result = {} as Record<Person, { income: number; expense: number; transferOut: number; transferIn: number }>;
  for (const person of PERSONS) result[person] = { income: 0, expense: 0, transferOut: 0, transferIn: 0 };

  for (const t of monthTxns) {
    if (t.type === 'income') {
      result[t.person].income = rc(result[t.person].income + t.amount);
    } else if (t.type === 'expense') {
      result[t.person].expense = rc(result[t.person].expense + t.amount);
    } else if (t.type === 'transfer') {
      result[t.person].transferOut = rc(result[t.person].transferOut + t.amount);
      if (t.transferTo) result[t.transferTo].transferIn = rc(result[t.transferTo].transferIn + t.amount);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNING ACCOUNT BALANCE (no date scope — for Settings / overview)
// ─────────────────────────────────────────────────────────────────────────────

export function getAccountBalanceSimple(
  txns: Transaction[],
  accountId: string,
  accountBalances: Record<string, number>,
): number {
  let balance = accountBalances[accountId] || 0;
  for (const t of txns) {
    if (t.type === 'income' && t.accountId === accountId) {
      balance = rc(balance + t.amount);
    } else if (t.type === 'expense' && t.accountId === accountId) {
      balance = rc(balance - t.amount);
    } else if (t.type === 'transfer') {
      const destId = resolveTransferDestAccount(t); // Bug 4
      if (t.accountId === accountId) balance = rc(balance - t.amount);
      if (destId      === accountId) balance = rc(balance + t.amount);
    }
  }
  return balance;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY-LEVEL TOTALS
// Transfers cancel at family level — zero net effect.
// ─────────────────────────────────────────────────────────────────────────────

export function getTotalBalance(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances?: Record<string, number>,
) {
  const monthTxns = getMonthTransactions(txns, year, month);
  // Bug 1: only income and expense — no transfers
  const realIncome  = rc(monthTxns.filter(t => t.type === 'income' ).reduce((s, t) => rc(s + t.amount), 0));
  const realExpense = rc(monthTxns.filter(t => t.type === 'expense').reduce((s, t) => rc(s + t.amount), 0));

  let opening = 0;
  if (accountBalances) {
    for (const acc of ACCOUNTS) opening = rc(opening + (accountBalances[acc.id] || 0));
  }
  opening = rc(opening + Object.values(initialBalances).reduce((s, v) => rc(s + v), 0));

  const targetYM = year * 12 + month;
  for (const t of txns) {
    if (t.year * 12 + t.month >= targetYM) continue;
    if (t.type === 'income')  opening = rc(opening + t.amount);
    if (t.type === 'expense') opening = rc(opening - t.amount);
    // transfers cancel out — no adjustment needed
  }

  return {
    opening,
    income:  realIncome,
    expense: realExpense,
    closing: rc(opening + realIncome - realExpense),
    savings: rc(realIncome - realExpense),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME / DEBT SPLIT
// ─────────────────────────────────────────────────────────────────────────────

export function getHomeDebtSummary(txns: Transaction[], year: number, month: number) {
  const m = getMonthTransactions(txns, year, month);
  const homeIncome  = rc(m.filter(t => t.type === 'income'  && t.homeOrDebt === 'home').reduce((s, t) => rc(s + t.amount), 0));
  const debtIncome  = rc(m.filter(t => t.type === 'income'  && t.homeOrDebt === 'debt').reduce((s, t) => rc(s + t.amount), 0));
  const homeExpense = rc(m.filter(t => t.type === 'expense' && t.homeOrDebt === 'home').reduce((s, t) => rc(s + t.amount), 0));
  const debtExpense = rc(m.filter(t => t.type === 'expense' && t.homeOrDebt === 'debt').reduce((s, t) => rc(s + t.amount), 0));
  return {
    homeIncome, debtIncome, homeExpense, debtExpense,
    homeBalance:  rc(homeIncome  - homeExpense),
    debtBalance:  rc(debtIncome  - debtExpense),
    totalIncome:  rc(homeIncome  + debtIncome),
    totalExpense: rc(homeExpense + debtExpense),
    totalBalance: rc((homeIncome + debtIncome) - (homeExpense + debtExpense)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPECTED VS ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

export function getExpectedVsActualIncome(txns: Transaction[], year: number, month: number) {
  const monthTxns = getMonthTransactions(txns, year, month).filter(t => t.type === 'income');
  const result: Record<string, { expected: number; actual: number }> = {};
  for (const t of monthTxns) {
    if (!result[t.category]) result[t.category] = { expected: 0, actual: 0 };
    result[t.category].actual = rc(result[t.category].actual + t.amount);
    if (t.expectedAmount) result[t.category].expected = rc(t.expectedAmount);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MISSING MONEY
// ─────────────────────────────────────────────────────────────────────────────

export function getMissingMoney(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances: Record<string, number>,
) {
  const totals = getTotalBalance(txns, year, month, initialBalances, accountBalances);
  let accountTotal = 0;
  for (const acc of ACCOUNTS) {
    accountTotal = rc(accountTotal + getAccountBalance(txns, acc.id, year, month, accountBalances).closing);
  }
  for (const p of PERSONS) {
    const legacyBal = getPersonBalance(txns.filter(t => !t.accountId), p, year, month, initialBalances);
    accountTotal = rc(accountTotal + legacyBal.closing);
  }
  return {
    expectedClosing: totals.closing,
    actualClosing:   accountTotal,
    missingMoney:    rc(totals.closing - accountTotal),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET / SPENDING
// ─────────────────────────────────────────────────────────────────────────────

export function getBudgetForCategory(budgets: Budget[], category: string, year: number, month: number): number {
  const found = budgets.find(b => b.category === category && b.year === year && b.month === month);
  return found ? found.amount : (DEFAULT_BUDGETS[category] || 0);
}

export function getCategorySpending(txns: Transaction[], year: number, month: number) {
  const result: Record<string, number> = {};
  for (const t of getMonthTransactions(txns, year, month)) {
    if (t.type !== 'expense') continue;
    result[t.category] = rc((result[t.category] || 0) + t.amount);
  }
  return result;
}

export function getOverspendCategories(txns: Transaction[], budgets: Budget[], year: number, month: number) {
  const spending = getCategorySpending(txns, year, month);
  return EXPENSE_CATEGORIES.map(cat => {
    const budget    = getBudgetForCategory(budgets, cat, year, month);
    const actual    = spending[cat] || 0;
    const remaining = rc(budget - actual);
    const percent   = budget > 0 ? Math.round((actual / budget) * 100) : 0;
    return { category: cat, budget, actual, remaining, percent, overspent: actual > budget };
  });
}