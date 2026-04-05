import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  IndianRupee, Banknote, CreditCard, QrCode,
  TrendingUp, Receipt, CalendarDays, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type PaymentMethod = 'CASH' | 'UPI' | 'DIGITAL';

type ByMethod = { method: PaymentMethod; total: number; count: number };
type ByDay = { date: string; total: number; count: number; cash: number; upi: number; digital: number };
type Transaction = {
  id: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  orderId: string;
  tableNumber: string | null;
};

type PaymentsData = {
  summary: { total: number; count: number };
  byMethod: ByMethod[];
  byDay: ByDay[];
  transactions: Transaction[];
  filters: { from: string | null; to: string | null; method: string; preset: string };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH: '#22c55e',
  UPI: '#f97316',
  DIGITAL: '#3b82f6',
};
const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  DIGITAL: 'Card',
};
const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Banknote className="w-5 h-5 text-green-600" />,
  UPI: <QrCode className="w-5 h-5 text-[#2d2f2f]" />,
  DIGITAL: <CreditCard className="w-5 h-5 text-blue-500" />,
};

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function Payments() {
  const { token } = useAuth();

  const [preset, setPreset] = useState<string>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState<string>('ALL');
  const [data, setData] = useState<PaymentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ preset, method });
      if (preset === 'custom') {
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
      }
      const res = await fetch(`/api/reporting/payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [preset, dateFrom, dateTo, method, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Summary helpers ────────────────────────────────────────────────────────
  const methodMap = Object.fromEntries((data?.byMethod ?? []).map(m => [m.method, m]));
  const grandTotal = data?.summary.total ?? 0;
  const txCount = data?.summary.count ?? 0;
  const avgTx = txCount > 0 ? grandTotal / txCount : 0;

  // Pie data
  const pieData = (data?.byMethod ?? []).map(m => ({
    name: METHOD_LABEL[m.method] ?? m.method,
    value: m.total,
    color: METHOD_COLORS[m.method] ?? '#94a3b8',
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-muted-foreground text-sm">Payment transactions and revenue breakdown.</p>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                preset === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-auto text-sm"
              placeholder="From"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-auto text-sm"
              placeholder="To"
            />
          </div>
        )}

        {/* Mode filter */}
        <div className="flex gap-2 ml-auto flex-wrap">
          {(['ALL', 'CASH', 'UPI', 'DIGITAL'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                method === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {m !== 'ALL' && METHOD_ICON[m as PaymentMethod]}
              {m === 'ALL' ? 'All Methods' : METHOD_LABEL[m as PaymentMethod]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ── Summary cards ──────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                <IndianRupee className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-primary">₹{grandTotal.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">{txCount} transactions · avg ₹{avgTx.toFixed(2)}</p>
              </CardContent>
            </Card>

            {(['CASH', 'UPI', 'DIGITAL'] as PaymentMethod[]).map(m => {
              const info = methodMap[m];
              return (
                <Card key={m}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {METHOD_LABEL[m]}
                    </CardTitle>
                    {METHOD_ICON[m]}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" style={{ color: METHOD_COLORS[m] }}>
                      ₹{(info?.total ?? 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{info?.count ?? 0} txns</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Charts ─────────────────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Stacked bar — payments by day */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4" />
                  Payments by Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.byDay.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                    No payment data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data?.byDay ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={v => {
                          try { return format(new Date(v + 'T00:00:00'), 'MMM d'); } catch { return v; }
                        }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} width={60} />
                      <Tooltip
                        formatter={(val: number, name: string) => [`₹${val.toFixed(2)}`, name]}
                        labelFormatter={label => {
                          try { return format(new Date(label + 'T00:00:00'), 'MMMM d, yyyy'); } catch { return label; }
                        }}
                      />
                      <Legend />
                      <Bar dataKey="cash" name="Cash" fill={METHOD_COLORS.CASH} radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="upi" name="UPI" fill={METHOD_COLORS.UPI} radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="digital" name="Card" fill={METHOD_COLORS.DIGITAL} radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Donut — breakdown by method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-4 h-4" />
                  By Payment Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `₹${val.toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Transactions table ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="w-4 h-4" />
                Transactions
                <Badge variant="secondary" className="ml-auto font-normal">
                  {data?.transactions.length ?? 0} shown
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.transactions ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No transactions found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data?.transactions ?? []).map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(tx.createdAt), 'MMM d, yyyy · HH:mm')}
                          </TableCell>
                          <TableCell>
                            {tx.tableNumber
                              ? <span className="font-medium">Table {tx.tableNumber}</span>
                              : <span className="text-muted-foreground text-xs">Counter</span>}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {tx.orderId.slice(0, 8)}…
                          </TableCell>
                          <TableCell>
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: METHOD_COLORS[tx.method] + '22',
                                color: METHOD_COLORS[tx.method],
                              }}
                            >
                              {METHOD_ICON[tx.method]}
                              {METHOD_LABEL[tx.method] ?? tx.method}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            ₹{tx.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
