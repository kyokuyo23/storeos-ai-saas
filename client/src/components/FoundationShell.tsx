import { Link } from "wouter";
import { AlertTriangle, BarChart3, Box, ChevronLeft, ClipboardList, Coffee, LayoutDashboard, Lock, LogOut, Menu, Package, Settings, Sparkles, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export type FoundationPage = "dashboard" | "products" | "inventory" | "settings" | "pos" | "sales" | "alerts" | "insights" | "reports" | "users";

const items: Array<{ page: FoundationPage; label: string; href: string; icon: typeof LayoutDashboard; ready?: boolean; ownerOnly?: boolean }> = [
  { page: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, ready: true },
  { page: "pos", label: "POS", href: "/pos", icon: Coffee, ready: true },
  { page: "products", label: "Products", href: "/products", icon: Package, ready: true },
  { page: "inventory", label: "Inventory", href: "/inventory", icon: Box, ready: true },
  { page: "sales", label: "Sales", href: "/sales", icon: BarChart3, ready: true },
  { page: "alerts", label: "Alerts", href: "/alerts", icon: AlertTriangle, ready: true },
  { page: "insights", label: "Insights", href: "/insights", icon: Sparkles, ready: true },
  { page: "reports", label: "Reports", href: "/reports", icon: ClipboardList, ready: true },
  { page: "users", label: "Pengguna", href: "/users", icon: Users, ready: true, ownerOnly: true },
  { page: "settings", label: "Settings", href: "/settings", icon: Settings, ready: true, ownerOnly: true },
];
/** Pages a member (staff) cannot open; the server enforces the same rule. */
export const OWNER_ONLY_PAGES = new Set<FoundationPage>(items.filter((item) => item.ownerOnly).map((item) => item.page));

const initials = (name: string | null | undefined) => (name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";

function Sidebar({ active, onNavigate, isOwner }: { active: FoundationPage; onNavigate?: () => void; isOwner: boolean }) {
  return <aside className="foundation-sidebar">
    <div className="brand-lockup"><div className="brand-mark"><Coffee size={20} /></div><div><strong>StoreOS AI</strong><span>Foundation</span></div></div>
    <nav className="foundation-nav" aria-label="Navigasi utama">
      {items.filter((item) => isOwner || !item.ownerOnly).map((item) => { const Icon = item.icon; return <Link key={item.page} href={item.href} onClick={onNavigate} className={`nav-item ${active === item.page ? "active" : ""}`}><Icon size={18} /><span>{item.label}</span>{!item.ready && <small>Segera</small>}</Link>; })}
    </nav>
    <div className="sidebar-note"><strong>Step 2 foundation</strong><span>Master data dan struktur aplikasi yang siap dikembangkan.</span></div>
  </aside>;
}

export function AppShell({ active, title, eyebrow, children }: { active: FoundationPage; title: string; eyebrow: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const auth = useAuth({ redirectOnUnauthenticated: true });
  const user = auth.user;
  const isOwner = Boolean(user?.isOwner);
  if (!user) return <div className="auth-gate"><span className="loading-dot" /> {auth.loading ? "Memeriksa sesi…" : "Mengarahkan ke halaman login…"}</div>;
  const blocked = OWNER_ONLY_PAGES.has(active) && !isOwner;
  const signOut = async () => { await auth.logout(); window.location.href = "/login"; };
  return <div className="foundation-app">
    <div className={`mobile-drawer ${open ? "open" : ""}`}><div className="drawer-overlay" onClick={() => setOpen(false)} /><div className="drawer-content"><button className="drawer-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><ChevronLeft /></button><Sidebar active={active} isOwner={isOwner} onNavigate={() => setOpen(false)} /></div></div>
    <div className="desktop-sidebar"><Sidebar active={active} isOwner={isOwner} /></div>
    <main className="foundation-main">
      <header className="foundation-topbar"><button className="mobile-menu" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={21} /></button><div className="topbar-context"><span>{eyebrow}</span><strong>{title}</strong></div><div className="topbar-store"><strong>Kopi Nusantara</strong><span>Cibitung Bekasi</span></div><div className="topbar-user"><div className="avatar" aria-hidden="true">{initials(user.name)}</div><div className="topbar-user-text"><strong>{user.name || user.username}</strong><span>{isOwner ? "Pemilik" : "Karyawan"}</span></div><button type="button" className="icon-button" onClick={signOut} aria-label="Keluar" title="Keluar"><LogOut size={15} /></button></div></header>
      <div className="foundation-content">{blocked ? <section className="foundation-panel"><EmptyState title="Khusus pemilik toko" description="Halaman ini hanya bisa dibuka oleh pemilik. Hubungi pemilik bila Anda membutuhkan perubahan." icon={Lock} /></section> : children}</div>
    </main>
  </div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <section className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-action">{action}</div>}</section>;
}

export function Panel({ title, description, children, className = "" }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`foundation-panel ${className}`}>{title && <div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>}{children}</section>;
}

export function EmptyState({ title, description, icon: Icon = Package }: { title: string; description: string; icon?: typeof Package }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{description}</p></div>;
}

export function ErrorState({ message }: { message: string }) { return <div className="error-state"><AlertTriangle size={18} /><span>{message}</span></div>; }
