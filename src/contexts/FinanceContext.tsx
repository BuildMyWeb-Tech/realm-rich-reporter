/**
 * FinanceContext.tsx — UPGRADED with Supabase sync
 *
 * Changes from original:
 * - loadState() → loads from Supabase on mount, falls back to localStorage
 * - Every mutation also writes to Supabase in the background
 * - localStorage is still updated (offline fallback)
 * - Added `isLoading` and `isSyncing` flags for UI feedback
 * - Added `migrateData` for one-time localStorage → Supabase migration
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Transaction, Budget, RecurringEntry, FinancialState, Person } from '@/lib/types';
import { generateId } from '@/lib/financial-store';
import {
  loadLocalState,
  saveLocalState,
  loadFromSupabase,
  saveTransaction,
  deleteTransactionFromDB,
  saveBudget,
  saveRecurring,
  deleteRecurringFromDB,
  saveConfig,
  migrateLocalToSupabase,
} from '@/lib/supabase-store';

interface FinanceContextType {
  state: FinancialState;
  isLoading: boolean;
  isSyncing: boolean;
  addTransaction: (txn: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (txn: Transaction) => Promise<void>;
  setBudget: (category: string, amount: number, year: number, month: number) => Promise<void>;
  addRecurring: (entry: Omit<RecurringEntry, 'id'>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  setInitialBalance: (person: Person, amount: number) => Promise<void>;
  setAccountBalance: (accountId: string, amount: number) => Promise<void>;
  migrateData: () => Promise<{ success: boolean; message: string }>;
  refreshFromCloud: () => Promise<void>;
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (y: number) => void;
  setSelectedMonth: (m: number) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  // Start with local state immediately (no flash of empty)
  const [state, setState] = useState<FinancialState>(loadLocalState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // On mount — load fresh data from Supabase
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const cloudState = await loadFromSupabase();
      setState(cloudState);
      setIsLoading(false);
    })();
  }, []);

  // Keep localStorage in sync as a cache
  useEffect(() => {
    if (!isLoading) saveLocalState(state);
  }, [state, isLoading]);

  // ─── TRANSACTIONS ──────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (txn: Omit<Transaction, 'id'>) => {
    const newTxn: Transaction = { ...txn, id: generateId() };
    // Update local immediately
    setState(s => ({ ...s, transactions: [...s.transactions, newTxn] }));
    // Sync to cloud in background
    setIsSyncing(true);
    await saveTransaction(newTxn);
    setIsSyncing(false);
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
    setIsSyncing(true);
    await deleteTransactionFromDB(id);
    setIsSyncing(false);
  }, []);

  const updateTransaction = useCallback(async (txn: Transaction) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t => t.id === txn.id ? txn : t),
    }));
    setIsSyncing(true);
    await saveTransaction(txn);
    setIsSyncing(false);
  }, []);

  // ─── BUDGETS ───────────────────────────────────────────────────────────────

  const setBudget = useCallback(async (category: string, amount: number, year: number, month: number) => {
    setState(s => {
      const existing = s.budgets.findIndex(b => b.category === category && b.year === year && b.month === month);
      const budgets = [...s.budgets];
      if (existing >= 0) budgets[existing] = { category, amount, year, month };
      else budgets.push({ category, amount, year, month });
      return { ...s, budgets };
    });
    setIsSyncing(true);
    await saveBudget({ category, amount, year, month });
    setIsSyncing(false);
  }, []);

  // ─── RECURRING ────────────────────────────────────────────────────────────

  const addRecurring = useCallback(async (entry: Omit<RecurringEntry, 'id'>) => {
    const newEntry: RecurringEntry = { ...entry, id: generateId() };
    setState(s => ({ ...s, recurringEntries: [...s.recurringEntries, newEntry] }));
    setIsSyncing(true);
    await saveRecurring(newEntry);
    setIsSyncing(false);
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    setState(s => ({ ...s, recurringEntries: s.recurringEntries.filter(r => r.id !== id) }));
    setIsSyncing(true);
    await deleteRecurringFromDB(id);
    setIsSyncing(false);
  }, []);

  // ─── BALANCES ─────────────────────────────────────────────────────────────

  const setInitialBalance = useCallback(async (person: Person, amount: number) => {
    setState(s => {
      const updated = { ...s, initialBalances: { ...s.initialBalances, [person]: amount } };
      saveConfig('initialBalances', updated.initialBalances);
      return updated;
    });
  }, []);

  const setAccountBalance = useCallback(async (accountId: string, amount: number) => {
    setState(s => {
      const updated = { ...s, accountBalances: { ...s.accountBalances, [accountId]: amount } };
      saveConfig('accountBalances', updated.accountBalances);
      return updated;
    });
  }, []);

  // ─── MIGRATION & REFRESH ──────────────────────────────────────────────────

  const migrateData = useCallback(async () => {
    return await migrateLocalToSupabase();
  }, []);

  const refreshFromCloud = useCallback(async () => {
    setIsLoading(true);
    const cloudState = await loadFromSupabase();
    setState(cloudState);
    setIsLoading(false);
  }, []);

  return (
    <FinanceContext.Provider value={{
      state, isLoading, isSyncing,
      addTransaction, deleteTransaction, updateTransaction,
      setBudget, addRecurring, deleteRecurring,
      setInitialBalance, setAccountBalance,
      migrateData, refreshFromCloud,
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