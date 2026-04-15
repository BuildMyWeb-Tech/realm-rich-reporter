import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions, getCategorySpending, getTotalBalance } from '@/lib/financial-store';
import { PERSONS, MONTH_NAMES, EXPENSE_CATEGORIES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import { cn } from '@/lib/utils';

export default function Reports() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const monthTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth);
  const totals = getTotalBalance(state.transactions, selectedYear, selectedMonth, state.initialBalances);

  // Category spending
  const catSpending = getCategorySpending(state.transactions, selectedYear, selectedMonth);
  const sortedCats = Object.entries(catSpending).sort((a, b) => b[1] - a[1]);

  // Person spending
  const personSpending = useMemo(() => {
    return PERSONS.map(p => {
      const pTxns = monthTxns.filter(t => t.person === p);
      const income = pTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = pTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { person: p, income, expense };
    });
  }, [monthTxns]);

  // Monthly comparison (last 6 months)
  const monthlyComparison = useMemo(() => {
    const months: { label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = selectedMonth - i;
      let y = selectedYear;
      while (m < 0) { m += 12; y--; }
      const t = getTotalBalance(state.transactions, y, m, state.initialBalances);
      months.push({ label: MONTH_NAMES[m].slice(0, 3), income: t.income, expense: t.expense });
    }
    return months;
  }, [state.transactions, selectedYear, selectedMonth, state.initialBalances]);

  const maxVal = Math.max(...monthlyComparison.map(m => Math.max(m.income, m.expense)), 1);

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <MonthSelector />
      </div>

      {/* Monthly Summary */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Monthly Summary</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-sm font-bold text-success">₹{totals.income.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-sm font-bold text-destructive">₹{totals.expense.toLocaleString('en-IN')}</p>
          </div>
          <div className={cn('rounded-lg p-3', totals.savings >= 0 ? 'bg-primary/10' : 'bg-destructive/10')}>
            <p className="text-xs text-muted-foreground">Savings</p>
            <p className={cn('text-sm font-bold', totals.savings >= 0 ? 'text-primary' : 'text-destructive')}>
              ₹{totals.savings.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Trend (bar chart) */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">6-Month Trend</h2>
        <div className="flex items-end gap-2 h-32">
          {monthlyComparison.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end h-24">
                <div className="flex-1 bg-success/20 rounded-t" style={{ height: `${(m.income / maxVal) * 100}%` }} />
                <div className="flex-1 bg-destructive/20 rounded-t" style={{ height: `${(m.expense / maxVal) * 100}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 bg-success/40 rounded-full" /> Income</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2 h-2 bg-destructive/40 rounded-full" /> Expense</span>
        </div>
      </div>

      {/* Category Spending */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Spending by Category</h2>
        {sortedCats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No expenses this month</p>
        ) : (
          <div className="space-y-2">
            {sortedCats.map(([cat, amt]) => {
              const total = totals.expense || 1;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-foreground font-medium">{cat}</span>
                    <span className="text-muted-foreground">₹{amt.toLocaleString('en-IN')} ({Math.round(amt / total * 100)}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(amt / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Person-wise */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Person-wise Summary</h2>
        <div className="space-y-2">
          {personSpending.map(p => (
            <div key={p.person} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">{p.person[0]}</div>
                <span className="text-sm font-medium">{p.person}</span>
              </div>
              <div className="text-right text-xs">
                <span className="text-success">+₹{p.income.toLocaleString('en-IN')}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-destructive">-₹{p.expense.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
