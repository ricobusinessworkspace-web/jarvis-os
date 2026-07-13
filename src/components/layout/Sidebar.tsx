'use client';
import { getDashboardData } from '@/actions/dashboard';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  KanbanSquare,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Content & Tasks', href: '/content', icon: KanbanSquare },
] as const;

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export default function Sidebar() {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();

  const handleLaunchCRM = async () => {
    try {
      alert('CRM Launch not supported in Cloud Mode (Web App). Please open the CRM directly.');
    } catch (e) {
      console.error('[Sidebar] Failed to launch CRM:', e);
    }
  };

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col glass border-r border-border electron-no-drag transition-transform duration-300",
          isCollapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0"
        )}
      >
        {/* ── Brand ─────────────────────────── */}
        <div className="flex h-14 items-center gap-3 px-5 shrink-0 select-none">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white text-sm font-black shadow-glow">
            J
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, delay: 0.05 }}
              className="text-xs font-black tracking-widest text-foreground whitespace-nowrap uppercase"
            >
              Jarvis OS
            </motion.span>
          )}
        </div>

        {/* ── Navigation ────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 select-none">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    toggleSidebar();
                  }
                }}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent-muted text-accent font-semibold'
                    : 'text-secondary hover:bg-overlay hover:text-foreground'
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    'shrink-0 transition-colors duration-150',
                    isActive
                      ? 'text-accent'
                      : 'text-muted group-hover:text-foreground'
                  )}
                />
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </Link>
            );
          })}

        </nav>

        {/* ── User + Collapse Toggle ────────── */}
        <div className="shrink-0 border-t border-border px-3 py-3 space-y-2">
          {/* User section */}
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 select-none">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-foreground ring-1 ring-border shadow-sm">
              R
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-medium text-foreground whitespace-nowrap"
              >
                Rico
              </motion.span>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center rounded-lg py-2 text-muted hover:bg-overlay hover:text-foreground transition-colors duration-150"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
