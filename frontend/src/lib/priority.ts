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
  none:   { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-400 dark:text-slate-400',   dot: '#cbd5e1' },
  low:    { bg: 'bg-sky-50 dark:bg-sky-950',          text: 'text-sky-500 dark:text-sky-300',       dot: '#38bdf8' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-950',      text: 'text-amber-600 dark:text-amber-300',   dot: '#fbbf24' },
  high:   { bg: 'bg-orange-50 dark:bg-orange-950',    text: 'text-orange-500 dark:text-orange-300', dot: '#f97316' },
  urgent: { bg: 'bg-red-50 dark:bg-red-950',          text: 'text-red-500 dark:text-red-400',       dot: '#ef4444' },
}

/**
 * Priority chip style for selector buttons (border + bg + text).
 * Used in sidebar/detail views where priority is displayed as a clickable pill with a border.
 */
export const PRIORITY_CHIP: Record<Priority, string> = {
  none:   'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400',
  low:    'bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
  medium: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  high:   'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
  urgent: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
}
