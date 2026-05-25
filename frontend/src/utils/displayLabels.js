/**
 * Remove GSMA branding from app/form labels shown in the UI.
 */
export function withoutGsmaLabel(text) {
  if (text == null || typeof text !== 'string') return '';
  return text
    .replace(/\bGSMA\s+/gi, '')
    .replace(/\s+at\s+GSMA\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
