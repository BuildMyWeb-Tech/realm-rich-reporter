import { useFinance } from '@/contexts/FinanceContext';
import { getOverspendCategories, getBudgetForCategory } from '@/lib/financial-store';
import { EXPENSE_CATEGORIES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

export default function BudgetPage() {
  const { state, selectedYear, selectedMonth, setBudget } = useFinance();
  const categories = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleSave = (category: string) => {
    const val = Number(editValue);
    if (val >= 0) {
      setBudget(category, val, selectedYear, selectedMonth);
      toast.success(`Budget updated for ${category}`);
    }
    setEditing(null);
  };

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = categories.reduce((s, c) => s + c.actual, 0);

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Budget</h1>
        <MonthSelector />
      </div>

      {/* Summary */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Total Budget</span>
          <span className="font-semibold">₹{totalBudget.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Total Spent</span>
          <span className={cn('font-semibold', totalSpent > totalBudget ? 'text-destructive' : 'text-foreground')}>
            ₹{totalSpent.toLocaleString('en-IN')}
          </span>
        </div>
        <Progress value={Math.min((totalSpent / totalBudget) * 100, 100)} className="h-2" />
      </div>

      {/* Category List */}
      <div className="space-y-2">
        {categories.map(c => (
          <div key={c.category} className={cn(
            'glass-card rounded-xl p-3',
            c.overspent && 'border-destructive/30 bg-destructive/5',
            !c.overspent && c.percent >= 80 && 'border-warning/30 bg-warning/5',
          )}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">{c.category}</span>
              {editing === c.category ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-24 h-7 text-xs"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave(c.category)}
                    autoFocus
                  />
                  <button onClick={() => handleSave(c.category)} className="text-xs text-primary font-medium">Save</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditing(c.category); setEditValue(String(c.budget)); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Budget: ₹{c.budget.toLocaleString('en-IN')}
                </button>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Spent: ₹{c.actual.toLocaleString('en-IN')}</span>
              <span className={cn(c.remaining < 0 ? 'text-destructive font-medium' : '')}>
                {c.remaining >= 0 ? `₹${c.remaining.toLocaleString('en-IN')} left` : `₹${Math.abs(c.remaining).toLocaleString('en-IN')} over`}
              </span>
            </div>
            <Progress
              value={Math.min(c.percent, 100)}
              className={cn('h-1.5', c.overspent ? '[&>div]:bg-destructive' : c.percent >= 80 ? '[&>div]:bg-warning' : '[&>div]:bg-primary')}
            />
          </div>
        ))}
      </div>

      <TransactionForm />
    </div>
  );
}
