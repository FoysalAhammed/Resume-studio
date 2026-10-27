import { LIMITS } from '../constants';

export interface FileDescriptor {
  name: string;
  size: number;
  type?: string;
}

export type FileKind = 'pdf' | 'docx' | 'text' | 'unknown';

export interface FileValidationResult {
  ok: boolean;
  kind: FileKind;
  extension: string;
  errors: string[];
  warnings: string[];
}

const DANGEROUS_EXTENSIONS = ['.exe', '.js', '.mjs', '.cjs', '.sh', '.bat', '.cmd', '.ps1', '.php', '.jar', '.html', '.htm', '.svg', '.dll', '.com', '.scr', '.vbs', '.zip'];

export function extensionOf(name: string): string {
  const clean = (name ?? '').trim().toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot);
}

/**
 * Client-side validation of a selected resume. The server repeats these checks
 * and additionally inspects the file signature, because nothing from the browser
 * can be trusted on its own.
 */
export function validateResumeFile(file: FileDescriptor, limits = LIMITS): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const extension = extensionOf(file?.name ?? '');
  const accepted = limits.acceptedExtensions as readonly string[];

  if (!file || !file.name) {
    errors.push('No file was selected.');
  } else {
    if (!accepted.includes(extension)) {
      errors.push(`Unsupported file type "${extension || 'unknown'}". Accepted formats: ${accepted.join(', ')}.`);
    }
    const parts = file.name.toLowerCase().split('.');
    const nested = parts.filter((part) => DANGEROUS_EXTENSIONS.includes(`.${part}`));
    if (nested.length > 0) {
      errors.push('This file name contains an executable or archive extension and will not be processed.');
    }
  }

  if (file && file.size <= 0) errors.push('The selected file is empty.');
  if (file && file.size > limits.maxUploadBytes) {
    errors.push(`The file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is ${(limits.maxUploadBytes / (1024 * 1024)).toFixed(1)} MB.`);
  }
  if (file && file.size > 0 && file.size < 512) {
    warnings.push('This file is very small and probably contains little text.');
  }
  if (file?.type && !(limits.acceptedMimeTypes as readonly string[]).includes(file.type)) {
    warnings.push(`Your browser reported the type as "${file.type}", which is unusual for a resume. The file will still be checked on the server.`);
  }

  return {
    ok: errors.length === 0,
    kind: kindForExtension(extension),
    extension,
    errors,
    warnings,
  };
}

export function kindForExtension(extension: string): FileKind {
  if (extension === '.pdf') return 'pdf';
  if (extension === '.docx') return 'docx';
  if (extension === '.txt' || extension === '.md') return 'text';
  return 'unknown';
}

/** Inspects raw bytes - the only trustworthy way to identify an upload. */
export function detectFileKind(bytes: Uint8Array, fallback: FileKind = 'unknown'): FileKind {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) return 'docx';
  }
  if (bytes.length > 0) {
    const sample = bytes.subarray(0, Math.min(bytes.length, 1024));
    let printable = 0;
    for (const byte of sample) {
      if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127)) printable += 1;
    }
    if (printable / sample.length > 0.85) return 'text';
  }
  return fallback === 'docx' || fallback === 'pdf' ? fallback : 'unknown';
}
