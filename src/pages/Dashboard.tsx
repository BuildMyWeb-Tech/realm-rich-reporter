import { useFinance } from '@/contexts/FinanceContext';
import { getTotalBalance, getOverspendCategories, getMonthTransactions, getAccountBalance, getHomeDebtSummary } from '@/lib/financial-store';
import { PERSONS, ACCOUNTS, getCashAccounts, getBankAccounts } from '@/lib/types';
import { getPersonBalance } from '@/lib/financial-store';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const totals = getTotalBalance(state.transactions, selectedYear, selectedMonth, state.initialBalances, state.accountBalances);
  const overspend = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);
  const topOverspend = overspend.filter(o => o.overspent).sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget)).slice(0, 5);
  const nearLimit = overspend.filter(o => !o.overspent && o.percent >= 80).slice(0, 3);
  const recentTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const homeDebt = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);

  const cashAccounts = getCashAccounts();
  const bankAccounts = getBankAccounts();

  const totalCashOpening = cashAccounts.reduce((s, a) => s + (getAccountBalance(state.transactions, a.id, selectedYear, selectedMonth, state.accountBalances).opening), 0);
  const totalCashClosing = cashAccounts.reduce((s, a) => s + (getAccountBalance(state.transactions, a.id, selectedYear, selectedMonth, state.accountBalances).closing), 0);
  const totalOnlineOpening = bankAccounts.reduce((s, a) => s + (getAccountBalance(state.transactions, a.id, selectedYear, selectedMonth, state.accountBalances).opening), 0);
  const totalOnlineClosing = bankAccounts.reduce((s, a) => s + (getAccountBalance(state.transactions, a.id, selectedYear, selectedMonth, state.accountBalances).closing), 0);
  const overallOpening = totalCashOpening + totalOnlineOpening;
  const overallClosing = totalCashClosing + totalOnlineClosing;

  const stats = [
    { label: 'Balance', value: totals.closing, icon: Wallet, gradient: 'gradient-primary' },
    { label: 'Income', value: totals.income, icon: TrendingUp, gradient: 'bg-success' },
    { label: 'Expenses', value: totals.expense, icon: TrendingDown, gradient: 'gradient-danger' },
    { label: 'Savings', value: totals.savings, icon: PiggyBank, gradient: 'gradient-accent' },
  ];

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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
            <p className="text-lg font-bold">{fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Account Balances - Opening & Ending */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Account Balances</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Opening */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Opening</h3>
            <div className="space-y-1">
              {ACCOUNTS.map(acc => {
                const bal = getAccountBalance(state.transactions, acc.id, selectedYear, selectedMonth, state.accountBalances);
                return (
                  <div key={acc.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{acc.name}</span>
                    <span className="font-medium">{fmt(bal.opening)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Ending */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Ending</h3>
            <div className="space-y-1">
              {ACCOUNTS.map(acc => {
                const bal = getAccountBalance(state.transactions, acc.id, selectedYear, selectedMonth, state.accountBalances);
                return (
                  <div key={acc.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{acc.name}</span>
                    <span className={cn('font-medium', bal.closing < 0 ? 'text-destructive' : '')}>{fmt(bal.closing)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Total Cash</span>
            <span className="flex gap-6"><span>{fmt(totalCashOpening)}</span><span>{fmt(totalCashClosing)}</span></span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span>Total Online</span>
            <span className="flex gap-6"><span>{fmt(totalOnlineOpening)}</span><span>{fmt(totalOnlineClosing)}</span></span>
          </div>
          <div className="flex justify-between text-sm font-bold text-primary">
            <span>Overall Total</span>
            <span className="flex gap-6"><span>{fmt(overallOpening)}</span><span>{fmt(overallClosing)}</span></span>
          </div>
        </div>
      </div>

      {/* Home vs Debt Summary */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Monthly Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Income – Home</span>
            <span className="font-medium text-success">{fmt(homeDebt.homeIncome)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Expenses – Home</span>
            <span className="font-medium text-destructive">{fmt(homeDebt.homeExpense)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span>Balance – Home</span>
            <span className={homeDebt.homeBalance >= 0 ? 'text-success' : 'text-destructive'}>{fmt(homeDebt.homeBalance)}</span>
          </div>

          <div className="border-t border-border/50 my-1"></div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Income – Debt</span>
            <span className="font-medium text-success">{fmt(homeDebt.debtIncome)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Expenses – Debt</span>
            <span className="font-medium text-destructive">{fmt(homeDebt.debtExpense)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span>Balance – Debt</span>
            <span className={homeDebt.debtBalance >= 0 ? 'text-success' : 'text-destructive'}>{fmt(homeDebt.debtBalance)}</span>
          </div>

          <div className="border-t border-border/50 my-1"></div>

          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL INCOME (All)</span>
            <span className="text-success">{fmt(homeDebt.totalIncome)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL EXPENSES (All)</span>
            <span className="text-destructive">{fmt(homeDebt.totalExpense)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-primary">
            <span>Balance (All)</span>
            <span>{fmt(homeDebt.totalBalance)}</span>
          </div>
        </div>
      </div>

      {/* Missing Money */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Missing Money</h2>
        <p className={cn(
          'text-lg font-bold',
          Math.abs(totals.closing - overallClosing) > 0 ? 'text-destructive' : 'text-success'
        )}>
          {fmt(Math.abs(totals.closing - overallClosing))}
        </p>
        {Math.abs(totals.closing - overallClosing) > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Difference between calculated balance and account totals</p>
        )}
      </div>

      {/* Overspend Alerts */}
      {(topOverspend.length > 0 || nearLimit.length > 0) && (
        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Overspend Breakdown
          </h2>
          <div className="space-y-2">
            {topOverspend.map(o => (
              <div key={o.category} className="flex justify-between items-center text-sm bg-destructive/10 rounded-lg px-3 py-2">
                <span className="text-destructive font-medium">{o.category}</span>
                <span className="text-destructive font-semibold">
                  {fmt(o.actual - o.budget)} over
                </span>
              </div>
            ))}
            {nearLimit.map(o => (
              <div key={o.category} className="flex justify-between items-center text-sm bg-warning/10 rounded-lg px-3 py-2">
                <span className="text-warning font-medium">{o.category}</span>
                <span className="text-warning font-semibold">{Math.round(o.percent)}% used</span>
              </div>
            ))}
            {topOverspend.length > 0 && (
              <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-border/50">
                <span>Home Total Overspend</span>
                <span className="text-destructive">{fmt(topOverspend.reduce((s, o) => s + (o.actual - o.budget), 0))}</span>
              </div>
            )}
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
                  <p className="text-xs text-muted-foreground">
                    {t.person} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {t.homeOrDebt === 'debt' ? ' · Debt' : ''}
                  </p>
                </div>
                <span className={cn(
                  'text-sm font-semibold',
                  t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-info'
                )}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
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
