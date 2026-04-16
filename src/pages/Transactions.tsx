import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import {
  PERSONS, Transaction, HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, ACCOUNTS, PaymentMode, HomeOrDebt, Person,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Search, Pencil, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE_SIZE = 15;

function TxnDialog({ open, onClose, initial, mode, onSave }: {
  open: boolean; onClose: () => void;
  initial: Transaction; mode: 'edit' | 'copy';
  onSave: (t: Partial<Transaction>) => void;
}) {
  const { state } = useFinance();
  const [form, setForm] = useState<Partial<Transaction>>({ ...initial });

  const customIncome = state.incomeSources || [];
  const customExpense = state.expenseSources || [];

  const cats: string[] = form.type === 'income'
    ? form.homeOrDebt === 'home'
      ? [...HOME_INCOME_CATEGORIES, ...customIncome.filter(s => s.group === 'home').map(s => s.name)]
      : [...DEBT_INCOME_CATEGORIES, ...customIncome.filter(s => s.group === 'debt').map(s => s.name)]
    : form.type === 'expense'
      ? form.homeOrDebt === 'debt'
        ? [...DEBT_EXPENSE_CATEGORIES, ...customExpense.filter(s => s.group === 'debt').map(s => s.name)]
        : [...EXPENSE_CATEGORIES, ...customExpense.filter(s => s.group === 'home').map(s => s.name)]
      : [];

  const personAccounts = form.person ? ACCOUNTS.filter(a => a.person === form.person as Person) : [];
  const toAccounts = form.transferTo ? ACCOUNTS.filter(a => a.person === form.transferTo as Person) : [];

  const handleSave = () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.type !== 'transfer' && !form.category) { toast.error('Select a category'); return; }
    onSave(form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '✏️ Edit Transaction' : '📋 Copy Transaction'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs">Type</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(['expense', 'income', 'transfer'] as Transaction['type'][]).map(t => (
                <Button key={t} size="sm" variant={form.type === t ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, type: t, category: '' }))} className="capitalize">{t}</Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Classification</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(['home', 'debt'] as HomeOrDebt[]).map(hd => (
                <Button key={hd} size="sm" variant={form.homeOrDebt === hd ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, homeOrDebt: hd, category: '' }))}>
                  {hd === 'home' ? '🏠 Home' : '💳 Debt'}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Person</Label>
            <Select value={form.person} onValueChange={v => setForm(f => ({ ...f, person: v as Person, accountId: '' }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.person && personAccounts.length > 0 && (
            <div>
              <Label className="text-xs">Account</Label>
              <Select value={form.accountId || ''} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{personAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {form.type === 'transfer' ? (
            <>
              <div>
                <Label className="text-xs">Transfer To</Label>
                <Select value={form.transferTo || ''} onValueChange={v => setForm(f => ({ ...f, transferTo: v as Person, transferToAccountId: '' }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Recipient" /></SelectTrigger>
                  <SelectContent>{PERSONS.filter(p => p !== form.person).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.transferTo && toAccounts.length > 0 && (
                <div>
                  <Label className="text-xs">To Account</Label>
                  <Select value={form.transferToAccountId || ''} onValueChange={v => setForm(f => ({ ...f, transferToAccountId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Account" /></SelectTrigger>
                    <SelectContent>{toAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={v => setForm(f => ({ ...f, paymentMode: v as PaymentMode }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="mt-1" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleSave}>
              {mode === 'edit' ? 'Save Changes' : 'Confirm Copy'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Transactions() {
  const { state, selectedYear, selectedMonth, deleteTransaction, updateTransaction, addTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [copyTarget, setCopyTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const today = new Date().toISOString().split('T')[0];

  const allTxns = useMemo(() => {
    let list = getMonthTransactions(state.transactions, selectedYear, selectedMonth);
    if (filterPerson !== 'all') list = list.filter(t => t.person === filterPerson);
    if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterDate) list = list.filter(t => t.date === filterDate);
    if (search) list = list.filter(t =>
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      t.notes.toLowerCase().includes(search.toLowerCase()) ||
      t.person.toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, selectedYear, selectedMonth, filterPerson, filterType, filterDate, search]);

  const totalPages = Math.max(1, Math.ceil(allTxns.length / PAGE_SIZE));
  const txns = allTxns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

  const handleSaveEdit = (fields: Partial<Transaction>) => {
    if (!editTarget) return;
    const d = new Date(fields.date || editTarget.date);
    updateTransaction({ ...editTarget, ...fields, year: d.getFullYear(), month: d.getMonth() });
    toast.success('Transaction updated');
  };

  const handleSaveCopy = (fields: Partial<Transaction>) => {
    if (!copyTarget) return;
    const { id, ...rest } = copyTarget;
    const d = new Date(fields.date || today);
    addTransaction({ ...rest, ...fields, year: d.getFullYear(), month: d.getMonth() });
    toast.success('Transaction copied');
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Transactions</h1>
        <MonthSelector />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Income', val: allTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), color: 'text-success', money: true },
          { label: 'Expense', val: allTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), color: 'text-destructive', money: true },
          { label: 'Count', val: allTxns.length, color: 'text-foreground', money: false },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
            <p className={cn('text-sm font-bold', s.color)}>{s.money ? fmt(s.val as number) : s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={filterPerson} onValueChange={v => { setFilterPerson(v); resetPage(); }}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Person" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Persons</SelectItem>
              {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={v => { setFilterType(v); resetPage(); }}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); resetPage(); }} className="flex-1 text-sm" />
          {filterDate && (
            <Button size="sm" variant="ghost" onClick={() => { setFilterDate(''); resetPage(); }} className="text-xs text-muted-foreground shrink-0">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {txns.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm">No transactions found</p>
          </div>
        ) : txns.map(t => (
          <div key={t.id} className="glass-card rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                t.type === 'income' ? 'bg-success/15 text-success' :
                t.type === 'expense' ? 'bg-destructive/15 text-destructive' : 'bg-info/15 text-info'
              )}>
                {t.type === 'transfer' ? '↔' : t.type === 'income' ? '↑' : '↓'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {t.category}
                  {t.type === 'transfer' && t.transferTo ? ` → ${t.transferTo}` : ''}
                  {t.homeOrDebt === 'debt' && <span className="ml-1 text-[10px] bg-warning/20 text-warning rounded px-1 py-0.5">DEBT</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.person} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {t.paymentMode}
                </p>
                {t.notes && <p className="text-xs text-muted-foreground truncate">{t.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={cn('text-sm font-semibold mr-1', t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-info')}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditTarget(t)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-success" onClick={() => setCopyTarget({ ...t, date: today })}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(t)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {allTxns.length} records</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {editTarget && <TxnDialog open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} mode="edit" onSave={handleSaveEdit} />}
      {copyTarget && <TxnDialog open={!!copyTarget} onClose={() => setCopyTarget(null)} initial={copyTarget} mode="copy" onSave={handleSaveCopy} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This cannot be undone.</p>
                {deleteTarget && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{deleteTarget.category}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount</span>
                      <span className={cn('font-semibold', deleteTarget.type === 'income' ? 'text-success' : 'text-destructive')}>
                        {deleteTarget.type === 'income' ? '+' : '-'}{fmt(deleteTarget.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Person</span><span className="font-medium">{deleteTarget.person}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{new Date(deleteTarget.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { deleteTransaction(deleteTarget.id); toast.success('Deleted'); setDeleteTarget(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransactionForm />
    </div>
  );
}