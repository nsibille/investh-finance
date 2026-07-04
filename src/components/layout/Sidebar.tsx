"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Upload,
  FolderTree,
  Wand2,
  Repeat,
  BarChart3,
  ShoppingBag,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Comptes", icon: Wallet },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/achats", label: "Achats", icon: ShoppingBag },
  { href: "/categories", label: "Catégories", icon: FolderTree },
  { href: "/rules", label: "Règles", icon: Wand2 },
  { href: "/recurring", label: "Récurrentes", icon: Repeat },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="nav-sidebar" aria-label="Navigation principale">
      <div className="nav-sidebar__brand">
        <Logo />
      </div>
      <div className="nav-sidebar__group">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="nav-sidebar-item"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
