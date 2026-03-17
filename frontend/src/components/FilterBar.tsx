export type FilterOperator = 'eq' | 'neq'

export type FilterRule = {
  id: string
  field: string
  op: FilterOperator
  value: string
}

export type FilterField = {
  id: string
  label: string
  options: { value: string; label: string }[]
  ops?: FilterOperator[]  // defaults to ['eq','neq']
}

export default function FilterBar({
  fields,
  rules,
  onRulesChange,
  extra,
}: {
  fields: FilterField[]
  rules: FilterRule[]
  onRulesChange: (rules: FilterRule[], resetPage?: boolean) => void
  extra?: React.ReactNode
}) {
  function addRule() {
    const firstField = fields[0]
    if (!firstField) return
    const newRule: FilterRule = {
      id: Math.random().toString(36).slice(2, 9),
      field: firstField.id,
      op: (firstField.ops ?? ['eq'])[0],
      value: firstField.options[0]?.value ?? '',
    }
    onRulesChange([...rules, newRule], true)
  }

  function updateRule(id: string, changes: Partial<FilterRule>) {
    onRulesChange(
      rules.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, ...changes }
        // Reset value and op when field changes
        if (changes.field && changes.field !== r.field) {
          const newFieldConfig = fields.find((f) => f.id === changes.field)
          updated.value = newFieldConfig?.options[0]?.value ?? ''
          updated.op = (newFieldConfig?.ops ?? ['eq'])[0]
        }
        return updated
      }),
      true,
    )
  }

  function removeRule(id: string) {
    onRulesChange(rules.filter((r) => r.id !== id), true)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-400 dark:text-slate-500 shrink-0">Filter</span>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 shrink-0" />

      {rules.map((rule) => {
        const fieldConfig = fields.find((f) => f.id === rule.field)
        return (
          <div
            key={rule.id}
            className="flex items-center bg-violet-50 border border-violet-200 rounded-full h-8 overflow-hidden divide-x divide-violet-200"
          >
            {/* Field */}
            <select
              value={rule.field}
              onChange={(e) => updateRule(rule.id, { field: e.target.value })}
              className="text-xs font-semibold text-violet-700 bg-transparent border-none outline-none cursor-pointer px-2.5 h-full"
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            {/* Operator */}
            {(() => {
              const ops = fieldConfig?.ops ?? ['eq', 'neq']
              return ops.length === 1 ? (
                <span className="text-xs text-violet-500 px-2 h-full flex items-center">
                  {ops[0] === 'eq' ? 'is' : 'is not'}
                </span>
              ) : (
                <select
                  value={rule.op}
                  onChange={(e) => updateRule(rule.id, { op: e.target.value as FilterOperator })}
                  className="text-xs text-violet-500 bg-transparent border-none outline-none cursor-pointer px-2 h-full"
                >
                  {ops.includes('eq') && <option value="eq">is</option>}
                  {ops.includes('neq') && <option value="neq">is not</option>}
                </select>
              )
            })()}
            {/* Value */}
            <select
              value={rule.value}
              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
              className="text-xs font-semibold text-violet-700 bg-transparent border-none outline-none cursor-pointer px-2 h-full"
            >
              {(fieldConfig?.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* Remove */}
            <button
              onClick={() => removeRule(rule.id)}
              aria-label={`Remove ${fieldConfig?.label ?? rule.field} filter`}
              className="px-2 h-full text-violet-400 hover:text-red-500 hover:bg-red-50 transition-colors text-sm leading-none"
            >
              ×
            </button>
          </div>
        )
      })}

      <button
        onClick={addRule}
        className="h-8 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors px-3 rounded-full"
      >
        <span className="text-sm leading-none font-bold">+</span> Add filter
      </button>

      {extra}

      {rules.length > 0 && (
        <button
          onClick={() => onRulesChange([], true)}
          className="h-8 flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 rounded-full hover:bg-red-50"
        >
          ✕ Clear all
        </button>
      )}
    </div>
  )
}
