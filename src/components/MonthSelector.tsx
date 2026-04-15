import { useFinance } from '@/contexts/FinanceContext';
import { MONTH_NAMES } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MonthSelector() {
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth } = useFinance();

  const prev = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };
  const next = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };
  const goToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  return (
    <div className="flex items-center justify-between px-1">
      <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <button onClick={goToday} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
        {MONTH_NAMES[selectedMonth]} {selectedYear}
      </button>
      <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
