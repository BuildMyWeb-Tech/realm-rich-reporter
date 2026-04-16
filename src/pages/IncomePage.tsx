import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import { HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES, DEFAULT_EXPECTED_INCOME } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Pencil, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

type ExpectedMap = Record<string, number>;

function IncomeRow({ category, expected, actual, onEditExpected }: {
  category: string; expected: number; actual: number;
  onEditExpected: (cat: string, val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(expected));
  const balance = expected - actual;
  const save = () => {
    const n = Number(val);
    if (!isNaN(n) && n >= 0) { onEditExpected(category, n); toast.success(`Expected updated for ${category}`); }
    setEditing(false);
  };
  return (
    <div className={cn('flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs', actual === 0 ? 'opacity-60' : '')}>
      <span className="flex-1 font-medium text-foreground truncate min-w-0">{category}</span>
      <div className="w-24 text-right shrink-0">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <Input type="number" className="h-6 w-20 text-xs px-1" value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus />
            <button onClick={save} className="text-success"><Check className="h-3 w-3" /></button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button className="flex items-center gap-1 justify-end w-full hover:text-primary group"
            onClick={() => { setVal(String(expected)); setEditing(true); }}>
            <span className="text-muted-foreground">₹{expected.toLocaleString('en-IN')}</span>
            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
          </button>
        )}
      </div>
      <span className={cn('w-20 text-right font-semibold shrink-0', actual > 0 ? 'text-success' : 'text-muted-foreground')}>
        ₹{actual.toLocaleString('en-IN')}
      </span>
      <span className={cn('w-20 text-right font-bold shrink-0', balance > 0 ? 'text-warning' : balance < 0 ? 'text-success' : 'text-muted-foreground')}>
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

  const customIncome = state.incomeSources || [];
  const customHome = customIncome.filter(s => s.group === 'home');
  const customDebt = customIncome.filter(s => s.group === 'debt');
  const homeCategories = [...HOME_INCOME_CATEGORIES, ...customHome.map(s => s.name)];
  const debtCategories = [...DEBT_INCOME_CATEGORIES, ...customDebt.map(s => s.name)];

  const defaultExpected = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_EXPECTED_INCOME };
    for (const s of customIncome) map[s.name] = s.defaultExpected;
    return map;
  }, [customIncome]);

  const getExpected = (cat: string) => cat in expectedOverrides ? expectedOverrides[cat] : (defaultExpected[cat] ?? 0);
  const handleEditExpected = (cat: string, val: number) => setExpectedOverrides(m => ({ ...m, [cat]: val }));

  const homeActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) if (t.type === 'income' && t.homeOrDebt === 'home') map[t.category] = (map[t.category] || 0) + t.amount;
    return map;
  }, [monthTxns]);

  const debtActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) if (t.type === 'income' && t.homeOrDebt === 'debt') map[t.category] = (map[t.category] || 0) + t.amount;
    return map;
  }, [monthTxns]);

  const homeTotalExpected = homeCategories.reduce((s, c) => s + getExpected(c), 0);
  const homeTotalActual = homeCategories.reduce((s, c) => s + (homeActuals[c] || 0), 0);
  const debtTotalExpected = debtCategories.reduce((s, c) => s + getExpected(c), 0);
  const debtTotalActual = debtCategories.reduce((s, c) => s + (debtActuals[c] || 0), 0);
  const overallExpected = homeTotalExpected + debtTotalExpected;
  const overallActual = homeTotalActual + debtTotalActual;
  const overallBalance = overallExpected - overallActual;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const TableHeader = () => (
    <div className="flex items-center gap-2 py-2 px-3 text-xs font-semibold text-muted-foreground border-b border-border/40 mb-1">
      <span className="flex-1 min-w-0">Source</span>
      <span className="w-24 text-right shrink-0">Expected</span>
      <span className="w-20 text-right shrink-0">Actual</span>
      <span className="w-20 text-right shrink-0">Balance</span>
    </div>
  );

  const SectionTotal = ({ label, expected, actual, balance, color }: { label: string; expected: number; actual: number; balance: number; color: string }) => (
    <div className={cn('flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold mt-1', color)}>
      <span className="flex-1 min-w-0">{label}</span>
      <span className="w-24 text-right shrink-0">{fmt(expected)}</span>
      <span className="w-20 text-right shrink-0">{fmt(actual)}</span>
      <span className="w-20 text-right shrink-0">{balance >= 0 ? '-' : '+'}{fmt(Math.abs(balance))}</span>
    </div>
  );

  return (
    <div className="pb-20 px-4 pt-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Income</h1>
        <MonthSelector />
      </div>

      {/* 3-box summary — matches Expenses style */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Expected</p>
          <p className="text-base font-bold text-foreground">{fmt(overallExpected)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Actual</p>
          <p className="text-base font-bold text-success">{fmt(overallActual)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className={cn('text-base font-bold', overallBalance > 0 ? 'text-warning' : 'text-success')}>
            {overallBalance >= 0 ? '-' : '+'}{fmt(Math.abs(overallBalance))}
          </p>
        </div>
      </div>

      {/* HOME INCOME TABLE */}
      <div className="glass-card rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Home Income</h2>
          {customHome.length > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">+{customHome.length} custom</span>}
        </div>
        <div className="min-w-[380px]">
          <TableHeader />
          {homeCategories.map(cat => <IncomeRow key={cat} category={cat} expected={getExpected(cat)} actual={homeActuals[cat] || 0} onEditExpected={handleEditExpected} />)}
          <SectionTotal label="Total Home Income" expected={homeTotalExpected} actual={homeTotalActual} balance={homeTotalExpected - homeTotalActual} color="bg-success/10 text-success" />
        </div>
      </div>

      {/* DEBT INCOME TABLE */}
      <div className="glass-card rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
            <TrendingDown className="h-3.5 w-3.5 text-warning" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Debt Income</h2>
          {customDebt.length > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">+{customDebt.length} custom</span>}
        </div>
        <div className="min-w-[380px]">
          <TableHeader />
          {debtCategories.map(cat => <IncomeRow key={cat} category={cat} expected={getExpected(cat)} actual={debtActuals[cat] || 0} onEditExpected={handleEditExpected} />)}
          <SectionTotal label="Total Debt Income" expected={debtTotalExpected} actual={debtTotalActual} balance={debtTotalExpected - debtTotalActual} color="bg-warning/10 text-warning" />
        </div>
      </div>

      {/* OVERALL TOTAL */}
      <div className="glass-card rounded-xl p-4 border border-primary/20">
        <h2 className="text-sm font-semibold text-primary mb-3">Overall Income Total</h2>
        <div className="space-y-2 text-xs">
          {[
            { label: 'Total Home Expected', val: homeTotalExpected, color: '' },
            { label: 'Total Home Actual', val: homeTotalActual, color: 'text-success' },
            { label: 'Total Debt Expected', val: debtTotalExpected, color: '', border: true },
            { label: 'Total Debt Actual', val: debtTotalActual, color: 'text-success' },
            { label: 'Overall Expected', val: overallExpected, color: '', border: true, bold: true },
            { label: 'Overall Actual', val: overallActual, color: 'text-success', bold: true },
          ].map(r => (
            <div key={r.label} className={cn('flex justify-between', r.border ? 'border-t border-border/40 pt-2' : '')}>
              <span className={cn('text-muted-foreground', r.bold ? 'font-bold text-foreground text-sm' : '')}>{r.label}</span>
              <span className={cn('font-semibold', r.color, r.bold ? 'text-sm' : '')}>{fmt(r.val)}</span>
            </div>
          ))}
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