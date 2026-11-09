/**
 * Compare entity tags. Quotes and a weak-validator prefix are ignored.
 * CloudFront adds W/ when it compresses a response larger than 1000 bytes.
 */
export function etagsEqual(a: string, b: string): boolean {
  return etagToken(a) === etagToken(b);
}

function etagToken(value: string): string {
  return value.trim().replace(/^W\//i, '').replace(/"/g, '');
}
