/** Small helpers for exporting generated text. No file ever leaves the browser. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Opens a print dialog for a plain-text document, which is how "export to PDF"
 * works in this build. A real DOCX export would need a document library; that is
 * listed as future work rather than faked.
 */
export function printTextDocument(title: string, text: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      '<style>body{font-family:Georgia,"Times New Roman",serif;white-space:pre-wrap;padding:2.5rem;line-height:1.55;font-size:12pt;color:#111}' +
      'h1{font-family:Helvetica,Arial,sans-serif;font-size:14pt}</style></head><body>' +
      `${escapeHtml(text)}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
  return true;
}
