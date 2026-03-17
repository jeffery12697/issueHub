import type { Priority } from '@/api/tasks'

/**
 * Canonical dot color for each priority level.
 * Used for dot indicators, drag handles, and inline priority markers.
 * Single source of truth — import from here instead of re-defining per file.
 */
export const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none:   '#cbd5e1',
  low:    '#38bdf8',
  medium: '#fbbf24',
  high:   '#f97316',
  urgent: '#ef4444',
}

/**
 * Full priority color set for card/badge rendering (board view).
 * bg + text use Tailwind classes; dot matches PRIORITY_DOT_COLORS.
 */
export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; dot: string }> = {
  none:   { bg: 'bg-slate-100',  text: 'text-slate-400',  dot: '#cbd5e1' },
  low:    { bg: 'bg-sky-50',     text: 'text-sky-500',    dot: '#38bdf8' },
  medium: { bg: 'bg-amber-50',   text: 'text-amber-600',  dot: '#fbbf24' },
  high:   { bg: 'bg-orange-50',  text: 'text-orange-500', dot: '#f97316' },
  urgent: { bg: 'bg-red-50',     text: 'text-red-500',    dot: '#ef4444' },
}
