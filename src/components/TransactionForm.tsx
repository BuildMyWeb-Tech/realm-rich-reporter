import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  PERSONS, HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, ACCOUNTS,
  TransactionType, PaymentMode, Person, HomeOrDebt,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function TransactionForm({ onSuccess }: { onSuccess?: () => void }) {
  const { addTransaction, state } = useFinance();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    person: '' as string,
    type: 'expense' as TransactionType,
    category: '',
    amount: '',
    expectedAmount: '',
    paymentMode: 'cash' as PaymentMode,
    notes: '',
    transferTo: '' as string,
    accountId: '',
    transferToAccountId: '',
    homeOrDebt: 'home' as HomeOrDebt,
  });

  // Build category lists including custom sources from Settings
  const customIncomeSources = state.incomeSources || [];
  const customExpenseSources = state.expenseSources || [];

  const homeIncomeCategories = [
    ...HOME_INCOME_CATEGORIES,
    ...customIncomeSources.filter(s => s.group === 'home').map(s => s.name),
  ];
  const debtIncomeCategories = [
    ...DEBT_INCOME_CATEGORIES,
    ...customIncomeSources.filter(s => s.group === 'debt').map(s => s.name),
  ];
  const homeExpenseCategories = [
    ...EXPENSE_CATEGORIES,
    ...customExpenseSources.filter(s => s.group === 'home').map(s => s.name),
  ];
  const debtExpenseCategories = [
    ...DEBT_EXPENSE_CATEGORIES,
    ...customExpenseSources.filter(s => s.group === 'debt').map(s => s.name),
  ];

  const categories: string[] = form.type === 'income'
    ? (form.homeOrDebt === 'home' ? homeIncomeCategories : debtIncomeCategories)
    : form.type === 'expense'
      ? (form.homeOrDebt === 'debt' ? debtExpenseCategories : homeExpenseCategories)
      : [];

  const personAccounts = form.person
    ? ACCOUNTS.filter(a => a.person === (form.person as Person))
    : [];

  const transferToAccounts = form.transferTo
    ? ACCOUNTS.filter(a => a.person === (form.transferTo as Person))
    : [];

  const handleSubmit = () => {
    if (!form.person || !form.amount || Number(form.amount) <= 0) {
      toast.error('Please fill required fields'); return;
    }
    if (form.type !== 'transfer' && !form.category) {
      toast.error('Please select a category'); return;
    }
    if (form.type === 'transfer' && !form.transferTo) {
      toast.error('Please select transfer recipient'); return;
    }
    if (form.type === 'transfer' && form.transferTo === form.person) {
      toast.error('Cannot transfer to same person'); return;
    }

    const d = new Date(form.date);
    addTransaction({
      date: form.date,
      year: d.getFullYear(),
      month: d.getMonth(),
      person: form.person as Person,
      type: form.type,
      category: form.type === 'transfer' ? 'Transfer' : form.category,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      notes: form.notes,
      transferTo: form.type === 'transfer' ? form.transferTo as Person : undefined,
      accountId: form.accountId || undefined,
      transferToAccountId: form.type === 'transfer' ? form.transferToAccountId || undefined : undefined,
      homeOrDebt: form.homeOrDebt,
      expectedAmount: form.expectedAmount ? Number(form.expectedAmount) : undefined,
    });

    toast.success('Transaction added');
    setForm({ date: today, person: '', type: 'expense', category: '', amount: '', expectedAmount: '', paymentMode: 'cash', notes: '', transferTo: '', accountId: '', transferToAccountId: '', homeOrDebt: 'home' });
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary text-primary-foreground rounded-full h-14 w-14 fixed bottom-20 right-4 z-50 shadow-lg hover:shadow-xl transition-shadow">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
              <Button
                key={t}
                variant={form.type === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setForm(f => ({ ...f, type: t, category: '' }))}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>

          {/* Home / Debt toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(['home', 'debt'] as HomeOrDebt[]).map(hd => (
              <Button
                key={hd}
                variant={form.homeOrDebt === hd ? 'default' : 'outline'}
                size="sm"
                onClick={() => setForm(f => ({ ...f, homeOrDebt: hd, category: '' }))}
                className="capitalize"
              >
                {hd === 'home' ? '🏠 Home' : '💳 Debt'}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Expected Amount (₹)</Label>
            <Input type="number" placeholder="Optional" value={form.expectedAmount} onChange={e => setForm(f => ({ ...f, expectedAmount: e.target.value }))} />
          </div>

          <div>
            <Label>Person</Label>
            <Select value={form.person} onValueChange={v => setForm(f => ({ ...f, person: v, accountId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.person && personAccounts.length > 0 && (
            <div>
              <Label>Account</Label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {personAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.type === 'transfer' ? (
            <>
              <div>
                <Label>Transfer To</Label>
                <Select value={form.transferTo} onValueChange={v => setForm(f => ({ ...f, transferTo: v, transferToAccountId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                  <SelectContent>
                    {PERSONS.filter(p => p !== form.person).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.transferTo && transferToAccounts.length > 0 && (
                <div>
                  <Label>To Account</Label>
                  <Select value={form.transferToAccountId} onValueChange={v => setForm(f => ({ ...f, transferToAccountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {transferToAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={v => setForm(f => ({ ...f, paymentMode: v as PaymentMode }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Input placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <Button onClick={handleSubmit} className="w-full gradient-primary text-primary-foreground">
            Add Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}