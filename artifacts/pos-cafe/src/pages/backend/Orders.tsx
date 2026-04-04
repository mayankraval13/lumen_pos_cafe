import React, { useState, useMemo } from 'react';
import { useListOrders, useGetOrder } from '@workspace/api-client-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  ShoppingBag, Clock, CheckCircle2, TrendingUp,
  Search, Filter, ChevronDown, RefreshCw, X,
  UtensilsCrossed, CreditCard, Smartphone, Banknote, Receipt,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom';
type StatusFilter = 'all' | 'DRAFT' | 'PAID';
type Order = any;

const METHOD_BADGE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CASH: { label: 'Cash', icon: <Banknote className="w-3 h-3" />, color: 'bg-green-100 text-green-700 border-green-200' },
  UPI: { label: 'UPI', icon: <Smartphone className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  CARD: { label: 'Card', icon: <CreditCard className="w-3 h-3" />, color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

function getPresetDates(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  if (preset === 'today') return { dateFrom: fmt(today), dateTo: fmt(today) };
  if (preset === 'yesterday') {
    const y = subDays(today, 1);
    return { dateFrom: fmt(y), dateTo: fmt(y) };
  }
  if (preset === 'last7') return { dateFrom: fmt(subDays(today, 6)), dateTo: fmt(today) };
  if (preset === 'last30') return { dateFrom: fmt(subDays(today, 29)), dateTo: fmt(today) };
  return {};
}

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { dateFrom, dateTo } = useMemo(() => {
    if (datePreset === 'custom') return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    return getPresetDates(datePreset);
  }, [datePreset, customFrom, customTo]);

  const queryParams = useMemo(() => {
    const p: any = { limit: '200' };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    return p;
  }, [statusFilter, dateFrom, dateTo]);

  const { data: rawOrders, isLoading, refetch } = useListOrders(queryParams);
  const orders: Order[] = (rawOrders as any) || [];

  const { data: selectedOrder } = useGetOrder(selectedOrderId || '', {
    query: { enabled: !!selectedOrderId }
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o: Order) =>
      o.id.toLowerCase().startsWith(q) ||
      String(o.table?.tableNumber ?? '').includes(q) ||
      (o.customer?.name ?? '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  // Summary stats from the fetched page
  const stats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter((o: Order) => o.status === 'PAID');
    const draft = orders.filter((o: Order) => o.status === 'DRAFT');
    const revenue = paid.reduce((s: number, o: Order) => s + (o.total ?? 0), 0);
    return { total, paid: paid.length, draft: draft.length, revenue };
  }, [orders]);

  const PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last7', label: 'Last 7 Days' },
    { key: 'last30', label: 'Last 30 Days' },
    { key: 'all', label: 'All Time' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground text-sm mt-0.5">All orders across sessions, sorted newest first</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Orders',
            value: stats.total,
            sub: 'in selected range',
            icon: <ShoppingBag className="w-5 h-5 text-primary" />,
            bg: 'bg-primary/5',
          },
          {
            label: 'Open Orders',
            value: stats.draft,
            sub: 'still in progress',
            icon: <Clock className="w-5 h-5 text-amber-500" />,
            bg: 'bg-amber-50',
          },
          {
            label: 'Paid Orders',
            value: stats.paid,
            sub: 'completed',
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50',
          },
          {
            label: 'Total Revenue',
            value: `₹${stats.revenue.toFixed(2)}`,
            sub: 'from paid orders',
            icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
            bg: 'bg-blue-50',
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border p-4 shadow-sm flex items-start gap-3">
            <div className={`${card.bg} p-2.5 rounded-lg shrink-0`}>{card.icon}</div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">{card.label}</div>
              <div className="text-2xl font-bold text-slate-800 leading-tight mt-0.5">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date presets */}
          <div className="flex items-center gap-1 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setDatePreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  datePreset === p.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200" />

          {/* Status filter */}
          <div className="flex items-center gap-1">
            {(['all', 'DRAFT', 'PAID'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? s === 'PAID'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : s === 'DRAFT'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'All Status' : s}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search table, order ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Custom date pickers */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-3 pt-1 border-t">
            <span className="text-sm text-slate-500 font-medium">From</span>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-40 text-sm" />
            <span className="text-sm text-slate-500 font-medium">To</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-40 text-sm" />
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-slate-300" />
            Loading orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="font-medium">No orders found</p>
            <p className="text-sm mt-1">Try a different filter or date range</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-600 w-28">Order #</TableHead>
                <TableHead className="font-semibold text-slate-600">Date & Time</TableHead>
                <TableHead className="font-semibold text-slate-600">Table</TableHead>
                <TableHead className="font-semibold text-slate-600 text-center">Items</TableHead>
                <TableHead className="font-semibold text-slate-600">Payment</TableHead>
                <TableHead className="font-semibold text-slate-600">Status</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order: Order) => {
                const method = order.paymentMethod ? METHOD_BADGE[order.paymentMethod] : null;
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-slate-50/80 border-b border-slate-100"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    {/* Order ID */}
                    <TableCell>
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <div className="text-sm font-medium text-slate-800">
                        {format(new Date(order.createdAt), 'dd MMM yyyy')}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(order.createdAt), 'hh:mm a')}
                      </div>
                    </TableCell>

                    {/* Table */}
                    <TableCell>
                      {order.table ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#d2d2d2] flex items-center justify-center text-sm font-bold text-[#2d2f2f]">
                            {order.table.tableNumber}
                          </div>
                          <div className="text-sm text-slate-600">
                            {order.customer?.name && (
                              <div className="text-xs text-slate-400">{order.customer.name}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm text-slate-500">Takeaway</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Items count */}
                    <TableCell className="text-center">
                      <span className="text-sm font-semibold text-slate-700">
                        {order.linesCount ?? '—'}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">
                        {order.linesCount === 1 ? 'item' : 'items'}
                      </span>
                    </TableCell>

                    {/* Payment method */}
                    <TableCell>
                      {method ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${method.color}`}>
                          {method.icon}
                          {method.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unpaid</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {order.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Open
                        </span>
                      )}
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-right">
                      <span className="font-bold text-slate-900">₹{(order.total ?? 0).toFixed(2)}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t bg-slate-50 text-sm text-slate-500 flex items-center justify-between">
            <span>
              Showing <span className="font-semibold text-slate-700">{filtered.length}</span>
              {search ? ` of ${orders.length}` : ''} orders
            </span>
            {orders.length >= 200 && (
              <span className="text-xs text-slate-400">Showing latest 200 orders. Use date filters to narrow down.</span>
            )}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Order Details
              {selectedOrder && (
                <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded ml-1">
                  #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder ? (
            <div className="space-y-5 mt-2">
              {/* Meta info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Date', value: format(new Date(selectedOrder.createdAt), 'dd MMM yyyy') },
                  { label: 'Time', value: format(new Date(selectedOrder.createdAt), 'hh:mm a') },
                  {
                    label: 'Table',
                    value: selectedOrder.table ? `Table ${selectedOrder.table.tableNumber}` : 'Takeaway',
                  },
                  { label: 'Customer', value: selectedOrder.customer?.name || 'Walk-in' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground font-medium">{item.label}</div>
                    <div className="font-semibold text-slate-800 mt-0.5 text-sm">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Status + payment */}
              <div className="flex items-center gap-3">
                {selectedOrder.status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" />
                    Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    <Clock className="w-4 h-4" />
                    Open / Unpaid
                  </span>
                )}
                {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${
                    METHOD_BADGE[selectedOrder.payments[0].method]?.color ?? 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {METHOD_BADGE[selectedOrder.payments[0].method]?.icon}
                    {METHOD_BADGE[selectedOrder.payments[0].method]?.label ?? selectedOrder.payments[0].method}
                  </span>
                )}
              </div>

              {/* Items */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Order Items</h3>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs text-center">Qty</TableHead>
                        <TableHead className="text-xs text-right">Unit Price</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedOrder.lines || []).map((line: any) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="font-medium text-slate-800">{line.product?.name}</div>
                            {line.note && (
                              <div className="text-xs text-[#5a5c5c] italic mt-0.5">📝 {line.note}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-semibold">{line.qty}</TableCell>
                          <TableCell className="text-right text-slate-500">₹{line.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-800">₹{line.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Total */}
              <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                <div className="text-slate-600 font-medium">Order Total</div>
                <div className="text-2xl font-bold text-primary">
                  ₹{(selectedOrder.lines?.reduce((s: number, l: any) => s + l.total, 0) ?? 0).toFixed(2)}
                </div>
              </div>

              {/* Payments breakdown */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Payments Received</h3>
                  <div className="space-y-2">
                    {selectedOrder.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-white border rounded-lg px-4 py-2.5">
                        <span className="flex items-center gap-2 text-sm">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            METHOD_BADGE[p.method]?.color ?? 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {METHOD_BADGE[p.method]?.icon}
                            {METHOD_BADGE[p.method]?.label ?? p.method}
                          </span>
                          <span className="text-slate-400">{format(new Date(p.createdAt), 'hh:mm a')}</span>
                        </span>
                        <span className="font-bold text-slate-800">₹{p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-300" />
              Loading order details...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
