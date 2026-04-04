import React, { useEffect, useState, useMemo } from 'react';
import { useListKitchenTickets, useUpdateKitchenTicketStatus, useUpdateKitchenTicketItem } from '@workspace/api-client-react';
import { useSocket } from '../../hooks/useSocket';
import { Button } from '../../components/ui/button';
import {
  UtensilsCrossed, Clock, Flame, CheckCircle, ChefHat, ArrowRight, Wifi, WifiOff, Check,
} from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type TicketStatus = 'TO_COOK' | 'PREPARING' | 'COMPLETED';

interface TicketItem {
  id: string;
  prepared: boolean;
  orderLine?: {
    qty: number;
    note?: string | null;
    product?: { name: string } | null;
  } | null;
}

interface Ticket {
  id: string;
  orderId: string;
  status: TicketStatus;
  createdAt: string;
  items?: TicketItem[];
  order?: {
    table?: { tableNumber?: string } | null;
    customer?: { name?: string } | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeLabel(createdAt: string) {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: false });
}

function isUrgent(createdAt: string, status: TicketStatus) {
  return status !== 'COMPLETED' && differenceInMinutes(new Date(), new Date(createdAt)) >= 10;
}

function tableLabel(ticket: Ticket) {
  if (ticket.order?.table?.tableNumber) return `Table ${ticket.order.table.tableNumber}`;
  if (ticket.order?.customer?.name) return ticket.order.customer.name;
  return 'Takeaway';
}

// ─── Column config ────────────────────────────────────────────────────────────
const COL = {
  TO_COOK: {
    headerBg: 'bg-amber-50',
    headerBorder: 'border-amber-200',
    headerText: 'text-amber-700',
    countBg: 'bg-amber-100 text-amber-700',
    cardBorder: 'border-amber-200',
    cardHeaderBg: 'bg-amber-50',
    cardHeaderText: 'text-amber-800',
    btnBg: 'bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
    icon: <Flame className="w-4 h-4" />,
    label: 'To Cook',
    next: 'PREPARING' as TicketStatus,
    btnLabel: 'Start Cooking',
    emptyEmoji: '🔥',
  },
  PREPARING: {
    headerBg: 'bg-blue-50',
    headerBorder: 'border-blue-200',
    headerText: 'text-blue-700',
    countBg: 'bg-blue-100 text-blue-700',
    cardBorder: 'border-blue-200',
    cardHeaderBg: 'bg-blue-50',
    cardHeaderText: 'text-blue-800',
    btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
    icon: <ChefHat className="w-4 h-4" />,
    label: 'Preparing',
    next: 'COMPLETED' as TicketStatus,
    btnLabel: 'Mark Ready',
    emptyEmoji: '👨‍🍳',
  },
  COMPLETED: {
    headerBg: 'bg-emerald-50',
    headerBorder: 'border-emerald-200',
    headerText: 'text-emerald-700',
    countBg: 'bg-emerald-100 text-emerald-700',
    cardBorder: 'border-emerald-200',
    cardHeaderBg: 'bg-emerald-50',
    cardHeaderText: 'text-emerald-800',
    btnBg: '',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Ready to Serve',
    next: null,
    btnLabel: '',
    emptyEmoji: '✅',
  },
} as const;

// ─── Ticket Card ──────────────────────────────────────────────────────────────
function TicketCard({
  ticket,
  status,
  onAdvance,
  onToggleItem,
  isAdvancing,
}: {
  ticket: Ticket;
  status: TicketStatus;
  onAdvance: () => void;
  onToggleItem: (itemId: string, prepared: boolean) => void;
  isAdvancing: boolean;
}) {
  const col = COL[status];
  const items = ticket.items ?? [];
  const urgent = isUrgent(ticket.createdAt, status);
  const isDone = status === 'COMPLETED';

  return (
    <div className={`rounded-2xl border bg-white shadow-sm mb-3 overflow-hidden ${col.cardBorder}`}>
      {/* card header */}
      <div className={`${col.cardHeaderBg} px-4 py-2.5 flex items-center justify-between border-b ${col.cardBorder}`}>
        <span className={`font-bold text-sm ${col.cardHeaderText}`}>{tableLabel(ticket)}</span>
        <span className={`text-xs flex items-center gap-1 font-medium ${urgent ? 'text-red-500' : 'text-[#5a5c5c]'}`}>
          <Clock className="w-3 h-3" />
          {timeLabel(ticket.createdAt)}
          {urgent && <span className="ml-1 text-red-500 font-bold">!</span>}
        </span>
      </div>

      {/* items */}
      <div className="divide-y divide-slate-100">
        {items.length === 0 && (
          <p className="text-[#5a5c5c] text-sm px-4 py-3">No items</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={isDone}
            onClick={() => !isDone && onToggleItem(item.id, !item.prepared)}
            className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors
              ${isDone ? 'cursor-default' : 'hover:bg-slate-50 active:bg-slate-100'}
              ${item.prepared ? 'opacity-50' : ''}
            `}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              item.prepared
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-[#2d2f2f]/30 bg-white'
            }`}>
              {item.prepared && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-semibold ${item.prepared ? 'line-through text-[#5a5c5c]' : 'text-[#2d2f2f]'}`}>
                  {item.orderLine?.product?.name ?? '—'}
                </span>
                <span className="text-[#5a5c5c] text-xs font-medium">× {item.orderLine?.qty ?? 1}</span>
              </div>
              {item.orderLine?.note && (
                <p className="text-amber-700 text-xs mt-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 inline-block">
                  📝 {item.orderLine.note}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* action footer */}
      {!isDone && col.next && (
        <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <Button
            size="sm"
            disabled={isAdvancing}
            onClick={onAdvance}
            className={`w-full text-sm font-semibold active:scale-[0.98] ${col.btnBg}`}
          >
            {isAdvancing ? 'Updating…' : col.btnLabel}
            {!isAdvancing && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
          </Button>
        </div>
      )}
      {isDone && (
        <div className="px-4 py-2.5 border-t border-emerald-100 bg-emerald-50 flex items-center justify-center gap-1.5 text-emerald-600 text-xs font-semibold">
          <CheckCircle className="w-3.5 h-3.5" /> Ready to Serve
        </div>
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function Column({
  status,
  tickets,
  onAdvance,
  onToggleItem,
  advancingId,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  onAdvance: (id: string, next: TicketStatus) => void;
  onToggleItem: (ticketId: string, itemId: string, prepared: boolean) => void;
  advancingId: string | null;
}) {
  const col = COL[status];

  return (
    <div className="flex flex-col min-h-0">
      {/* column header */}
      <div className={`${col.headerBg} border ${col.headerBorder} rounded-2xl px-4 py-2.5 flex items-center gap-2 mb-3 shrink-0 shadow-sm`}>
        <span className={col.headerText}>{col.icon}</span>
        <span className={`font-bold text-sm ${col.headerText}`}>{col.label}</span>
        <span className={`ml-auto text-xs font-bold rounded-full px-2.5 py-0.5 ${col.countBg}`}>
          {tickets.length}
        </span>
      </div>

      {/* scrollable cards */}
      <div className="overflow-y-auto flex-1 pr-1">
        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-[#5a5c5c] gap-2">
            <span className="text-4xl opacity-40">{col.emptyEmoji}</span>
            <p className="text-sm font-medium">No tickets</p>
          </div>
        )}
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            status={status}
            onAdvance={() => col.next && onAdvance(ticket.id, col.next)}
            onToggleItem={(itemId, prepared) => onToggleItem(ticket.id, itemId, prepared)}
            isAdvancing={advancingId === ticket.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Kitchen Display ─────────────────────────────────────────────────────
export default function Kitchen() {
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  const { data: rawData, isLoading, refetch } = useListKitchenTickets(
    undefined,
    { query: { refetchInterval: 10000 } }
  );

  const updateStatus = useUpdateKitchenTicketStatus();
  const updateItem = useUpdateKitchenTicketItem();

  const { on, socket } = useSocket('kitchen');

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    on('ticket:created', () => refetch());
    on('ticket:updated', () => refetch());
    on('item:prepared', () => refetch());
    on('kitchen:ticket:new', () => refetch());
    on('order:new', () => refetch());
  }, [on, refetch]);

  const allTickets: Ticket[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData as unknown as Ticket[];
    const d = rawData as any;
    return Array.isArray(d.tickets) ? d.tickets : [];
  }, [rawData]);

  const byStatus = useMemo(() => ({
    TO_COOK: allTickets.filter(t => t.status === 'TO_COOK').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    PREPARING: allTickets.filter(t => t.status === 'PREPARING').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    COMPLETED: allTickets.filter(t => t.status === 'COMPLETED').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  }), [allTickets]);

  const handleAdvance = (id: string, next: TicketStatus) => {
    setAdvancingId(id);
    updateStatus.mutate(
      { id, data: { status: next } },
      {
        onSuccess: () => { refetch(); setAdvancingId(null); },
        onError: () => setAdvancingId(null),
      }
    );
  };

  const handleToggleItem = (ticketId: string, itemId: string, prepared: boolean) => {
    updateItem.mutate(
      { ticketId, itemId, data: { prepared } },
      { onSuccess: () => refetch() }
    );
  };

  const totalActive = byStatus.TO_COOK.length + byStatus.PREPARING.length;

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      className="bg-[#d2d2d2]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-[#2d2f2f] px-5 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-[#ecfe8d]/20 p-2 rounded-lg">
            <UtensilsCrossed className="w-5 h-5 text-[#ecfe8d]" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">Kitchen Display</h1>
            <p className="text-white/40 text-xs">
              {isLoading ? 'Loading…' : `${totalActive} active ticket${totalActive !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* live indicator */}
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? 'Live' : 'Offline'}
          </span>

          {/* summary pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full">
              <Flame className="w-3 h-3" /> {byStatus.TO_COOK.length} new
            </span>
            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">
              <ChefHat className="w-3 h-3" /> {byStatus.PREPARING.length} cooking
            </span>
            <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> {byStatus.COMPLETED.length} ready
            </span>
          </div>
        </div>
      </div>

      {/* ── Kanban board ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#5a5c5c] gap-3">
          <UtensilsCrossed className="w-8 h-8 animate-pulse" />
          <span className="font-medium">Loading kitchen…</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem', minHeight: 0 }}>
          {(['TO_COOK', 'PREPARING', 'COMPLETED'] as TicketStatus[]).map(status => (
            <Column
              key={status}
              status={status}
              tickets={byStatus[status]}
              onAdvance={handleAdvance}
              onToggleItem={handleToggleItem}
              advancingId={advancingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
