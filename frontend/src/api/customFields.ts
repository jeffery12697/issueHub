import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url'

export type FieldDefinition = {
  id: string
  list_id: string
  name: string
  field_type: FieldType
  is_required: boolean
  options_json: string[] | null
  order_index: number
}

export type FieldValue = {
  id: string
  task_id: string
  field_id: string
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_boolean: boolean | null
  value_json: Record<string, unknown> | null
}

// API functions
export const customFieldsApi = {
  listDefinitions: (listId: string) =>
    apiClient.get<FieldDefinition[]>(`/lists/${listId}/custom-fields`).then(r => r.data),
  createDefinition: (listId: string, data: { name: string; field_type: FieldType; is_required?: boolean; options_json?: string[] | null }) =>
    apiClient.post<FieldDefinition>(`/lists/${listId}/custom-fields`, data).then(r => r.data),
  updateDefinition: (listId: string, fieldId: string, data: { name?: string; is_required?: boolean; options_json?: string[] | null }) =>
    apiClient.patch<FieldDefinition>(`/lists/${listId}/custom-fields/${fieldId}`, data).then(r => r.data),
  deleteDefinition: (listId: string, fieldId: string) =>
    apiClient.delete(`/lists/${listId}/custom-fields/${fieldId}`),
  getValues: (taskId: string) =>
    apiClient.get<FieldValue[]>(`/tasks/${taskId}/field-values`).then(r => r.data),
  upsertValues: (taskId: string, values: Record<string, unknown>) =>
    apiClient.put<FieldValue[]>(`/tasks/${taskId}/field-values`, { values }).then(r => r.data),
}

// Hooks
export function useFieldDefinitions(listId: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields', listId],
    queryFn: () => customFieldsApi.listDefinitions(listId!),
    enabled: !!listId,
  })
}

export function useFieldValues(taskId: string) {
  return useQuery({
    queryKey: ['field-values', taskId],
    queryFn: () => customFieldsApi.getValues(taskId),
    enabled: !!taskId,
  })
}

export function useCreateField(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; field_type: FieldType; is_required?: boolean; options_json?: string[] | null }) =>
      customFieldsApi.createDefinition(listId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields', listId] }),
  })
}

export function useUpdateField(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: { name?: string; is_required?: boolean; options_json?: string[] | null } }) =>
      customFieldsApi.updateDefinition(listId, fieldId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields', listId] }),
  })
}

export function useDeleteField(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fieldId: string) => customFieldsApi.deleteDefinition(listId, fieldId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields', listId] }),
  })
}

export function useUpsertValues(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => customFieldsApi.upsertValues(taskId, values),
    onSuccess: (updated) => {
      qc.setQueryData<FieldValue[]>(['field-values', taskId], updated)
    },
  })
}
