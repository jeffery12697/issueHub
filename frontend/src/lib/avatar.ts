// Muted palette — distinguishable without saturated color noise
// bg-{color}-100 text-{color}-700, matching .impeccable.md avatar token spec
const AVATAR_COLORS: [string, string][] = [
  ['bg-violet-100', 'text-violet-700'],
  ['bg-sky-100',    'text-sky-700'],
  ['bg-emerald-100','text-emerald-700'],
  ['bg-amber-100',  'text-amber-700'],
  ['bg-rose-100',   'text-rose-700'],
  ['bg-indigo-100', 'text-indigo-700'],
]

export function avatarColor(name: string): [string, string] {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}
