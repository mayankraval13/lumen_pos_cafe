import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useSocket } from '../../hooks/useSocket';
import {
  useGetActiveSession,
  useGetFloorTables,
  useGetTableOrder,
  useCloseSession,
  useCreateKitchenTicket,
  useCreatePayment,
  useListProducts,
  useListCategories,
  useListPaymentMethods,
  useAddOrderLine,
  useUpdateOrderLine,
  useDeleteOrderLine,
  useCreateOrder,
  useListOrders,
  getGetTableOrderQueryKey,
  Table,
  Product,
  OrderSummary,
} from '@workspace/api-client-react';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  LogOut, ArrowLeft, Send, CreditCard, Search, Grid3X3, ListOrdered,
  CheckCircle, Store, Delete, UtensilsCrossed, Plus, Minus, Trash2,
  StickyNote, RefreshCw, Users, Smartphone, ChevronLeft,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { resolveRegisterProductImage } from '../../lib/productImage';

export default function WaiterPOS() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const { setSession, activeTable, setTable, activeOrder, setOrder, clearOrder } = usePOS();

  const [activeTab, setActiveTab] = useState<'TABLES' | 'REGISTER' | 'ORDERS'>('TABLES');
  const [activeFloorId, setActiveFloorId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedTableIds, setAssignedTableIds] = useState<string[]>([]);

  const [showPayment, setShowPayment] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tenderedAmount, setTenderedAmount] = useState('0');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [paidTotal, setPaidTotal] = useState(0);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [activeNoteLineId, setActiveNoteLineId] = useState<string | null>(null);
  const [lineNote, setLineNote] = useState('');

  // Numpad state
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [numpadMode, setNumpadMode] = useState<'qty' | 'disc' | 'price'>('qty');
  const [numpadBuffer, setNumpadBuffer] = useState<string>('');

  const { data: sessionData, isLoading: sessionLoading } = useGetActiveSession({
    query: { retry: false }
  });

  useEffect(() => {
    if (!token) return;
    fetch('/api/waiters/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.assignedTableIds?.length > 0) {
          setAssignedTableIds(data.assignedTableIds);
        }
      })
      .catch(() => {});
  }, [token]);

  const floors = sessionData?.pos?.floors || [];

  useEffect(() => {
    if (floors.length > 0 && !activeFloorId) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  const currentFloor = floors.find(f => f.id === activeFloorId) || floors[0];

  const { data: tablesData, refetch: refetchTables } = useGetFloorTables(currentFloor?.id || '', {
    query: { enabled: !!currentFloor?.id }
  });

  const { data: productsData } = useListProducts({ limit: 100 });
  const { data: categories = [] } = useListCategories();
  const { data: paymentMethods = [] } = useListPaymentMethods();

  const { data: sessionOrders, refetch: refetchOrders } = useListOrders(
    { sessionId: sessionData?.id || '' },
    { query: { enabled: !!sessionData?.id } }
  );

  const sessionTableOrderMap = useMemo(() => {
    const map: Record<string, OrderSummary> = {};
    (sessionOrders || []).forEach(order => {
      if (order.tableId && order.status === 'DRAFT') {
        map[order.tableId] = order;
      }
    });
    return map;
  }, [sessionOrders]);

  const tableOrderMap = useMemo(() => {
    const map: Record<string, OrderSummary> = { ...sessionTableOrderMap };
    (tablesData || []).forEach((table) => {
      if (table.activeOrderId && !map[table.id]) {
        map[table.id] = {
          id: table.activeOrderId,
          sessionId: table.activeOrderSessionId ?? '',
          tableId: table.id,
          status: 'DRAFT',
          createdAt: '',
          total: table.activeOrderTotal ?? 0,
        };
      }
    });
    return map;
  }, [sessionTableOrderMap, tablesData]);

  const { data: tableOrderData, refetch: refetchTableOrder } = useGetTableOrder(
    activeTable?.id || '',
    { query: { enabled: !!activeTable?.id, retry: false } }
  );

  useEffect(() => {
    if (tableOrderData && activeTable) {
      setOrder(tableOrderData);
    }
  }, [tableOrderData, activeTable, setOrder]);

  const { on } = useSocket();
  useEffect(() => {
    on('order:new', (data: any) => {
      if (data?.source === 'SELF_ORDER') {
        refetchOrders();
        refetchTables();
        toast.info(`New self-order at Table ${data.tableNumber || ''}`, { duration: 6000 });
      }
    });
    on('order:updated', () => {
      refetchTables();
      refetchOrders();
    });
    on('payment:confirmed', (data: any) => {
      if (data?.source === 'CUSTOMER') {
        refetchOrders();
        refetchTables();
        refetchTableOrder();
        toast.success(`Customer paid at Table ${data.tableNumber || ''}`, {
          description: `₹${data.amount?.toFixed(2) || ''} via ${data.method || 'UPI'}`,
          duration: 8000,
        });
      }
    });
  }, [on, refetchOrders, refetchTables, refetchTableOrder]);

  const closeSession = useCloseSession();
  const createOrder = useCreateOrder();
  const addLine = useAddOrderLine();
  const updateLine = useUpdateOrderLine();
  const deleteLine = useDeleteOrderLine();
  const sendToKitchen = useCreateKitchenTicket();
  const createPayment = useCreatePayment();

  useEffect(() => {
    if (!sessionLoading) {
      if (!sessionData) {
        toast.error('No active session. Please open a session first.');
        setLocation('/waiter');
      } else {
        setSession(sessionData);
      }
    }
  }, [sessionData, sessionLoading, setLocation, setSession]);

  const invalidateTableOrder = () => {
    if (activeTable) {
      queryClient.invalidateQueries({ queryKey: getGetTableOrderQueryKey(activeTable.id) });
    }
  };

  const handleCloseSession = () => {
    if (!sessionData) return;
    if (confirm('Close your shift session?')) {
      closeSession.mutate(
        { id: sessionData.id },
        {
          onSuccess: () => {
            setSession(null);
            clearOrder();
            setLocation('/waiter');
          }
        }
      );
    }
  };

  const handleTableClick = (table: Table) => {
    if (!table.active) return;
    setTable(table);
    setOrder(null);
    setActiveTab('REGISTER');

    const existingOrder = tableOrderMap[table.id];
    if (!existingOrder && sessionData) {
      createOrder.mutate(
        { data: { sessionId: sessionData.id, tableId: table.id } },
        {
          onSuccess: (newOrder) => {
            setOrder(newOrder);
            refetchOrders();
          }
        }
      );
    }
  };

  const handleBackToTables = () => {
    clearOrder();
    setActiveTab('TABLES');
    refetchOrders();
    refetchTables();
  };

  const handleProductClick = (product: Product) => {
    if (!activeOrder) {
      if (!sessionData) return;
      createOrder.mutate(
        { data: { sessionId: sessionData.id, tableId: activeTable?.id } },
        {
          onSuccess: (newOrder) => {
            setOrder(newOrder);
            addLine.mutate(
              { id: newOrder.id, data: { productId: product.id, qty: 1 } },
              { onSuccess: () => refetchTableOrder() }
            );
          }
        }
      );
      return;
    }
    addLine.mutate(
      { id: activeOrder.id, data: { productId: product.id, qty: 1 } },
      { onSuccess: () => refetchTableOrder() }
    );
  };

  const handleUpdateLineQty = (lineId: string, qty: number) => {
    if (!activeOrder) return;
    if (qty <= 0) {
      deleteLine.mutate({ id: activeOrder.id, lineId }, { onSuccess: () => refetchTableOrder() });
      return;
    }
    updateLine.mutate(
      { id: activeOrder.id, lineId, data: { qty } },
      { onSuccess: () => refetchTableOrder() }
    );
  };

  const handleDeleteLine = (lineId: string) => {
    if (!activeOrder) return;
    deleteLine.mutate({ id: activeOrder.id, lineId }, { onSuccess: () => refetchTableOrder() });
  };

  const handleSaveNote = (lineId: string) => {
    if (!activeOrder) return;
    updateLine.mutate(
      { id: activeOrder.id, lineId, data: { note: lineNote } },
      {
        onSuccess: () => {
          refetchTableOrder();
          setActiveNoteLineId(null);
          setLineNote('');
        }
      }
    );
  };

  const handleSendToKitchen = () => {
    if (!activeOrder || !activeOrder.lines?.length) return;
    sendToKitchen.mutate(
      { data: { orderId: activeOrder.id } },
      { onSuccess: () => toast.success('Sent to kitchen!') }
    );
  };

  // Numpad helpers
  const applyNumpad = (lineId?: string, mode?: 'qty' | 'disc' | 'price', buffer?: string) => {
    const targetLine = lineId ?? selectedLineId;
    const targetMode = mode ?? numpadMode;
    const targetBuffer = buffer ?? numpadBuffer;
    if (!targetLine || !targetBuffer || !activeOrder) return;
    const val = parseFloat(targetBuffer);
    if (isNaN(val)) return;
    const body: Record<string, number> = {};
    if (targetMode === 'qty') body.qty = Math.max(1, Math.round(Math.abs(val)));
    else if (targetMode === 'price') body.unitPrice = Math.max(0, val);
    else if (targetMode === 'disc') body.discountPct = Math.min(100, Math.max(0, val));
    else return;
    if (Object.keys(body).length === 0) return;
    updateLine.mutate(
      { id: activeOrder.id, lineId: targetLine, data: body as any },
      {
        onSuccess: () => {
          refetchTableOrder();
          setNumpadBuffer('');
          setSelectedLineId(null);
        },
        onError: () => toast.error('Failed to update line'),
      }
    );
  };

  const handleNumpadClick = (btn: string | number | React.ReactElement) => {
    const btnStr = typeof btn === 'object' ? 'DEL' : String(btn);
    if (btnStr === 'Qty' || btnStr === 'Disc' || btnStr === 'Price') {
      const newMode = btnStr.toLowerCase() as 'qty' | 'disc' | 'price';
      if (numpadBuffer && selectedLineId) applyNumpad(undefined, numpadMode, numpadBuffer);
      setNumpadMode(newMode);
      setNumpadBuffer('');
      return;
    }
    if (btnStr === 'DEL') { setNumpadBuffer(prev => prev.slice(0, -1)); return; }
    if (btnStr === '+/-') { setNumpadBuffer(prev => prev ? (prev.startsWith('-') ? prev.slice(1) : '-' + prev) : ''); return; }
    setNumpadBuffer(prev => {
      if (btnStr === '.' && prev.includes('.')) return prev;
      if (prev.replace('-', '').length >= 8) return prev;
      return prev + btnStr;
    });
  };

  const handleSelectLine = (lineId: string) => {
    if (selectedLineId && selectedLineId !== lineId && numpadBuffer) applyNumpad();
    setSelectedLineId(prev => prev === lineId ? null : lineId);
    setNumpadBuffer('');
  };

  const orderTotal = activeOrder?.lines?.reduce((sum, l) => sum + l.total, 0) || 0;

  const handleOpenPayment = () => {
    if (!activeOrder || !activeOrder.lines?.length) return;
    setShowPayment(true);
    setTenderedAmount(orderTotal.toString());
    const cashMethod = paymentMethods.find(m => m.name === 'CASH' && m.enabled);
    setSelectedPaymentMethod(cashMethod || paymentMethods.find(m => m.enabled));
  };

  const handleProcessPayment = () => {
    if (!activeOrder || !selectedPaymentMethod) return;
    const amount = parseFloat(tenderedAmount) || orderTotal;
    setPaidTotal(orderTotal);
    createPayment.mutate(
      { data: { orderId: activeOrder.id, method: selectedPaymentMethod.name as any, amount } },
      {
        onSuccess: () => {
          setShowPayment(false);
          setShowConfirm(true);
        },
        onError: (err: any) => toast.error(err.message || 'Payment failed')
      }
    );
  };

  const handleConfirmDone = () => {
    setShowConfirm(false);
    handleBackToTables();
  };

  const handleRequestPayment = async () => {
    if (!activeTable || !activeOrder || !orderTotal) return;
    const upiMethod = paymentMethods.find((m: any) => m.name === 'UPI' && m.enabled);
    setRequestingPayment(true);
    try {
      await fetch(`/api/self-order/${activeTable.token}/request-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId: activeOrder.id,
          amount: orderTotal,
          upiId: upiMethod?.upiId ?? null,
        }),
      });
      toast.success("Payment request sent to customer's phone", { duration: 5000 });
    } catch {
      toast.error('Failed to send payment request');
    } finally {
      setRequestingPayment(false);
    }
  };

  const filteredProducts = productsData?.products?.filter(p => {
    if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const filteredTablesData = useMemo(() => {
    if (!tablesData) return [];
    if (assignedTableIds.length === 0) return tablesData;
    return tablesData.filter(t => assignedTableIds.includes(t.id));
  }, [tablesData, assignedTableIds]);

  const occupiedCount = Object.keys(tableOrderMap).filter(id =>
    assignedTableIds.length === 0 || assignedTableIds.includes(id)
  ).length;
  const totalActiveTables = filteredTablesData.filter(t => t.active).length || 0;

  if (!sessionData) return null;

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden select-none">

      {/* ── TOP NAVBAR ── */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 shrink-0 shadow-md z-10">
        <div className="flex items-center space-x-2">
          <div className="bg-[#ecfe8d]/20 p-2 rounded text-[#ecfe8d]">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight mr-6">{sessionData.pos?.name}</span>

          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg">
            <Button
              variant="ghost"
              className={`text-slate-300 hover:text-white hover:bg-slate-700 ${activeTab === 'TABLES' ? 'bg-slate-700 text-white' : ''}`}
              onClick={() => { clearOrder(); setActiveTab('TABLES'); }}
            >
              <Grid3X3 className="w-4 h-4 mr-2" />
              Floor Plan
            </Button>
            <Button
              variant="ghost"
              className={`text-slate-300 hover:text-white hover:bg-slate-700 ${activeTab === 'REGISTER' ? 'bg-slate-700 text-white' : ''}`}
              onClick={() => setActiveTab('REGISTER')}
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              Register
            </Button>
            <Button
              variant="ghost"
              className={`text-slate-300 hover:text-white hover:bg-slate-700 ${activeTab === 'ORDERS' ? 'bg-slate-700 text-white' : ''}`}
              onClick={() => { clearOrder(); setActiveTab('ORDERS'); }}
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              Orders
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white">{sessionData.cashier?.name}</div>
            <div className="text-xs text-slate-400">Waiter</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            onClick={() => setLocation('/waiter')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Switch
          </Button>
          <Button variant="destructive" size="sm" onClick={handleCloseSession} disabled={closeSession.isPending}>
            <LogOut className="w-4 h-4 mr-2" />
            End Shift
          </Button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══ FLOOR PLAN ═══ */}
        {activeTab === 'TABLES' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b px-6 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center space-x-1 py-3">
                {floors.map(floor => (
                  <button
                    key={floor.id}
                    onClick={() => setActiveFloorId(floor.id)}
                    className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                      activeFloorId === floor.id
                        ? 'bg-slate-900 text-white shadow'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-5 text-sm">
                <div className="flex items-center space-x-4 text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    Free ({totalActiveTables - occupiedCount})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    Occupied ({occupiedCount})
                  </span>
                </div>
                <Button
                  variant="ghost" size="sm"
                  className="text-slate-400 hover:text-slate-700"
                  onClick={() => { refetchTables(); refetchOrders(); }}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-5">
                {filteredTablesData.map(table => {
                  const occupying = tableOrderMap[table.id];
                  const isOccupied = !!occupying;
                  const isInactive = !table.active;

                  return (
                    <div
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={`
                        relative flex flex-col rounded-2xl border-2 p-4 transition-all shadow-sm
                        ${isInactive
                          ? 'opacity-40 border-slate-200 bg-slate-50 cursor-not-allowed'
                          : isOccupied
                          ? 'border-amber-300 bg-amber-50 hover:shadow-md hover:border-amber-400 cursor-pointer active:scale-95'
                          : 'border-emerald-200 bg-white hover:shadow-md hover:border-emerald-400 cursor-pointer active:scale-95'
                        }
                      `}
                    >
                      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                        isInactive ? 'bg-slate-300' : isOccupied ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <div className={`text-3xl font-extrabold mb-1 leading-none ${
                        isInactive ? 'text-slate-400' : isOccupied ? 'text-amber-700' : 'text-slate-800'
                      }`}>
                        {table.tableNumber}
                      </div>
                      <div className="flex items-center text-xs font-medium text-slate-400 mb-3">
                        <Users className="w-3 h-3 mr-1" />
                        {table.seats} seats
                      </div>
                      {isOccupied ? (
                        <div className="mt-auto pt-2 border-t border-amber-200">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Occupied</div>
                          <div className="text-lg font-extrabold text-amber-700 leading-tight">
                            ₹{(occupying.total ?? table.activeOrderTotal ?? 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className={`mt-auto text-[10px] font-bold uppercase tracking-wider ${
                          isInactive ? 'text-slate-300' : 'text-emerald-500'
                        }`}>
                          {isInactive ? 'Inactive' : 'Available'}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredTablesData.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <UtensilsCrossed className="mx-auto w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-slate-400 font-medium">No tables on this floor.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ REGISTER ═══ */}
        {activeTab === 'REGISTER' && (
          <>
            <div className="flex-[6] flex flex-col border-r bg-white">
              <div className="p-4 border-b flex items-center space-x-4 bg-slate-50/80 shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    className="pl-10 h-12 text-lg rounded-xl bg-white border-slate-200 shadow-sm"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-x-auto hide-scrollbar flex space-x-2 pb-1">
                  <Button
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    className={`rounded-xl whitespace-nowrap h-12 px-6 text-sm font-bold ${categoryFilter === 'all' ? 'shadow-md' : 'bg-white'}`}
                    onClick={() => setCategoryFilter('all')}
                  >
                    All Items
                  </Button>
                  {categories.map(cat => (
                    <Button
                      key={cat.id}
                      variant={categoryFilter === cat.id ? 'default' : 'outline'}
                      className={`rounded-xl whitespace-nowrap h-12 px-6 text-sm font-bold shadow-sm ${categoryFilter !== cat.id ? 'bg-white' : ''}`}
                      style={categoryFilter === cat.id
                        ? { backgroundColor: cat.color, color: 'white', borderColor: cat.color }
                        : { borderLeftColor: cat.color, borderLeftWidth: '4px' }
                      }
                      onClick={() => setCategoryFilter(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProducts.map(product => {
                    const cat = categories.find(c => c.id === product.categoryId);
                    const available = (product as any).isAvailable !== false;
                    const imageUrl = resolveRegisterProductImage(product.name, (product as any).imageUrl);
                    return (
                      <div
                        key={product.id}
                        className={`relative rounded-2xl shadow-sm border flex flex-col justify-between aspect-square transition-all overflow-hidden ${
                          available
                            ? 'bg-white border-slate-200 cursor-pointer active:scale-95 hover:shadow-md hover:border-primary/30'
                            : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                        }`}
                        onClick={() => available && handleProductClick(product)}
                      >
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {!available && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10">
                            <span className="bg-slate-700/80 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Unavailable
                            </span>
                          </div>
                        )}
                        <div className={`relative z-10 p-3 flex justify-between items-start ${imageUrl ? 'pt-2' : ''}`}>
                          {!imageUrl && <span className={`font-bold leading-tight line-clamp-3 text-sm ${available ? 'text-slate-800' : 'text-slate-400'}`}>{product.name}</span>}
                          {cat && !imageUrl && (
                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm ml-1" style={{ backgroundColor: cat.color, opacity: available ? 1 : 0.4 }} />
                          )}
                        </div>
                        <div className={`relative z-10 p-3 ${imageUrl ? 'bg-gradient-to-t from-black/70 to-transparent pt-4' : 'mt-auto'} flex flex-col`}>
                          {imageUrl && <span className="font-bold text-sm text-white leading-tight line-clamp-2 mb-0.5">{product.name}</span>}
                          <span className={`font-bold text-xl tracking-tight ${imageUrl ? 'text-white' : (available ? 'text-primary' : 'text-slate-400')}`}>₹{product.price}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Cart Panel */}
            <div className="flex-[4] flex flex-col bg-slate-50 max-w-md w-full shrink-0 border-l border-slate-200">
              <div className="h-[72px] bg-white border-b px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center font-bold text-xl text-slate-800">
                  {activeTable ? (
                    <>
                      <Button variant="ghost" size="icon" className="mr-2 h-10 w-10 rounded-full" onClick={handleBackToTables}>
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                      </Button>
                      Table {activeTable.tableNumber}
                    </>
                  ) : 'Takeaway Order'}
                </div>
                <Badge variant="outline" className="text-xs uppercase font-bold tracking-wider text-slate-500 border-slate-200">
                  {activeOrder?.status || 'New'}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto bg-white p-2">
                {(!activeOrder || !activeOrder.lines || activeOrder.lines.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <ListOrdered className="w-16 h-16 opacity-20" />
                    <p className="font-medium text-lg">Order is empty</p>
                    <p className="text-sm text-slate-400">Tap a product to add it</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeOrder.lines.map((line, idx) => {
                      const isSelected = selectedLineId === line.id;
                      const hasDiscount = (line as any).discountPct > 0;
                      const rawSubTotal = line.unitPrice * line.qty;
                      return (
                      <div
                        key={line.id || idx}
                        onClick={() => handleSelectLine(line.id)}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer ${isSelected ? 'bg-primary/5 border-primary/40 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-100'}`}
                      >
                        <div className="flex justify-between font-bold text-slate-800 text-lg mb-1">
                          <span className="leading-tight">{line.product?.name}</span>
                          <div className="text-right shrink-0 ml-2">
                            <span>₹{line.total.toFixed(2)}</span>
                            {hasDiscount && <div className="text-xs font-normal text-slate-400 line-through">₹{rawSubTotal.toFixed(2)}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <span>{line.qty} × ₹{line.unitPrice.toFixed(2)}</span>
                          {hasDiscount && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">{(line as any).discountPct}% OFF</span>}
                        </div>
                        <div className="flex justify-between items-center text-slate-500 text-sm mt-2">
                          <div className="flex items-center bg-slate-100 rounded-full border border-slate-200" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 rounded-full"
                              onClick={() => handleUpdateLineQty(line.id, line.qty - 1)}
                              disabled={activeOrder.status === 'PAID'}
                            >
                              <Minus className="w-4 h-4 text-slate-600" />
                            </Button>
                            <span className="w-8 text-center font-bold text-sm text-slate-800">{line.qty}</span>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 rounded-full"
                              onClick={() => handleUpdateLineQty(line.id, line.qty + 1)}
                              disabled={activeOrder.status === 'PAID'}
                            >
                              <Plus className="w-4 h-4 text-slate-600" />
                            </Button>
                          </div>
                          <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { setActiveNoteLineId(line.id); setLineNote(line.note || ''); }}
                              disabled={activeOrder.status === 'PAID'}
                            >
                              <StickyNote className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => handleDeleteLine(line.id)}
                              disabled={activeOrder.status === 'PAID'}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {line.note && activeNoteLineId !== line.id && (
                          <div className="text-xs text-[#5a5c5c] mt-1 italic">📝 {line.note}</div>
                        )}

                        {activeNoteLineId === line.id && (
                          <div className="mt-2 flex space-x-2" onClick={e => e.stopPropagation()}>
                            <Input
                              value={lineNote}
                              onChange={e => setLineNote(e.target.value)}
                              placeholder="Add note..."
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button size="sm" className="h-8" onClick={() => handleSaveNote(line.id)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setActiveNoteLineId(null)}>✕</Button>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* NumPad row */}
              <div className="border-t bg-slate-50 shrink-0">
                {/* Mode selector + display strip */}
                <div className="flex items-stretch border-b divide-x divide-slate-200">
                  {(['Qty', 'Disc', 'Price'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => handleNumpadClick(m)}
                      className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${numpadMode === m.toLowerCase() ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                      {m}
                    </button>
                  ))}
                  <div className="flex-[2] flex items-center justify-end px-4 bg-white min-w-0 overflow-hidden">
                    {!selectedLineId ? (
                      <span className="text-xs text-slate-400 italic">← tap a line</span>
                    ) : numpadBuffer ? (
                      <span className="font-mono text-2xl font-bold text-slate-800">{numpadBuffer}</span>
                    ) : (
                      <span className="font-mono text-lg text-slate-400">
                        {numpadMode === 'qty' ? activeOrder?.lines?.find(l => l.id === selectedLineId)?.qty :
                         numpadMode === 'price' ? activeOrder?.lines?.find(l => l.id === selectedLineId)?.unitPrice?.toFixed(2) :
                         ((activeOrder?.lines?.find(l => l.id === selectedLineId) as any)?.discountPct ?? 0) + '%'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => applyNumpad()}
                    disabled={!selectedLineId || !numpadBuffer}
                    className="px-5 py-2 bg-green-600 text-white font-bold text-lg rounded-none disabled:opacity-30 disabled:bg-slate-300 hover:bg-green-700 transition-colors"
                  >
                    ✓
                  </button>
                </div>
                {/* Digit grid */}
                <div className="h-36 grid grid-cols-4 gap-0 divide-x divide-y divide-slate-200">
                  {[1, 2, 3, 'DEL-icon', 4, 5, 6, '+/-', 7, 8, 9, 0, '.'].map((btn, i) => {
                    const isDelIcon = btn === 'DEL-icon';
                    const display = isDelIcon ? <Delete className="w-5 h-5 mx-auto" /> : btn;
                    const clickVal = isDelIcon ? <Delete className="w-5 h-5 mx-auto" key="del" /> : btn;
                    return (
                      <div
                        key={i}
                        onClick={() => handleNumpadClick(isDelIcon ? clickVal : (btn as string | number))}
                        className="flex items-center justify-center font-bold text-xl text-slate-700 hover:bg-slate-200 active:bg-slate-300 cursor-pointer bg-white transition-colors"
                      >
                        {display}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-white p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-end mb-4 px-2">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Total Due</span>
                  <span className="font-bold text-4xl text-slate-900 tracking-tight">₹{orderTotal.toFixed(2)}</span>
                </div>
                <div className="flex space-x-2 mb-2">
                  <Button
                    className="flex-1 h-14 text-base font-bold bg-[#2d2f2f] hover:bg-[#3a3c3c] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    onClick={handleSendToKitchen}
                    disabled={!activeOrder || !activeOrder.lines?.length || activeOrder.status === 'PAID' || sendToKitchen.isPending}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {sendToKitchen.isPending ? 'Sending...' : 'Send to Kitchen'}
                  </Button>
                  <Button
                    className="flex-1 h-14 text-base font-bold rounded-xl"
                    size="lg"
                    onClick={handleOpenPayment}
                    disabled={!activeOrder || !activeOrder.lines?.length || activeOrder.status === 'PAID'}
                  >
                    <CreditCard className="w-5 h-5 mr-2" /> Pay
                  </Button>
                </div>
                {activeTable && activeOrder && activeOrder.status !== 'PAID' && orderTotal > 0 && (
                  <Button
                    variant="outline"
                    className="w-full h-11 text-sm font-semibold rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={handleRequestPayment}
                    disabled={requestingPayment}
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    {requestingPayment ? 'Sending request...' : "Request Payment on Customer's Phone"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ ORDERS ═══ */}
        {activeTab === 'ORDERS' && (
          <div className="flex-1 p-8 overflow-y-auto bg-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">My Orders</h2>
              <Button variant="outline" size="sm" onClick={() => refetchOrders()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-b">
                    <th className="px-6 py-4 font-medium uppercase tracking-wider">Order</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider">Time</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider">Table</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!(sessionOrders || []).length ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No orders yet for this shift.</td>
                    </tr>
                  ) : (
                    (sessionOrders || []).map(order => (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          if (order.table) setTable(order.table);
                          else setTable(null);
                          setActiveTab('REGISTER');
                        }}
                      >
                        <td className="px-6 py-4 font-bold text-primary">#{order.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 text-slate-600">{format(new Date(order.createdAt), 'HH:mm')}</td>
                        <td className="px-6 py-4 text-slate-800 font-medium">
                          {order.table ? `Table ${order.table.tableNumber}` : 'Takeaway'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={order.status === 'PAID' ? 'default' : 'secondary'}>{order.status}</Badge>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 text-right">₹{order.total.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═══ PAYMENT OVERLAY ═══ */}
      {showPayment && selectedPaymentMethod && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex">
          <div className="flex-1 bg-transparent flex flex-col justify-between p-12">
            <Button variant="ghost" className="self-start text-white hover:bg-white/10" size="lg" onClick={() => setShowPayment(false)}>
              <ArrowLeft className="w-6 h-6 mr-2" /> Back
            </Button>
            <div className="text-center">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xl mb-4">Total Amount Due</p>
              <p className="text-8xl font-bold text-white font-mono tracking-tight">₹{orderTotal.toFixed(2)}</p>
              {activeTable && (
                <p className="text-slate-400 mt-4 text-xl">Table {activeTable.tableNumber}</p>
              )}
            </div>
            <div />
          </div>

          <div className="w-[500px] bg-white h-full flex flex-col shadow-2xl">
            <div className="p-8 border-b bg-slate-50">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Payment Method</h2>
              <div className="grid grid-cols-3 gap-3">
                {paymentMethods.filter(m => m.enabled).map(method => (
                  <div
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all font-bold ${
                      selectedPaymentMethod?.id === method.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    {method.name}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 p-8 flex flex-col justify-center items-center">
              {selectedPaymentMethod.name === 'CASH' && (
                <div className="w-full max-w-sm text-center">
                  <p className="text-slate-500 font-bold mb-2 uppercase tracking-wider text-sm">Tendered Amount</p>
                  <div className="relative mb-8">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₹</span>
                    <Input
                      className="h-20 text-5xl font-bold text-center pl-10 rounded-2xl bg-slate-50 border-slate-200"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                    />
                  </div>
                  {parseFloat(tenderedAmount) > orderTotal && (
                    <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                      <p className="text-green-600 font-bold uppercase tracking-wider text-sm mb-1">Change Due</p>
                      <p className="text-4xl font-bold text-green-700">₹{(parseFloat(tenderedAmount) - orderTotal).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedPaymentMethod.name === 'UPI' && (
                <div className="flex flex-col items-center text-center">
                  {selectedPaymentMethod.upiId ? (
                    <>
                      <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm mb-4">
                        <QRCodeSVG value={`upi://pay?pa=${selectedPaymentMethod.upiId}&am=${orderTotal}&cu=INR`} size={180} />
                      </div>
                      <p className="text-slate-600 font-medium">{selectedPaymentMethod.upiId}</p>
                      <p className="text-sm text-slate-400 mt-1">Scan to pay ₹{orderTotal.toFixed(2)}</p>
                    </>
                  ) : (
                    <p className="text-slate-500">No UPI ID configured. Use a different method.</p>
                  )}
                </div>
              )}

              {selectedPaymentMethod.name !== 'CASH' && selectedPaymentMethod.name !== 'UPI' && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-800 mb-2">₹{orderTotal.toFixed(2)}</p>
                  <p className="text-slate-500">Confirm {selectedPaymentMethod.name} payment</p>
                </div>
              )}
            </div>

            <div className="p-8 border-t">
              <Button
                className="w-full h-16 text-xl font-bold rounded-2xl"
                onClick={handleProcessPayment}
                disabled={createPayment.isPending}
              >
                {createPayment.isPending ? 'Processing...' : `Confirm Payment · ₹${orderTotal.toFixed(2)}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAYMENT SUCCESS ═══ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-12 max-w-md w-full mx-4 text-center shadow-2xl">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Payment Done!</h2>
            <p className="text-slate-500 mb-2">
              ₹{paidTotal.toFixed(2)} received
              {activeTable ? ` · Table ${activeTable.tableNumber}` : ''}
            </p>
            <Button className="w-full h-14 text-lg font-bold rounded-2xl mt-6" onClick={handleConfirmDone}>
              Next Table
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
