import { useEffect, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getTotalBalance, getOverspendCategories, getMonthTransactions, getAccountBalance, getHomeDebtSummary } from '@/lib/financial-store';
import { getCashAccounts, getBankAccounts, MONTH_NAMES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle, Home, CreditCard, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { state, selectedYear, selectedMonth, missingMoneyLog, logMissingMoney } = useFinance();

  const totals = getTotalBalance(state.transactions, selectedYear, selectedMonth, state.initialBalances, state.accountBalances);
  const overspend = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);
  const topOverspend = overspend.filter(o => o.overspent).sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget)).slice(0, 5);
  const nearLimit = overspend.filter(o => !o.overspent && o.percent >= 80).slice(0, 3);
  const recentTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const homeDebt = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);

  const cashAccounts = getCashAccounts();
  const bankAccounts = getBankAccounts();

  const totalCashClosing = cashAccounts.reduce((s, a) => s + getAccountBalance(state.transactions, a.id, selectedYear, selectedMonth, state.accountBalances).closing, 0);
  const totalOnlineClosing = bankAccounts.reduce((s, a) => s + getAccountBalance(state.transactions, a.id, selectedYear, selectedMonth, state.accountBalances).closing, 0);
  const overallClosing = totalCashClosing + totalOnlineClosing;
  const missingAmount = Math.round(Math.abs(totals.closing - overallClosing));

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (missingAmount > 0) logMissingMoney(today, missingAmount);
  }, [missingAmount]);

  const missingLog = missingMoneyLog.filter(e => e.amount > 0);
  const savingsRate = totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Family Finance</h1>
        <MonthSelector />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Income', value: totals.income, icon: TrendingUp, color: 'bg-success' },
          { label: 'Expenses', value: totals.expense, icon: TrendingDown, color: 'gradient-danger' },
          { label: 'Balance', value: totals.closing, icon: Wallet, color: 'gradient-primary' },
          // { label: 'Savings', value: totals.savings, icon: PiggyBank, color: 'gradient-accent' },
        ].map(s => (
          <div key={s.label} className={cn('stat-card rounded-xl text-primary-foreground', s.color)}>
            <div className="flex items-center gap-2 mb-1"><s.icon className="h-4 w-4 opacity-80" /><span className="text-xs opacity-90">{s.label}</span></div>
            <p className="text-lg font-bold">{fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Savings Rate */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Savings Rate</p>
          <span className={cn('text-base font-bold', savingsRate >= 20 ? 'text-success' : savingsRate >= 0 ? 'text-warning' : 'text-destructive')}>{savingsRate}%</span>
        </div>
        <Progress value={Math.max(0, Math.min(savingsRate, 100))}
          className={cn('h-2', savingsRate >= 20 ? '[&>div]:bg-success' : savingsRate >= 0 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive')} />
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
          <span>Income {fmt(totals.income)}</span>
          <span>Expense {fmt(totals.expense)}</span>
          <span className={cn('font-semibold', totals.savings >= 0 ? 'text-success' : 'text-destructive')}>
            Net {totals.savings >= 0 ? '+' : ''}{fmt(totals.savings)}
          </span>
        </div>
      </div>

      {/* Home vs Debt breakdown */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Monthly Breakdown</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success/8 p-3">
            <div className="flex items-center gap-1.5 mb-2"><Home className="h-3.5 w-3.5 text-success" /><span className="text-xs font-semibold text-success">Home</span></div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="text-success font-medium">+{fmt(homeDebt.homeIncome)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expense</span><span className="text-destructive font-medium">-{fmt(homeDebt.homeExpense)}</span></div>
              <div className="flex justify-between border-t border-border/30 pt-1 font-bold">
                <span>Balance</span>
                <span className={homeDebt.homeBalance >= 0 ? 'text-success' : 'text-destructive'}>{homeDebt.homeBalance >= 0 ? '+' : ''}{fmt(homeDebt.homeBalance)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-warning/8 p-3">
            <div className="flex items-center gap-1.5 mb-2"><CreditCard className="h-3.5 w-3.5 text-warning" /><span className="text-xs font-semibold text-warning">Debt</span></div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="text-success font-medium">+{fmt(homeDebt.debtIncome)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expense</span><span className="text-destructive font-medium">-{fmt(homeDebt.debtExpense)}</span></div>
              <div className="flex justify-between border-t border-border/30 pt-1 font-bold">
                <span>Balance</span>
                <span className={homeDebt.debtBalance >= 0 ? 'text-success' : 'text-destructive'}>{homeDebt.debtBalance >= 0 ? '+' : ''}{fmt(homeDebt.debtBalance)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-xs text-center">
          <div><p className="text-muted-foreground mb-0.5">Total Income</p><p className="font-bold text-success">{fmt(homeDebt.totalIncome)}</p></div>
          <div><p className="text-muted-foreground mb-0.5">Total Expense</p><p className="font-bold text-destructive">{fmt(homeDebt.totalExpense)}</p></div>
          <div><p className="text-muted-foreground mb-0.5">Net</p>
            <p className={cn('font-bold', homeDebt.totalBalance >= 0 ? 'text-success' : 'text-destructive')}>
              {homeDebt.totalBalance >= 0 ? '+' : ''}{fmt(homeDebt.totalBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Missing Money */}
      <div className={cn('glass-card rounded-xl p-4', missingAmount > 0 ? 'border border-destructive/30' : '')}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {missingAmount > 0 && <AlertCircle className="h-4 w-4 text-destructive" />}
            Missing Money
          </h2>
          <span className={cn('text-lg font-bold', missingAmount > 0 ? 'text-destructive' : 'text-success')}>
            {missingAmount > 0 ? `-${fmt(missingAmount)}` : '✓ ₹0'}
          </span>
        </div>
        {missingAmount > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            Calculated: {fmt(totals.closing)} · Accounts: {fmt(overallClosing)}
          </p>
        )}
        {missingLog.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">History</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {missingLog.map((entry, i) => {
                const prev = i > 0 ? missingLog[i - 1].amount : null;
                const diff = prev !== null ? entry.amount - prev : null;
                return (
                  <div key={entry.date} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-2">
                      {diff !== null && diff !== 0 && (
                        <span className={cn('text-[10px]', diff > 0 ? 'text-destructive' : 'text-success')}>
                          {diff > 0 ? `▲${fmt(diff)}` : `▼${fmt(Math.abs(diff))}`}
                        </span>
                      )}
                      <span className="font-semibold text-destructive">{fmt(entry.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Budget Alerts */}
      {(topOverspend.length > 0 || nearLimit.length > 0) && (
        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Budget Alerts
          </h2>
          <div className="space-y-2">
            {topOverspend.map(o => (
              <div key={o.category}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-destructive font-medium">{o.category}</span>
                  <span className="text-destructive font-semibold text-xs">{fmt(o.actual - o.budget)} over</span>
                </div>
                <Progress value={100} className="h-1 [&>div]:bg-destructive" />
              </div>
            ))}
            {nearLimit.map(o => (
              <div key={o.category}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-warning font-medium">{o.category}</span>
                  <span className="text-warning font-semibold text-xs">{Math.round(o.percent)}% used</span>
                </div>
                <Progress value={o.percent} className="h-1 [&>div]:bg-warning" />
              </div>
            ))}
            {topOverspend.length > 0 && (
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/50">
                <span>Total Overspend</span>
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
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {t.category}
                    {t.homeOrDebt === 'debt' && <span className="ml-1 text-[10px] bg-warning/20 text-warning rounded px-1">DEBT</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.person} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <span className={cn('text-sm font-semibold ml-2 shrink-0', t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-info')}>
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