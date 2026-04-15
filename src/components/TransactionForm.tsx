import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { PERSONS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, TransactionType, PaymentMode, Person } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function TransactionForm({ onSuccess }: { onSuccess?: () => void }) {
  const { addTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    person: '' as string,
    type: 'expense' as TransactionType,
    category: '',
    amount: '',
    paymentMode: 'cash' as PaymentMode,
    notes: '',
    transferTo: '' as string,
  });

  const categories = form.type === 'income' ? INCOME_CATEGORIES : form.type === 'expense' ? EXPENSE_CATEGORIES : [];

  const handleSubmit = () => {
    if (!form.person || !form.amount || Number(form.amount) <= 0) {
      toast.error('Please fill required fields');
      return;
    }
    if (form.type !== 'transfer' && !form.category) {
      toast.error('Please select a category');
      return;
    }
    if (form.type === 'transfer' && !form.transferTo) {
      toast.error('Please select transfer recipient');
      return;
    }
    if (form.type === 'transfer' && form.transferTo === form.person) {
      toast.error('Cannot transfer to same person');
      return;
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
    });

    toast.success('Transaction added');
    setForm({ date: today, person: '', type: 'expense', category: '', amount: '', paymentMode: 'cash', notes: '', transferTo: '' });
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
        <div className="space-y-4">
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
            <Label>Person</Label>
            <Select value={form.person} onValueChange={v => setForm(f => ({ ...f, person: v }))}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.type === 'transfer' ? (
            <div>
              <Label>Transfer To</Label>
              <Select value={form.transferTo} onValueChange={v => setForm(f => ({ ...f, transferTo: v }))}>
                <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                <SelectContent>
                  {PERSONS.filter(p => p !== form.person).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <Button onClick={handleSubmit} className="w-full gradient-primary text-primary-foreground">
            Add Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
