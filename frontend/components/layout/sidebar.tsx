'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  SquaresFour,
  CreditCard,
  Wallet,
  Repeat,
  ChartBar,
  Warning,
  Link as LinkIcon,
  GearSix,
  List,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { href: '/dashboard', icon: SquaresFour, label: 'Dashboard' },
  { href: '/payments', icon: CreditCard, label: 'Payments' },
  { href: '/payment-methods', icon: Wallet, label: 'Payment Methods' },
  { href: '/subscriptions', icon: Repeat, label: 'Subscriptions' },
  { href: '/usage', icon: ChartBar, label: 'Usage' },
  { href: '/disputes', icon: Warning, label: 'Disputes' },
  { href: '/connect', icon: LinkIcon, label: 'Connect' },
  { href: '/settings', icon: GearSix, label: 'Settings' },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" weight="bold" />
          {!collapsed && (
            <span className="text-lg font-semibold">Stripe Pay</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" weight={isActive ? 'bold' : 'regular'} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse button (desktop only) */}
      <div className="hidden border-t p-2 lg:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <CaretRight className="h-5 w-5" />
          ) : (
            <CaretLeft className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden h-full border-r bg-sidebar transition-all duration-300 lg:block',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-50 lg:hidden"
            aria-label="Open menu"
          >
            <List className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 pt-16 lg:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}