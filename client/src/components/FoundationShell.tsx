import { Link } from "wouter";
import { AlertTriangle, BarChart3, Box, ChevronLeft, ClipboardCheck, ClipboardList, Coffee, LayoutDashboard, Lock, LogOut, Menu, Package, Settings, Sparkles, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type FoundationPage = "dashboard" | "products" | "inventory" | "settings" | "pos" | "sales" | "alerts" | "insights" | "reports" | "users" | "shift";

const items: Array<{ page: FoundationPage; label: string; href: string; icon: typeof LayoutDashboard; ready?: boolean; ownerOnly?: boolean }> = [
  { page: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, ready: true },
  { page: "pos", label: "POS", href: "/pos", icon: Coffee, ready: true },
  { page: "products", label: "Products", href: "/products", icon: Package, ready: true },
  { page: "inventory", label: "Inventory", href: "/inventory", icon: Box, ready: true },
  { page: "sales", label: "Sales", href: "/sales", icon: BarChart3, ready: true },
  { page: "shift", label: "Cek Shift", href: "/shift-check", icon: ClipboardCheck, ready: true },
  { page: "alerts", label: "Alerts", href: "/alerts", icon: AlertTriangle, ready: true },
  { page: "insights", label: "Insights", href: "/insights", icon: Sparkles, ready: true },
  { page: "reports", label: "Reports", href: "/reports", icon: ClipboardList, ready: true },
  { page: "users", label: "Pengguna", href: "/users", icon: Users, ready: true, ownerOnly: true },
  { page: "settings", label: "Settings", href: "/settings", icon: Settings, ready: true, ownerOnly: true },
];
/** Pages only the owner or an admin sistem (sysadmin) can open; the server enforces the same rule. */
export const OWNER_ONLY_PAGES = new Set<FoundationPage>(items.filter((item) => item.ownerOnly).map((item) => item.page));

const initials = (name: string | null | undefined) => (name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";

type Branding = { businessName: string; storeLocation: string; logoUrl: string | null };

/** Store logo, or the default cup icon when none is uploaded. */
export function StoreMark({ branding, size = 39 }: { branding?: Branding | null; size?: number }) {
  return branding?.logoUrl
    ? <div className="brand-mark has-logo" style={{ width: size, height: size }}><img src={branding.logoUrl} alt={`Logo ${branding.businessName}`} /></div>
    : <div className="brand-mark" style={{ width: size, height: size }}><Coffee size={Math.round(size / 2)} /></div>;
}

/** Browser tab title + favicon follow the store name and logo. */
function useDocumentBranding(branding: Branding | undefined, title: string) {
  useEffect(() => {
    if (!branding) return;
    document.title = `${title} · ${branding.businessName}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (branding.logoUrl) {
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = branding.logoUrl;
    } else if (link?.dataset.storeLogo) link.remove();
    if (link && branding.logoUrl) link.dataset.storeLogo = "1";
  }, [branding?.businessName, branding?.logoUrl, title]);
}

function Sidebar({ active, onNavigate, canManage, branding }: { active: FoundationPage; onNavigate?: () => void; canManage: boolean; branding?: Branding }) {
  return <aside className="foundation-sidebar">
    <div className="brand-lockup"><StoreMark branding={branding} /><div><strong>{branding?.businessName ?? "StoreOS AI"}</strong><span>StoreOS</span></div></div>
    <nav className="foundation-nav" aria-label="Navigasi utama">
      {items.filter((item) => canManage || !item.ownerOnly).map((item) => { const Icon = item.icon; return <Link key={item.page} href={item.href} onClick={onNavigate} className={`nav-item ${active === item.page ? "active" : ""}`}><Icon size={18} /><span>{item.label}</span>{!item.ready && <small>Segera</small>}</Link>; })}
    </nav>
    <div className="sidebar-note"><strong>Step 2 foundation</strong><span>Master data dan struktur aplikasi yang siap dikembangkan.</span></div>
  </aside>;
}

export function AppShell({ active, title, eyebrow, children }: { active: FoundationPage; title: string; eyebrow: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const auth = useAuth({ redirectOnUnauthenticated: true });
  const user = auth.user;
  const canManage = Boolean(user?.canManage);
  const brandingQuery = trpc.settings.branding.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000, retry: false });
  const branding = brandingQuery.data;
  useDocumentBranding(branding, title);
  const roleLabel = user?.isOwner ? "Pemilik" : user?.accessLevel === "sysadmin" ? "Admin sistem" : "Kasir";
  if (!user) return <div className="auth-gate"><span className="loading-dot" /> {auth.loading ? "Memeriksa sesi…" : "Mengarahkan ke halaman login…"}</div>;
  const blocked = OWNER_ONLY_PAGES.has(active) && !canManage;
  const signOut = async () => { await auth.logout(); window.location.href = "/login"; };
  return <div className="foundation-app">
    <div className={`mobile-drawer ${open ? "open" : ""}`}><div className="drawer-overlay" onClick={() => setOpen(false)} /><div className="drawer-content"><button className="drawer-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><ChevronLeft /></button><Sidebar active={active} canManage={canManage} branding={branding} onNavigate={() => setOpen(false)} /></div></div>
    <div className="desktop-sidebar"><Sidebar active={active} canManage={canManage} branding={branding} /></div>
    <main className="foundation-main">
      <header className="foundation-topbar"><button className="mobile-menu" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={21} /></button><div className="topbar-context"><span>{eyebrow}</span><strong>{title}</strong></div><div className="topbar-store"><strong>{branding?.businessName ?? ""}</strong><span>{branding?.storeLocation ?? ""}</span></div><div className="topbar-user"><div className="avatar" aria-hidden="true">{initials(user.name)}</div><div className="topbar-user-text"><strong>{user.name || user.username}</strong><span>{roleLabel}</span></div><button type="button" className="icon-button" onClick={signOut} aria-label="Keluar" title="Keluar"><LogOut size={15} /></button></div></header>
      <div className="print-brand" aria-hidden="true"><StoreMark branding={branding} size={44} /><div><strong>{branding?.businessName}</strong><span>{branding?.storeLocation}</span></div></div>
      <div className="foundation-content">{blocked ? <section className="foundation-panel"><EmptyState title="Khusus pemilik & admin sistem" description="Halaman ini hanya bisa dibuka oleh pemilik atau admin sistem. Hubungi mereka bila Anda membutuhkan perubahan." icon={Lock} /></section> : children}</div>
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
