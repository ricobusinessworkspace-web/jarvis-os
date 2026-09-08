import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { RoutineService } from '@/core/services/RoutineService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { addDays, dateRange, isOffDay } from '@/lib/blocks';
import { DaySheet, type DaySheetData } from '@/components/verlauf/DaySheet';
import { ScrollToSelected } from '@/components/verlauf/ScrollToSelected';
import { STATE_CELL } from '@/lib/metricState';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const URSACHEN = ['sales.calls_count', 'training.sessions', 'content.posts'];
const STRIP_DAYS = 28;
const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

async function Verlauf({ selected }: { selected: string }) {
  const today = getBerlinDateStr();
  const stripFrom = addDays(today, -(STRIP_DAYS - 1));
  const from = selected < stripFrom ? selected : stripFrom;
  const to = selected > today ? selected : today;

  const [matrix, routines] = await Promise.all([
    AnalyticsService.getMatrix(from, to, [...URSACHEN, 'body.sleep_hours', 'body.weight', 'body.calories']),
    RoutineService.getRoutineBlocks(selected),
  ]);

  const row = matrix[selected] ?? {};
  const data: DaySheetData = {
    date: selected,
    isToday: selected === today,
    isOffDay: isOffDay(selected),
    isFuture: selected > today,
    calls: {
      value: row['sales.calls_count']?.value ?? null,
      base: row['sales.calls_count']?.base ?? null,
      stretch: row['sales.calls_count']?.stretch ?? null,
      state: row['sales.calls_count']?.state ?? 'ungemessen',
    },
    training: {
      value: row['training.sessions']?.value ?? null,
      state: row['training.sessions']?.state ?? 'ungemessen',
    },
    post: {
      value: row['content.posts']?.value ?? null,
      state: row['content.posts']?.state ?? 'ungemessen',
    },
    calories: row['body.calories']?.value ?? null,
    sleepHours: row['body.sleep_hours']?.value ?? null,
    weight: row['body.weight']?.value ?? null,
    routines,
  };

  const stripDays = dateRange(stripFrom, today);

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Verlauf</h1>
      <p className="mb-5 mt-1 text-[13px] text-muted">Tag wählen, Werte nachtragen oder korrigieren.</p>

      <div className="mb-4 flex items-center gap-2">
        <Link
          href={`/verlauf?d=${addDays(selected, -1)}`}
          aria-label="Tag zurück"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-elevated/40 text-muted transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>

        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stripDays.map(day => {
            const off = isOffDay(day);
            const isSel = day === selected;
            const dt = new Date(`${day}T12:00:00Z`);
            return (
              <Link
                key={day}
                href={`/verlauf?d=${day}`}
                scroll={false}
                data-day={day}
                className={cn(
                  'w-[52px] shrink-0 rounded-[11px] border px-0 py-2 text-center transition-colors',
                  isSel ? 'border-accent bg-accent/10' : 'border-border/60 bg-overlay/40 hover:border-border-hover',
                  off && !isSel && 'bg-white/[0.02]'
                )}
              >
                <div className="text-[9.5px] uppercase text-muted">{DOW[dt.getUTCDay()]}</div>
                <div className={cn('my-0.5 font-mono text-[13.5px] tabular-nums', isSel && 'text-accent')}>
                  {dt.getUTCDate()}.{dt.getUTCMonth() + 1}
                </div>
                <div className="flex justify-center gap-[2px]">
                  {URSACHEN.map(key => (
                    <span
                      key={key}
                      className={cn(
                        'h-[5px] w-[5px] rounded-[1.5px]',
                        off ? 'opacity-0' : STATE_CELL[matrix[day]?.[key]?.state ?? 'ungemessen']
                      )}
                    />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          href={`/verlauf?d=${addDays(selected, 1)}`}
          aria-label="Tag vor"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-elevated/40 text-muted transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ScrollToSelected date={selected} />
      <DaySheet key={selected} data={data} />
    </>
  );
}

export default async function VerlaufPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const selected = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : getBerlinDateStr();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 md:px-8">
      <Suspense
        key={selected}
        fallback={<div className="h-96 animate-pulse rounded-2xl border border-border/30 bg-elevated/30" />}
      >
        <Verlauf selected={selected} />
      </Suspense>
    </div>
  );
}
