import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Transaction, Budget, RecurringEntry, FinancialState, Person } from '@/lib/types';
import { loadState, saveState, generateId } from '@/lib/financial-store';

interface FinanceContextType {
  state: FinancialState;
  addTransaction: (txn: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (txn: Transaction) => void;
  setBudget: (category: string, amount: number, year: number, month: number) => void;
  addRecurring: (entry: Omit<RecurringEntry, 'id'>) => void;
  deleteRecurring: (id: string) => void;
  setInitialBalance: (person: Person, amount: number) => void;
  setAccountBalance: (accountId: string, amount: number) => void;
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (y: number) => void;
  setSelectedMonth: (m: number) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinancialState>(loadState);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  useEffect(() => { saveState(state); }, [state]);

  const addTransaction = useCallback((txn: Omit<Transaction, 'id'>) => {
    setState(s => ({ ...s, transactions: [...s.transactions, { ...txn, id: generateId() }] }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
  }, []);

  const updateTransaction = useCallback((txn: Transaction) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t => t.id === txn.id ? txn : t),
    }));
  }, []);

  const setBudget = useCallback((category: string, amount: number, year: number, month: number) => {
    setState(s => {
      const existing = s.budgets.findIndex(b => b.category === category && b.year === year && b.month === month);
      const budgets = [...s.budgets];
      if (existing >= 0) budgets[existing] = { category, amount, year, month };
      else budgets.push({ category, amount, year, month });
      return { ...s, budgets };
    });
  }, []);

  const addRecurring = useCallback((entry: Omit<RecurringEntry, 'id'>) => {
    setState(s => ({ ...s, recurringEntries: [...s.recurringEntries, { ...entry, id: generateId() }] }));
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    setState(s => ({ ...s, recurringEntries: s.recurringEntries.filter(r => r.id !== id) }));
  }, []);

  const setInitialBalance = useCallback((person: Person, amount: number) => {
    setState(s => ({ ...s, initialBalances: { ...s.initialBalances, [person]: amount } }));
  }, []);

  const setAccountBalance = useCallback((accountId: string, amount: number) => {
    setState(s => ({ ...s, accountBalances: { ...s.accountBalances, [accountId]: amount } }));
  }, []);

  return (
    <FinanceContext.Provider value={{
      state, addTransaction, deleteTransaction, updateTransaction,
      setBudget, addRecurring, deleteRecurring, setInitialBalance, setAccountBalance,
      selectedYear, selectedMonth, setSelectedYear, setSelectedMonth,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
