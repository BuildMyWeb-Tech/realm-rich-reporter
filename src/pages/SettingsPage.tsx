import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { PERSONS, Person, EXPENSE_CATEGORIES, INCOME_CATEGORIES, ACCOUNTS } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

export default function SettingsPage() {
  const { state, setInitialBalance, setAccountBalance, addRecurring, deleteRecurring } = useFinance();
  const [balances, setBalances] = useState(state.initialBalances);
  const [acctBalances, setAcctBalances] = useState(state.accountBalances || {});
  const [recForm, setRecForm] = useState({ person: '', type: 'expense' as 'income'|'expense', category: '', amount: '', paymentMode: 'cash' as 'cash'|'bank', dayOfMonth: '1', notes: '' });

  const saveBalances = () => {
    PERSONS.forEach(p => setInitialBalance(p, balances[p] || 0));
    ACCOUNTS.forEach(a => setAccountBalance(a.id, acctBalances[a.id] || 0));
    toast.success('Opening balances saved');
  };

  const addRec = () => {
    if (!recForm.person || !recForm.category || !recForm.amount) {
      toast.error('Fill all fields');
      return;
    }
    addRecurring({
      person: recForm.person as Person,
      type: recForm.type,
      category: recForm.category,
      amount: Number(recForm.amount),
      paymentMode: recForm.paymentMode,
      notes: recForm.notes,
      dayOfMonth: Number(recForm.dayOfMonth),
    });
    toast.success('Recurring entry added');
    setRecForm({ person: '', type: 'expense', category: '', amount: '', paymentMode: 'cash', dayOfMonth: '1', notes: '' });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-finance-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        localStorage.setItem('family-finance-data', JSON.stringify(data));
        toast.success('Data imported — refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        toast.error('Invalid file');
      }
    };
    reader.readAsText(file);
  };

  const categories = recForm.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-5 animate-slide-up">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {/* Account Opening Balances */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Account Opening Balances</h2>
        <div className="space-y-2">
          {ACCOUNTS.map(acc => (
            <div key={acc.id} className="flex items-center gap-3">
              <Label className="w-28 text-xs">{acc.name}</Label>
              <Input
                type="number"
                value={acctBalances[acc.id] || ''}
                onChange={e => setAcctBalances(b => ({ ...b, [acc.id]: Number(e.target.value) }))}
                placeholder="0"
                className="text-sm"
              />
            </div>
          ))}
          <Button onClick={saveBalances} className="w-full" size="sm">Save Balances</Button>
        </div>
      </div>

      {/* Recurring Entries */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Recurring Entries</h2>

        {state.recurringEntries.length > 0 && (
          <div className="space-y-2 mb-4">
            {state.recurringEntries.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{r.category} · ₹{r.amount.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground">{r.person} · Day {r.dayOfMonth} · {r.type}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteRecurring(r.id)} className="text-destructive text-xs">Remove</Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={recForm.person} onValueChange={v => setRecForm(f => ({ ...f, person: v }))}>
              <SelectTrigger><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={recForm.type} onValueChange={v => setRecForm(f => ({ ...f, type: v as any, category: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={recForm.category} onValueChange={v => setRecForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Amount" value={recForm.amount} onChange={e => setRecForm(f => ({ ...f, amount: e.target.value }))} />
            <Input type="number" placeholder="Day of month" value={recForm.dayOfMonth} onChange={e => setRecForm(f => ({ ...f, dayOfMonth: e.target.value }))} min="1" max="31" />
          </div>
          <Button onClick={addRec} className="w-full" size="sm">Add Recurring Entry</Button>
        </div>
      </div>

      {/* Export / Import */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Data Management</h2>
        <div className="flex gap-2">
          <Button onClick={exportData} variant="outline" className="flex-1" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export JSON
          </Button>
          <div className="flex-1">
            <label className="flex items-center justify-center gap-1 text-sm font-medium border border-input bg-background rounded-md h-9 px-3 cursor-pointer hover:bg-muted transition-colors">
              Import
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
