'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  target?: number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  animationDelay?: number;
}

export default function StatsCard({
  title,
  value,
  target,
  unit,
  icon,
  trend,
  animationDelay = 0,
}: StatsCardProps) {
  const progress = target ? (Number(value) / target) * 100 : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: animationDelay,
        ease: [0.16, 1, 0.3, 1] as const,
      }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5',
        'transition-colors duration-200 hover:border-border-hover',
        'cursor-default'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          {/* Icon circle */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            {icon}
          </div>

          {/* Title & unit */}
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted">{title}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {value}
              </span>
              {unit && (
                <span className="text-xs text-muted">{unit}</span>
              )}
            </div>
          </div>
        </div>

        {/* Trend indicator */}
        {trend && trend !== 'neutral' && (
          <span
            className={cn(
              'mt-1 text-xs font-medium',
              trend === 'up' && 'text-success',
              trend === 'down' && 'text-error'
            )}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>

      {/* Target text */}
      {target !== undefined && (
        <span className="text-[11px] text-muted">
          Target: {target}{unit ? ` ${unit}` : ''}
        </span>
      )}

      {/* Progress bar */}
      {progress !== null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{
              duration: 0.8,
              delay: animationDelay + 0.2,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
          />
        </div>
      )}
    </motion.div>
  );
}
