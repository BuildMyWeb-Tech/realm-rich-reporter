export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMode = 'cash' | 'bank';
export type Person = 'Appa' | 'Amma' | 'Ajai' | 'Mauli';
export type HomeOrDebt = 'home' | 'debt';

export const PERSONS: Person[] = ['Appa', 'Amma', 'Ajai', 'Mauli'];

// Account system: each person can have multiple accounts (cash + bank accounts)
export interface Account {
  id: string; // e.g. "appa-cash", "ajai-cnb"
  person: Person;
  name: string; // display name e.g. "Appa Cash", "Ajai CNB"
  type: 'cash' | 'bank';
}

export const ACCOUNTS: Account[] = [
  // Appa
  { id: 'appa-cash', person: 'Appa', name: 'Appa Cash', type: 'cash' },
  { id: 'appa-sbi', person: 'Appa', name: 'Appa SBI', type: 'bank' },
  { id: 'appa-cnb', person: 'Appa', name: 'Appa CNB', type: 'bank' },
  // Amma
  { id: 'amma-cash', person: 'Amma', name: 'Amma Cash', type: 'cash' },
  // Ajai
  { id: 'ajai-cash', person: 'Ajai', name: 'Ajai Cash', type: 'cash' },
  { id: 'ajai-cb', person: 'Ajai', name: 'Ajai CB', type: 'bank' },
  { id: 'ajai-cnb', person: 'Ajai', name: 'Ajai CNB', type: 'bank' },
  { id: 'ajai-pnb', person: 'Ajai', name: 'Ajai PNB', type: 'bank' },
  // Shared
  { id: 'appa-ajai-sbi', person: 'Appa', name: 'Appa Ajai SBI', type: 'bank' },
  // Mauli
  { id: 'mauli-cash', person: 'Mauli', name: 'Mauli Cash', type: 'cash' },
  { id: 'mauli-sbi', person: 'Mauli', name: 'Mauli SBI', type: 'bank' },
  { id: 'mauli-cnb', person: 'Mauli', name: 'Mauli CNB', type: 'bank' },
];

export function getAccountsForPerson(person: Person): Account[] {
  return ACCOUNTS.filter(a => a.person === person);
}

export function getCashAccounts(): Account[] {
  return ACCOUNTS.filter(a => a.type === 'cash');
}

export function getBankAccounts(): Account[] {
  return ACCOUNTS.filter(a => a.type === 'bank');
}

// ── INCOME CATEGORY GROUPS ─────────────────────────────────────────────────

/** Home income sources — regular/recurring household income */
export const HOME_INCOME_CATEGORIES = [
  'Appa Salary',
  'Ajai Salary',
  'Vaati',
  'Allowance',
  'Govt Ration Income',
  'Ration Income',
  'Mill SVRM Mann.',
] as const;

/** Debt / extra income sources */
export const DEBT_INCOME_CATEGORIES = [
  'Ajai Extra',
  'Appa Extra Earnings',
  'Home Extra',
  'BMW',
  'Extra Income - Ajai',
  'Extra Income - Appa',
  'Extra Income - Home',
] as const;

/** Combined list for dropdowns — home first, then debt */
export const INCOME_CATEGORIES = [
  ...HOME_INCOME_CATEGORIES,
  ...DEBT_INCOME_CATEGORIES,
] as const;

export const EXPENSE_CATEGORIES = [
  'Rent', 'Milk', 'Rice', 'Cylinder', 'EB',
  'Mangal', 'Medicine', 'Vegetables', 'Grocery', 'Snacks',
  'Petrol', 'Cable', 'Recharge', 'Hotel/Food', 'Non Veg',
  'Ration', 'Maavu', 'Others',
] as const;

export const DEBT_EXPENSE_CATEGORIES = [
  'Loan Repaid', 'Appa Ayyapan Kovil', 'Kannan Mama', 'Rajana Athai',
  'Other Debt Expense',
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// ── SETTINGS: CRUD for income/expense sources ──────────────────────────────

export interface IncomeSource {
  id: string;
  name: string;
  group: 'home' | 'debt';
  defaultExpected: number;
}

export interface ExpenseSource {
  id: string;
  name: string;
  group: 'home' | 'debt';
  defaultBudget: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  year: number;
  month: number; // 0-11
  person: Person;
  type: TransactionType;
  category: string;
  amount: number;
  paymentMode: PaymentMode;
  notes: string;
  transferTo?: Person;
  accountId?: string; // which account the money comes from/goes to
  transferToAccountId?: string; // for transfers: destination account
  homeOrDebt: HomeOrDebt; // home or debt classification
  expectedAmount?: number; // expected/budget amount for this entry
}

export interface Budget {
  category: string;
  amount: number;
  month: number;
  year: number;
}

export interface RecurringEntry {
  id: string;
  person: Person;
  type: TransactionType;
  category: string;
  amount: number;
  paymentMode: PaymentMode;
  notes: string;
  dayOfMonth: number;
  transferTo?: Person;
  homeOrDebt?: HomeOrDebt;
  accountId?: string;
}

export interface MonthData {
  year: number;
  month: number;
  openingBalance: number;
}

export interface FinancialState {
  transactions: Transaction[];
  budgets: Budget[];
  recurringEntries: RecurringEntry[];
  monthData: MonthData[];
  accountBalances: Record<string, number>; // accountId -> opening balance
  // Keep legacy for backward compat
  initialBalances: Record<Person, number>;
  // Custom sources (CRUD via Settings)
  incomeSources?: IncomeSource[];
  expenseSources?: ExpenseSource[];
  // Custom account display names
  accountNames?: Record<string, string>; // accountId -> custom display name
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DEFAULT_BUDGETS: Record<string, number> = {
  'Rent': 5000, 'Milk': 2000, 'Rice': 1500, 'Cylinder': 1000, 'EB': 1000,
  'Mangal': 500, 'Medicine': 1500, 'Vegetables': 3000, 'Grocery': 3000,
  'Snacks': 1000, 'Petrol': 2000, 'Cable': 500, 'Recharge': 1000,
  'Hotel/Food': 2000, 'Non Veg': 1500, 'Ration': 1000, 'Maavu': 500, 'Others': 2000,
};

// Expected income amounts (default)
export const DEFAULT_EXPECTED_INCOME: Record<string, number> = {
  'Appa Salary': 10000,
  'Ajai Salary': 15000,
  'Vaati': 2500,
  'Allowance': 2500,
  'Govt Ration Income': 1000,
  'Ration Income': 380,
  'Mill SVRM Mann.': 150,
  'Ajai Extra': 15000,
  'Appa Extra Earnings': 0,
  'Home Extra': 0,
  'BMW': 5000,
  'Extra Income - Ajai': 0,
  'Extra Income - Appa': 0,
  'Extra Income - Home': 0,
  'Debt Income': 0,
  'Other Income': 0,
};

// Expected debt expense amounts (default)
export const DEFAULT_EXPECTED_DEBT_EXPENSE: Record<string, number> = {
  'Loan Repaid': 12500,
  'Appa Ayyapan Kovil': 0,
  'Kannan Mama': 5000,
  'Rajana Athai': 500,
};