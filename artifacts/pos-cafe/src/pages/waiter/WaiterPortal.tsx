import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../../context/AuthContext';
import { Coffee, Store, LogOut, Loader2, CheckCircle, Clock, Grid3X3, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AssignedTable {
  id: string;
  tableNumber: string;
  seats: number;
  floorName: string;
  posConfigId: string | null;
  posConfigName: string | null;
  activeOrderId: string | null;
  status: 'FREE' | 'OCCUPIED';
}

interface WaiterProfile {
  id: string;
  name: string;
  assignedTableIds: string[];
  assignedTables: AssignedTable[];
  posConfigId: string | null;
  posConfigName: string | null;
}

interface PosConfig {
  id: string;
  name: string;
  lastOpenedAt: string | null;
}

interface ActiveSession {
  id: string;
  posConfigId: string;
  status: string;
  openedAt: string;
  pos: { id: string; name: string } | null;
}

export default function WaiterPortal() {
  const [, setLocation] = useLocation();
  const { token, user, logout } = useAuth();

  const [profile, setProfile] = useState<WaiterProfile | null>(null);
  const [configs, setConfigs] = useState<PosConfig[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, configsRes, sessionRes] = await Promise.all([
          fetch('/api/waiters/me', { headers: authHeader }),
          fetch('/api/sessions/configs', { headers: authHeader }),
          fetch('/api/sessions/active', { headers: authHeader }),
        ]);
        if (profileRes.ok) setProfile(await profileRes.json());
        if (configsRes.ok) setConfigs(await configsRes.json());
        if (sessionRes.ok) {
          const s = await sessionRes.json();
          setActiveSession(s);
        }
      } catch {
        toast.error('Failed to load portal data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleOpenSession = async (configId: string) => {
    setOpening(configId);
    try {
      const res = await fetch('/api/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ posConfigId: configId }),
      });
      if (!res.ok) throw new Error('Failed to open session');
      toast.success('Session started!');
      setLocation('/waiter/pos');
    } catch {
      toast.error('Could not start session');
    } finally {
      setOpening(null);
    }
  };

  const hasAssignedTables = profile && profile.assignedTables.length > 0;
  const assignedPosConfigId = profile?.posConfigId ?? null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#d2d2d2]">
        <Loader2 className="w-10 h-10 animate-spin text-[#2d2f2f]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d2d2d2]">
      {/* Header */}
      <header className="bg-[#2d2f2f] text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#ecfe8d]/20 rounded-xl flex items-center justify-center">
              <Coffee className="w-5 h-5 text-[#ecfe8d]" />
            </div>
            <div>
              <div className="font-bold text-white leading-none">POS Cafe</div>
              <div className="text-xs text-white/60 mt-0.5">Waiter Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70 font-medium">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-white/60 hover:text-red-400 hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {hasAssignedTables ? (
          <>
            {/* Table-first view */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#2d2f2f]">Your Tables</h2>
              {profile.posConfigName && (
                <p className="text-[#5a5c5c] mt-1 flex items-center gap-1.5">
                  <Store className="w-4 h-4" />{profile.posConfigName}
                </p>
              )}
            </div>

            {/* Active session banner */}
            {activeSession && (
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-800 text-sm">Session Active</p>
                    <p className="text-xs text-emerald-600">
                      Started {format(new Date(activeSession.openedAt), 'hh:mm a')} · {activeSession.pos?.name}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { setResuming(true); setLocation('/waiter/pos'); }}
                  disabled={resuming}
                >
                  {resuming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resume →'}
                </Button>
              </div>
            )}

            {/* Table cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {profile.assignedTables.map((table) => (
                <div
                  key={table.id}
                  className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all ${
                    table.status === 'OCCUPIED'
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-[#d2d2d2]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#d2d2d2]">
                      <Grid3X3 className="w-5 h-5 text-[#2d2f2f]" />
                    </div>
                    {table.status === 'OCCUPIED' ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs font-bold" variant="outline">
                        <Clock className="w-3 h-3 mr-1" />Occupied
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs font-bold" variant="outline">
                        <CheckCircle className="w-3 h-3 mr-1" />Free
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-[#2d2f2f]">Table {table.tableNumber}</p>
                  <p className="text-xs text-[#5a5c5c] mt-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" />{table.seats} seats · {table.floorName}
                  </p>
                </div>
              ))}
            </div>

            {/* Start / Resume CTA */}
            {!activeSession && assignedPosConfigId && (
              <div className="bg-white rounded-2xl border border-[#d2d2d2] p-6 shadow-sm">
                <h3 className="font-bold text-[#2d2f2f] mb-1">Ready to start?</h3>
                <p className="text-sm text-[#5a5c5c] mb-4">
                  Open a session for <strong>{profile.posConfigName}</strong> to begin taking orders on your assigned tables.
                </p>
                <Button
                  className="w-full h-12 bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white font-bold rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all"
                  onClick={() => handleOpenSession(assignedPosConfigId)}
                  disabled={opening === assignedPosConfigId}
                >
                  {opening === assignedPosConfigId
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                    : 'Start Session →'
                  }
                </Button>
              </div>
            )}

            {activeSession && assignedPosConfigId && activeSession.posConfigId !== assignedPosConfigId && (
              <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm">
                <p className="text-sm text-[#5a5c5c] mb-3">
                  You have an active session in a different restaurant. Start a new one for your assigned tables.
                </p>
                <Button
                  className="w-full h-12 bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white font-bold rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all"
                  onClick={() => handleOpenSession(assignedPosConfigId)}
                  disabled={!!opening}
                >
                  Switch & Start Session
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* No tables assigned — original restaurant picker */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#2d2f2f]">Select Restaurant</h2>
              <p className="text-[#5a5c5c] mt-1">Choose a restaurant to start your shift.</p>
            </div>

            {activeSession && (
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-800 text-sm">Active — {activeSession.pos?.name}</p>
                    <p className="text-xs text-emerald-600">Started {format(new Date(activeSession.openedAt), 'hh:mm a')}</p>
                  </div>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setLocation('/waiter/pos')}>
                  Resume →
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {configs.map((config) => {
                const isCurrentSession = activeSession?.posConfigId === config.id;
                const isOpening = opening === config.id;
                return (
                  <div
                    key={config.id}
                    className={`bg-white rounded-2xl border-2 p-6 shadow-sm transition-all ${
                      isCurrentSession ? 'border-emerald-300 bg-emerald-50/50' : 'border-[#d2d2d2] hover:border-[#2d2f2f] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-[#d2d2d2] rounded-xl flex items-center justify-center">
                        <Store className="w-6 h-6 text-[#2d2f2f]" />
                      </div>
                      {isCurrentSession && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 font-bold" variant="outline">Active</Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-[#2d2f2f] mb-1">{config.name}</h3>
                    <p className="text-xs text-[#5a5c5c] mb-4">
                      {config.lastOpenedAt ? `Last opened ${format(new Date(config.lastOpenedAt), 'dd MMM, hh:mm a')}` : 'Never opened'}
                    </p>
                    <Button
                      className={`w-full rounded-xl font-bold h-11 active:scale-[0.98] transition-all ${
                        isCurrentSession
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                      }`}
                      onClick={() => isCurrentSession ? setLocation('/waiter/pos') : handleOpenSession(config.id)}
                      disabled={isOpening || resuming}
                    >
                      {isOpening
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening...</>
                        : isCurrentSession ? 'Resume Session' : 'Open Session'
                      }
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
