import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import { PERSONS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, Transaction } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Transactions() {
  const { state, selectedYear, selectedMonth, deleteTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterType, setFilterType] = useState('all');

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
    toast.success('Deleted');
  };

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Transactions</h1>
        <MonthSelector />
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
            <div key={t.id} className="glass-card rounded-xl p-3 flex items-center justify-between">
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
                  <p className="text-sm font-medium truncate">{t.category}{t.type === 'transfer' && t.transferTo ? ` → ${t.transferTo}` : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.person} · {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {t.paymentMode}
                  </p>
                  {t.notes && <p className="text-xs text-muted-foreground truncate">{t.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'text-sm font-semibold',
                  t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-info'
                )}>
                  {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <TransactionForm />
    </div>
  );
}
