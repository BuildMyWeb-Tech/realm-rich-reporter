import { useFinance } from '@/contexts/FinanceContext';
import {
  getTotalBalance,
  getHomeDebtSummary,
  getMonthTransactions,
  getAccountBalance,
  getOverspendCategories,
} from '@/lib/financial-store';
import {
  ACCOUNTS, getCashAccounts, getBankAccounts, MONTH_NAMES,
  DEFAULT_EXPECTED_INCOME, DEFAULT_EXPECTED_DEBT_EXPENSE,
  HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  DEBT_EXPENSE_CATEGORIES,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Home, CreditCard, FileDown } from 'lucide-react';
import { toast } from 'sonner';

export default function Reports() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const totals = getTotalBalance(
    state.transactions, selectedYear, selectedMonth,
    state.initialBalances, state.accountBalances
  );
  const homeDebt = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);
  const monthTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth);

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

  // ── Expense overspend data for PDF ────────────────────────────────────────
  const expenseCategories = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);

  // ── Debt expense actuals ──────────────────────────────────────────────────
  const debtActuals: Record<string, number> = {};
  for (const t of monthTxns) {
    if (t.type === 'expense' && t.homeOrDebt === 'debt') {
      debtActuals[t.category] = (debtActuals[t.category] || 0) + t.amount;
    }
  }

  // ── Income actuals ────────────────────────────────────────────────────────
  const homeIncomeActuals: Record<string, number> = {};
  const debtIncomeActuals: Record<string, number> = {};
  for (const t of monthTxns) {
    if (t.type === 'income') {
      if (t.homeOrDebt === 'home') {
        homeIncomeActuals[t.category] = (homeIncomeActuals[t.category] || 0) + t.amount;
      } else {
        debtIncomeActuals[t.category] = (debtIncomeActuals[t.category] || 0) + t.amount;
      }
    }
  }

  // Custom sources from settings
  const customHomeIncome = (state.incomeSources || []).filter(s => s.group === 'home');
  const customDebtIncome = (state.incomeSources || []).filter(s => s.group === 'debt');
  const customHomeExpense = (state.expenseSources || []).filter(s => s.group === 'home');
  const customDebtExpense = (state.expenseSources || []).filter(s => s.group === 'debt');

  const allHomeIncomeCategories = [...HOME_INCOME_CATEGORIES, ...customHomeIncome.map(s => s.name)];
  const allDebtIncomeCategories = [...DEBT_INCOME_CATEGORIES, ...customDebtIncome.map(s => s.name)];
  const allDebtExpenseCategories = [...DEBT_EXPENSE_CATEGORIES, ...customDebtExpense.map(s => s.name)];

  const getIncomeExpected = (cat: string) => DEFAULT_EXPECTED_INCOME[cat] ?? 0;
  const getDebtExpExpected = (cat: string) => DEFAULT_EXPECTED_DEBT_EXPENSE[cat] ?? 0;

  // ── PDF Generation ────────────────────────────────────────────────────────
  const downloadPDF = () => {
    const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

    // Build HTML for the printable PDF
    const overspentItems = expenseCategories.filter(c => c.overspent);

    const tableStyle = `
      width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;
    `;
    const thStyle = `
      background: #1e293b; color: #f1f5f9; padding: 7px 10px; text-align: left;
      border: 1px solid #334155; font-weight: 600;
    `;
    const thRStyle = `${thStyle} text-align: right;`;
    const tdStyle = `padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px;`;
    const tdRStyle = `${tdStyle} text-align: right;`;
    const trEven = `background: #f8fafc;`;
    const sectionTitle = `
      font-size: 13px; font-weight: 700; color: #1e293b;
      margin: 18px 0 8px 0; border-left: 4px solid #6366f1; padding-left: 8px;
    `;
    const badge = (txt: string, color: string) =>
      `<span style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">${txt}</span>`;

    const buildIncomeTable = (
      title: string,
      cats: string[],
      actuals: Record<string, number>,
      getExp: (c: string) => number,
      accentColor: string,
    ) => {
      let rows = '';
      let totalExp = 0, totalAct = 0;
      cats.forEach((cat, i) => {
        const exp = getExp(cat);
        const act = actuals[cat] || 0;
        const bal = exp - act;
        totalExp += exp; totalAct += act;
        rows += `<tr style="${i % 2 === 1 ? trEven : ''}">
          <td style="${tdStyle}">${cat}</td>
          <td style="${tdRStyle}">₹${exp.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};color:${act > 0 ? '#16a34a' : '#94a3b8'}">₹${act.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};color:${bal > 0 ? '#d97706' : '#16a34a'};font-weight:600;">
            ${bal >= 0 ? '-' : '+'}₹${Math.abs(bal).toLocaleString('en-IN')}
          </td>
        </tr>`;
      });
      const totBal = totalExp - totalAct;
      return `
        <p style="${sectionTitle}">${title}</p>
        <table style="${tableStyle}">
          <thead>
            <tr>
              <th style="${thStyle}">Source</th>
              <th style="${thRStyle}">Expected</th>
              <th style="${thRStyle}">Actual</th>
              <th style="${thRStyle}">Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:${accentColor}20;font-weight:700;">
              <td style="${tdStyle};font-weight:700;">Total</td>
              <td style="${tdRStyle};font-weight:700;">₹${totalExp.toLocaleString('en-IN')}</td>
              <td style="${tdRStyle};font-weight:700;color:#16a34a;">₹${totalAct.toLocaleString('en-IN')}</td>
              <td style="${tdRStyle};font-weight:700;color:${totBal > 0 ? '#d97706' : '#16a34a'};">
                ${totBal >= 0 ? '-' : '+'}₹${Math.abs(totBal).toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>`;
    };

    const buildExpenseTable = (
      title: string,
      cats: { category: string; budget: number; actual: number; remaining: number; overspent: boolean }[],
      accentColor: string,
    ) => {
      let rows = '';
      let totalBudget = 0, totalActual = 0;
      cats.forEach((c, i) => {
        totalBudget += c.budget; totalActual += c.actual;
        rows += `<tr style="${i % 2 === 1 ? trEven : ''}">
          <td style="${tdStyle}">${c.overspent ? '⚠️ ' : ''}${c.category}</td>
          <td style="${tdRStyle}">₹${c.budget.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};color:${c.actual > 0 ? '#dc2626' : '#94a3b8'}">₹${c.actual.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};color:${c.remaining < 0 ? '#dc2626' : '#16a34a'};font-weight:600;">
            ${c.remaining >= 0 ? '₹' + c.remaining.toLocaleString('en-IN') : '-₹' + Math.abs(c.remaining).toLocaleString('en-IN')}
          </td>
        </tr>`;
      });
      const rem = totalBudget - totalActual;
      return `
        <p style="${sectionTitle}">${title}</p>
        <table style="${tableStyle}">
          <thead>
            <tr>
              <th style="${thStyle}">Category</th>
              <th style="${thRStyle}">Budget</th>
              <th style="${thRStyle}">Actual</th>
              <th style="${thRStyle}">Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:${accentColor}20;font-weight:700;">
              <td style="${tdStyle};font-weight:700;">Total</td>
              <td style="${tdRStyle};font-weight:700;">₹${totalBudget.toLocaleString('en-IN')}</td>
              <td style="${tdRStyle};font-weight:700;color:#dc2626;">₹${totalActual.toLocaleString('en-IN')}</td>
              <td style="${tdRStyle};font-weight:700;color:${rem >= 0 ? '#16a34a' : '#dc2626'};">
                ${rem >= 0 ? '₹' + rem.toLocaleString('en-IN') : '-₹' + Math.abs(rem).toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>`;
    };

    // Debt expense table rows
    const debtExpCats = allDebtExpenseCategories.map(cat => {
      const exp = getDebtExpExpected(cat);
      const act = debtActuals[cat] || 0;
      return { category: cat, budget: exp, actual: act, remaining: exp - act, overspent: act > exp && exp > 0 };
    });

    // Overspend breakdown
    const overspendRows = overspentItems.map((c, i) => `
      <tr style="${i % 2 === 1 ? trEven : ''}">
        <td style="${tdStyle}">${c.category}</td>
        <td style="${tdRStyle}">₹${c.budget.toLocaleString('en-IN')}</td>
        <td style="${tdRStyle};color:#dc2626;font-weight:600;">₹${c.actual.toLocaleString('en-IN')}</td>
        <td style="${tdRStyle};color:#dc2626;font-weight:700;">+₹${(c.actual - c.budget).toLocaleString('en-IN')}</td>
        <td style="${tdRStyle};">${Math.round(c.percent)}%</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Finance Report — ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 32px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #6366f1; }
    .header h1 { font-size: 22px; color: #6366f1; font-weight: 800; }
    .header p { font-size: 12px; color: #64748b; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .summary-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .summary-card .value { font-size: 16px; font-weight: 700; }
    .overspend-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .overspend-box h3 { font-size: 12px; font-weight: 700; color: #dc2626; margin-bottom: 8px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    .print-btn { background: #6366f1; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <div class="header">
    <div>
      <h1>Family Finance Report</h1>
      <p>${monthLabel} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:11px;color:#64748b;">Savings Rate</p>
      <p style="font-size:20px;font-weight:800;color:${savingsRate >= 20 ? '#16a34a' : savingsRate >= 0 ? '#d97706' : '#dc2626'}">${savingsRate}%</p>
    </div>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Income</div>
      <div class="value" style="color:#16a34a;">₹${totals.income.toLocaleString('en-IN')}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">Home ₹${homeDebt.homeIncome.toLocaleString('en-IN')} &nbsp;|&nbsp; Debt ₹${homeDebt.debtIncome.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Expense</div>
      <div class="value" style="color:#dc2626;">₹${totals.expense.toLocaleString('en-IN')}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">Home ₹${homeDebt.homeExpense.toLocaleString('en-IN')} &nbsp;|&nbsp; Debt ₹${homeDebt.debtExpense.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Balance</div>
      <div class="value" style="color:${homeDebt.totalBalance >= 0 ? '#16a34a' : '#dc2626'};">
        ${homeDebt.totalBalance >= 0 ? '+' : '-'}₹${Math.abs(homeDebt.totalBalance).toLocaleString('en-IN')}
      </div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">Opening ₹${overallOpening.toLocaleString('en-IN')} → Closing ₹${overallClosing.toLocaleString('en-IN')}</div>
    </div>
  </div>

  <!-- OVERSPEND ALERT BOX -->
  ${overspentItems.length > 0 ? `
  <div class="overspend-box">
    <h3>⚠️ Overspend Alert — ${overspentItems.length} categor${overspentItems.length === 1 ? 'y' : 'ies'} exceeded budget</h3>
    <p style="font-size:11px;color:#7f1d1d;">Total overspend: ₹${overspentItems.reduce((s, c) => s + (c.actual - c.budget), 0).toLocaleString('en-IN')}</p>
  </div>` : `
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 16px;margin-bottom:16px;">
    <p style="font-size:11px;color:#15803d;font-weight:600;">✅ All categories within budget this month!</p>
  </div>`}

  <!-- INCOME TABLES -->
  ${buildIncomeTable('🏠 Home Income', allHomeIncomeCategories, homeIncomeActuals, getIncomeExpected, '#16a34a')}
  ${buildIncomeTable('💳 Debt Income', allDebtIncomeCategories, debtIncomeActuals, getIncomeExpected, '#d97706')}

  <!-- EXPENSE TABLES -->
  ${buildExpenseTable('🏠 Home Expenses', expenseCategories, '#6366f1')}
  ${buildExpenseTable('💳 Debt Expenses', debtExpCats, '#d97706')}

  <!-- OVERSPEND BREAKDOWN TABLE -->
  ${overspentItems.length > 0 ? `
  <p style="${sectionTitle}">🔴 Overspend Breakdown</p>
  <table style="${tableStyle}">
    <thead>
      <tr>
        <th style="${thStyle}">Category</th>
        <th style="${thRStyle}">Budget</th>
        <th style="${thRStyle}">Spent</th>
        <th style="${thRStyle}">Over By</th>
        <th style="${thRStyle}">% Used</th>
      </tr>
    </thead>
    <tbody>${overspendRows}</tbody>
    <tfoot>
      <tr style="background:#fee2e220;font-weight:700;">
        <td style="${tdStyle};font-weight:700;">Total Overspend</td>
        <td style="${tdRStyle}">—</td>
        <td style="${tdRStyle}">—</td>
        <td style="${tdRStyle};color:#dc2626;font-weight:700;">
          +₹${overspentItems.reduce((s, c) => s + (c.actual - c.budget), 0).toLocaleString('en-IN')}
        </td>
        <td style="${tdRStyle}">—</td>
      </tr>
    </tfoot>
  </table>` : ''}

  <!-- ACCOUNT SUMMARY TABLE -->
  <p style="${sectionTitle}">🏦 Account Balances Summary</p>
  <table style="${tableStyle}">
    <thead>
      <tr>
        <th style="${thStyle}">Account</th>
        <th style="${thRStyle}">Type</th>
        <th style="${thRStyle}">Opening</th>
        <th style="${thRStyle}">Income</th>
        <th style="${thRStyle}">Expense</th>
        <th style="${thRStyle}">Closing</th>
      </tr>
    </thead>
    <tbody>
      ${ACCOUNTS.map((acc, i) => {
        const b = getAccBal(acc.id);
        if (b.opening === 0 && b.income === 0 && b.expense === 0) return '';
        return `<tr style="${i % 2 === 1 ? trEven : ''}">
          <td style="${tdStyle}">${acc.name}</td>
          <td style="${tdStyle}">${acc.type}</td>
          <td style="${tdRStyle}">₹${b.opening.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};color:#16a34a;">+₹${b.income.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};color:#dc2626;">-₹${b.expense.toLocaleString('en-IN')}</td>
          <td style="${tdRStyle};font-weight:600;color:${b.closing < 0 ? '#dc2626' : '#1e293b'};">₹${b.closing.toLocaleString('en-IN')}</td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="background:#eef2ff;font-weight:700;">
        <td style="${tdStyle};font-weight:700;" colspan="2">Overall Total</td>
        <td style="${tdRStyle};font-weight:700;">₹${overallOpening.toLocaleString('en-IN')}</td>
        <td style="${tdRStyle};font-weight:700;color:#16a34a;">+₹${totals.income.toLocaleString('en-IN')}</td>
        <td style="${tdRStyle};font-weight:700;color:#dc2626;">-₹${totals.expense.toLocaleString('en-IN')}</td>
        <td style="${tdRStyle};font-weight:700;color:#6366f1;">₹${overallClosing.toLocaleString('en-IN')}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Realm Rich Reporter &nbsp;·&nbsp; ${monthLabel}</span>
    <span>Generated ${new Date().toLocaleString('en-IN')}</span>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Allow popups to open the PDF');
      return;
    }
    win.document.write(html);
    win.document.close();
    toast.success('PDF opened — use Print → Save as PDF');
  };

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Monthly Summary</h1>
        <MonthSelector />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {MONTH_NAMES[selectedMonth]} {selectedYear}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={downloadPDF}
          className="gap-1.5 text-xs"
        >
          <FileDown className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      {/* ── OPENING & ENDING BALANCE CARD ───────────────────────── */}
      <div className="glass-card rounded-2xl p-5 border border-primary/20">
        <h2 className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Balance Flow</h2>

        <div className="space-y-3">
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

          <div className="flex items-center justify-between pl-4 border-l-2 border-success/40">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-sm text-muted-foreground">+ Total Income</p>
            </div>
            <p className="text-sm font-bold text-success">+{fmt(totals.income)}</p>
          </div>

          <div className="flex items-center justify-between pl-4 border-l-2 border-destructive/40">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-sm text-muted-foreground">- Total Expense</p>
            </div>
            <p className="text-sm font-bold text-destructive">-{fmt(totals.expense)}</p>
          </div>

          <div className="border-t border-border/50 pt-2" />

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