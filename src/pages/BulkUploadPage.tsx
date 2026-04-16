import BulkUploadTransactions from "@/components/BulkUploadTransactions";
import { useFinance } from "@/contexts/FinanceContext";

export default function BulkUploadPage() {
  const { addTransaction } = useFinance();
  return <BulkUploadTransactions addTransaction={addTransaction} />;
}