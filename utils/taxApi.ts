/* The browser's side of /api/tax-docs: list, upload, rename, delete, download one file, and download the year's zip. */

export interface TaxDocument {
  id: string;
  year: number;
  label: string;
  filename: string;
  mime: string;
  size: number;
  checklistKey: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface TaxUsage { usedBytes: number; documents: number; maxBytes: number; maxFileBytes: number }

export class TaxApiError extends Error {}

const request = async (path: string, init: RequestInit = {}, fallback = 'Something went wrong. Try again.'): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(`/api/tax-docs${path}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    throw new TaxApiError('Could not reach your Crystal server.');
  }
  if (!response.ok) {
    let message = fallback;
    try { const body = await response.json(); if (typeof body?.message === 'string' && body.message.trim()) message = body.message.trim(); } catch { /* keep the fallback */ }
    throw new TaxApiError(message);
  }
  return response;
};

export const listTaxDocuments = async (year?: number): Promise<{ documents: TaxDocument[]; usage: TaxUsage }> =>
  (await request(year === undefined ? '' : `?year=${year}`, {}, 'Could not load the documents.')).json();

const toBase64 = async (file: Blob): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export const uploadTaxDocument = async (file: File, meta: { year: number; label: string; checklistKey?: string }): Promise<TaxDocument> =>
  (await request('', { method: 'POST', body: JSON.stringify({ ...meta, filename: file.name, content: await toBase64(file) }) }, 'Could not save the document.')).json();

export const updateTaxDocument = async (id: string, patch: { label?: string; year?: number; checklistKey?: string | null }): Promise<TaxDocument> =>
  (await request(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'Could not update the document.')).json();

export const deleteTaxDocument = async (id: string): Promise<void> => { await request(`/${id}`, { method: 'DELETE' }, 'Could not delete the document.'); };

const save = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const downloadTaxDocument = async (doc: TaxDocument): Promise<void> => {
  save(await (await request(`/${doc.id}/file`, {}, 'Could not download the document.')).blob(), doc.filename);
};

export const downloadTaxPack = async (year: number, files: { name: string; content: string }[], label: string): Promise<void> => {
  save(await (await request('/export', { method: 'POST', body: JSON.stringify({ year, files }) }, 'Could not build the pack.')).blob(), `crystal-tax-pack-${label.replace('/', '-')}.zip`);
};
