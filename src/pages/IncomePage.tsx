import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import {
  INCOME_CATEGORIES,
  DEBT_EXPENSE_CATEGORIES,
  DEFAULT_EXPECTED_INCOME,
  DEFAULT_EXPECTED_DEBT_EXPENSE,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Pencil, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

// We store expected overrides in local state (per session) — can be persisted via setBudget if needed
type ExpectedMap = Record<string, number>;

function IncomeRow({
  category,
  expected,
  actual,
  onEditExpected,
}: {
  category: string;
  expected: number;
  actual: number;
  onEditExpected: (cat: string, val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(expected));
  const balance = expected - actual;

  const save = () => {
    const n = Number(val);
    if (!isNaN(n) && n >= 0) {
      onEditExpected(category, n);
      toast.success(`Expected updated for ${category}`);
    }
    setEditing(false);
  };

  return (
    <div className={cn(
      'flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs',
      actual === 0 ? 'opacity-60' : '',
      actual > expected && expected > 0 ? 'bg-success/5' : '',
    )}>
      {/* Category */}
      <span className="flex-1 font-medium text-foreground truncate">{category}</span>

      {/* Expected */}
      <div className="w-24 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <Input
              type="number"
              className="h-6 w-20 text-xs px-1"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
            />
            <button onClick={save} className="text-success"><Check className="h-3 w-3" /></button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 justify-end w-full hover:text-primary group"
            onClick={() => { setVal(String(expected)); setEditing(true); }}
          >
            <span className="text-muted-foreground">₹{expected.toLocaleString('en-IN')}</span>
            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
          </button>
        )}
      </div>

      {/* Actual */}
      <span className={cn(
        'w-20 text-right font-semibold',
        actual > 0 ? 'text-success' : 'text-muted-foreground'
      )}>
        ₹{actual.toLocaleString('en-IN')}
      </span>

      {/* Balance */}
      <span className={cn(
        'w-20 text-right font-bold',
        balance > 0 ? 'text-warning' : balance < 0 ? 'text-success' : 'text-muted-foreground'
      )}>
        {balance >= 0 ? '-' : '+'}₹{Math.abs(balance).toLocaleString('en-IN')}
      </span>
    </div>
  );
}

export default function IncomePage() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const [expectedOverrides, setExpectedOverrides] = useState<ExpectedMap>({});

  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const getExpected = (cat: string, defaults: Record<string, number>) => {
    if (cat in expectedOverrides) return expectedOverrides[cat];
    return defaults[cat] ?? 0;
  };

  const handleEditExpected = (cat: string, val: number) => {
    setExpectedOverrides(m => ({ ...m, [cat]: val }));
  };

  // ── HOME INCOME ──────────────────────────────────────────────
  const homeIncomeCategories = INCOME_CATEGORIES.filter(c => c !== 'Debt Income');
  const homeActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) {
      if (t.type === 'income' && t.homeOrDebt === 'home') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    }
    return map;
  }, [monthTxns]);

  const homeTotalExpected = homeIncomeCategories.reduce((s, c) => s + getExpected(c, DEFAULT_EXPECTED_INCOME), 0);
  const homeTotalActual = homeIncomeCategories.reduce((s, c) => s + (homeActuals[c] || 0), 0);
  const homeTotalBalance = homeTotalExpected - homeTotalActual;

  // ── DEBT INCOME ──────────────────────────────────────────────
  const debtActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) {
      if (t.type === 'income' && t.homeOrDebt === 'debt') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    }
    return map;
  }, [monthTxns]);

  const debtIncomeCategories = ['Debt Income'];
  const debtTotalExpected = debtIncomeCategories.reduce((s, c) => s + getExpected(c, DEFAULT_EXPECTED_INCOME), 0);
  const debtTotalActual = debtIncomeCategories.reduce((s, c) => s + (debtActuals[c] || 0), 0);
  const debtTotalBalance = debtTotalExpected - debtTotalActual;

  // Also count any income txns tagged as debt
  const extraDebtIncome = monthTxns
    .filter(t => t.type === 'income' && t.homeOrDebt === 'debt' && !debtIncomeCategories.includes(t.category))
    .reduce((s, t) => s + t.amount, 0);

  const overallExpected = homeTotalExpected + debtTotalExpected;
  const overallActual = homeTotalActual + debtTotalActual + extraDebtIncome;
  const overallBalance = overallExpected - overallActual;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const TableHeader = () => (
    <div className="flex items-center gap-2 py-2 px-3 text-xs font-semibold text-muted-foreground border-b border-border/40 mb-1">
      <span className="flex-1">Source</span>
      <span className="w-24 text-right">Expected</span>
      <span className="w-20 text-right">Actual</span>
      <span className="w-20 text-right">Balance</span>
    </div>
  );

  const SectionTotal = ({ label, expected, actual, balance, color }: {
    label: string; expected: number; actual: number; balance: number; color: string;
  }) => (
    <div className={cn('flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold mt-1', color)}>
      <span className="flex-1">{label}</span>
      <span className="w-24 text-right">{fmt(expected)}</span>
      <span className="w-20 text-right">{fmt(actual)}</span>
      <span className="w-20 text-right">{balance >= 0 ? '-' : '+'}{fmt(Math.abs(balance))}</span>
    </div>
  );

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Income</h1>
        <MonthSelector />
      </div>

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Expected</p>
          <p className="text-sm font-bold text-foreground">{fmt(overallExpected)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Actual</p>
          <p className="text-sm font-bold text-success">{fmt(overallActual)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className={cn('text-sm font-bold', overallBalance > 0 ? 'text-warning' : 'text-success')}>
            {overallBalance >= 0 ? '-' : '+'}{fmt(Math.abs(overallBalance))}
          </p>
        </div>
      </div>

      {/* HOME INCOME */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-success/15 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Home Income</h2>
        </div>
        <TableHeader />
        {homeIncomeCategories.map(cat => (
          <IncomeRow
            key={cat}
            category={cat}
            expected={getExpected(cat, DEFAULT_EXPECTED_INCOME)}
            actual={homeActuals[cat] || 0}
            onEditExpected={handleEditExpected}
          />
        ))}
        <SectionTotal
          label="Total Home Income"
          expected={homeTotalExpected}
          actual={homeTotalActual}
          balance={homeTotalBalance}
          color="bg-success/10 text-success"
        />
      </div>

      {/* DEBT INCOME */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-warning/15 flex items-center justify-center">
            <TrendingDown className="h-3.5 w-3.5 text-warning" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Debt Income</h2>
        </div>
        <TableHeader />
        {debtIncomeCategories.map(cat => (
          <IncomeRow
            key={cat}
            category={cat}
            expected={getExpected(cat, DEFAULT_EXPECTED_INCOME)}
            actual={(debtActuals[cat] || 0) + extraDebtIncome}
            onEditExpected={handleEditExpected}
          />
        ))}
        <SectionTotal
          label="Total Debt Income"
          expected={debtTotalExpected}
          actual={debtTotalActual + extraDebtIncome}
          balance={debtTotalBalance - extraDebtIncome}
          color="bg-warning/10 text-warning"
        />
      </div>

      {/* OVERALL TOTAL */}
      <div className="glass-card rounded-xl p-4 border border-primary/20">
        <h2 className="text-sm font-semibold text-primary mb-3">Overall Income Total</h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Expected</span>
            <span className="font-semibold">{fmt(overallExpected)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Actual</span>
            <span className="font-semibold text-success">{fmt(overallActual)}</span>
          </div>
          <div className="flex justify-between border-t border-border/40 pt-2">
            <span className="font-bold text-sm text-foreground">Balance</span>
            <span className={cn('font-bold text-sm', overallBalance > 0 ? 'text-warning' : 'text-success')}>
              {overallBalance >= 0 ? 'Short by ' : 'Extra '}{fmt(Math.abs(overallBalance))}
            </span>
          </div>
        </div>
      </div>

      <TransactionForm />
    </div>
  );
}