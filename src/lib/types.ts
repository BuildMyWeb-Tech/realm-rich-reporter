export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMode = 'cash' | 'bank';
export type Person = 'Appa' | 'Amma' | 'Ajai' | 'Mauli';

export const PERSONS: Person[] = ['Appa', 'Amma', 'Ajai', 'Mauli'];

export const INCOME_CATEGORIES = [
  'Appa Salary', 'Ajai Salary', 'Vaati', 'Allowance', 'Govt Ration',
  'Extra Income - Ajai', 'Extra Income - Appa', 'Extra Income - Home',
  'Debt Income', 'Other Income',
] as const;

export const EXPENSE_CATEGORIES = [
  'Rent', 'Milk', 'Rice', 'Cylinder', 'EB',
  'Mangal', 'Medicine', 'Vegetables', 'Grocery', 'Snacks',
  'Petrol', 'Cable', 'Recharge', 'Hotel/Food', 'Non Veg',
  'Ration', 'Maavu', 'Others',
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

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
  initialBalances: Record<Person, number>;
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
