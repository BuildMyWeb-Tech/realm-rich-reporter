import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getOverspendCategories, getMonthTransactions } from '@/lib/financial-store';
import { EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, DEFAULT_EXPECTED_DEBT_EXPENSE } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Pencil, Check, X, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export default function BudgetPage() {
  const { state, selectedYear, selectedMonth, setBudget } = useFinance();

  // Home expense categories (built-in + custom)
  const customExpense = state.expenseSources || [];
  const customHome = customExpense.filter(s => s.group === 'home');
  const customDebt = customExpense.filter(s => s.group === 'debt');

  const categories = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);

  // Add custom home expense categories to the categories list
  const customHomeCategories = useMemo(() => {
    const monthTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth);
    return customHome.map(s => {
      const actual = monthTxns
        .filter(t => t.type === 'expense' && t.homeOrDebt === 'home' && t.category === s.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const budget = s.defaultBudget;
      const remaining = budget - actual;
      const percent = budget > 0 ? (actual / budget) * 100 : 0;
      return { category: s.name, budget, actual, remaining, percent, overspent: actual > budget };
    });
  }, [state, selectedYear, selectedMonth]);

  const allHomeCategories = [...categories, ...customHomeCategories];

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const debtActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) {
      if (t.type === 'expense' && t.homeOrDebt === 'debt') map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return map;
  }, [monthTxns]);

  const allDebtCats = [...DEBT_EXPENSE_CATEGORIES, ...customDebt.map(s => s.name)];

  // Debt expected: built-in defaults + custom source defaults
  const defaultDebtExpected = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_EXPECTED_DEBT_EXPENSE };
    for (const s of customDebt) map[s.name] = s.defaultBudget;
    return map;
  }, [customDebt]);

  const [debtExpectedOverrides, setDebtExpectedOverrides] = useState<Record<string, number>>({});
  const [editingDebt, setEditingDebt] = useState<string | null>(null);
  const [editDebtValue, setEditDebtValue] = useState('');

  const getDebtExpected = (cat: string) =>
    cat in debtExpectedOverrides ? debtExpectedOverrides[cat] : (defaultDebtExpected[cat] ?? 0);

  const handleSave = (category: string) => {
    const val = Number(editValue);
    if (val >= 0) { setBudget(category, val, selectedYear, selectedMonth); toast.success(`Budget updated for ${category}`); }
    setEditing(null);
  };

  const handleSaveDebt = (cat: string) => {
    const val = Number(editDebtValue);
    if (val >= 0) { setDebtExpectedOverrides(m => ({ ...m, [cat]: val })); toast.success(`Expected updated for ${cat}`); }
    setEditingDebt(null);
  };

  const totalBudget = allHomeCategories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = allHomeCategories.reduce((s, c) => s + c.actual, 0);
  const totalBalance = totalBudget - totalSpent;
  const debtTotalExpected = allDebtCats.reduce((s, c) => s + getDebtExpected(c), 0);
  const debtTotalActual = allDebtCats.reduce((s, c) => s + (debtActuals[c] || 0), 0);
  const debtTotalBalance = debtTotalExpected - debtTotalActual;

  // Overall totals (Home + Debt)
  const overallExpected = totalBudget + debtTotalExpected;
  const overallActual = totalSpent + debtTotalActual;
  const overallBalance = overallExpected - overallActual;

  // Overspend: amount spent ABOVE budget per category (home only for now)
  const totalHomOverspend = allHomeCategories.filter(c => c.overspent).reduce((s, c) => s + (c.actual - c.budget), 0);

  const overspentCount = allHomeCategories.filter(c => c.overspent).length;
  const nearLimitCount = allHomeCategories.filter(c => !c.overspent && c.percent >= 80).length;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const statusIcon = (c: { overspent: boolean; percent: number }) => {
    if (c.overspent) return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    if (c.percent >= 80) return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />;
    return <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 opacity-50" />;
  };

  return (
    <div className="pb-20 px-2 sm:px-4 pt-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-xl font-bold text-foreground">Expenses</h1>
        <MonthSelector />
      </div>

      {/* 3-box summary — matching Income page style */}
      <div className="grid grid-cols-3 gap-2 px-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
          <p className="text-base font-bold text-foreground">{fmt(totalBudget)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
          <p className={cn('text-base font-bold', totalSpent > totalBudget ? 'text-destructive' : 'text-foreground')}>{fmt(totalSpent)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className={cn('text-base font-bold', totalBalance < 0 ? 'text-destructive' : 'text-success')}>
            {totalBalance >= 0 ? fmt(totalBalance) : `-${fmt(Math.abs(totalBalance))}`}
          </p>
        </div>
      </div>

      {/* Overall progress */}
      <div className="glass-card rounded-xl p-4 mx-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground">Overall Usage</span>
          <span className="text-xs font-semibold">{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</span>
        </div>
        <Progress value={totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}
          className={cn('h-2.5', totalSpent > totalBudget ? '[&>div]:bg-destructive' : '[&>div]:bg-primary')} />
        <div className="flex gap-4 mt-2 text-xs flex-wrap">
          {overspentCount > 0 && <span className="text-destructive font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" />{overspentCount} overspent</span>}
          {nearLimitCount > 0 && <span className="text-warning font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{nearLimitCount} near limit</span>}
          {totalHomOverspend > 0 && <span className="text-destructive font-medium ml-auto">Over by {fmt(totalHomOverspend)}</span>}
        </div>
      </div>

      {/* HOME EXPENSE TABLE */}
      <div className="glass-card rounded-xl p-4 mx-2 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">🏠 Home Expenses</h2>
          {customHome.length > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">+{customHome.length} custom</span>}
        </div>
        <div className="min-w-[520px]">
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-2 mb-2 font-semibold border-b border-border/40 pb-2">
            <span className="w-5 shrink-0"></span>
            <span className="flex-1 min-w-[100px]">Category</span>
            <span className="w-24 text-right shrink-0">Exp. Budget</span>
            <span className="w-24 text-right shrink-0">Actual</span>
            <span className="w-24 text-right shrink-0">Balance</span>
            <span className="w-20 text-right shrink-0">Overspend</span>
          </div>
          <div className="space-y-1">
            {allHomeCategories.map(c => {
              const overspendAmt = c.overspent ? c.actual - c.budget : 0;
              return (
                <div key={c.category} className={cn('rounded-lg px-2 py-2 transition-colors', c.overspent ? 'bg-destructive/8' : c.percent >= 80 ? 'bg-warning/8' : '')}>
                  <div className="flex items-center gap-3">
                    {statusIcon(c)}
                    <span className="flex-1 text-xs font-medium text-foreground min-w-[100px] truncate">{c.category}</span>
                    {editing === c.category ? (
                      <div className="flex items-center gap-1 w-24 justify-end shrink-0">
                        <Input type="number" className="w-20 h-6 text-xs px-1" value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(c.category); if (e.key === 'Escape') setEditing(null); }}
                          autoFocus />
                        <button onClick={() => handleSave(c.category)} className="text-success"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setEditing(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button className="w-24 text-right text-xs text-muted-foreground hover:text-primary flex items-center justify-end gap-0.5 group shrink-0"
                        onClick={() => { setEditing(c.category); setEditValue(String(c.budget)); }}>
                        {fmt(c.budget)}<Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                      </button>
                    )}
                    <span className={cn('w-24 text-right text-xs font-semibold shrink-0', c.actual > 0 ? 'text-foreground' : 'text-muted-foreground')}>{fmt(c.actual)}</span>
                    <span className={cn('w-24 text-right text-xs font-bold shrink-0', c.remaining < 0 ? 'text-destructive' : c.remaining < c.budget * 0.2 ? 'text-warning' : 'text-success')}>
                      {c.remaining >= 0 ? fmt(c.remaining) : `-${fmt(Math.abs(c.remaining))}`}
                    </span>
                    <span className={cn('w-20 text-right text-xs font-bold shrink-0', overspendAmt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {overspendAmt > 0 ? fmt(overspendAmt) : '—'}
                    </span>
                  </div>
                  <div className="mt-1.5 ml-8">
                    <Progress value={Math.min(c.percent, 100)}
                      className={cn('h-1', c.overspent ? '[&>div]:bg-destructive' : c.percent >= 80 ? '[&>div]:bg-warning' : '[&>div]:bg-success')} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Home Total Row */}
          <div className="flex items-center gap-3 px-2 pt-3 mt-2 border-t border-border/50 text-xs font-bold bg-muted/30 rounded-lg py-2">
            <span className="w-5 shrink-0"></span>
            <span className="flex-1 min-w-[100px]">Total Home Expenses</span>
            <span className="w-24 text-right shrink-0">{fmt(totalBudget)}</span>
            <span className="w-24 text-right text-destructive shrink-0">{fmt(totalSpent)}</span>
            <span className={cn('w-24 text-right shrink-0', totalBalance >= 0 ? 'text-success' : 'text-destructive')}>
              {totalBalance >= 0 ? fmt(totalBalance) : `-${fmt(Math.abs(totalBalance))}`}
            </span>
            <span className={cn('w-20 text-right shrink-0', totalHomOverspend > 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {totalHomOverspend > 0 ? fmt(totalHomOverspend) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* DEBT EXPENSE TABLE */}
      <div className="glass-card rounded-xl p-4 mx-2 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">💳 Debt Expenses</h2>
          {customDebt.length > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">+{customDebt.length} custom</span>}
        </div>
        <div className="min-w-[520px]">
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-2 mb-2 font-semibold border-b border-border/40 pb-2">
            <span className="w-5 shrink-0"></span>
            <span className="flex-1 min-w-[100px]">Category</span>
            <span className="w-24 text-right shrink-0">Expected</span>
            <span className="w-24 text-right shrink-0">Actual</span>
            <span className="w-24 text-right shrink-0">Balance</span>
            <span className="w-20 text-right shrink-0">Overspend</span>
          </div>
          <div className="space-y-1">
            {allDebtCats.map(cat => {
              const exp = getDebtExpected(cat);
              const actual = debtActuals[cat] || 0;
              const bal = exp - actual;
              const over = actual > exp && exp > 0;
              const overspendAmt = over ? actual - exp : 0;
              return (
                <div key={cat} className={cn('rounded-lg px-2 py-2', over ? 'bg-destructive/8' : '')}>
                  <div className="flex items-center gap-3">
                    {over ? <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" /> : <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 opacity-50" />}
                    <span className="flex-1 text-xs font-medium text-foreground min-w-[100px] truncate">{cat}</span>
                    {editingDebt === cat ? (
                      <div className="flex items-center gap-1 w-24 justify-end shrink-0">
                        <Input type="number" className="w-20 h-6 text-xs px-1" value={editDebtValue}
                          onChange={e => setEditDebtValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveDebt(cat); if (e.key === 'Escape') setEditingDebt(null); }}
                          autoFocus />
                        <button onClick={() => handleSaveDebt(cat)} className="text-success"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setEditingDebt(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button className="w-24 text-right text-xs text-muted-foreground hover:text-primary flex items-center justify-end gap-0.5 group shrink-0"
                        onClick={() => { setEditingDebt(cat); setEditDebtValue(String(exp)); }}>
                        {fmt(exp)}<Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                      </button>
                    )}
                    <span className={cn('w-24 text-right text-xs font-semibold shrink-0', actual > 0 ? 'text-foreground' : 'text-muted-foreground')}>{fmt(actual)}</span>
                    <span className={cn('w-24 text-right text-xs font-bold shrink-0', bal >= 0 ? 'text-warning' : 'text-success')}>
                      {bal >= 0 ? `-${fmt(bal)}` : `+${fmt(Math.abs(bal))}`}
                    </span>
                    <span className={cn('w-20 text-right text-xs font-bold shrink-0', overspendAmt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {overspendAmt > 0 ? fmt(overspendAmt) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Debt Total Row */}
          <div className="flex items-center gap-3 px-2 pt-3 mt-2 border-t border-border/50 text-xs font-bold bg-muted/30 rounded-lg py-2">
            <span className="w-5 shrink-0"></span>
            <span className="flex-1 min-w-[100px]">Total Debt Expenses</span>
            <span className="w-24 text-right shrink-0">{fmt(debtTotalExpected)}</span>
            <span className="w-24 text-right text-destructive shrink-0">{fmt(debtTotalActual)}</span>
            <span className={cn('w-24 text-right shrink-0', debtTotalBalance >= 0 ? 'text-warning' : 'text-success')}>
              {debtTotalBalance >= 0 ? `-${fmt(debtTotalBalance)}` : `+${fmt(Math.abs(debtTotalBalance))}`}
            </span>
            <span className="w-20 text-right text-muted-foreground shrink-0">—</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* OVERALL EXPENSES TOTAL — mirrors Income page Overall Income Total  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="glass-card rounded-xl p-4 mx-2 border border-destructive/20">
        <h2 className="text-sm font-semibold text-destructive mb-3">Overall Expenses Total</h2>
        <div className="space-y-2 text-xs">
          {[
            { label: 'Total Home Expected',  val: totalBudget,       color: '',                bold: false, border: false },
            { label: 'Total Home Actual',    val: totalSpent,        color: 'text-destructive', bold: false, border: false },
            { label: 'Total Debt Expected',  val: debtTotalExpected, color: '',                bold: false, border: true  },
            { label: 'Total Debt Actual',    val: debtTotalActual,   color: 'text-destructive', bold: false, border: false },
            { label: 'Overall Expected',     val: overallExpected,   color: '',                bold: true,  border: true  },
            { label: 'Overall Actual',       val: overallActual,     color: 'text-destructive', bold: true,  border: false },
          ].map(r => (
            <div key={r.label} className={cn('flex justify-between', r.border ? 'border-t border-border/40 pt-2' : '')}>
              <span className={cn('text-muted-foreground', r.bold ? 'font-bold text-foreground text-sm' : '')}>{r.label}</span>
              <span className={cn('font-semibold', r.color, r.bold ? 'text-sm' : '')}>{fmt(r.val)}</span>
            </div>
          ))}

          {/* Balance row */}
          <div className="flex justify-between border-t border-border/40 pt-2">
            <span className="font-bold text-sm text-foreground">Balance</span>
            <span className={cn('font-bold text-sm', overallBalance < 0 ? 'text-destructive' : 'text-success')}>
              {overallBalance < 0 ? `Over by ${fmt(Math.abs(overallBalance))}` : `Under by ${fmt(overallBalance)}`}
            </span>
          </div>

          {/* Overspend row */}
          <div className="flex justify-between border-t border-border/40 pt-2">
            <span className="font-bold text-sm text-foreground">Overspend</span>
            <span className={cn('font-bold text-sm', totalHomOverspend > 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {totalHomOverspend > 0 ? fmt(totalHomOverspend) : '₹0'}
            </span>
          </div>
        </div>

        {/* Compact summary grid — mirrors Income page 3-box style */}
        {/* <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/30">
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Home Expected</p>
            <p className="text-sm font-bold text-foreground">{fmt(totalBudget)}</p>
          </div>
          <div className="rounded-lg bg-destructive/8 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Home Actual</p>
            <p className="text-sm font-bold text-destructive">{fmt(totalSpent)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Debt Expected</p>
            <p className="text-sm font-bold text-foreground">{fmt(debtTotalExpected)}</p>
          </div>
          <div className="rounded-lg bg-destructive/8 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Debt Actual</p>
            <p className="text-sm font-bold text-destructive">{fmt(debtTotalActual)}</p>
          </div>
          <div className="rounded-lg bg-primary/8 p-2.5 text-center col-span-1">
            <p className="text-[10px] text-muted-foreground mb-0.5">Overall Expected</p>
            <p className="text-sm font-bold text-foreground">{fmt(overallExpected)}</p>
          </div>
          <div className="rounded-lg bg-primary/8 p-2.5 text-center col-span-1">
            <p className="text-[10px] text-muted-foreground mb-0.5">Overall Actual</p>
            <p className="text-sm font-bold text-destructive">{fmt(overallActual)}</p>
          </div>
        </div> */}
      </div>

      <TransactionForm />
    </div>
  );
}