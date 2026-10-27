import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { detectFileKind, kindForExtension, LIMITS, normalizeWhitespace, extensionOf, type FileKind } from '@careerlens/core';
import { AppError } from '../middleware/errors';

export interface ParsedUpload {
  text: string;
  kind: FileKind;
  fileName: string;
  bytes: number;
  warnings: string[];
}

/**
 * Removes directory components and control characters from a client-supplied
 * file name. Nothing is ever written to disk, but a hostile name must not be
 * able to influence anything downstream either.
 */
export function sanitizeFileName(raw: string): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return cleaned || 'resume-upload';
}

function ensureNotBinary(buffer: Buffer): void {
  const sample = buffer.subarray(0, 1024);
  let nulls = 0;
  for (const byte of sample) if (byte === 0) nulls += 1;
  if (sample.length > 0 && nulls / sample.length > 0.1) {
    throw new AppError(415, 'This file looks like a binary document. Accepted formats are PDF, DOCX, TXT and MD.', 'unsupported_media_type');
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    return normalizeWhitespace(result?.text ?? '');
  } catch (error) {
    // Logged without any document content so the failure can be diagnosed.
    console.warn(`[api] PDF extraction failed: ${(error as Error)?.message ?? 'unknown parser error'}`);
    throw new AppError(
      422,
      'The PDF could not be read. It may be corrupted, password protected, or an image-only scan without a text layer. This build does not perform OCR - paste the text into the resume box instead.',
      'pdf_unreadable',
    );
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result?.value ?? '');
  } catch (error) {
    console.warn(`[api] DOCX extraction failed: ${(error as Error)?.message ?? 'unknown parser error'}`);
    throw new AppError(422, 'The DOCX file could not be read. Try re-saving it as .docx or .txt, or paste the text instead.', 'docx_unreadable');
  }
}

/**
 * Validates an uploaded resume server-side and converts it to plain text.
 * The signature is inspected because a file name or MIME type cannot be trusted.
 */
export async function extractResumeText(buffer: Buffer, fileNameHeader: string): Promise<ParsedUpload> {
  const warnings: string[] = [];
  const fileName = sanitizeFileName(fileNameHeader);
  const extension = extensionOf(fileName);
  const accepted = LIMITS.acceptedExtensions as readonly string[];

  if (!accepted.includes(extension)) {
    throw new AppError(415, `Unsupported file type "${extension || 'unknown'}". Accepted formats: ${accepted.join(', ')}.`, 'unsupported_media_type');
  }
  if (buffer.length === 0) {
    throw new AppError(400, 'The uploaded file was empty.', 'empty_upload');
  }
  if (buffer.length > LIMITS.maxUploadBytes) {
    throw new AppError(413, `The file exceeds the ${Math.round(LIMITS.maxUploadBytes / (1024 * 1024))} MB upload limit.`, 'payload_too_large');
  }

  const declaredKind = kindForExtension(extension);
  const detected = detectFileKind(buffer, declaredKind);
  if (declaredKind !== 'text' && detected !== declaredKind) {
    throw new AppError(
      415,
      'The file content does not match its extension, so it was rejected. Rename the file correctly or convert it to PDF/DOCX/TXT.',
      'signature_mismatch',
    );
  }

  let text: string;
  if (detected === 'pdf') {
    text = await extractPdf(buffer);
  } else if (detected === 'docx') {
    text = await extractDocx(buffer);
  } else {
    ensureNotBinary(buffer);
    text = normalizeWhitespace(buffer.toString('utf8').replace(/^\ufeff/, ''));
  }

  if (text.length < LIMITS.minExtractedCharacters) {
    warnings.push(
      `Only ${text.length} characters of text were found. If this is a scanned or image-only document the text layer is missing, and this build does not implement OCR.`,
    );
  }
  if (detected === 'pdf') {
    warnings.push('PDF text is extracted without preserving layout, so columns and tables can be reordered.');
  }

  return { text, kind: detected, fileName, bytes: buffer.length, warnings };
}

/** Text pasted directly by the user, used by the same analysis pipeline. */
export function fromPastedText(text: string, fileName: string): ParsedUpload {
  const cleaned = normalizeWhitespace(text);
  if (cleaned.length < 20) {
    throw new AppError(400, 'The pasted text is too short to analyse.', 'text_too_short');
  }
  return {
    text: cleaned,
    kind: 'text',
    fileName: sanitizeFileName(fileName || 'pasted-resume.txt'),
    bytes: Buffer.byteLength(cleaned, 'utf8'),
    warnings: ['Text was provided directly, so no file parsing was performed.'],
  };
}
