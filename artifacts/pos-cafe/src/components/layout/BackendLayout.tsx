import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Tags, 
  CreditCard, 
  Map, 
  Users, 
  MonitorSmartphone, 
  LogOut,
  Coffee,
  Wallet,
  UserCheck,
  QrCode,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface BackendLayoutProps {
  children: React.ReactNode;
}

export const BackendLayout: React.FC<BackendLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navigation = [
    { name: 'Reporting', href: '/backend/reporting', icon: LayoutDashboard },
    { name: 'Orders', href: '/backend/orders', icon: ShoppingCart },
    { name: 'Products', href: '/backend/products', icon: Package },
    { name: 'Categories', href: '/backend/categories', icon: Tags },
    { name: 'Total Payments', href: '/backend/payments', icon: Wallet },
    { name: 'Payment Methods', href: '/backend/payment-methods', icon: CreditCard },
    { name: 'Floors', href: '/backend/floors', icon: Map },
    { name: 'QR Codes', href: '/backend/qr-codes', icon: QrCode },
    { name: 'Customers', href: '/backend/customers', icon: Users },
    { name: 'Waiters', href: '/backend/waiters', icon: UserCheck },
    { name: 'POS Config', href: '/backend/pos-config', icon: MonitorSmartphone },
  ];

  return (
    <div className="flex h-screen bg-[#d2d2d2] font-sans tracking-tight">
      {/* Sidebar */}
      <div className="w-64 bg-[#2d2f2f] text-white flex flex-col shadow-xl z-10 rounded-r-[20px]">
        <div className="h-20 flex items-center px-6 border-b border-white/10">
          <Coffee className="w-6 h-6 text-[#ecfe8d] mr-3" />
          <span className="font-semibold text-lg tracking-tight text-white">Lumen POS</span>
        </div>
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="space-y-2 px-4">
            {navigation.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center px-4 py-3 text-sm font-medium cursor-pointer transition-all active:scale-[0.98]',
                      isActive
                        ? 'bg-[#ecfe8d] text-[#546200] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                        : 'text-white/70 hover:bg-white/10 hover:text-white rounded-full'
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 flex-shrink-0 h-5 w-5',
                        isActive ? 'text-[#546200]' : 'text-white/50'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-5 border-t border-white/10">
          <div className="flex items-center justify-between bg-black/20 p-3 rounded-[20px]">
            <div className="flex items-center min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#ecfe8d] flex items-center justify-center text-[#546200] font-bold flex-shrink-0 shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="ml-3 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/50 truncate font-medium">{user?.role}</p>
              </div>
            </div>
            <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors" data-testid="button-logout" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#d2d2d2]">
        <header className="h-20 bg-transparent flex items-center justify-between px-10">
          <h1 className="text-3xl font-semibold text-[#2d2f2f] tracking-tight">
            {navigation.find((n) => location.startsWith(n.href))?.name ?? ''}
          </h1>
          <div className="flex items-center space-x-4">
            <Link href="/pos">
              <Button 
                className="h-12 px-6 rounded-full font-semibold transition-transform active:scale-[0.98] border-0 bg-gradient-to-b from-[#3a3c3c] to-[#2d2f2f] text-white"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)' }}
                data-testid="button-launch-pos">
                Launch POS
              </Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-10 pb-10">
          {children}
        </main>
      </div>
    </div>
  );
};
