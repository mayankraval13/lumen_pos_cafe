import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  UtensilsCrossed, Monitor, ChefHat, Tablet, QrCode,
  Zap, ShieldCheck, Wifi, BarChart3, Users, ArrowRight,
  CheckCircle, Star, Menu, X,
} from 'lucide-react';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="font-[Manrope,sans-serif] bg-white text-[#2d2f2f] overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#2d2f2f]/95 backdrop-blur-sm shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#ecfe8d] rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-4.5 h-4.5 text-[#2d2f2f]" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">Lumen POS</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/70">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#terminals" className="hover:text-white transition-colors">Terminals</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <span className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors cursor-pointer">
                Sign In
              </span>
            </Link>
            <Link href="/signup">
              <span className="px-5 py-2 bg-[#ecfe8d] text-[#2d2f2f] text-sm font-bold rounded-xl hover:bg-[#d8eb7a] transition-colors cursor-pointer">
                Get Started
              </span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#2d2f2f] border-t border-white/10 px-6 py-5 flex flex-col gap-5">
            <a href="#features" onClick={() => setMenuOpen(false)} className="text-white/80 font-semibold">Features</a>
            <a href="#terminals" onClick={() => setMenuOpen(false)} className="text-white/80 font-semibold">Terminals</a>
            <a href="#how" onClick={() => setMenuOpen(false)} className="text-white/80 font-semibold">How it works</a>
            <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
              <Link href="/login"><span className="block text-center py-3 bg-white/10 text-white font-semibold rounded-xl cursor-pointer">Sign In</span></Link>
              <Link href="/signup"><span className="block text-center py-3 bg-[#ecfe8d] text-[#2d2f2f] font-bold rounded-xl cursor-pointer">Get Started</span></Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="bg-[#2d2f2f] min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 relative overflow-hidden">
        {/* Background texture dots */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Accent glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ecfe8d]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-sm font-semibold text-white/70 mb-8">
            <Star className="w-3.5 h-3.5 text-[#ecfe8d]" fill="#ecfe8d" />
            Modern Restaurant POS — Built for Speed
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.05] mb-6 tracking-tight">
            Your café,{' '}
            <span className="text-[#ecfe8d]">fully in sync.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Lumen POS connects your floor, kitchen, and customers in real time —
            from QR self-order to kitchen display to cashier terminal.
          <h4 className="text-2xl font-bold text-white">
            <span className="text-[#ecfe8d]">Built By</span> Mayank, Aastha & Rudra...
          </h4>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-[#ecfe8d] text-[#2d2f2f] font-bold text-base rounded-2xl hover:bg-[#d8eb7a] transition-colors shadow-lg cursor-pointer">
                Start for free
                <ArrowRight className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </span>
            </Link>
            <Link href="/login">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 border border-white/15 text-white font-bold text-base rounded-2xl hover:bg-white/15 transition-colors cursor-pointer">
                Sign in to your account
              </span>
            </Link>
          </div>

          {/* Hero stat bar */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: '4', label: 'Terminals' },
              { value: 'Live', label: 'Real-time sync' },
              { value: '∞', label: 'Menus & tables' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-[#ecfe8d]">{s.value}</div>
                <div className="text-xs text-white/40 font-semibold mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-[#5a5c5c] mb-3">Why Lumen</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#2d2f2f] leading-tight">
              Everything your team needs
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Wifi className="w-6 h-6" />,
                title: 'Real-time across all screens',
                desc: 'Orders placed at any terminal instantly appear in the kitchen, waiter app, and customer display — no polling, no lag.',
                accent: 'bg-blue-50 text-blue-600',
              },
              {
                icon: <QrCode className="w-6 h-6" />,
                title: 'QR self-order',
                desc: 'Guests scan a table QR code, browse the menu, customise items, and pay — all from their phone.',
                accent: 'bg-[#ecfe8d]/30 text-[#546200]',
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: 'Live reporting',
                desc: 'Track revenue, top products, and order volumes from the backend dashboard, updated in real time.',
                accent: 'bg-purple-50 text-purple-600',
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: 'Multi-role access',
                desc: 'Separate logins and views for cashiers, waiters, and kitchen staff — each sees only what they need.',
                accent: 'bg-emerald-50 text-emerald-600',
              },
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                title: 'Secure by default',
                desc: 'JWT auth, role-based access, and session management keep your data and operations protected.',
                accent: 'bg-amber-50 text-amber-600',
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: 'Fast at peak hours',
                desc: 'Designed for speed — the POS terminal loads instantly and numpad-driven workflows handle rush hours.',
                accent: 'bg-rose-50 text-rose-600',
              },
            ].map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 bg-[#fafafa] hover:shadow-md transition-shadow group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.accent}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-[#2d2f2f] text-base mb-2">{f.title}</h3>
                <p className="text-sm text-[#5a5c5c] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TERMINALS ── */}
      <section id="terminals" className="bg-[#f5f5f0] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-[#5a5c5c] mb-3">Four terminals</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#2d2f2f] leading-tight">
              One system, every role
            </h2>
            <p className="text-[#5a5c5c] mt-4 max-w-xl mx-auto">
              Each screen is purpose-built for the person using it — no clutter, no confusion.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                icon: <Monitor className="w-6 h-6" />,
                label: 'POS Terminal',
                href: '/pos',
                desc: 'Full-featured cashier terminal with floor plan, product grid, numpad, split payments, and customer display.',
                features: ['Floor plan view', 'Numpad-driven order entry', 'Split & partial payments', 'Customer display'],
                cta: 'Open POS',
              },
              {
                icon: <ChefHat className="w-6 h-6" />,
                label: 'Kitchen Display',
                href: '/kitchen',
                desc: 'Live kanban board for kitchen staff — ticket queue, item checkboxes, and one-tap status updates.',
                features: ['To Cook → Preparing → Ready', 'Per-item prep checkboxes', 'Urgency alerts', 'Live socket updates'],
                cta: 'Open Kitchen',
              },
              {
                icon: <Tablet className="w-6 h-6" />,
                label: 'Waiter Portal',
                href: '/waiter',
                desc: 'Mobile-friendly waiter interface for table selection, order taking, and sending to kitchen.',
                features: ['Floor plan table picker', 'Product search & categories', 'Send to kitchen', 'Request payment'],
                cta: 'Open Waiter Portal',
              },
              {
                icon: <QrCode className="w-6 h-6" />,
                label: 'Self-Order (QR)',
                href: '/backend/qr-codes',
                desc: 'Guests scan a table QR code and order directly from their phone — no app install needed.',
                features: ['Menu browsing', 'Variants & notes', 'UPI / Cash / Card', 'Live order tracking'],
                cta: 'Manage QR Codes',
              },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-2xl p-7 border border-[#e5e5e0] hover:border-[#2d2f2f]/15 hover:shadow-lg transition-all group flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#2d2f2f] flex items-center justify-center text-[#ecfe8d]">
                    {t.icon}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#b0b0a8]">{t.label}</span>
                </div>
                <p className="text-sm text-[#5a5c5c] leading-relaxed">{t.desc}</p>
                <ul className="space-y-1.5 flex-1">
                  {t.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-[13px] text-[#2d2f2f]">
                      <CheckCircle className="w-3.5 h-3.5 text-[#2d2f2f]/30 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={t.href}>
                  <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2d2f2f] text-white hover:bg-[#3a3c3c] transition-colors cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                    {t.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="bg-white py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-[#5a5c5c] mb-3">Setup in minutes</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#2d2f2f] leading-tight">
              Up and running fast
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                step: '01',
                title: 'Create your account',
                desc: 'Sign up, add your POS name and configure your floors and tables in the backend.',
              },
              {
                step: '02',
                title: 'Add your menu',
                desc: 'Create product categories, upload items with photos, set prices and variants.',
              },
              {
                step: '03',
                title: 'Print your QR codes',
                desc: 'Download per-table QR codes from the backend and stick them on your tables.',
              },
              {
                step: '04',
                title: 'Open your sessions',
                desc: 'Cashiers open a shift on the POS terminal, waiters log into the waiter portal — and you\'re live.',
              },
            ].map((s, i) => (
              <div key={s.step} className="flex gap-6 items-start p-6 rounded-2xl border border-slate-100 bg-[#fafafa] hover:border-[#2d2f2f]/10 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-[#2d2f2f] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                  <span className="text-[#ecfe8d] font-extrabold text-sm">{s.step}</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#2d2f2f] text-base mb-1">{s.title}</h3>
                  <p className="text-sm text-[#5a5c5c] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-[#2d2f2f] text-white font-bold text-base rounded-2xl hover:bg-[#3a3c3c] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] cursor-pointer">
                Create your account
                <ArrowRight className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#2d2f2f] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#ecfe8d] rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-[#2d2f2f]" />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">Lumen POS</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/40 font-medium">
            <Link href="/login"><span className="hover:text-white transition-colors cursor-pointer">Sign In</span></Link>
            <Link href="/signup"><span className="hover:text-white transition-colors cursor-pointer">Sign Up</span></Link>
            <Link href="/kitchen"><span className="hover:text-white transition-colors cursor-pointer">Kitchen</span></Link>
            <Link href="/pos"><span className="hover:text-white transition-colors cursor-pointer">POS</span></Link>
          </div>

          <p className="text-xs text-white/30 font-medium">
            © {new Date().getFullYear()} Lumen POS Cafe
          </p>
        </div>
      </footer>

    </div>
  );
}
