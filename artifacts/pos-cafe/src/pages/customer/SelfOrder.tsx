import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'wouter';
import { useGetSelfOrderInfo, useCreateSelfOrder, Product } from '@workspace/api-client-react';
import {
  Coffee, ShoppingBag, Plus, Minus, ChevronLeft, CheckCircle,
  Clock, Flame, ChefHat, QrCode, Smartphone, UtensilsCrossed,
  SlidersHorizontal, CreditCard, Banknote, X, Download,
  ArrowRight, ReceiptText, Star,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../../hooks/useSocket';

// ─── Types ────────────────────────────────────────────────────────────────────
type Variant = { id: string; attribute: string; value: string; extraPrice: number };
type ProductWithVariants = Product & { variants: Variant[]; description?: string | null };

type CartItem = {
  productId: string;
  product: ProductWithVariants;
  qty: number;
  note?: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number; // base + variant extra
};

type OrderHistoryItem = {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  lines: Array<{ id: string; qty: number; total: number; product: { name: string } | null }>;
  ticket: { status: 'TO_COOK' | 'PREPARING' | 'COMPLETED' } | null;
};

type PaymentRequest = {
  orderId: string;
  amount: number;         // total bill amount
  upiId: string | null;
  tableId: string;
  splitParts?: number;    // how many equal parts (1 or undefined = no split)
  splitAmountEach?: number; // amount per part
  collectedParts?: number;  // parts already collected
  remainingAmount?: number; // outstanding amount
};

type PaymentMethod = { id: string; name: 'CASH' | 'DIGITAL' | 'UPI'; enabled: boolean; upiId?: string | null };
type SelfOrderInfo = {
  tableId: string;
  tableNumber: string;
  floorName: string;
  posName: string;
  tableToken: string;
  hasActiveOrder: boolean;
  activeOrderId: string | null;
  categories: Array<{ id: string; name: string; color: string }>;
  products: ProductWithVariants[];
  paymentMethods: PaymentMethod[];
};

type Step = 'SPLASH' | 'IDENTIFY' | 'MENU' | 'CHECKOUT' | 'TRACKING' | 'PAY_REQUEST' | 'PARTIAL_PAID' | 'SUCCESS' | 'ENDED';

const STATUS_LABEL: Record<string, string> = { TO_COOK: 'Waiting', PREPARING: 'Cooking', COMPLETED: 'Ready! 🍽️' };
const STATUS_COLOR: Record<string, string> = {
  TO_COOK: 'bg-amber-100 text-amber-700 border border-amber-200',
  PREPARING: 'bg-blue-100 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-green-100 text-green-700 border border-green-200',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  TO_COOK: <Clock className="w-3.5 h-3.5" />,
  PREPARING: <Flame className="w-3.5 h-3.5" />,
  COMPLETED: <CheckCircle className="w-3.5 h-3.5" />,
};

function resolveSelfOrderUpiId(
  info: SelfOrderInfo | null | undefined,
  requestUpiId?: string | null,
): string | null {
  const fromRequest = requestUpiId?.trim();
  if (fromRequest) return fromRequest;
  const upi = info?.paymentMethods?.find(
    (m) => m.name === "UPI" && m.enabled && (m.upiId?.trim() ?? ""),
  );
  return upi?.upiId?.trim() ?? null;
}

function buildUpiDeepLink(upiId: string, merchantName: string, amount: number): string {
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR`;
}

function SelfOrderUpiQrCard({
  title,
  subtitle,
  amount,
  upiId,
  posName,
  size = 200,
}: {
  title: string;
  subtitle?: string;
  amount: number;
  upiId: string;
  posName: string;
  size?: number;
}) {
  const url = buildUpiDeepLink(upiId, posName, amount);
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border p-6 flex flex-col items-center">
      <h3 className="font-bold text-lg mb-1 text-slate-800 text-center">{title}</h3>
      <p className="text-sm text-slate-500 mb-4 text-center">
        {subtitle ?? "Open any UPI app and scan the code"}
      </p>
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <QRCodeSVG value={url} size={size} level="M" />
      </div>
      <p className="text-xs text-slate-400 mt-3 break-all text-center px-1">UPI ID: {upiId}</p>
      <p className="text-base font-extrabold text-[#2d2f2f] mt-2">₹{amount.toFixed(2)}</p>
    </div>
  );
}

// ─── Receipt Generator ────────────────────────────────────────────────────────
function generateReceiptHTML(orders: OrderHistoryItem[], info: SelfOrderInfo, payMethod: string) {
  const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const grandTotal = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const allLines = orders.flatMap(o => o.lines);

  const rows = allLines.map(l =>
    `<tr><td>${l.product?.name ?? 'Item'}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">₹${(l.total ?? 0).toFixed(2)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title><style>
    body{font-family:monospace;max-width:320px;margin:0 auto;padding:24px;color:#111}
    h1{text-align:center;font-size:20px;margin-bottom:4px}
    .sub{text-align:center;font-size:12px;color:#666;margin-bottom:16px}
    hr{border:none;border-top:1px dashed #bbb;margin:12px 0}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;font-size:11px;color:#888;padding-bottom:6px}
    td{padding:3px 0}
    .total{font-size:16px;font-weight:bold;display:flex;justify-content:space-between;margin-top:12px}
    .footer{text-align:center;font-size:11px;color:#888;margin-top:16px}
  </style></head><body>
    <h1>${info.posName}</h1>
    <div class="sub">Table ${info.tableNumber} · ${info.floorName}<br/>${now}</div>
    <hr/>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <hr/>
    <div class="total"><span>TOTAL</span><span>₹${grandTotal.toFixed(2)}</span></div>
    <div style="font-size:12px;color:#555;margin-top:6px">Payment: ${payMethod}</div>
    <hr/>
    <div class="footer">Thank you for dining with us!<br/>Visit us again 🙏</div>
  </body></html>`;
}

function downloadReceipt(orders: OrderHistoryItem[], info: SelfOrderInfo, payMethod: string) {
  const html = generateReceiptHTML(orders, info, payMethod);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-table${info.tableNumber}-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Countdown Circle ─────────────────────────────────────────────────────────
function CountdownCircle({ seconds, total }: { seconds: number; total: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - seconds / total);
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="text-2xl font-bold text-green-700">{seconds}</span>
    </div>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────
function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: ProductWithVariants;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}) {
  const [customize, setCustomize] = useState(false);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    product.variants?.[0] ?? null
  );

  const unitPrice = product.price + (selectedVariant?.extraPrice ?? 0);
  const lineTotal = unitPrice * qty;

  function handleAdd() {
    onAdd({
      productId: product.id,
      product,
      qty,
      note: note.trim() || undefined,
      variantId: selectedVariant?.id,
      variantName: selectedVariant ? `${selectedVariant.attribute}: ${selectedVariant.value}` : undefined,
      unitPrice,
    });
    onClose();
    toast.success(`${qty}× ${product.name} added to cart`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-xl font-bold text-slate-900 flex-1 pr-2">{product.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {product.description && (
          <p className="text-slate-500 text-sm mb-2">{product.description}</p>
        )}
        <p className="text-lg font-bold text-[#2d2f2f] mb-5">₹{product.price.toFixed(2)}</p>

        {!customize ? (
          /* Two-option buttons */
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-between bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white rounded-2xl px-5 py-4 font-semibold text-base transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
              onClick={() => { setQty(1); handleAdd(); }}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add to Cart
              </div>
              <span className="text-white/70 text-sm">₹{product.price.toFixed(2)}</span>
            </button>
            <button
              className="w-full flex items-center justify-between border-2 border-[#2d2f2f] text-[#2d2f2f] hover:bg-[#2d2f2f]/5 rounded-2xl px-5 py-4 font-semibold text-base transition-colors"
              onClick={() => setCustomize(true)}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5" />
                Customize
              </div>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Customize section */
          <div className="space-y-4">
            {/* Variant selector */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Options</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        selectedVariant?.id === v.id
                          ? 'border-[#2d2f2f] bg-[#2d2f2f]/5 text-[#2d2f2f]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {v.value}
                      {v.extraPrice > 0 && <span className="text-xs ml-1 opacity-70">+₹{v.extraPrice}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Qty stepper */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xl font-bold w-8 text-center">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Note */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Special Instructions</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. extra sugar, no ice…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-[#2d2f2f] focus:ring-2 focus:ring-[#2d2f2f]/10"
                rows={2}
                maxLength={120}
              />
            </div>

            {/* Add button */}
            <button
              className="w-full flex items-center justify-between bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white rounded-2xl px-5 py-4 font-bold text-base transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
              onClick={handleAdd}
            >
              <span>Add to Cart</span>
              <span>₹{lineTotal.toFixed(2)}</span>
            </button>

            <button onClick={() => setCustomize(false)} className="w-full text-sm text-slate-400 hover:text-slate-600 py-1">
              ← Back to options
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Success Overlay ──────────────────────────────────────────────────────────
function SuccessOverlay({
  orders,
  info,
  payMethod,
  onSessionEnd,
}: {
  orders: OrderHistoryItem[];
  info: SelfOrderInfo;
  payMethod: string;
  onSessionEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(60);
  const [showReceipt, setShowReceipt] = useState(false);
  const grandTotal = orders.reduce((s, o) => s + (o.total ?? 0), 0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(interval);
          onSessionEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onSessionEnd]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-green-50 overflow-y-auto px-4 py-8 text-center">
      {/* Animated icon */}
      <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-6 mt-4">
        <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
      </div>

      <h2 className="text-3xl font-extrabold text-green-800 mb-1">Payment Confirmed!</h2>
      <p className="text-green-600 text-lg font-medium mb-1">{info.posName}</p>
      <p className="text-slate-500 text-sm mb-6">Table {info.tableNumber} · {info.floorName}</p>

      {/* Amount */}
      <div className="bg-white rounded-2xl shadow-sm border border-green-200 px-8 py-4 mb-6">
        <p className="text-sm text-slate-500 mb-1">Total Paid</p>
        <p className="text-4xl font-extrabold text-green-600">₹{grandTotal.toFixed(2)}</p>
        <p className="text-sm text-slate-400 mt-1">via {payMethod}</p>
      </div>

      {/* Receipt */}
      <div className="w-full max-w-sm mb-6">
        <button
          onClick={() => setShowReceipt(r => !r)}
          className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <ReceiptText className="w-5 h-5 text-[#2d2f2f]" />
            View Receipt
          </div>
          <span className="text-xs text-slate-400">{showReceipt ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showReceipt && (
          <div className="mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden text-left">
            <div className="divide-y text-sm">
              {orders.flatMap(o => o.lines).map(line => (
                <div key={line.id} className="flex justify-between px-5 py-2.5">
                  <span className="text-slate-700">
                    <span className="font-semibold mr-2">{line.qty}×</span>{line.product?.name}
                  </span>
                  <span className="font-medium">₹{(line.total ?? 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-5 py-3 bg-green-50 font-bold">
                <span>Total</span>
                <span className="text-green-700">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Download button */}
      <button
        onClick={() => downloadReceipt(orders, info, payMethod)}
        className="flex items-center gap-2 bg-white border-2 border-slate-200 hover:border-[#2d2f2f] text-slate-700 rounded-2xl px-6 py-3 font-semibold transition-colors mb-8"
      >
        <Download className="w-4 h-4 text-[#2d2f2f]" />
        Download Receipt
      </button>

      {/* Countdown + manual end */}
      <div className="flex flex-col items-center gap-2">
        <CountdownCircle seconds={seconds} total={60} />
        <p className="text-slate-500 text-sm">Session ends automatically in {seconds}s</p>
        <p className="text-slate-400 text-xs">Scan the QR at your table for a new session</p>
        <button
          onClick={onSessionEnd}
          className="mt-3 flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-2xl px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          <X className="w-4 h-4" />
          End Session Now
        </button>
      </div>

      <div className="mt-8 flex items-center gap-1 text-yellow-500">
        {[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-5 h-5 fill-yellow-400" />)}
      </div>
      <p className="text-slate-400 text-sm mt-1">We hope you enjoyed your meal! 🙏</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SelfOrder() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('SPLASH');

  const { data: info, isLoading: infoLoading } = useGetSelfOrderInfo(token || '', {
    query: { enabled: !!token },
  });

  const createOrder = useCreateSelfOrder();
  const { on } = useSocket();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'UPI' | 'CASH' | 'DIGITAL'>('CASH');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null);
  const tableIdRef = useRef<string>('');
  const payMethodRef = useRef<string>('CASH');

  // Customer identification
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [identifyForm, setIdentifyForm] = useState({ name: '', phone: '', email: '' });
  const [identifyLoading, setIdentifyLoading] = useState(false);

  const GUEST_KEY = `pos_guest_${token}`;

  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  const restoreGuestSession = useCallback(() => {
    try {
      const stored = localStorage.getItem(GUEST_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.customerId) {
          setCustomerId(parsed.customerId);
          setCustomerName(parsed.name || '');
          setSessionStartedAt(parsed.sessionStartedAt || null);
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, [GUEST_KEY]);

  useEffect(() => {
    if (info) tableIdRef.current = info.tableId ?? '';
  }, [info]);

  useEffect(() => {
    if (step === 'SPLASH' && info) {
      const t = setTimeout(() => {
        if (restoreGuestSession()) {
          setStep('MENU');
        } else {
          setStep('IDENTIFY');
        }
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [step, info, restoreGuestSession]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (sessionStartedAt) params.set('since', sessionStartedAt);
      if (customerId) params.set('customerId', customerId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/self-order/${token}/history${query}`);
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json)) {
        setOrders(json);
      } else {
        if (json.orders) setOrders(json.orders);
        if (json.pendingPayment) {
          const pp = json.pendingPayment as PaymentRequest;
          setPaymentRequest(pp);
          // If step is already PARTIAL_PAID (we paid our share), update split state but don't reset the screen
          setStep(prev => prev === 'PARTIAL_PAID' ? 'PARTIAL_PAID' : 'PAY_REQUEST');
        } else {
          // No pending payment — if we were waiting (PARTIAL_PAID), all parts are now paid → SUCCESS
          setStep(prev => prev === 'PARTIAL_PAID' ? 'SUCCESS' : prev);
        }
      }
    } catch { /* silent */ }
  }, [token, sessionStartedAt, customerId]);

  useEffect(() => {
    if (step === 'TRACKING' || step === 'PAY_REQUEST' || step === 'PARTIAL_PAID' || step === 'MENU') {
      fetchHistory();
      const interval = setInterval(fetchHistory, 6000);
      return () => clearInterval(interval);
    }
  }, [step, fetchHistory]);

  useEffect(() => {
    on('payment:requested', (data: PaymentRequest & { tableId: string }) => {
      if (data.tableId === tableIdRef.current || data.tableId === info?.tableId) {
        setPaymentRequest(data);
        setStep('PAY_REQUEST');
        toast.info('The cashier has requested payment', { duration: 5000 });
      }
    });
    on('payment:confirmed', (data: { tableId?: string; source?: string }) => {
      if (!data?.tableId || data.tableId === tableIdRef.current || data.tableId === info?.tableId) {
        setPaymentConfirmed(true);
        setStep('SUCCESS');
      }
    });
    on('payment:partial', (data: { tableId?: string; collectedParts?: number; splitParts?: number; splitAmountEach?: number; remainingAmount?: number }) => {
      if (!data?.tableId || data.tableId === tableIdRef.current || data.tableId === info?.tableId) {
        // Update payment request with latest collected count so PARTIAL_PAID screen stays fresh
        setPaymentRequest(prev => prev ? {
          ...prev,
          collectedParts: data.collectedParts ?? prev.collectedParts,
          remainingAmount: data.remainingAmount ?? prev.remainingAmount,
        } : prev);
      }
    });
    on('kitchen:order:ready', (data: { tableId?: string }) => {
      if (!data?.tableId || data.tableId === info?.tableId) {
        toast.success('Your food is ready! 🍽️', {
          description: 'Your order will be served to your table shortly.',
          duration: 10000,
        });
      }
    });
  }, [on, info?.tableId]);

  // ── Cart helpers ─────────────────────────────────────────────────────────
  function addToCart(item: CartItem) {
    setCart(prev => {
      // If same product + same variant, just increment
      const key = item.productId + (item.variantId ?? '');
      const ex = prev.find(i => i.productId + (i.variantId ?? '') === key && !item.note);
      if (ex && !item.note) {
        return prev.map(i => i.productId + (i.variantId ?? '') === key ? { ...i, qty: i.qty + item.qty } : i);
      }
      return [...prev, item];
    });
  }

  function updateQty(productId: string, variantId: string | undefined, delta: number) {
    const key = productId + (variantId ?? '');
    setCart(prev =>
      prev.map(i => i.productId + (i.variantId ?? '') === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter(i => i.qty > 0)
    );
  }

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const filteredProducts = activeCategory === 'all'
    ? (info?.products ?? [])
    : (info?.products ?? []).filter(p => p.categoryId === activeCategory);

  // ── Place order ──────────────────────────────────────────────────────────
  function handlePlaceOrder() {
    if (!cart.length) return;
    payMethodRef.current = selectedPayMethod;
    createOrder.mutate(
      {
        token: token || '',
        data: {
          lines: cart.map(i => ({
            productId: i.productId,
            qty: i.qty,
            note: i.note,
          })),
          ...(customerId ? { customerId } : {}),
        } as any,
      },
      {
        onSuccess: () => {
          setCart([]);
          fetchHistory();
          setStep('TRACKING');
          toast.success('Order sent to kitchen! 🍳');
        },
        onError: (err: any) => toast.error(err.message || 'Failed to place order'),
      }
    );
  }

  // ── Customer-initiated payment confirmation (PAY_REQUEST step) ───────────
  async function handleConfirmPayment() {
    if (!paymentRequest) return;
    setIsConfirmingPayment(true);
    try {
      const res = await fetch(`/api/self-order/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'UPI' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.finalPayment) {
          payMethodRef.current = 'UPI';
          setPaymentConfirmed(true);
          setStep('SUCCESS');
        } else {
          // Partial payment — update the paymentRequest with new collected state and show waiting screen
          setPaymentRequest(prev => prev ? {
            ...prev,
            collectedParts: data.collectedParts,
            remainingAmount: data.remainingAmount,
          } : prev);
          setStep('PARTIAL_PAID');
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Payment failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsConfirmingPayment(false);
    }
  }

  // ── End session (called after countdown) ─────────────────────────────────
  async function handleSessionEnd() {
    try {
      await fetch(`/api/self-order/${token}/end-session`, { method: 'POST' });
    } catch { /* best effort */ }
    localStorage.removeItem(GUEST_KEY);
    setCustomerId(null);
    setCustomerName('');
    setStep('ENDED');
  }

  // ── Handle customer identification form submit ────────────────────────────
  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    if (!identifyForm.name.trim()) return;
    setIdentifyLoading(true);
    try {
      const res = await fetch(`/api/self-order/${token}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: identifyForm.name.trim(),
          phone: identifyForm.phone.trim() || undefined,
          email: identifyForm.email.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const sessionTs = new Date().toISOString();
        setCustomerId(data.customerId);
        setCustomerName(data.name);
        setSessionStartedAt(sessionTs);
        localStorage.setItem(GUEST_KEY, JSON.stringify({
          customerId: data.customerId,
          name: data.name,
          phone: data.phone,
          sessionStartedAt: sessionTs,
        }));
        setStep('MENU');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to sign in');
      }
    } catch {
      toast.error('Network error, please try again');
    } finally {
      setIdentifyLoading(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (infoLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#d2d2d2]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[#2d2f2f] rounded-2xl flex items-center justify-center animate-pulse">
            <Coffee className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading menu…</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-4">
          <QrCode className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="font-bold text-slate-700 text-lg mb-2">Link Expired or Invalid</h2>
        <p className="text-slate-400 text-sm">Please scan the QR code at your table again.</p>
      </div>
    );
  }

  // ── ENDED ────────────────────────────────────────────────────────────────
  if (step === 'ENDED') {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#d2d2d2] p-8 text-center">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <UtensilsCrossed className="w-10 h-10 text-[#5a5c5c]" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Session Ended</h2>
        <p className="text-slate-500 text-base mb-1">Thank you for dining with us!</p>
        <p className="text-slate-400 text-sm">Scan the QR code at your table to start a new order.</p>
        <div className="mt-8 text-6xl">🙏</div>
        <p className="text-slate-300 text-xs mt-6">{info.posName}</p>
      </div>
    );
  }

  // ── SUCCESS overlay (shown over TRACKING or directly) ────────────────────
  if (step === 'SUCCESS') {
    return (
      <SuccessOverlay
        orders={orders}
        info={info}
        payMethod={payMethodRef.current}
        onSessionEnd={handleSessionEnd}
      />
    );
  }

  // ── IDENTIFY ─────────────────────────────────────────────────────────────
  if (step === 'IDENTIFY') {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-white max-w-md mx-auto shadow-2xl">
        <div className="px-6 pt-10 pb-6 text-center bg-[#2d2f2f]">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{info.posName}</h1>
          <p className="text-white/80 text-sm mt-1">Table {info.tableNumber} · {info.floorName}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 py-8">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Welcome! 👋</h2>
          <p className="text-slate-500 text-sm mb-6">Tell us your name to get started.</p>

          <form onSubmit={handleIdentify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={identifyForm.name}
                onChange={e => setIdentifyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Rahul"
                className="w-full border-2 border-slate-200 focus:border-[#2d2f2f] rounded-xl px-4 py-3 text-slate-800 text-base outline-none transition-colors"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Phone <span className="text-slate-400 font-normal normal-case">(optional · helps us recognize you)</span>
              </label>
              <input
                type="tel"
                value={identifyForm.phone}
                onChange={e => setIdentifyForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full border-2 border-slate-200 focus:border-[#2d2f2f] rounded-xl px-4 py-3 text-slate-800 text-base outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Email <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="email"
                value={identifyForm.email}
                onChange={e => setIdentifyForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full border-2 border-slate-200 focus:border-[#2d2f2f] rounded-xl px-4 py-3 text-slate-800 text-base outline-none transition-colors"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={!identifyForm.name.trim() || identifyLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-[#2d2f2f] hover:bg-[#3a3c3c] disabled:opacity-50 text-white font-bold text-base rounded-2xl py-4 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
            >
              {identifyLoading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Let's Order!</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-300 pb-6 px-6">
          Your info is only used to personalize your experience and track your orders.
        </p>
      </div>
    );
  }

  // ── SPLASH ───────────────────────────────────────────────────────────────
  if (step === 'SPLASH') {
    return (
      <div
        className="h-[100dvh] w-full flex flex-col items-center justify-center cursor-pointer select-none bg-[#2d2f2f]"
        onClick={() => {
          if (restoreGuestSession()) {
            setStep('MENU');
          } else {
            setStep('IDENTIFY');
          }
        }}
      >
        <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-sm">
          <Coffee className="w-12 h-12 text-white animate-bounce" />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">{info.posName}</h1>
        <p className="text-2xl text-white/90 font-semibold">Table {info.tableNumber}</p>
        <p className="text-sm text-white/60 uppercase tracking-widest mt-1">{info.floorName}</p>
        <div className="mt-16 flex items-center gap-2 bg-white/20 rounded-full px-6 py-2.5 backdrop-blur-sm">
          <span className="text-white/80 text-sm font-medium uppercase tracking-widest animate-pulse">Tap to Order</span>
        </div>
      </div>
    );
  }

  // ── PAY_REQUEST ──────────────────────────────────────────────────────────
  if (step === 'PAY_REQUEST' && paymentRequest) {
    const isSplit = (paymentRequest.splitParts ?? 1) > 1;
    const payAmount = isSplit ? (paymentRequest.splitAmountEach ?? paymentRequest.amount) : paymentRequest.amount;
    const nextPartNumber = (paymentRequest.collectedParts ?? 0) + 1;

    const effectiveUpiId = resolveSelfOrderUpiId(info, paymentRequest.upiId);

    return (
      <div className="h-[100dvh] w-full flex flex-col bg-slate-50 max-w-md mx-auto shadow-2xl">
        <header className="text-white bg-[#2d2f2f] px-6 py-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider opacity-80">
              {isSplit ? `Split Bill — Part ${nextPartNumber} of ${paymentRequest.splitParts}` : 'Payment Requested'}
            </span>
          </div>
          <p className="text-4xl font-extrabold">₹{payAmount.toFixed(2)}</p>
          {isSplit && (
            <p className="text-sm opacity-80 mt-1">Total bill: ₹{paymentRequest.amount.toFixed(2)}</p>
          )}
          <p className="text-sm opacity-70 mt-1">Table {info.tableNumber}</p>
        </header>

        <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-5">
          {isSplit && (
            <div className="w-full bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
              <p className="text-purple-800 font-semibold text-sm">Bill is split {paymentRequest.splitParts} ways</p>
              <p className="text-purple-600 text-xs mt-1">Each person pays ₹{payAmount.toFixed(2)}</p>
            </div>
          )}
          {effectiveUpiId ? (
            <SelfOrderUpiQrCard
              title={isSplit ? `Pay your share (part ${nextPartNumber})` : "Scan to pay with UPI"}
              subtitle="Use PhonePe, Google Pay, Paytm, or any UPI app"
              amount={payAmount}
              upiId={effectiveUpiId}
              posName={info.posName}
              size={200}
            />
          ) : (
            <div className="w-full bg-white rounded-2xl shadow-sm border p-8 flex flex-col items-center">
              <QrCode className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-600 font-medium text-center">
                Please pay ₹{payAmount.toFixed(2)} at the counter.
              </p>
              <p className="text-xs text-slate-400 text-center mt-2">
                Add a UPI ID in Payment Methods (backend) to show a scan-to-pay QR here.
              </p>
            </div>
          )}
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-amber-700 text-sm font-medium">
              After paying, tap the button below to notify the cashier.
            </p>
          </div>
        </main>

        <div className="p-4 bg-white border-t space-y-3 sticky bottom-0">
          <Button
            size="lg"
            className="w-full rounded-2xl h-14 font-bold text-base bg-green-600 hover:bg-green-700"
            onClick={handleConfirmPayment}
            disabled={isConfirmingPayment}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            {isConfirmingPayment ? 'Confirming…' : isSplit ? `I've Paid My Share` : 'I Have Paid'}
          </Button>
          <Button size="lg" variant="ghost" className="w-full rounded-2xl h-10 text-sm text-slate-500"
            onClick={() => setStep('TRACKING')}>
            Back to my orders
          </Button>
        </div>
      </div>
    );
  }

  // ── PARTIAL_PAID — waiting screen shown after customer pays their share ───
  if (step === 'PARTIAL_PAID' && paymentRequest && info) {
    const collectedParts = paymentRequest.collectedParts ?? 0;
    const splitParts = paymentRequest.splitParts ?? 1;
    const remaining = splitParts - collectedParts;
    const shareAmount = paymentRequest.splitAmountEach ?? 0;
    const partialUpiId = resolveSelfOrderUpiId(info, paymentRequest.upiId);
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-slate-50 max-w-md mx-auto shadow-2xl overflow-y-auto">
        <div className="flex flex-col items-center p-6 pt-8 text-center shrink-0">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Your share is paid!</h1>
          <p className="text-slate-500 text-sm mb-6">
            Waiting for {remaining} more {remaining === 1 ? 'person' : 'people'} to pay their share.
          </p>
          <div className="flex gap-2 mb-4">
            {Array.from({ length: splitParts }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-10 rounded-full ${i < collectedParts ? 'bg-green-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-6">
            {collectedParts} of {splitParts} paid · ₹{shareAmount.toFixed(2)} per person
          </p>
        </div>

        {partialUpiId && remaining > 0 && shareAmount > 0 && (
          <div className="px-4 pb-4">
            <SelfOrderUpiQrCard
              title="QR for the next payment"
              subtitle={`Others can scan to pay ₹${shareAmount.toFixed(2)} (one share each)`}
              amount={shareAmount}
              upiId={partialUpiId}
              posName={info.posName}
              size={180}
            />
            <p className="text-xs text-slate-400 text-center mt-3 px-2">
              Each person pays ₹{shareAmount.toFixed(2)} until the bill is complete.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-300 text-center px-6 pb-8 mt-auto">
          This page updates automatically when everyone has paid.
        </p>
      </div>
    );
  }

  // ── MENU ─────────────────────────────────────────────────────────────────
  if (step === 'MENU') {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-slate-50 max-w-md mx-auto relative shadow-2xl">
        {/* Header */}
        <header className="bg-white px-4 py-3.5 shadow-sm z-10 sticky top-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{info.posName}</h2>
              <p className="text-xs text-slate-400">
                Table {info.tableNumber} · {info.floorName}
                {customerName ? <span className="ml-1.5 text-[#2d2f2f] font-semibold">· Hi, {customerName.split(' ')[0]}!</span> : null}
              </p>
            </div>
            {orders.length > 0 && (
              <button
                onClick={() => { fetchHistory(); setStep('TRACKING'); }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors"
              >
                <ReceiptText className="w-3.5 h-3.5" />
                My Orders
              </button>
            )}
          </div>
        </header>

        {/* Category tabs */}
        <div className="bg-white border-b sticky top-[60px] z-10">
          <div className="flex overflow-x-auto px-4 py-2.5 gap-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                activeCategory === 'all'
                  ? 'bg-[#2d2f2f] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >All</button>
            {info.categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  activeCategory === cat.id ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={activeCategory === cat.id ? { backgroundColor: cat.color } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <main className="flex-1 overflow-y-auto p-4 pb-28">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingBag className="w-12 h-12 opacity-30 mb-3" />
              <p>No items in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((product: ProductWithVariants) => {
                const cartQty = cart.filter(i => i.productId === product.id).reduce((s, i) => s + i.qty, 0);
                const catColor = info.categories.find(c => c.id === product.categoryId)?.color ?? '#f97316';
                const available = (product as any).isAvailable !== false;

                return (
                  <button
                    key={product.id}
                    onClick={() => available && setSelectedProduct(product)}
                    disabled={!available}
                    className={`relative rounded-2xl border overflow-hidden text-left shadow-sm transition-all flex flex-col ${
                      available
                        ? 'bg-white border-slate-200 hover:shadow-md hover:border-[#2d2f2f]/30 active:scale-[0.97]'
                        : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {/* Colour band */}
                    <div
                      className="h-14 w-full flex items-center justify-center relative"
                      style={{ backgroundColor: catColor + '22' }}
                    >
                      <UtensilsCrossed className="w-6 h-6" style={{ color: catColor, opacity: available ? 1 : 0.4 }} />
                      {!available && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-full">
                            Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <p className={`font-bold text-sm leading-tight mb-1 line-clamp-2 ${available ? 'text-slate-900' : 'text-slate-400'}`}>{product.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`font-extrabold text-sm ${available ? 'text-[#2d2f2f]' : 'text-slate-400'}`}>₹{product.price.toFixed(2)}</span>
                        {cartQty > 0 && available && (
                          <span className="text-xs bg-[#ecfe8d] text-[#546200] font-bold px-2 py-0.5 rounded-full">
                            {cartQty} in cart
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        {/* Cart bar */}
        {cartCount > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-20">
            <button
              className="w-full flex justify-between items-center px-5 h-14 rounded-2xl text-white font-bold shadow-xl transition-transform active:scale-[0.98] bg-[#2d2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              onClick={() => setStep('CHECKOUT')}
            >
              <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm">
                <ShoppingBag className="w-4 h-4" />
                {cartCount} item{cartCount !== 1 ? 's' : ''}
              </div>
              <span>Checkout · ₹{cartTotal.toFixed(2)}</span>
            </button>
          </div>
        )}

        {/* Product modal */}
        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAdd={addToCart}
          />
        )}
      </div>
    );
  }

  // ── CHECKOUT ─────────────────────────────────────────────────────────────
  if (step === 'CHECKOUT') {
    const checkoutUpiId = resolveSelfOrderUpiId(info);

    return (
      <div className="h-[100dvh] w-full flex flex-col bg-slate-50 max-w-md mx-auto shadow-2xl">
        <header className="bg-white px-4 py-4 shadow-sm sticky top-0 flex items-center">
          <button onClick={() => setStep('MENU')} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center mr-3 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-xl font-extrabold text-slate-900">Checkout</h2>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
          {/* Cart items */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">Your Order</h3>
            </div>
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{item.product.name}</p>
                  {item.variantName && (
                    <p className="text-xs text-slate-400 truncate">{item.variantName}</p>
                  )}
                  {item.note && (
                    <p className="text-xs text-slate-400 italic truncate">"{item.note}"</p>
                  )}
                  <p className="text-sm font-bold text-[#2d2f2f] mt-0.5">₹{(item.unitPrice * item.qty).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl border border-slate-200 px-1">
                  <button
                    onClick={() => updateQty(item.productId, item.variantId, -1)}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 rounded-lg"
                  ><Minus className="w-3.5 h-3.5" /></button>
                  <span className="w-5 text-center font-bold text-sm">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.productId, item.variantId, 1)}
                    className="w-7 h-7 flex items-center justify-center hover:bg-slate-200 rounded-lg"
                  ><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            <div className="px-4 py-3 bg-slate-50 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-[#2d2f2f] font-bold">₹{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">
                How would you like to pay?
              </h3>
            </div>

            {checkoutUpiId && cartTotal > 0 && (
              <div className="p-4 border-b border-slate-100 bg-slate-50/90">
                <SelfOrderUpiQrCard
                  title="Scan to pay (UPI)"
                  subtitle="Pay now, or place your order and pay when the cashier requests it"
                  amount={cartTotal}
                  upiId={checkoutUpiId}
                  posName={info.posName}
                  size={176}
                />
              </div>
            )}

            <div className="p-4 grid grid-cols-3 gap-3">
              {([
                { key: 'UPI', icon: <QrCode className="w-6 h-6" />, label: 'UPI' },
                { key: 'CASH', icon: <Banknote className="w-6 h-6" />, label: 'Cash' },
                { key: 'DIGITAL', icon: <CreditCard className="w-6 h-6" />, label: 'Card' },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedPayMethod(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-colors ${
                    selectedPayMethod === key
                      ? 'border-[#2d2f2f] bg-[#2d2f2f]/5 text-[#2d2f2f]'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {icon}
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>

            {selectedPayMethod === 'UPI' && !checkoutUpiId && (
              <p className="px-4 pb-4 text-xs text-amber-700 text-center bg-amber-50 mx-4 mb-4 rounded-xl py-3 border border-amber-100">
                UPI QR is not configured. Add a UPI ID in Payment Methods (admin), or pay at the counter when asked.
              </p>
            )}
            {selectedPayMethod === 'CASH' && (
              <p className="px-4 pb-4 text-xs text-slate-400 text-center">
                Staff will collect cash at your table after your order is ready.
              </p>
            )}
            {selectedPayMethod === 'DIGITAL' && (
              <p className="px-4 pb-4 text-xs text-slate-400 text-center">
                Pay by card at the counter when your order is ready.
              </p>
            )}
          </div>
        </main>

        <div className="p-4 bg-white border-t sticky bottom-0">
          <button
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl text-white font-bold text-base shadow-lg disabled:opacity-60 transition-all active:scale-[0.98] bg-[#2d2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
            onClick={handlePlaceOrder}
            disabled={createOrder.isPending}
          >
            <ChefHat className="w-5 h-5" />
            {createOrder.isPending ? 'Sending to Kitchen…' : 'Place Order →'}
          </button>
        </div>
      </div>
    );
  }

  // ── TRACKING ─────────────────────────────────────────────────────────────
  const latestOrder = orders[orders.length - 1];
  const latestStatus = latestOrder?.ticket?.status ?? 'TO_COOK';
  const isAllReady = orders.every(o => o.ticket?.status === 'COMPLETED');

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-50 max-w-md mx-auto shadow-2xl">
      <header className="bg-white px-4 py-4 shadow-sm sticky top-0 flex items-center justify-between z-10">
        <div className="flex items-center">
          <button onClick={() => setStep('MENU')} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center mr-3">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-xl font-extrabold text-slate-900">My Orders</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Live
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status banner */}
        {latestOrder && (
          <div className={`rounded-2xl p-5 text-center border-2 ${
            isAllReady
              ? 'bg-green-50 border-green-200'
              : latestStatus === 'PREPARING'
                ? 'bg-blue-50 border-blue-200'
                : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex justify-center mb-3">
              {isAllReady
                ? <CheckCircle className="w-12 h-12 text-green-500" />
                : latestStatus === 'PREPARING'
                  ? <Flame className="w-12 h-12 text-blue-500 animate-pulse" />
                  : <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
              }
            </div>
            <h3 className={`text-xl font-extrabold mb-1 ${
              isAllReady ? 'text-green-700' : latestStatus === 'PREPARING' ? 'text-blue-700' : 'text-amber-700'
            }`}>
              {isAllReady ? 'Your food is ready! 🍽️' : latestStatus === 'PREPARING' ? 'Cooking your order…' : 'Order received!'}
            </h3>
            <p className={`text-sm ${
              isAllReady ? 'text-green-600' : latestStatus === 'PREPARING' ? 'text-blue-600' : 'text-amber-600'
            }`}>
              {isAllReady
                ? 'It will be served to your table shortly.'
                : latestStatus === 'PREPARING'
                  ? 'Our kitchen is working on it!'
                  : 'Waiting for the kitchen to start.'}
            </p>
          </div>
        )}

        {/* Order cards */}
        {orders.map((order, i) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 text-sm">Order {i + 1}</span>
                <span className="text-xs text-slate-400">
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLOR[order.ticket?.status ?? 'TO_COOK']}`}>
                {STATUS_ICON[order.ticket?.status ?? 'TO_COOK']}
                {STATUS_LABEL[order.ticket?.status ?? 'TO_COOK']}
              </span>
            </div>
            <div className="divide-y text-sm">
              {order.lines.map(line => (
                <div key={line.id} className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-700"><span className="font-semibold mr-2">{line.qty}×</span>{line.product?.name}</span>
                  <span className="font-medium">₹{(line.total ?? 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-slate-50 font-bold text-sm">
                <span>Total</span>
                <span className="text-[#2d2f2f] font-bold">₹{(order.total ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShoppingBag className="w-12 h-12 opacity-30 mb-3" />
            <p>No orders yet</p>
          </div>
        )}
      </main>

      {/* Add more items */}
      <div className="p-4 bg-white border-t sticky bottom-0">
        <button
          onClick={() => setStep('MENU')}
          className="w-full h-12 rounded-2xl border-2 border-[#2d2f2f] text-[#2d2f2f] font-bold text-sm hover:bg-[#2d2f2f]/5 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add More Items
        </button>
      </div>
    </div>
  );
}
