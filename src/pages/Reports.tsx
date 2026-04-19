import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getTotalBalance, getHomeDebtSummary, getMonthTransactions,
  getAccountBalance, getOverspendCategories,
} from '@/lib/financial-store';
import {
  ACCOUNTS, getCashAccounts, getBankAccounts, MONTH_NAMES,
  DEFAULT_EXPECTED_INCOME, DEFAULT_EXPECTED_DEBT_EXPENSE,
  HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES, DEBT_EXPENSE_CATEGORIES,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import DataControls from '@/components/DataControls';
import OverspendAnalytics from '@/components/OverspendAnalytics';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  Home, CreditCard, FileDown, BarChart2,
} from 'lucide-react';
import { toast } from 'sonner';

type ReportTab = 'summary' | 'analytics';

export default function Reports() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

  const totals   = getTotalBalance(state.transactions, selectedYear, selectedMonth, state.initialBalances, state.accountBalances);
  const homeDebt = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);
  const monthTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth);

  const cashAccounts = getCashAccounts();
  const bankAccounts = getBankAccounts();
  const getAccBal = (id: string) => getAccountBalance(state.transactions, id, selectedYear, selectedMonth, state.accountBalances);

  const totalCashOpening   = cashAccounts.reduce((s, a) => s + getAccBal(a.id).opening, 0);
  const totalCashClosing   = cashAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const totalOnlineOpening = bankAccounts.reduce((s, a) => s + getAccBal(a.id).opening, 0);
  const totalOnlineClosing = bankAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const overallOpening     = totalCashOpening + totalOnlineOpening;
  const overallClosing     = totalCashClosing + totalOnlineClosing;

  const prevMonth  = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear   = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevTotals = getTotalBalance(state.transactions, prevYear, prevMonth, state.initialBalances, state.accountBalances);
  const diff       = overallClosing - prevTotals.closing;

  const fmt       = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const fmtSigned = (n: number) => `${n >= 0 ? '+' : '-'}₹${Math.abs(n).toLocaleString('en-IN')}`;

  const savingsRate = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;

  const expenseCategories = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);

  const debtActuals: Record<string, number> = {};
  const homeIncomeActuals: Record<string, number> = {};
  const debtIncomeActuals: Record<string, number> = {};
  for (const t of monthTxns) {
    if (t.type === 'expense' && t.homeOrDebt === 'debt')
      debtActuals[t.category] = (debtActuals[t.category] || 0) + t.amount;
    if (t.type === 'income') {
      if (t.homeOrDebt === 'home')
        homeIncomeActuals[t.category] = (homeIncomeActuals[t.category] || 0) + t.amount;
      else
        debtIncomeActuals[t.category] = (debtIncomeActuals[t.category] || 0) + t.amount;
    }
  }

  const customHomeIncome   = (state.incomeSources  || []).filter(s => s.group === 'home');
  const customDebtIncome   = (state.incomeSources  || []).filter(s => s.group === 'debt');
  const customDebtExpense  = (state.expenseSources || []).filter(s => s.group === 'debt');

  const allHomeIncomeCategories  = [...HOME_INCOME_CATEGORIES,  ...customHomeIncome.map(s => s.name)];
  const allDebtIncomeCategories  = [...DEBT_INCOME_CATEGORIES,  ...customDebtIncome.map(s => s.name)];
  const allDebtExpenseCategories = [...DEBT_EXPENSE_CATEGORIES, ...customDebtExpense.map(s => s.name)];

  const getIncomeExpected  = (cat: string) => DEFAULT_EXPECTED_INCOME[cat] ?? 0;
  const getDebtExpExpected = (cat: string) => DEFAULT_EXPECTED_DEBT_EXPENSE[cat] ?? 0;

  // ── Account Balance Row helper ─────────────────────────────────────────────
  const AccRow = ({ label, opening, closing, bold = false }: {
    label: string; opening: number; closing: number; bold?: boolean;
  }) => {
    const diff = closing - opening;
    return (
      <div className={cn('flex items-center justify-between text-xs py-1',
        bold ? 'font-bold border-t border-border/40 pt-2 mt-1' : '')}>
        <span className={bold ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
        <div className="flex gap-0 text-right">
          {/* Opening */}
          <span className="w-20 tabular-nums text-right">{fmt(opening)}</span>
          {/* Closing */}
          <span className={cn('w-20 tabular-nums text-right ml-4',
            bold ? '' : closing < 0 ? 'text-destructive' : '')}>{fmt(closing)}</span>
          {/* Difference — new column */}
          {/* <span className={cn('w-24 tabular-nums text-right ml-4 font-semibold',
            diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {diff > 0 ? `+${fmt(diff)}` : diff < 0 ? `-${fmt(Math.abs(diff))}` : '₹0'}
          </span> */}
        </div>
      </div>
    );
  };


  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Monthly Summary</h1>
        <MonthSelector />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
  <p className="text-sm text-muted-foreground">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>
  <DataControls year={selectedYear} month={selectedMonth} />
</div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
        {(['summary', 'analytics'] as ReportTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('flex-1 text-xs font-semibold rounded-lg py-2 transition-all flex items-center justify-center gap-1',
              activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {tab === 'summary' ? '📊 Monthly Summary' : <><BarChart2 className="h-3 w-3" /> Overspend Analytics</>}
          </button>
        ))}
      </div>

      {activeTab === 'analytics' ? <OverspendAnalytics /> : (
        <>
          {/* Balance Flow */}
          <div className="glass-card rounded-2xl p-5 border border-primary/20">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Balance Flow</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="text-base font-bold tabular-nums">{fmt(overallOpening)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pl-4 border-l-2 border-success/40">
                <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /><p className="text-sm text-muted-foreground">+ Total Income</p></div>
                <p className="text-sm font-bold text-success tabular-nums">+{fmt(totals.income)}</p>
              </div>
              <div className="flex items-center justify-between pl-4 border-l-2 border-destructive/40">
                <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /><p className="text-sm text-muted-foreground">- Total Expense</p></div>
                <p className="text-sm font-bold text-destructive tabular-nums">-{fmt(totals.expense)}</p>
              </div>
              <div className="border-t border-border/50 pt-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center',
                    overallClosing >= overallOpening ? 'bg-success/15' : 'bg-destructive/15')}>
                    <Wallet className={cn('h-4 w-4', overallClosing >= overallOpening ? 'text-success' : 'text-destructive')} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ending Balance</p>
                    <p className={cn('text-xl font-bold tabular-nums',
                      overallClosing >= overallOpening ? 'text-success' : 'text-destructive')}>
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

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Income</p>
              <p className="text-lg font-bold text-success tabular-nums">{fmt(totals.income)}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Home</span><span className="tabular-nums">{fmt(homeDebt.homeIncome)}</span></div>
                <Progress value={totals.income > 0 ? (homeDebt.homeIncome / totals.income) * 100 : 0} className="h-1 [&>div]:bg-success" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Debt</span><span className="tabular-nums">{fmt(homeDebt.debtIncome)}</span></div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Expense</p>
              <p className="text-lg font-bold text-destructive tabular-nums">{fmt(totals.expense)}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Home</span><span className="tabular-nums">{fmt(homeDebt.homeExpense)}</span></div>
                <Progress value={totals.expense > 0 ? (homeDebt.homeExpense / totals.expense) * 100 : 0} className="h-1 [&>div]:bg-destructive" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Debt</span><span className="tabular-nums">{fmt(homeDebt.debtExpense)}</span></div>
              </div>
            </div>
          </div>

          {/* Savings rate */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Savings Rate</p>
              <span className={cn('text-lg font-bold', savingsRate >= 20 ? 'text-success' : savingsRate >= 0 ? 'text-warning' : 'text-destructive')}>
                {savingsRate}%
              </span>
            </div>
            <Progress value={Math.max(0, Math.min(savingsRate, 100))}
              className={cn('h-3', savingsRate >= 20 ? '[&>div]:bg-success' : savingsRate >= 0 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive')} />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span className="tabular-nums">Net: {totals.income - totals.expense >= 0 ? '+' : ''}{fmt(totals.income - totals.expense)}</span>
              <span>{savingsRate >= 20 ? '✅ Great!' : savingsRate >= 0 ? '⚠️ Low' : '🔴 Overspent'}</span>
            </div>
          </div>

          {/* Home vs Debt */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-4">Home vs Debt Split</h2>
            <div className="rounded-xl bg-success/8 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2"><Home className="h-4 w-4 text-success" /><span className="text-sm font-semibold text-success">Home</span></div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="font-medium text-success tabular-nums">+{fmt(homeDebt.homeIncome)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expense</span><span className="font-medium text-destructive tabular-nums">-{fmt(homeDebt.homeExpense)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-sm">
                  <span>Balance</span>
                  <span className={cn('tabular-nums', homeDebt.homeBalance >= 0 ? 'text-success' : 'text-destructive')}>
                    {homeDebt.homeBalance >= 0 ? '+' : '-'}{fmt(homeDebt.homeBalance)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-warning/8 p-3">
              <div className="flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-warning" /><span className="text-sm font-semibold text-warning">Debt</span></div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="font-medium text-success tabular-nums">+{fmt(homeDebt.debtIncome)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expense</span><span className="font-medium text-destructive tabular-nums">-{fmt(homeDebt.debtExpense)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-sm">
                  <span>Balance</span>
                  <span className={cn('tabular-nums', homeDebt.debtBalance >= 0 ? 'text-success' : 'text-destructive')}>
                    {homeDebt.debtBalance >= 0 ? '+' : '-'}{fmt(homeDebt.debtBalance)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
              <div className="flex justify-between text-sm font-bold"><span>Total Income</span><span className="text-success tabular-nums">+{fmt(homeDebt.totalIncome)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>Total Expense</span><span className="text-destructive tabular-nums">-{fmt(homeDebt.totalExpense)}</span></div>
              <div className="flex justify-between text-base font-bold text-primary pt-1 border-t border-border/50">
                <span>Net Balance</span>
                <span className="tabular-nums">{homeDebt.totalBalance >= 0 ? '+' : '-'}{fmt(homeDebt.totalBalance)}</span>
              </div>
            </div>
          </div>

          {/* ── Account Balances table with DIFFERENCE column ── */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Account Balances</h2>

            {/* Column headers */}
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <span className="flex-1">Account</span>
              <div className="flex gap-0">
                <span className="w-20 text-right">Opening</span>
                <span className="w-20 text-right ml-4">Closing</span>
              </div>
            </div>

            {/* CASH */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Cash</p>
            <div className="space-y-0.5 mb-3">
              {cashAccounts.map(acc => {
                const bal = getAccBal(acc.id);
                return <AccRow key={acc.id} label={acc.name} opening={bal.opening} closing={bal.closing} />;
              })}
              <AccRow label="Total Cash" opening={totalCashOpening} closing={totalCashClosing} bold />
            </div>

            {/* BANK */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Bank / Online</p>
            <div className="space-y-0.5 mb-3">
              {bankAccounts.map(acc => {
                const bal = getAccBal(acc.id);
                return <AccRow key={acc.id} label={acc.name} opening={bal.opening} closing={bal.closing} />;
              })}
              <AccRow label="Total Bank" opening={totalOnlineOpening} closing={totalOnlineClosing} bold />
            </div>

            {/* OVERALL */}
            <AccRow label="Overall Total" opening={overallOpening} closing={overallClosing} bold />
          </div>
        </>
      )}

      <TransactionForm />
    </div>
  );
}