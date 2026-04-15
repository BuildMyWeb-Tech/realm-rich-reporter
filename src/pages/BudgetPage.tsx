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
  const categories = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Debt expenses
  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const debtActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxns) {
      if (t.type === 'expense' && t.homeOrDebt === 'debt') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    }
    return map;
  }, [monthTxns]);

  const [debtExpected, setDebtExpected] = useState<Record<string, number>>({ ...DEFAULT_EXPECTED_DEBT_EXPENSE });
  const [editingDebt, setEditingDebt] = useState<string | null>(null);
  const [editDebtValue, setEditDebtValue] = useState('');

  const handleSave = (category: string) => {
    const val = Number(editValue);
    if (val >= 0) {
      setBudget(category, val, selectedYear, selectedMonth);
      toast.success(`Budget updated for ${category}`);
    }
    setEditing(null);
  };

  const handleSaveDebt = (category: string) => {
    const val = Number(editDebtValue);
    if (val >= 0) {
      setDebtExpected(m => ({ ...m, [category]: val }));
      toast.success(`Expected updated for ${category}`);
    }
    setEditingDebt(null);
  };

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = categories.reduce((s, c) => s + c.actual, 0);
  const totalOverspend = categories.filter(c => c.overspent).reduce((s, c) => s + (c.actual - c.budget), 0);

  const overspentCount = categories.filter(c => c.overspent).length;
  const nearLimitCount = categories.filter(c => !c.overspent && c.percent >= 80).length;

  const debtTotalExpected = DEBT_EXPENSE_CATEGORIES.reduce((s, c) => s + (debtExpected[c] || 0), 0);
  const debtTotalActual = DEBT_EXPENSE_CATEGORIES.reduce((s, c) => s + (debtActuals[c] || 0), 0);
  const debtTotalBalance = debtTotalExpected - debtTotalActual;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const statusIcon = (c: typeof categories[0]) => {
    if (c.overspent) return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    if (c.percent >= 80) return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />;
    return <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 opacity-50" />;
  };

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Expenses</h1>
        <MonthSelector />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
          <p className="text-base font-bold">{fmt(totalBudget)}</p>
        </div>
        <div className="glass-card rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
          <p className={cn('text-base font-bold', totalSpent > totalBudget ? 'text-destructive' : 'text-foreground')}>
            {fmt(totalSpent)}
          </p>
        </div>
      </div>

      {/* Overall progress */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground">Overall Usage</span>
          <span className="text-xs font-semibold">{Math.round((totalSpent / totalBudget) * 100)}%</span>
        </div>
        <Progress
          value={Math.min((totalSpent / totalBudget) * 100, 100)}
          className={cn('h-2.5', totalSpent > totalBudget ? '[&>div]:bg-destructive' : '[&>div]:bg-primary')}
        />
        <div className="flex gap-4 mt-2 text-xs">
          {overspentCount > 0 && (
            <span className="text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {overspentCount} overspent
            </span>
          )}
          {nearLimitCount > 0 && (
            <span className="text-warning font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {nearLimitCount} near limit
            </span>
          )}
          {totalOverspend > 0 && (
            <span className="text-destructive font-medium ml-auto">
              Over by {fmt(totalOverspend)}
            </span>
          )}
        </div>
      </div>

      {/* HOME EXPENSE TABLE */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">🏠 Home Expenses</h2>

        {/* Column headers */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 mb-2 font-semibold border-b border-border/40 pb-2">
          <span className="flex-1">Category</span>
          <span className="w-20 text-right">Budget</span>
          <span className="w-18 text-right">Actual</span>
          <span className="w-18 text-right">Balance</span>
        </div>

        <div className="space-y-1">
          {categories.map(c => (
            <div
              key={c.category}
              className={cn(
                'rounded-lg px-2 py-2 transition-colors',
                c.overspent ? 'bg-destructive/8' : c.percent >= 80 ? 'bg-warning/8' : ''
              )}
            >
              <div className="flex items-center gap-2">
                {statusIcon(c)}
                <span className="flex-1 text-xs font-medium text-foreground truncate">{c.category}</span>

                {/* Budget - editable */}
                {editing === c.category ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-20 h-6 text-xs px-1"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(c.category); if (e.key === 'Escape') setEditing(null); }}
                      autoFocus
                    />
                    <button onClick={() => handleSave(c.category)} className="text-success"><Check className="h-3 w-3" /></button>
                    <button onClick={() => setEditing(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <button
                    className="w-20 text-right text-xs text-muted-foreground hover:text-primary flex items-center justify-end gap-0.5 group"
                    onClick={() => { setEditing(c.category); setEditValue(String(c.budget)); }}
                  >
                    {fmt(c.budget)}
                    <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                  </button>
                )}

                <span className={cn('w-18 text-right text-xs font-semibold', c.actual > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                  {fmt(c.actual)}
                </span>
                <span className={cn(
                  'w-18 text-right text-xs font-bold',
                  c.remaining < 0 ? 'text-destructive' : c.remaining < c.budget * 0.2 ? 'text-warning' : 'text-success'
                )}>
                  {c.remaining >= 0 ? fmt(c.remaining) : `-${fmt(Math.abs(c.remaining))}`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 ml-5">
                <Progress
                  value={Math.min(c.percent, 100)}
                  className={cn(
                    'h-1',
                    c.overspent ? '[&>div]:bg-destructive' :
                    c.percent >= 80 ? '[&>div]:bg-warning' :
                    '[&>div]:bg-success'
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Home total */}
        <div className="flex items-center gap-2 px-1 pt-3 mt-2 border-t border-border/50 text-xs font-bold">
          <span className="flex-1">Total Home</span>
          <span className="w-20 text-right">{fmt(totalBudget)}</span>
          <span className="w-18 text-right text-destructive">{fmt(totalSpent)}</span>
          <span className={cn('w-18 text-right', totalBudget - totalSpent >= 0 ? 'text-success' : 'text-destructive')}>
            {totalBudget - totalSpent >= 0 ? fmt(totalBudget - totalSpent) : `-${fmt(Math.abs(totalBudget - totalSpent))}`}
          </span>
        </div>
      </div>

      {/* DEBT EXPENSE TABLE */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">💳 Debt Expenses</h2>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 mb-2 font-semibold border-b border-border/40 pb-2">
          <span className="flex-1">Category</span>
          <span className="w-20 text-right">Expected</span>
          <span className="w-18 text-right">Actual</span>
          <span className="w-18 text-right">Balance</span>
        </div>

        <div className="space-y-1">
          {DEBT_EXPENSE_CATEGORIES.map(cat => {
            const exp = debtExpected[cat] || 0;
            const actual = debtActuals[cat] || 0;
            const bal = exp - actual;
            const over = actual > exp && exp > 0;
            return (
              <div key={cat} className={cn('rounded-lg px-2 py-2', over ? 'bg-destructive/8' : '')}>
                <div className="flex items-center gap-2">
                  {over
                    ? <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    : <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 opacity-50" />
                  }
                  <span className="flex-1 text-xs font-medium text-foreground truncate">{cat}</span>

                  {editingDebt === cat ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-20 h-6 text-xs px-1"
                        value={editDebtValue}
                        onChange={e => setEditDebtValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveDebt(cat); if (e.key === 'Escape') setEditingDebt(null); }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveDebt(cat)} className="text-success"><Check className="h-3 w-3" /></button>
                      <button onClick={() => setEditingDebt(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button
                      className="w-20 text-right text-xs text-muted-foreground hover:text-primary flex items-center justify-end gap-0.5 group"
                      onClick={() => { setEditingDebt(cat); setEditDebtValue(String(exp)); }}
                    >
                      {fmt(exp)}
                      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                    </button>
                  )}

                  <span className={cn('w-18 text-right text-xs font-semibold', actual > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                    {fmt(actual)}
                  </span>
                  <span className={cn('w-18 text-right text-xs font-bold', bal >= 0 ? 'text-warning' : 'text-success')}>
                    {bal >= 0 ? `-${fmt(bal)}` : `+${fmt(Math.abs(bal))}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Debt total */}
        <div className="flex items-center gap-2 px-1 pt-3 mt-2 border-t border-border/50 text-xs font-bold">
          <span className="flex-1">Total Debt</span>
          <span className="w-20 text-right">{fmt(debtTotalExpected)}</span>
          <span className="w-18 text-right text-destructive">{fmt(debtTotalActual)}</span>
          <span className={cn('w-18 text-right', debtTotalBalance >= 0 ? 'text-warning' : 'text-success')}>
            {debtTotalBalance >= 0 ? `-${fmt(debtTotalBalance)}` : `+${fmt(Math.abs(debtTotalBalance))}`}
          </span>
        </div>
      </div>

      <TransactionForm />
    </div>
  );
}