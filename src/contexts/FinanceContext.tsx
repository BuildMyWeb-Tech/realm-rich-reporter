import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Transaction, Budget, RecurringEntry, FinancialState, Person, IncomeSource, ExpenseSource } from '@/lib/types';
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

export interface MissingMoneyEntry {
  date: string; // YYYY-MM-DD
  amount: number;
}

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
  // Settings CRUD — persists to state + localStorage + Supabase
  setIncomeSources: (sources: IncomeSource[]) => Promise<void>;
  setExpenseSources: (sources: ExpenseSource[]) => Promise<void>;
  setAccountNames: (names: Record<string, string>) => Promise<void>;
  // Missing money log
  missingMoneyLog: MissingMoneyEntry[];
  logMissingMoney: (date: string, amount: number) => void;
  migrateData: () => Promise<{ success: boolean; message: string }>;
  refreshFromCloud: () => Promise<void>;
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (y: number) => void;
  setSelectedMonth: (m: number) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

// Missing money log is stored separately in localStorage
const MISSING_LOG_KEY = 'family-finance-missing-log';

function loadMissingLog(): MissingMoneyEntry[] {
  try {
    const raw = localStorage.getItem(MISSING_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMissingLog(log: MissingMoneyEntry[]) {
  localStorage.setItem(MISSING_LOG_KEY, JSON.stringify(log));
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinancialState>(loadLocalState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [missingMoneyLog, setMissingMoneyLog] = useState<MissingMoneyEntry[]>(loadMissingLog);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const cloudState = await loadFromSupabase();
      setState(cloudState);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!isLoading) saveLocalState(state);
  }, [state, isLoading]);

  // ─── TRANSACTIONS ──────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (txn: Omit<Transaction, 'id'>) => {
    const newTxn: Transaction = { ...txn, id: generateId() };
    setState(s => ({ ...s, transactions: [...s.transactions, newTxn] }));
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

  // ─── SETTINGS CRUD ────────────────────────────────────────────────────────
  // These write directly to state so all pages pick up changes without refresh

  const setIncomeSources = useCallback(async (sources: IncomeSource[]) => {
    setState(s => {
      const updated = { ...s, incomeSources: sources };
      saveConfig('incomeSources', sources);
      return updated;
    });
  }, []);

  const setExpenseSources = useCallback(async (sources: ExpenseSource[]) => {
    setState(s => {
      const updated = { ...s, expenseSources: sources };
      saveConfig('expenseSources', sources);
      return updated;
    });
  }, []);

  const setAccountNames = useCallback(async (names: Record<string, string>) => {
    setState(s => {
      const updated = { ...s, accountNames: names };
      saveConfig('accountNames', names);
      return updated;
    });
  }, []);

  // ─── MISSING MONEY LOG ────────────────────────────────────────────────────

  const logMissingMoney = useCallback((date: string, amount: number) => {
    setMissingMoneyLog(prev => {
      // Update or insert entry for this date
      const existing = prev.findIndex(e => e.date === date);
      let updated: MissingMoneyEntry[];
      if (amount === 0) {
        // Remove zero entries
        updated = prev.filter(e => e.date !== date);
      } else if (existing >= 0) {
        updated = prev.map(e => e.date === date ? { date, amount } : e);
      } else {
        updated = [...prev, { date, amount }].sort((a, b) => a.date.localeCompare(b.date));
      }
      saveMissingLog(updated);
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
      setIncomeSources, setExpenseSources, setAccountNames,
      missingMoneyLog, logMissingMoney,
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