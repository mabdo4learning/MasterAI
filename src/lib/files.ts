/** File types that can be attached to a session besides images. */
const DOC_TYPES: Record<string, { label: string; color: string; mime: string; office?: boolean }> = {
  pdf: { label: 'PDF', color: '#DC2626', mime: 'application/pdf' },
  ppt: { label: 'PPT', color: '#C2410C', mime: 'application/vnd.ms-powerpoint', office: true },
  pptx: { label: 'PPT', color: '#C2410C', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', office: true },
  doc: { label: 'DOC', color: '#1D4ED8', mime: 'application/msword', office: true },
  docx: { label: 'DOC', color: '#1D4ED8', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', office: true },
  xls: { label: 'XLS', color: '#15803D', mime: 'application/vnd.ms-excel', office: true },
  xlsx: { label: 'XLS', color: '#15803D', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', office: true },
  csv: { label: 'CSV', color: '#15803D', mime: 'text/csv' },
  txt: { label: 'TXT', color: '#4B5563', mime: 'text/plain' },
  md: { label: 'MD', color: '#4B5563', mime: 'text/markdown' },
};

/** Supabase's free plan rejects files over 50 MB. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ACCEPT = ['image/*', ...Object.keys(DOC_TYPES).map((e) => `.${e}`)].join(',');

export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function fileKind(file: File): 'image' | 'document' | null {
  if (file.type.startsWith('image/')) return 'image';
  return DOC_TYPES[extOf(file.name)] ? 'document' : null;
}

export function docType(name: string) {
  return DOC_TYPES[extOf(name)] ?? { label: 'FILE', color: '#4B5563', mime: 'application/octet-stream' };
}

export const isPdf = (name: string) => extOf(name) === 'pdf';
export const isOffice = (name: string) => !!DOC_TYPES[extOf(name)]?.office;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
