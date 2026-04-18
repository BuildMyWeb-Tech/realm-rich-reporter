import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getPersonBalance, getMonthTransactions } from '@/lib/financial-store';
import { PERSONS, Person, ACCOUNTS, MONTH_NAMES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Users, TrendingUp, TrendingDown, ArrowRight,
  Wallet, Crown, AlertCircle, ArrowLeftRight, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const TXN_PAGE_SIZE = 20;

const PERSON_COLORS: Record<Person, { bg: string; text: string; border: string }> = {
  Appa:  { bg: 'bg-blue-500/15',    text: 'text-blue-400',  border: 'border-blue-500/30' },
  Amma:  { bg: 'bg-pink-500/15',    text: 'text-pink-400',  border: 'border-pink-500/30' },
  Ajai:  { bg: 'bg-success/15',     text: 'text-success',   border: 'border-success/30'  },
  Mauli: { bg: 'bg-warning/15',     text: 'text-warning',   border: 'border-warning/30'  },
};

const PERSON_EMOJI: Record<Person, string> = {
  Appa: '👨', Amma: '👩', Ajai: '👦', Mauli: '👧',
};

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">{icon}<span>{title}</span></div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Person Transaction Detail Panel ────────────────────────────────────────
function PersonTxnPanel({ person, txns, colors }: {
  person: Person;
  txns: ReturnType<typeof getMonthTransactions>;
  colors: { bg: string; text: string; border: string };
}) {
  const [page, setPage] = useState(1);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  // Only income + expense for this person (exclude transfers from I/E counts)
  const personTxns = useMemo(() =>
    txns
      .filter(t => t.person === person)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [txns, person]
  );

  const totalPages = Math.max(1, Math.ceil(personTxns.length / TXN_PAGE_SIZE));
  const paged = personTxns.slice((page - 1) * TXN_PAGE_SIZE, page * TXN_PAGE_SIZE);

  if (personTxns.length === 0) return (
    <p className="text-xs text-muted-foreground py-2 text-center">No transactions this month</p>
  );

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
        All Transactions ({personTxns.length})
      </p>
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {paged.map(t => (
          <div key={t.id}
            className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/30 border-b border-border/20 last:border-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                t.type === 'income'   ? 'bg-success/20 text-success' :
                t.type === 'transfer' ? 'bg-blue-500/20 text-blue-500' :
                                        'bg-destructive/20 text-destructive'
              )}>
                {t.type === 'income' ? '↑' : t.type === 'transfer' ? '↔' : '↓'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium max-w-[120px]">
                  {t.type === 'transfer' ? `Transfer → ${t.transferTo}` : t.category}
                </p>
                {t.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{t.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <span className={cn('font-semibold tabular-nums',
                t.type === 'income'   ? 'text-success' :
                t.type === 'transfer' ? 'text-blue-500' : 'text-destructive')}>
                {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{fmt(t.amount)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1} className="h-7 w-7 p-0">
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {page} / {totalPages} · {personTxns.length} total
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages} className="h-7 w-7 p-0">
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PersonWisePage() {
  const { state, selectedYear, selectedMonth, addTransaction } = useFinance();

  const fmt  = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const fmtK = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000)   return `₹${(Math.abs(n) / 1000).toFixed(1)}k`;
    return `₹${Math.abs(n)}`;
  };

  // ── Per-person data ────────────────────────────────────────────────────────
  const personData = useMemo(() =>
    PERSONS.map(person => {
      const bal = getPersonBalance(
        state.transactions, person,
        selectedYear, selectedMonth,
        state.initialBalances, state.accountBalances
      );
      return { person, ...bal };
    }),
    [state.transactions, state.initialBalances, state.accountBalances, selectedYear, selectedMonth]
  );

  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  // Totals: EXCLUDE transfers from income/expense
  const totalIncome  = personData.reduce((s, p) => s + p.income, 0);
  const totalExpense = personData.reduce((s, p) => s + p.expense, 0);

  // Note: getPersonBalance already handles transfers as balance-shift only
  // (deducts from sender, adds to receiver) so income/expense remain pure.

  const highestSpender = [...personData].sort((a, b) => b.expense - a.expense)[0];
  const highestEarner  = [...personData].sort((a, b) => b.income  - a.income )[0];

  // ── Transfer form ──────────────────────────────────────────────────────────
  const [transferForm, setTransferForm] = useState({
    from: '' as string, to: '' as string,
    fromAccount: '', toAccount: '',
    amount: '', notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fromAccounts = transferForm.from ? ACCOUNTS.filter(a => a.person === transferForm.from as Person) : [];
  const toAccounts   = transferForm.to   ? ACCOUNTS.filter(a => a.person === transferForm.to   as Person) : [];

  const doTransfer = async () => {
    if (!transferForm.from || !transferForm.to || !transferForm.amount) { toast.error('Fill all required fields'); return; }
    if (transferForm.from === transferForm.to) { toast.error('Cannot transfer to same person'); return; }
    if (Number(transferForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    const d = new Date(transferForm.date);
    await addTransaction({
      date: transferForm.date, year: d.getFullYear(), month: d.getMonth(),
      person: transferForm.from as Person, type: 'transfer', category: 'Transfer',
      amount: Number(transferForm.amount), paymentMode: 'bank',
      notes: transferForm.notes || `Transfer: ${transferForm.from} → ${transferForm.to}`,
      transferTo: transferForm.to as Person,
      accountId: transferForm.fromAccount || undefined,
      transferToAccountId: transferForm.toAccount || undefined,
      homeOrDebt: 'home',
    });
    toast.success(`Transfer: ${transferForm.from} → ${transferForm.to} · ${fmt(Number(transferForm.amount))}`);
    setTransferForm({ from: '', to: '', fromAccount: '', toAccount: '', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
  };

  const transferHistory = monthTxns
    .filter(t => t.type === 'transfer')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [expandedPerson, setExpandedPerson] = useState<Person | null>(null);

  return (
    <div className="pb-20 px-4 pt-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Person-wise
        </h1>
        <MonthSelector />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>

      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Crown className="h-3.5 w-3.5 text-warning" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Top Earner</span>
          </div>
          <p className="text-sm font-bold">{PERSON_EMOJI[highestEarner?.person]} {highestEarner?.person}</p>
          <p className="text-xs text-success font-semibold">{fmt(highestEarner?.income || 0)}</p>
        </div>
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Top Spender</span>
          </div>
          <p className="text-sm font-bold">{PERSON_EMOJI[highestSpender?.person]} {highestSpender?.person}</p>
          <p className="text-xs text-destructive font-semibold">{fmt(highestSpender?.expense || 0)}</p>
        </div>
      </div>

      {/* ── Individual Balances ── */}
      <Section title="Individual Balances" icon={<Users className="h-4 w-4 text-primary" />}>
        <div className="overflow-x-auto">
          <div className="min-w-[380px]">
            {/* Header */}
            <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-2 border-b border-border/40">
              <span className="w-20">Person</span>
              <span className="flex-1 text-right">Income</span>
              <span className="flex-1 text-right">Expense</span>
              <span className="flex-1 text-right">Balance</span>
            </div>

            <div className="space-y-1 mt-1">
              {personData.map(({ person, income, expense, closing, opening }) => {
                const colors    = PERSON_COLORS[person];
                const isExpanded = expandedPerson === person;
                const spendPct  = income > 0 ? Math.min((expense / income) * 100, 100) : 0;

                return (
                  <div key={person}>
                    <button
                      className={cn(
                        'w-full rounded-xl px-2 py-2.5 transition-all text-left',
                        isExpanded ? `${colors.bg} border ${colors.border}` : 'hover:bg-muted/30'
                      )}
                      onClick={() => setExpandedPerson(isExpanded ? null : person)}
                    >
                      <div className="flex items-center gap-2 min-w-[360px]">
                        <div className="w-20 flex items-center gap-1.5 shrink-0">
                          <span className="text-base">{PERSON_EMOJI[person]}</span>
                          <span className={cn('text-xs font-bold', colors.text)}>{person}</span>
                        </div>
                        <span className={cn('flex-1 text-right text-xs font-semibold tabular-nums',
                          income > 0 ? 'text-success' : 'text-muted-foreground')}>
                          {income > 0 ? fmt(income) : '—'}
                        </span>
                        <span className={cn('flex-1 text-right text-xs font-semibold tabular-nums',
                          expense > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                          {expense > 0 ? fmt(expense) : '—'}
                        </span>
                        <span className={cn('flex-1 text-right text-xs font-bold tabular-nums',
                          closing >= 0 ? 'text-success' : 'text-destructive')}>
                          {closing >= 0 ? '+' : ''}{fmtK(closing)}
                        </span>
                      </div>
                      {(income > 0 || expense > 0) && (
                        <div className="mt-1.5">
                          <Progress value={spendPct}
                            className={cn('h-1',
                              spendPct >= 100 ? '[&>div]:bg-destructive' :
                              spendPct >= 80  ? '[&>div]:bg-warning'     :
                              '[&>div]:bg-primary')} />
                        </div>
                      )}
                    </button>

                    {/* Expanded: stats + ALL transactions (paginated) */}
                    {isExpanded && (
                      <div className={cn('rounded-b-xl border-x border-b px-3 py-3 mb-1 space-y-3', colors.border, colors.bg)}>
                        {/* Mini stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Opening</p>
                            <p className="text-xs font-bold tabular-nums">{fmtK(opening)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Net</p>
                            <p className={cn('text-xs font-bold tabular-nums',
                              income - expense >= 0 ? 'text-success' : 'text-destructive')}>
                              {income - expense >= 0 ? '+' : ''}{fmtK(income - expense)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Closing</p>
                            <p className={cn('text-xs font-bold tabular-nums',
                              closing >= 0 ? 'text-success' : 'text-destructive')}>
                              {fmtK(closing)}
                            </p>
                          </div>
                        </div>
                        {/* ALL transactions for this person */}
                        <PersonTxnPanel
                          person={person}
                          txns={monthTxns}
                          colors={colors}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals row */}
            <div className="flex items-center gap-2 px-2 py-2 border-t border-border/50 mt-1 text-xs font-bold">
              <span className="w-20 shrink-0 text-muted-foreground">Total</span>
              <span className="flex-1 text-right text-success tabular-nums">{fmt(totalIncome)}</span>
              <span className="flex-1 text-right text-destructive tabular-nums">{fmt(totalExpense)}</span>
              <span className={cn('flex-1 text-right tabular-nums',
                totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive')}>
                {totalIncome - totalExpense >= 0 ? '+' : ''}{fmtK(totalIncome - totalExpense)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Internal Transfer ── */}
      <Section title="Internal Transfer" icon={<ArrowLeftRight className="h-4 w-4 text-primary" />} defaultOpen={false}>
        <div className="mt-2 space-y-1.5">
          <div className="rounded-lg bg-primary/5 border border-primary/15 p-2.5 mb-3">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-primary">↔ Balance Shift Only</span> — Transfers move money
              between family members but are <em>not counted as income or expense</em>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From Person</Label>
              <Select value={transferForm.from}
                onValueChange={v => setTransferForm(f => ({ ...f, from: v, fromAccount: '' }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="From" /></SelectTrigger>
                <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{PERSON_EMOJI[p]} {p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">To Person</Label>
              <Select value={transferForm.to}
                onValueChange={v => setTransferForm(f => ({ ...f, to: v, toAccount: '' }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="To" /></SelectTrigger>
                <SelectContent>
                  {PERSONS.filter(p => p !== transferForm.from).map(p => (
                    <SelectItem key={p} value={p}>{PERSON_EMOJI[p]} {p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {transferForm.from && transferForm.to && (
            <div className="flex items-center justify-center gap-3 py-1">
              <span className={cn('text-sm font-bold', PERSON_COLORS[transferForm.from as Person]?.text)}>
                {PERSON_EMOJI[transferForm.from as Person]} {transferForm.from}
              </span>
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className={cn('text-sm font-bold', PERSON_COLORS[transferForm.to as Person]?.text)}>
                {PERSON_EMOJI[transferForm.to as Person]} {transferForm.to}
              </span>
            </div>
          )}

          {fromAccounts.length > 0 && (
            <div>
              <Label className="text-xs">From Account (optional)</Label>
              <Select value={transferForm.fromAccount}
                onValueChange={v => setTransferForm(f => ({ ...f, fromAccount: v }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{fromAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {toAccounts.length > 0 && (
            <div>
              <Label className="text-xs">To Account (optional)</Label>
              <Select value={transferForm.toAccount}
                onValueChange={v => setTransferForm(f => ({ ...f, toAccount: v }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{toAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" placeholder="0" value={transferForm.amount}
                onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={transferForm.date}
                onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input placeholder="e.g. Ajai paid for Appa's medicine" value={transferForm.notes}
              onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" />
          </div>

          <Button onClick={doTransfer} className="w-full gradient-primary text-primary-foreground mt-1" size="sm"
            disabled={!transferForm.from || !transferForm.to || !transferForm.amount}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Record Transfer
          </Button>
        </div>

        {transferHistory.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Transfer History — {MONTH_NAMES[selectedMonth]}
            </p>
            <div className="space-y-1.5">
              {transferHistory.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs rounded-lg bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{t.person}</span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <span className="font-semibold">{t.transferTo}</span>
                    <span className="text-muted-foreground text-[10px] ml-1">
                      {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.notes && t.notes !== 'Transfer' && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{t.notes}</span>
                    )}
                    <span className="font-bold text-primary tabular-nums">{fmt(t.amount)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold pt-1">
                <span className="text-muted-foreground">Total transferred</span>
                <span className="text-primary tabular-nums">
                  {fmt(transferHistory.reduce((s, t) => s + t.amount, 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </Section>

      <TransactionForm />
    </div>
  );
}