/**
 * mammoth ships without type definitions. Only the functions this project uses
 * are declared, so calls stay type-checked without an `any` escape hatch.
 */
declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
  export function convertToHtml(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
}
