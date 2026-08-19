import { Link } from "wouter";
import { AlertTriangle, BarChart3, Box, ChevronLeft, ClipboardList, Coffee, LayoutDashboard, Menu, Package, Settings, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

export type FoundationPage = "dashboard" | "products" | "inventory" | "settings" | "pos" | "sales" | "alerts" | "insights" | "reports";

const items: Array<{ page: FoundationPage; label: string; href: string; icon: typeof LayoutDashboard; ready?: boolean }> = [
  { page: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, ready: true },
  { page: "pos", label: "POS", href: "/pos", icon: Coffee, ready: true },
  { page: "products", label: "Products", href: "/products", icon: Package, ready: true },
  { page: "inventory", label: "Inventory", href: "/inventory", icon: Box, ready: true },
  { page: "sales", label: "Sales", href: "/sales", icon: BarChart3, ready: true },
  { page: "alerts", label: "Alerts", href: "/alerts", icon: AlertTriangle },
  { page: "insights", label: "AI Insights", href: "/insights", icon: Sparkles },
  { page: "reports", label: "Reports", href: "/reports", icon: ClipboardList },
  { page: "settings", label: "Settings", href: "/settings", icon: Settings, ready: true },
];

function Sidebar({ active, onNavigate }: { active: FoundationPage; onNavigate?: () => void }) {
  return <aside className="foundation-sidebar">
    <div className="brand-lockup"><div className="brand-mark"><Coffee size={20} /></div><div><strong>StoreOS AI</strong><span>Foundation</span></div></div>
    <nav className="foundation-nav" aria-label="Navigasi utama">
      {items.map((item) => { const Icon = item.icon; return <Link key={item.page} href={item.href} onClick={onNavigate} className={`nav-item ${active === item.page ? "active" : ""}`}><Icon size={18} /><span>{item.label}</span>{!item.ready && <small>Segera</small>}</Link>; })}
    </nav>
    <div className="sidebar-note"><strong>Step 2 foundation</strong><span>Master data dan struktur aplikasi yang siap dikembangkan.</span></div>
  </aside>;
}

export function AppShell({ active, title, eyebrow, children }: { active: FoundationPage; title: string; eyebrow: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="foundation-app">
    <div className={`mobile-drawer ${open ? "open" : ""}`}><div className="drawer-overlay" onClick={() => setOpen(false)} /><div className="drawer-content"><button className="drawer-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><ChevronLeft /></button><Sidebar active={active} onNavigate={() => setOpen(false)} /></div></div>
    <div className="desktop-sidebar"><Sidebar active={active} /></div>
    <main className="foundation-main">
      <header className="foundation-topbar"><button className="mobile-menu" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={21} /></button><div className="topbar-context"><span>{eyebrow}</span><strong>{title}</strong></div><div className="topbar-store"><strong>Kopi Nusantara</strong><span>Cibitung Bekasi</span></div><div className="avatar">KN</div></header>
      <div className="foundation-content">{children}</div>
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
