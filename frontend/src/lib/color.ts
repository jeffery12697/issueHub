import type { CSSProperties } from 'react'

/**
 * Lightens a 6-digit hex color by mixing it with white.
 * factor: 0 = no change, 1 = pure white
 */
function lightenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * factor)
  const lg = Math.round(g + (255 - g) * factor)
  const lb = Math.round(b + (255 - b) * factor)
  return `rgb(${lr}, ${lg}, ${lb})`
}

/**
 * Returns inline styles for a status badge pill (background + text color).
 * In dark mode, lightens the text color so it remains readable on slate-900 backgrounds.
 */
export function statusBadgeStyle(color: string): CSSProperties {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  if (!isDark) {
    return { backgroundColor: color + '20', color }
  }
  return {
    backgroundColor: color + '25',
    color: lightenHex(color, 0.5),
  }
}
