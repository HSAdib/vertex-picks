/**
 * sanitizeHTML — strip XSS vectors from an admin-entered HTML string.
 *
 * Allows safe formatting tags (<em>, <span>, <strong>, <b>, <i>, <br>)
 * while removing <script> blocks, event-handler attributes (onclick=, onload=, …),
 * and dangerous URL schemes (javascript:, data:).
 *
 * This is a lightweight defence-in-depth measure for Firestore-sourced content
 * rendered via dangerouslySetInnerHTML. It does NOT replace a full sanitiser
 * like DOMPurify for untrusted-user input, but is appropriate for admin-only
 * fields where the risk is a compromised admin account.
 */
export function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    // 1. Remove <script>…</script> blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // 2. Remove <style>…</style> blocks
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 3. Strip inline event handlers: onclick="…", onload='…', onerror=…, etc.
    .replace(/\s+on[a-z]{1,20}\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // 4. Replace javascript: and data: URL schemes with "#" to neutralise them
    .replace(/javascript\s*:/gi, '#')
    .replace(/data\s*:/gi, '#')
    // 5. Remove <iframe>, <object>, <embed>, <form> and similar dangerous tags
    .replace(/<\/?(iframe|object|embed|form|input|button|select|textarea|meta|link|base)[^>]*>/gi, '');
}
