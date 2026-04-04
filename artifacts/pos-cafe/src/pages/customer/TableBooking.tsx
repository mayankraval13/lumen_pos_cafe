import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Coffee, MapPin, Users, CheckCircle, ArrowRight, QrCode, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

type TableInfo = {
  tableId: string;
  tableNumber: string;
  floorName: string;
  posName: string;
  tableToken: string;
  hasActiveOrder: boolean;
  seats?: number;
};

type BookingStep = 'LOADING' | 'PREVIEW' | 'BOOKING' | 'BOOKED' | 'ERROR';

export default function TableBooking() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<BookingStep>('LOADING');
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStep('ERROR'); setError('No table token found.'); return; }

    fetch(`/api/self-order/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Table not found or link expired.');
        const data = await res.json();
        setInfo({
          tableId: data.tableId,
          tableNumber: data.tableNumber,
          floorName: data.floorName,
          posName: data.posName,
          tableToken: data.tableToken,
          hasActiveOrder: data.hasActiveOrder,
        });
        setStep('PREVIEW');
      })
      .catch((err) => {
        setError(err.message || 'Unable to load table information.');
        setStep('ERROR');
      });
  }, [token]);

  async function handleBook() {
    if (!token) return;
    setStep('BOOKING');
    try {
      const res = await fetch(`/api/self-order/${token}/book-table`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to book table');
      }
      setStep('BOOKED');
      toast.success('Table booked!');
    } catch (err: any) {
      toast.error(err.message || 'Booking failed');
      setStep('PREVIEW');
    }
  }

  function goToSelfOrder() {
    navigate(`/self-order/${token}`);
  }

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (step === 'LOADING') {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#d2d2d2]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[#2d2f2f] rounded-2xl flex items-center justify-center animate-pulse">
            <Coffee className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading table info…</p>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────
  if (step === 'ERROR') {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-4">
          <QrCode className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="font-bold text-slate-700 text-lg mb-2">Link Expired or Invalid</h2>
        <p className="text-slate-400 text-sm">{error || 'Please scan the QR code at your table again.'}</p>
      </div>
    );
  }

  // ── BOOKED (success + redirect prompt) ───────────────────────────────────
  if (step === 'BOOKED' && info) {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-white max-w-md mx-auto shadow-2xl">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-3xl flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Table Booked!</h1>
          <p className="text-slate-500 text-base mb-1">
            Table {info.tableNumber} · {info.floorName}
          </p>
          <p className="text-slate-400 text-sm mb-10">{info.posName}</p>

          <div className="w-full space-y-3">
            <Button
              size="lg"
              className="w-full rounded-2xl h-14 font-bold text-base bg-[#2d2f2f] hover:bg-[#3a3c3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              onClick={goToSelfOrder}
            >
              <span>Browse Menu & Order</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <p className="text-xs text-slate-400 pt-1">
              You can also order later — just scan the QR again.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-300 pb-6 px-6">
          Powered by {info.posName}
        </p>
      </div>
    );
  }

  // ── PREVIEW (main booking screen) ────────────────────────────────────────
  if (!info) return null;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-white max-w-md mx-auto shadow-2xl">
      {/* Header */}
      <div className="px-6 pt-10 pb-8 text-center bg-[#2d2f2f]">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Coffee className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">{info.posName}</h1>
        <p className="text-white/70 text-sm mt-1">Scan · Book · Order</p>
      </div>

      {/* Table info card */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-4xl font-extrabold text-slate-900">
              Table {info.tableNumber}
            </h2>
            {info.hasActiveOrder && (
              <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                In Use
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium">{info.floorName}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium">{info.posName}</span>
            </div>
          </div>
        </div>

        {info.hasActiveOrder ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center mb-2">
              <p className="text-amber-800 text-sm font-medium">
                This table already has an active session.
              </p>
              <p className="text-amber-600 text-xs mt-1">
                You can still continue to the menu.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full rounded-2xl h-14 font-bold text-base bg-[#2d2f2f] hover:bg-[#3a3c3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              onClick={goToSelfOrder}
            >
              <span>Go to Menu</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full rounded-2xl h-14 font-bold text-base bg-[#2d2f2f] hover:bg-[#3a3c3c] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
            onClick={handleBook}
            disabled={step === 'BOOKING'}
          >
            {step === 'BOOKING' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Booking…
              </>
            ) : (
              <>
                <span>Book This Table</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-slate-300 pb-6 px-6">
        Powered by {info.posName}
      </p>
    </div>
  );
}
