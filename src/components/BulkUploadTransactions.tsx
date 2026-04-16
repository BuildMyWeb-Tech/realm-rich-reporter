import React, { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type Person = "Appa" | "Ajai" | "Amma" | "Mauli" | "Home";

type Transaction = {
  date: string;
  person: Person;
  type: "income" | "expense" | "transfer";
  category: string;
  amount: number;
  paymentMode: "cash" | "bank";
  notes: string;
  homeOrDebt: "home" | "debt";
};

/** After normalization every row has these lowercase underscore keys */
type NormalizedRow = {
  date: string;
  account: string;
  category: string;
  subcategory: string;
  note: string;
  inr: string;
  income_expense: string;
  description: string;
  amount: string;
  currency: string;
};

type ParseResult = {
  transactions: Transaction[];
  invalidRows: { row: number; reason: string; raw: Record<string, unknown> }[];
};

type ImportStatus = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBT_KEYWORDS = ["loan", "emi", "debt", "gold loan", "loan repaid"];
const PERSON_NAMES: Person[] = ["Appa", "Ajai", "Amma", "Mauli"];
const CHUNK_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// KEY FIX: Normalize raw Excel headers to stable lowercase keys.
// Handles: duplicate "Account" columns, extra spaces, BOM chars,
//          slash variants in "Income/Expense", etc.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps any header variant → our internal NormalizedRow key.
 */
const HEADER_ALIASES: Record<string, keyof NormalizedRow> = {
  // Date
  date: "date",

  // Account — first occurrence wins; SheetJS renames dup cols to Account_1 etc.
  account: "account",
  account_1: "account",
  account_2: "account",

  // Category
  category: "category",

  // Subcategory
  subcategory: "subcategory",
  "sub category": "subcategory",
  "sub-category": "subcategory",

  // Note
  note: "note",
  notes: "note",

  // INR column (the 6th column in your sheet)
  inr: "inr",

  // Income/Expense — many possible representations from different exports
  "income/expense": "income_expense",
  "income / expense": "income_expense",
  "income-expense": "income_expense",
  incomeexpense: "income_expense",
  "income_expense": "income_expense",
  type: "income_expense",
  "transaction type": "income_expense",

  // Description
  description: "description",
  desc: "description",

  // Amount
  amount: "amount",
  amt: "amount",

  // Currency
  currency: "currency",
};

/** Strips BOM, trims, lowercases, collapses whitespace */
function cleanHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")          // BOM
    .replace(/[^\x20-\x7E]/g, "")   // non-ASCII chars
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Given a raw SheetJS row, return a NormalizedRow with stable keys.
 * Unknown columns are silently ignored.
 * For duplicate columns (e.g. two "Account" cols), the first mapped value wins.
 */
function normalizeRow(raw: Record<string, unknown>): NormalizedRow {
  const result: Partial<NormalizedRow> = {};

  for (const [key, value] of Object.entries(raw)) {
    const cleaned = cleanHeader(key);
    const mapped = HEADER_ALIASES[cleaned];
    if (mapped && result[mapped] === undefined) {
      result[mapped] = String(value ?? "").trim();
    }
  }

  return {
    date: result.date ?? "",
    account: result.account ?? "",
    category: result.category ?? "",
    subcategory: result.subcategory ?? "",
    note: result.note ?? "",
    inr: result.inr ?? "",
    income_expense: result.income_expense ?? "",
    description: result.description ?? "",
    amount: result.amount ?? "",
    currency: result.currency ?? "",
  };
}

// ─── Date parser: "MM-DD-YYYY" → "YYYY-MM-DD" ────────────────────────────────

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // MM-DD-YYYY  ← your primary format
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[1].padStart(2, "0")}-${m1[2].padStart(2, "0")}`;

  // YYYY-MM-DD  ← already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;

  // Excel serial number (e.g. 45826)
  const serial = Number(s);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    try {
      const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return null;
    }
  }

  return null;
}

// ─── Person detector ──────────────────────────────────────────────────────────

function detectPerson(subcategory: string, note: string): Person {
  const sub = subcategory.trim();
  const n = note.toLowerCase();

  for (const p of PERSON_NAMES) {
    if (sub === p) return p;
  }
  if (sub === "Home") return "Home";

  for (const p of PERSON_NAMES) {
    if (n.includes(p.toLowerCase())) return p;
  }

  return "Appa";
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function getHomeOrDebt(category: string): "home" | "debt" {
  const lower = category.toLowerCase();
  return DEBT_KEYWORDS.some((kw) => lower.includes(kw)) ? "debt" : "home";
}

function parsePaymentMode(account: string): "cash" | "bank" {
  return account.toLowerCase().trim() === "cash" ? "cash" : "bank";
}

function parseType(ie: string): "income" | "expense" | "transfer" | null {
  const v = ie.toLowerCase().trim();
  if (v === "income") return "income";
  if (v === "expense") return "expense";
  if (v === "transfer") return "transfer";
  return null;
}

// ─── Row transformer ──────────────────────────────────────────────────────────

function transformRow(
  row: NormalizedRow,
  rowIndex: number
): { tx: Transaction } | { error: string } {
  // Amount — prefer "amount" column, fall back to "inr"
  const amountRaw = row.amount || row.inr;
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    return { error: `Row ${rowIndex}: bad amount "${amountRaw}"` };
  }

  const date = parseDate(row.date);
  if (!date) {
    return { error: `Row ${rowIndex}: bad date "${row.date}"` };
  }

  const type = parseType(row.income_expense);
  if (!type) {
    return { error: `Row ${rowIndex}: unknown type "${row.income_expense}"` };
  }

  const category = row.category.trim() || "Others";
  const notes = (row.note || row.description || "").trim();
  const person = detectPerson(row.subcategory, notes);
  const paymentMode = parsePaymentMode(row.account);
  const homeOrDebt = getHomeOrDebt(category);

  return {
    tx: { date, person, type, category, amount, paymentMode, notes, homeOrDebt },
  };
}

// ─── Async chunked parser ─────────────────────────────────────────────────────

async function parseRowsAsync(
  rows: Record<string, unknown>[],
  onProgress: (pct: number) => void
): Promise<ParseResult> {
  const transactions: Transaction[] = [];
  const invalidRows: ParseResult["invalidRows"] = [];
  const total = rows.length;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (let j = 0; j < chunk.length; j++) {
      const rowIndex = i + j + 2;
      const normalized = normalizeRow(chunk[j]);
      const result = transformRow(normalized, rowIndex);

      if ("tx" in result) {
        transactions.push(result.tx);
      } else {
        invalidRows.push({ row: rowIndex, reason: result.error, raw: chunk[j] });
        console.warn("[BulkUpload] Skipped:", result.error, "| normalized:", normalized);
      }
    }

    onProgress(Math.round(((i + chunk.length) / total) * 100));
    await new Promise((r) => setTimeout(r, 0)); // yield to UI thread
  }

  return { transactions, invalidRows };
}

// ─── Excel file reader ────────────────────────────────────────────────────────

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsArrayBuffer(file);
  });
}

function parseExcelFile(buffer: ArrayBuffer): {
  rows: Record<string, unknown>[];
  detectedHeaders: string[];
} {
  const wb = XLSX.read(buffer, { type: "array", raw: false, cellText: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,
    defval: "",
  });
  const detectedHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, detectedHeaders };
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function calcSummary(txs: Transaction[]) {
  return txs.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      else if (t.type === "expense") acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" | "info" }) {
  const colors = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-slate-700 text-white",
  };
  return (
    <div
      style={{ animation: "slideUp 0.3s ease" }}
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 ${colors[type]}`}
    >
      {type === "success" && "✅ "}
      {type === "error" && "❌ "}
      {type === "info" && "ℹ️ "}
      {message}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div>
      <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full bg-gradient-to-r ${color} transition-all duration-150`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 text-right mt-1">{pct}%</p>
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  violet: "bg-violet-900/50 text-violet-300",
  emerald: "bg-emerald-900/50 text-emerald-400",
  red: "bg-red-900/50 text-red-400",
  amber: "bg-amber-900/50 text-amber-300",
  blue: "bg-blue-900/50 text-blue-300",
  rose: "bg-rose-900/50 text-rose-300",
  slate: "bg-slate-700 text-slate-400",
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${BADGE_COLORS[color] ?? BADGE_COLORS.slate}`}>
      {children}
    </span>
  );
}

/** Collapsible debug panel — shows what SheetJS actually detected */
function DebugPanel({
  headers,
  sampleRow,
}: {
  headers: string[];
  sampleRow: Record<string, unknown> | undefined;
}) {
  const [open, setOpen] = useState(true); // open by default when shown
  return (
    <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-amber-400 text-xs font-semibold hover:bg-amber-900/20 transition"
        onClick={() => setOpen((o) => !o)}
      >
        <span>🔍 Debug — Detected {headers.length} Excel headers</span>
        <span>{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-amber-600">
            Green = successfully mapped to a field. Grey = ignored (not in alias table).
          </p>
          <div className="flex flex-wrap gap-2">
            {headers.map((h) => {
              const mapped = HEADER_ALIASES[cleanHeader(h)];
              return (
                <span
                  key={h}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono ${
                    mapped
                      ? "bg-emerald-900/50 text-emerald-300"
                      : "bg-slate-800 text-slate-500"
                  }`}
                  title={mapped ? `→ ${mapped}` : "not mapped"}
                >
                  "{h}"
                  {mapped && <span className="text-emerald-600 ml-1"> → {mapped}</span>}
                </span>
              );
            })}
          </div>
          {sampleRow && (
            <div>
              <p className="text-[11px] text-slate-500 mb-1 font-semibold">First row raw values from SheetJS:</p>
              <pre className="text-[10px] bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-400 max-h-48">
                {JSON.stringify(sampleRow, null, 2)}
              </pre>
              <p className="text-[11px] text-slate-500 mt-2 mb-1 font-semibold">First row after normalization:</p>
              <pre className="text-[10px] bg-slate-900 rounded-lg p-3 overflow-x-auto text-emerald-400 max-h-48">
                {JSON.stringify(normalizeRow(sampleRow), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BulkUploadTransactionsProps {
  addTransaction: (tx: Transaction) => void | Promise<void>;
}

const BulkUploadTransactions: React.FC<BulkUploadTransactionsProps> = ({ addTransaction }) => {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [parseProgress, setParseProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invalidRows, setInvalidRows] = useState<ParseResult["invalidRows"]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [sampleRawRow, setSampleRawRow] = useState<Record<string, unknown> | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      showToast("Please upload .xlsx, .xls or .csv", "error");
      return;
    }

    setFileName(file.name);
    setStatus("parsing");
    setParseProgress(0);
    setTransactions([]);
    setInvalidRows([]);
    setDetectedHeaders([]);
    setSampleRawRow(undefined);

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const { rows, detectedHeaders: dh } = parseExcelFile(buffer);

      // Always log — helps diagnose issues
      console.group("[BulkUpload] File loaded: " + file.name);
      console.log("SheetJS detected headers:", dh);
      console.log("Total data rows:", rows.length);
      if (rows[0]) {
        console.log("Row 1 raw:", rows[0]);
        console.log("Row 1 normalized:", normalizeRow(rows[0]));
      }
      console.groupEnd();

      setDetectedHeaders(dh);
      setSampleRawRow(rows[0]);

      if (rows.length === 0) {
        showToast("No data rows found in file", "error");
        setStatus("error");
        return;
      }

      const result = await parseRowsAsync(rows, setParseProgress);
      setTransactions(result.transactions);
      setInvalidRows(result.invalidRows);
      setStatus("ready");

      if (result.transactions.length === 0) {
        showToast("0 valid rows — open Debug panel to diagnose", "error");
      } else {
        showToast(
          `Parsed ${result.transactions.length} valid rows` +
            (result.invalidRows.length ? `, ${result.invalidRows.length} skipped` : ""),
          "info"
        );
      }
    } catch (err) {
      console.error("[BulkUpload] Error:", err);
      showToast("Failed to parse file — check console", "error");
      setStatus("error");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImportAll = async () => {
    if (transactions.length === 0) return;
    setStatus("importing");
    setImportProgress(0);

    try {
      for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
        const chunk = transactions.slice(i, i + CHUNK_SIZE);
        for (const tx of chunk) {
          await addTransaction(tx);
        }
        setImportProgress(Math.round(((i + chunk.length) / transactions.length) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
      setStatus("done");
      showToast(`Imported ${transactions.length} transactions successfully`, "success");
    } catch (err) {
      console.error("[BulkUpload] Import error:", err);
      showToast("Import failed — check console", "error");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setTransactions([]);
    setInvalidRows([]);
    setFileName("");
    setParseProgress(0);
    setImportProgress(0);
    setDetectedHeaders([]);
    setSampleRawRow(undefined);
  };

  const summary = calcSummary(transactions);
  const preview = transactions.slice(0, 10);
  const showDebug = detectedHeaders.length > 0 && (transactions.length === 0 || invalidRows.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-8">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Bulk Import
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Upload your Excel / CSV to import all transactions at once
            </p>
          </div>
          {!["idle", "parsing", "importing"].includes(status) && (
            <button
              onClick={handleReset}
              className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              ↺ Reset
            </button>
          )}
        </div>

        {/* ── Drop Zone ── */}
        {status === "idle" && (
          <div
            className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? "border-indigo-400 bg-indigo-950/30 scale-[1.01]"
                : "border-slate-700 hover:border-indigo-500 hover:bg-slate-800/40"}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-semibold text-slate-200">Drop your Excel / CSV here</p>
            <p className="text-sm text-slate-500 mt-2">or click to browse — .xlsx, .xls, .csv</p>
          </div>
        )}

        {/* ── Parsing progress ── */}
        {status === "parsing" && (
          <div className="rounded-3xl bg-slate-800/60 p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="font-semibold text-slate-200">Parsing {fileName}…</span>
            </div>
            <ProgressBar pct={parseProgress} color="from-indigo-500 to-violet-500" />
          </div>
        )}

        {/* ── Importing progress ── */}
        {status === "importing" && (
          <div className="rounded-3xl bg-slate-800/60 p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="font-semibold text-slate-200">
                Importing… {Math.round((importProgress / 100) * transactions.length).toLocaleString()} / {transactions.length.toLocaleString()}
              </span>
            </div>
            <ProgressBar pct={importProgress} color="from-emerald-500 to-teal-400" />
          </div>
        )}

        {/* ── Ready / Done / Error ── */}
        {["ready", "done", "error"].includes(status) && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Rows" value={transactions.length.toLocaleString()} color="bg-slate-800 text-white" />
              <StatCard label="Income"     value={fmt(summary.income)}                 color="bg-emerald-950 text-emerald-300" />
              <StatCard label="Expense"    value={fmt(summary.expense)}                color="bg-red-950 text-red-300" />
              <StatCard label="Skipped"    value={invalidRows.length.toString()}       color="bg-amber-950 text-amber-300" />
            </div>

            {/* File badge */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full">📄 {fileName}</span>
              {invalidRows.length > 0 && (
                <span className="bg-amber-900/50 text-amber-400 px-3 py-1 rounded-full">
                  ⚠️ {invalidRows.length} rows skipped
                </span>
              )}
            </div>

            {/* Debug panel — shown whenever something went wrong */}
            {showDebug && (
              <DebugPanel headers={detectedHeaders} sampleRow={sampleRawRow} />
            )}

            {/* No valid rows */}
            {transactions.length === 0 && (
              <div className="rounded-2xl bg-red-950/40 border border-red-800/50 px-6 py-5 text-center space-y-1">
                <p className="text-red-400 font-semibold text-sm">No valid rows could be parsed.</p>
                <p className="text-red-600 text-xs">
                  Use the Debug panel above to check which headers SheetJS detected and whether they mapped correctly. Copy the raw header names from your Excel and share them if you need help fixing the aliases.
                </p>
              </div>
            )}

            {/* Preview Table */}
            {transactions.length > 0 && (
              <div className="rounded-2xl overflow-hidden border border-slate-800">
                <div className="bg-slate-800/80 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-300">
                    Preview — first {Math.min(10, transactions.length)} rows
                  </span>
                  <span className="text-xs text-slate-500">
                    {transactions.length.toLocaleString()} total ready
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px]">
                        {["Date", "Person", "Type", "Category", "Amount", "Mode", "Tag", "Notes"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((tx, i) => (
                        <tr key={i} className={`border-t border-slate-800/60 hover:bg-slate-800/30 transition ${i % 2 === 0 ? "bg-slate-900/20" : ""}`}>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-300 font-mono text-[11px]">{tx.date}</td>
                          <td className="px-3 py-2 whitespace-nowrap"><Badge color="violet">{tx.person}</Badge></td>
                          <td className="px-3 py-2 whitespace-nowrap"><Badge color={tx.type === "income" ? "emerald" : "red"}>{tx.type}</Badge></td>
                          <td className="px-3 py-2 text-slate-300 whitespace-nowrap text-[11px]">{tx.category}</td>
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">
                            <span className={tx.type === "income" ? "text-emerald-400" : "text-red-400"}>{fmt(tx.amount)}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap"><Badge color={tx.paymentMode === "cash" ? "amber" : "blue"}>{tx.paymentMode}</Badge></td>
                          <td className="px-3 py-2 whitespace-nowrap"><Badge color={tx.homeOrDebt === "debt" ? "rose" : "slate"}>{tx.homeOrDebt}</Badge></td>
                          <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate text-[11px]">{tx.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import button */}
            {status === "ready" && transactions.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleImportAll}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600
                    hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm
                    shadow-lg shadow-indigo-900/40 transition-all duration-200 active:scale-95"
                >
                  ⬆️ Import All {transactions.length.toLocaleString()} Transactions
                </button>
              </div>
            )}

            {/* Done banner */}
            {status === "done" && (
              <div className="rounded-2xl bg-emerald-950/60 border border-emerald-800 px-6 py-4 flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="font-bold text-emerald-300">Import Complete!</p>
                  <p className="text-xs text-emerald-600">{transactions.length.toLocaleString()} transactions added successfully.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

export default BulkUploadTransactions;