/**
 * Input sanitization for user-submitted strings.
 * Defence against stored XSS — all user text is stripped of HTML
 * and validated against a strict character allowlist.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const ALLOWED_CHARS_RE = /^[a-zA-Z0-9\s\-,.'&()/!@£€:;]+$/;

/**
 * Strip HTML tags, trim whitespace, enforce max length.
 */
export function sanitize(input: string, maxLength: number): string {
  return input.replace(HTML_TAG_RE, "").trim().slice(0, maxLength);
}

/**
 * Returns true if the string contains only safe characters.
 */
export function isSafeText(input: string): boolean {
  return ALLOWED_CHARS_RE.test(input);
}

/**
 * Sanitize and validate — returns null if input contains unsafe characters.
 */
export function sanitizeOrReject(
  input: string,
  maxLength: number
): string | null {
  const clean = sanitize(input, maxLength);
  if (!clean) return null;
  if (!isSafeText(clean)) return null;
  return clean;
}

/**
 * Validate a Strava route URL strictly.
 */
const STRAVA_URL_RE = /^https:\/\/www\.strava\.com\/routes\/\d+$/;

export function isValidStravaUrl(url: string): boolean {
  return STRAVA_URL_RE.test(url);
}
