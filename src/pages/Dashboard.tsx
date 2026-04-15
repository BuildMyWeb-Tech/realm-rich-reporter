import { useFinance } from '@/contexts/FinanceContext';
import { getTotalBalance, getOverspendCategories, getMonthTransactions } from '@/lib/financial-store';
import { PERSONS } from '@/lib/types';
import { getPersonBalance } from '@/lib/financial-store';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const totals = getTotalBalance(state.transactions, selectedYear, selectedMonth, state.initialBalances);
  const overspend = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);
  const topOverspend = overspend.filter(o => o.overspent).sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget)).slice(0, 3);
  const nearLimit = overspend.filter(o => !o.overspent && o.percent >= 80).slice(0, 3);
  const recentTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Balance', value: totals.closing, icon: Wallet, gradient: 'gradient-primary' },
    { label: 'Income', value: totals.income, icon: TrendingUp, gradient: 'bg-success' },
    { label: 'Expenses', value: totals.expense, icon: TrendingDown, gradient: 'gradient-danger' },
    { label: 'Savings', value: totals.savings, icon: PiggyBank, gradient: 'gradient-accent' },
  ];

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Family Finance</h1>
        <MonthSelector />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className={cn('stat-card rounded-xl text-primary-foreground', s.gradient)}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="h-4 w-4 opacity-80" />
              <span className="text-xs opacity-90">{s.label}</span>
            </div>
            <p className="text-lg font-bold">₹{s.value.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      {/* Person Balances */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Wallet Balances</h2>
        <div className="space-y-2">
          {PERSONS.map(p => {
            const bal = getPersonBalance(state.transactions, p, selectedYear, selectedMonth, state.initialBalances);
            return (
              <div key={p} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {p[0]}
                  </div>
                  <span className="text-sm font-medium">{p}</span>
                </div>
                <span className={cn('text-sm font-semibold', bal.closing >= 0 ? 'text-success' : 'text-destructive')}>
                  ₹{bal.closing.toLocaleString('en-IN')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overspend Alerts */}
      {(topOverspend.length > 0 || nearLimit.length > 0) && (
        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Budget Alerts
          </h2>
          <div className="space-y-2">
            {topOverspend.map(o => (
              <div key={o.category} className="flex justify-between items-center text-sm bg-destructive/10 rounded-lg px-3 py-2">
                <span className="text-destructive font-medium">{o.category}</span>
                <span className="text-destructive font-semibold">
                  ₹{(o.actual - o.budget).toLocaleString('en-IN')} over
                </span>
              </div>
            ))}
            {nearLimit.map(o => (
              <div key={o.category} className="flex justify-between items-center text-sm bg-warning/10 rounded-lg px-3 py-2">
                <span className="text-warning font-medium">{o.category}</span>
                <span className="text-warning font-semibold">{Math.round(o.percent)}% used</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Transactions</h2>
        {recentTxns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions this month</p>
        ) : (
          <div className="space-y-2">
            {recentTxns.map(t => (
              <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{t.category}</p>
                  <p className="text-xs text-muted-foreground">{t.person} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <span className={cn(
                  'text-sm font-semibold',
                  t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-info'
                )}>
                  {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionForm />
    </div>
  );
}
