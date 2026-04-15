import { useFinance } from '@/contexts/FinanceContext';
import {
  getTotalBalance,
  getHomeDebtSummary,
  getMonthTransactions,
  getAccountBalance,
} from '@/lib/financial-store';
import { ACCOUNTS, getCashAccounts, getBankAccounts, MONTH_NAMES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Home, CreditCard } from 'lucide-react';

export default function Reports() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const totals = getTotalBalance(
    state.transactions, selectedYear, selectedMonth,
    state.initialBalances, state.accountBalances
  );
  const homeDebt = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);

  const cashAccounts = getCashAccounts();
  const bankAccounts = getBankAccounts();

  const getAccBal = (id: string) =>
    getAccountBalance(state.transactions, id, selectedYear, selectedMonth, state.accountBalances);

  const totalCashOpening = cashAccounts.reduce((s, a) => s + getAccBal(a.id).opening, 0);
  const totalCashClosing = cashAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const totalOnlineOpening = bankAccounts.reduce((s, a) => s + getAccBal(a.id).opening, 0);
  const totalOnlineClosing = bankAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const overallOpening = totalCashOpening + totalOnlineOpening;
  const overallClosing = totalCashClosing + totalOnlineClosing;

  // Previous month for comparison
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevTotals = getTotalBalance(
    state.transactions, prevYear, prevMonth,
    state.initialBalances, state.accountBalances
  );
  const diff = overallClosing - prevTotals.closing;

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const fmtSigned = (n: number) => `${n >= 0 ? '+' : '-'}₹${Math.abs(n).toLocaleString('en-IN')}`;

  const savingsRate = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100)
    : 0;

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Monthly Summary</h1>
        <MonthSelector />
      </div>

      <p className="text-sm text-muted-foreground -mt-1">
        {MONTH_NAMES[selectedMonth]} {selectedYear}
      </p>

      {/* ── OPENING & ENDING BALANCE CARD ───────────────────────── */}
      <div className="glass-card rounded-2xl p-5 border border-primary/20">
        <h2 className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Balance Flow</h2>

        <div className="space-y-3">
          {/* Opening */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Opening Balance</p>
                <p className="text-base font-bold text-foreground">{fmt(overallOpening)}</p>
              </div>
            </div>
          </div>

          {/* Income */}
          <div className="flex items-center justify-between pl-4 border-l-2 border-success/40">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-sm text-muted-foreground">+ Total Income</p>
            </div>
            <p className="text-sm font-bold text-success">+{fmt(totals.income)}</p>
          </div>

          {/* Expense */}
          <div className="flex items-center justify-between pl-4 border-l-2 border-destructive/40">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-sm text-muted-foreground">- Total Expense</p>
            </div>
            <p className="text-sm font-bold text-destructive">-{fmt(totals.expense)}</p>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50 pt-2" />

          {/* Ending */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center',
                overallClosing >= overallOpening ? 'bg-success/15' : 'bg-destructive/15'
              )}>
                <Wallet className={cn('h-4 w-4', overallClosing >= overallOpening ? 'text-success' : 'text-destructive')} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ending Balance</p>
                <p className={cn('text-xl font-bold', overallClosing >= overallOpening ? 'text-success' : 'text-destructive')}>
                  {fmt(overallClosing)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">vs last month</p>
              <p className={cn('text-sm font-semibold flex items-center gap-1', diff >= 0 ? 'text-success' : 'text-destructive')}>
                {diff >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {fmtSigned(diff)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUMMARY STAT CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Income</p>
          <p className="text-lg font-bold text-success">{fmt(totals.income)}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Home</span><span>{fmt(homeDebt.homeIncome)}</span>
            </div>
            <Progress value={totals.income > 0 ? (homeDebt.homeIncome / totals.income) * 100 : 0} className="h-1 [&>div]:bg-success" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Debt</span><span>{fmt(homeDebt.debtIncome)}</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Expense</p>
          <p className="text-lg font-bold text-destructive">{fmt(totals.expense)}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Home</span><span>{fmt(homeDebt.homeExpense)}</span>
            </div>
            <Progress value={totals.expense > 0 ? (homeDebt.homeExpense / totals.expense) * 100 : 0} className="h-1 [&>div]:bg-destructive" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Debt</span><span>{fmt(homeDebt.debtExpense)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Savings rate card */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Savings Rate</p>
          <span className={cn(
            'text-lg font-bold',
            savingsRate >= 20 ? 'text-success' : savingsRate >= 0 ? 'text-warning' : 'text-destructive'
          )}>
            {savingsRate}%
          </span>
        </div>
        <Progress
          value={Math.max(0, Math.min(savingsRate, 100))}
          className={cn(
            'h-3',
            savingsRate >= 20 ? '[&>div]:bg-success' :
            savingsRate >= 0 ? '[&>div]:bg-warning' :
            '[&>div]:bg-destructive'
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Net: {totals.income - totals.expense >= 0 ? '+' : ''}{fmt(totals.income - totals.expense)}</span>
          <span>{savingsRate >= 20 ? '✅ Great!' : savingsRate >= 0 ? '⚠️ Low' : '🔴 Overspent'}</span>
        </div>
      </div>

      {/* ── HOME vs DEBT SPLIT ──────────────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Home vs Debt Split</h2>

        {/* Home */}
        <div className="rounded-xl bg-success/8 p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Home className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold text-success">Home</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium text-success">+{fmt(homeDebt.homeIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expense</span>
              <span className="font-medium text-destructive">-{fmt(homeDebt.homeExpense)}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-sm">
              <span>Balance</span>
              <span className={homeDebt.homeBalance >= 0 ? 'text-success' : 'text-destructive'}>
                {homeDebt.homeBalance >= 0 ? '+' : '-'}{fmt(homeDebt.homeBalance)}
              </span>
            </div>
          </div>
          {homeDebt.homeIncome > 0 && (
            <Progress
              value={Math.min((homeDebt.homeExpense / homeDebt.homeIncome) * 100, 100)}
              className="h-1.5 mt-2 [&>div]:bg-success"
            />
          )}
        </div>

        {/* Debt */}
        <div className="rounded-xl bg-warning/8 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-warning" />
            <span className="text-sm font-semibold text-warning">Debt</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium text-success">+{fmt(homeDebt.debtIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expense</span>
              <span className="font-medium text-destructive">-{fmt(homeDebt.debtExpense)}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-sm">
              <span>Balance</span>
              <span className={homeDebt.debtBalance >= 0 ? 'text-success' : 'text-destructive'}>
                {homeDebt.debtBalance >= 0 ? '+' : '-'}{fmt(homeDebt.debtBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Grand Total */}
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
          <div className="flex justify-between text-sm font-bold">
            <span>Total Income</span>
            <span className="text-success">+{fmt(homeDebt.totalIncome)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Total Expense</span>
            <span className="text-destructive">-{fmt(homeDebt.totalExpense)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-primary pt-1 border-t border-border/50">
            <span>Net Balance</span>
            <span>{homeDebt.totalBalance >= 0 ? '+' : '-'}{fmt(homeDebt.totalBalance)}</span>
          </div>
        </div>
      </div>

      {/* ── ACCOUNT BALANCES CARD ───────────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Account Balances</h2>

        {/* Cash */}
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Cash</p>
        <div className="space-y-1.5 mb-4">
          {cashAccounts.map(acc => {
            const bal = getAccBal(acc.id);
            return (
              <div key={acc.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{acc.name}</span>
                <div className="flex gap-6">
                  <span className="text-muted-foreground w-20 text-right">{fmt(bal.opening)}</span>
                  <span className={cn('font-medium w-20 text-right', bal.closing < 0 ? 'text-destructive' : '')}>{fmt(bal.closing)}</span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-border/40">
            <span>Total Cash</span>
            <div className="flex gap-6">
              <span className="w-20 text-right">{fmt(totalCashOpening)}</span>
              <span className="w-20 text-right">{fmt(totalCashClosing)}</span>
            </div>
          </div>
        </div>

        {/* Bank */}
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Bank / Online</p>
        <div className="space-y-1.5 mb-2">
          {bankAccounts.map(acc => {
            const bal = getAccBal(acc.id);
            return (
              <div key={acc.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{acc.name}</span>
                <div className="flex gap-6">
                  <span className="text-muted-foreground w-20 text-right">{fmt(bal.opening)}</span>
                  <span className={cn('font-medium w-20 text-right', bal.closing < 0 ? 'text-destructive' : '')}>{fmt(bal.closing)}</span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-border/40">
            <span>Total Online</span>
            <div className="flex gap-6">
              <span className="w-20 text-right">{fmt(totalOnlineOpening)}</span>
              <span className="w-20 text-right">{fmt(totalOnlineClosing)}</span>
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex justify-end gap-6 text-xs text-muted-foreground mb-1 pr-0">
          <span className="w-20 text-right">Opening</span>
          <span className="w-20 text-right">Closing</span>
        </div>

        <div className="flex items-center justify-between text-sm font-bold text-primary pt-2 border-t border-border/50">
          <span>Overall Total</span>
          <div className="flex gap-6">
            <span className="w-20 text-right">{fmt(overallOpening)}</span>
            <span className="w-20 text-right">{fmt(overallClosing)}</span>
          </div>
        </div>
      </div>

      <TransactionForm />
    </div>
  );
}