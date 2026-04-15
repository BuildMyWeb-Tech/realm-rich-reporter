import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import { PERSONS, Transaction } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Search, Pencil, Copy, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Transactions() {
  const { state, selectedYear, selectedMonth, deleteTransaction, updateTransaction, addTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});

  const txns = useMemo(() => {
    let list = getMonthTransactions(state.transactions, selectedYear, selectedMonth);
    if (filterPerson !== 'all') list = list.filter(t => t.person === filterPerson);
    if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (search) list = list.filter(t =>
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      t.notes.toLowerCase().includes(search.toLowerCase()) ||
      t.person.toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, selectedYear, selectedMonth, filterPerson, filterType, search]);

  const handleDelete = (id: string) => {
    deleteTransaction(id);
    toast.success('Transaction deleted');
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditFields({ amount: t.amount, notes: t.notes, date: t.date, category: t.category });
  };

  const handleSaveEdit = (t: Transaction) => {
    updateTransaction({
      ...t,
      amount: Number(editFields.amount ?? t.amount),
      notes: editFields.notes ?? t.notes,
      date: editFields.date ?? t.date,
      category: editFields.category ?? t.category,
    });
    setEditingId(null);
    toast.success('Transaction updated');
  };

  const handleCopy = async (t: Transaction) => {
    const today = new Date().toISOString().split('T')[0];
    const { id, ...rest } = t;
    await addTransaction({ ...rest, date: today, notes: `Copy of: ${t.notes || t.category}` });
    toast.success(`Copied "${t.category}" — edit date/amount if needed`);
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Transactions</h1>
        <MonthSelector />
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Income', value: txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), color: 'text-success' },
          { label: 'Expense', value: txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), color: 'text-destructive' },
          { label: 'Count', value: txns.length, color: 'text-foreground', raw: true },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
            <p className={cn('text-sm font-bold', s.color)}>
              {s.raw ? s.value : fmt(s.value as number)}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={filterPerson} onValueChange={setFilterPerson}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Person" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Persons</SelectItem>
              {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {txns.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm">No transactions found</p>
          </div>
        ) : (
          txns.map(t => (
            <div key={t.id} className={cn(
              'glass-card rounded-xl p-3 transition-all',
              editingId === t.id && 'ring-1 ring-primary/50'
            )}>
              {editingId === t.id ? (
                /* ── EDIT MODE ── */
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Editing</span>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Amount (₹)</p>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={editFields.amount}
                        onChange={e => setEditFields(f => ({ ...f, amount: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Date</p>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={editFields.date}
                        onChange={e => setEditFields(f => ({ ...f, date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <Input
                      className="h-8 text-sm"
                      value={editFields.notes}
                      onChange={e => setEditFields(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => handleSaveEdit(t)}>
                      <Check className="h-3 w-3" /> Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      t.type === 'income' ? 'bg-success/15 text-success' :
                      t.type === 'expense' ? 'bg-destructive/15 text-destructive' :
                      'bg-info/15 text-info'
                    )}>
                      {t.type === 'transfer' ? '↔' : t.type === 'income' ? '↑' : '↓'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.category}
                        {t.type === 'transfer' && t.transferTo ? ` → ${t.transferTo}` : ''}
                        {t.homeOrDebt === 'debt' && (
                          <span className="ml-1 text-[10px] bg-warning/20 text-warning rounded px-1 py-0.5">DEBT</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.person} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {t.paymentMode}
                      </p>
                      {t.notes && <p className="text-xs text-muted-foreground truncate">{t.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn(
                      'text-sm font-semibold mr-1',
                      t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-info'
                    )}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </span>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(t)}
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-success"
                      onClick={() => handleCopy(t)}
                      title="Copy/Duplicate"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(t.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <TransactionForm />
    </div>
  );
}