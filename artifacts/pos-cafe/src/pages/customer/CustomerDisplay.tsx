import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { QRCodeSVG } from 'qrcode.react';
import {
  Coffee, Users, Wifi, RefreshCw, ArrowLeft, MapPin,
  ScanLine, ChevronRight, UtensilsCrossed, X,
} from 'lucide-react';
import { getTableQrUrl } from '../../lib/networkUrl';

// ─── Types ────────────────────────────────────────────────────────────────────
type TableData = {
  id: string;
  tableNumber: string;
  seats: number;
  token: string;
  status: 'FREE' | 'OCCUPIED';
  orderId: string | null;
};

type FloorData = {
  id: string;
  name: string;
  tables: TableData[];
};

type PosData = {
  id: string;
  name: string;
  floors: FloorData[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function selfOrderUrl(token: string) {
  return getTableQrUrl(token);
}

// ─── QR Overlay ───────────────────────────────────────────────────────────────
function QROverlay({ table, onClose }: { table: TableData; onClose: () => void }) {
  const url = selfOrderUrl(table.token);
  const isFree = table.status === 'FREE';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#d2d2d2] hover:bg-[#c4c4c4] flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-[#2d2f2f]" />
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5a5c5c] mb-1">
            {isFree ? 'Available' : 'In Use — Add More Items'}
          </p>
          <h2 className="text-3xl font-extrabold text-[#2d2f2f]">Table {table.tableNumber}</h2>
          <p className="text-[#5a5c5c] text-sm mt-1 flex items-center justify-center gap-1">
            <Users className="w-3.5 h-3.5" /> {table.seats} seats
          </p>
        </div>

        <div className={`p-4 rounded-2xl ${isFree ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-amber-50 border-2 border-amber-200'}`}>
          <QRCodeSVG
            value={url}
            size={200}
            level="H"
            fgColor={isFree ? '#065f46' : '#92400e'}
            includeMargin={false}
          />
        </div>

        <div className="text-center space-y-1">
          <p className="font-bold text-[#2d2f2f] text-base">
            {isFree ? '📱 Scan to Start Ordering' : '📱 Scan to Add More Items'}
          </p>
          <p className="text-[#5a5c5c] text-sm">Point your phone camera at the QR code</p>
        </div>

        <div className="w-full bg-[#d2d2d2]/60 rounded-xl px-3 py-2 border border-[#d2d2d2]">
          <p className="text-xs text-[#5a5c5c] text-center font-mono break-all">{url}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ table, onClick }: { table: TableData; onClick: () => void }) {
  const isFree = table.status === 'FREE';
  const url = selfOrderUrl(table.token);

  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-2xl border-2 p-4 flex flex-col items-center gap-2.5 transition-all
        hover:scale-[1.02] hover:shadow-lg active:scale-[0.99] cursor-pointer text-left w-full
        ${isFree
          ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100/80'
          : 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:bg-amber-100/80'}
      `}
    >
      <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${isFree ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />

      <div className="text-center">
        <p className={`font-extrabold text-base ${isFree ? 'text-emerald-900' : 'text-amber-900'}`}>
          Table {table.tableNumber}
        </p>
        <p className={`text-xs flex items-center justify-center gap-1 ${isFree ? 'text-emerald-600' : 'text-amber-600'}`}>
          <Users className="w-3 h-3" /> {table.seats} seats
        </p>
      </div>

      <div className={`p-2 rounded-xl ${isFree ? 'bg-white border border-emerald-200' : 'bg-white border border-amber-200'}`}>
        <QRCodeSVG
          value={url}
          size={100}
          level="M"
          fgColor={isFree ? '#065f46' : '#92400e'}
          includeMargin={false}
        />
      </div>

      <div className={`flex items-center gap-1 text-xs font-semibold ${isFree ? 'text-emerald-700' : 'text-amber-700'}`}>
        <ScanLine className="w-3.5 h-3.5" />
        {isFree ? 'Scan to Order' : 'Scan to Add Items'}
      </div>
    </button>
  );
}

// ─── Floor View ───────────────────────────────────────────────────────────────
function FloorView({
  pos,
  onBack,
  onRefresh,
  lastUpdated,
}: {
  pos: PosData;
  onBack: () => void;
  onRefresh: () => void;
  lastUpdated: Date;
}) {
  const [activeFloorIdx, setActiveFloorIdx] = useState(0);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);

  const activeFloor = pos.floors[activeFloorIdx] ?? pos.floors[0];
  const allTables = pos.floors.flatMap(f => f.tables);
  const freeCount = allTables.filter(t => t.status === 'FREE').length;
  const occupiedCount = allTables.filter(t => t.status === 'OCCUPIED').length;

  return (
    <div className="min-h-screen bg-[#d2d2d2] flex flex-col">
      {/* Header */}
      <header className="bg-[#2d2f2f] text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors mr-1"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="w-10 h-10 bg-[#ecfe8d]/20 rounded-xl flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-[#ecfe8d]" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">{pos.name}</h1>
            <p className="text-xs text-white/60">Select your table and scan the QR code</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-900/40 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-emerald-300 font-semibold text-xs">{freeCount} Free</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-900/40 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-300 font-semibold text-xs">{occupiedCount} Occupied</span>
          </div>
          <div className="flex items-center gap-1 text-white/60 text-xs">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 font-medium">Live</span>
          </div>
        </div>
      </header>

      {/* Steps banner */}
      <div className="bg-[#ecfe8d]/30 border-b border-[#ecfe8d]/50 px-6 py-3 flex items-center gap-2 text-sm text-[#546200]">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-5 h-5 bg-[#2d2f2f] text-[#ecfe8d] rounded-full flex items-center justify-center text-xs font-bold">1</span>
          Find your table
        </span>
        <ChevronRight className="w-4 h-4 text-[#546200]/50 shrink-0" />
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-5 h-5 bg-[#2d2f2f] text-[#ecfe8d] rounded-full flex items-center justify-center text-xs font-bold">2</span>
          Scan the QR code
        </span>
        <ChevronRight className="w-4 h-4 text-[#546200]/50 shrink-0" />
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-5 h-5 bg-[#2d2f2f] text-[#ecfe8d] rounded-full flex items-center justify-center text-xs font-bold">3</span>
          Browse &amp; order — food comes to you!
        </span>
      </div>

      {/* Floor tabs */}
      {pos.floors.length > 1 && (
        <div className="bg-white/60 backdrop-blur-sm border-b border-black/10 px-6 flex gap-1 shrink-0">
          {pos.floors.map((floor, i) => (
            <button
              key={floor.id}
              onClick={() => setActiveFloorIdx(i)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                i === activeFloorIdx
                  ? 'border-[#2d2f2f] text-[#2d2f2f]'
                  : 'border-transparent text-[#5a5c5c] hover:text-[#2d2f2f]'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      {/* Table grid */}
      <main className="flex-1 overflow-y-auto p-6">
        {(!activeFloor || activeFloor.tables.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#5a5c5c]">
            <MapPin className="w-16 h-16 opacity-30 mb-3" />
            <p className="text-lg">No tables on this floor</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {activeFloor.tables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                onClick={() => setSelectedTable(table)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-black/10 px-6 py-3 flex items-center justify-between text-xs text-[#5a5c5c]">
        <div className="flex items-center gap-1.5">
          <Coffee className="w-3.5 h-3.5" />
          <span>Lumen POS Cafe</span>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 hover:text-[#2d2f2f] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </button>
      </footer>

      {/* QR overlay */}
      {selectedTable && (
        <QROverlay table={selectedTable} onClose={() => setSelectedTable(null)} />
      )}
    </div>
  );
}

// ─── Restaurant List ──────────────────────────────────────────────────────────
function RestaurantList({
  configs,
  onSelect,
  lastUpdated,
  onRefresh,
}: {
  configs: PosData[];
  onSelect: (id: string) => void;
  lastUpdated: Date;
  onRefresh: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#d2d2d2] flex flex-col">
      {/* Header */}
      <header className="bg-[#2d2f2f] text-white px-8 py-6 text-center shadow-md shrink-0">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-[#ecfe8d]/20 rounded-2xl mb-3">
          <UtensilsCrossed className="w-7 h-7 text-[#ecfe8d]" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Welcome!</h1>
        <p className="text-white/60 mt-1">Choose a restaurant to view the menu &amp; book your table</p>
      </header>

      {/* Restaurant grid */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-[#5a5c5c] mb-5">
            {configs.length} Restaurant{configs.length !== 1 ? 's' : ''} Available
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {configs.map((pos) => {
              const allTables = pos.floors.flatMap(f => f.tables);
              const freeCount = allTables.filter(t => t.status === 'FREE').length;
              const totalCount = allTables.length;

              return (
                <button
                  key={pos.id}
                  onClick={() => onSelect(pos.id)}
                  className="group bg-white rounded-2xl border-2 border-[#d2d2d2] hover:border-[#2d2f2f] p-6 flex flex-col gap-4 text-left shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-[#d2d2d2] group-hover:bg-[#2d2f2f] rounded-xl flex items-center justify-center transition-colors">
                      <UtensilsCrossed className="w-6 h-6 text-[#2d2f2f] group-hover:text-white transition-colors" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#5a5c5c] group-hover:text-[#2d2f2f] transition-colors mt-1" />
                  </div>

                  <div>
                    <h2 className="font-extrabold text-xl text-[#2d2f2f]">{pos.name}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        {freeCount} free
                      </span>
                      <span className="text-xs text-[#5a5c5c]">{totalCount} tables total</span>
                      <span className="text-xs text-[#5a5c5c]">{pos.floors.length} floor{pos.floors.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[#2d2f2f] group-hover:gap-2.5 transition-all">
                    <ScanLine className="w-4 h-4" />
                    View Tables & QR Codes
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-black/10 px-8 py-3 flex items-center justify-between text-xs text-[#5a5c5c]">
        <div className="flex items-center gap-1.5">
          <Coffee className="w-3.5 h-3.5" />
          <span>Lumen POS Cafe</span>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1.5 hover:text-[#2d2f2f] transition-colors">
          <RefreshCw className="w-3 h-3" />
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </button>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-600 font-medium">Live</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function CustomerDisplay() {
  const { on } = useSocket();
  const [posConfigs, setPosConfigs] = useState<PosData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/public/tables');
      if (res.ok) {
        const data: PosData[] = await res.json();
        setPosConfigs(data);
        setLastUpdated(new Date());
        if (data.length === 1 && !selectedPosId) {
          setSelectedPosId(data[0].id);
        }
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 15000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  useEffect(() => {
    on('order:new', () => fetchTables());
    on('order:paid', () => fetchTables());
    on('payment:confirmed', () => fetchTables());
  }, [on, fetchTables]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#d2d2d2] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[#2d2f2f] rounded-2xl flex items-center justify-center mb-6 shadow-lg animate-pulse">
          <Coffee className="w-8 h-8 text-[#ecfe8d]" />
        </div>
        <p className="text-[#5a5c5c] text-lg font-medium">Loading restaurants…</p>
      </div>
    );
  }

  if (posConfigs.length === 0) {
    return (
      <div className="min-h-screen bg-[#d2d2d2] flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <Coffee className="w-10 h-10 text-[#5a5c5c]" />
        </div>
        <h1 className="text-2xl font-bold text-[#2d2f2f] mb-2">No Restaurants Yet</h1>
        <p className="text-[#5a5c5c]">Please ask staff to configure the restaurant.</p>
      </div>
    );
  }

  const activePos = posConfigs.find(p => p.id === selectedPosId);
  if (activePos) {
    return (
      <FloorView
        pos={activePos}
        onBack={() => {
          if (posConfigs.length === 1) return;
          setSelectedPosId(null);
        }}
        onRefresh={fetchTables}
        lastUpdated={lastUpdated}
      />
    );
  }

  return (
    <RestaurantList
      configs={posConfigs}
      onSelect={setSelectedPosId}
      lastUpdated={lastUpdated}
      onRefresh={fetchTables}
    />
  );
}
