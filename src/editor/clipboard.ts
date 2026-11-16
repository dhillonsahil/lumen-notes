/**
 * Sanitizes incoming pasted HTML to prevent script execution,
 * remote image downloading, or arbitrary style injection.
 */
export function sanitizePastedHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Strip dangerous and remote loading elements
  const disallowedTags = ['script', 'iframe', 'object', 'embed', 'form', 'style', 'base', 'link', 'meta'];
  disallowedTags.forEach((tag) => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach((el) => el.remove());
  });

  // Strip remote images automatically per security requirements
  // (Local attachments will be handled through managed attachment APIs)
  const images = doc.querySelectorAll('img');
  images.forEach((img) => {
    // Replace with alt text or remove
    const alt = img.getAttribute('alt');
    if (alt && alt.trim().length > 0) {
      img.replaceWith(doc.createTextNode(` [Image: ${alt.trim()}] `));
    } else {
      img.remove();
    }
  });

  // Strip javascript: and dangerous attributes
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    // Remove on* event handlers
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });

    // Check href attributes
    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href') || '';
      const trimmed = href.trim().toLowerCase();
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
        el.removeAttribute('href');
      }
    }
  });

  return doc.body.innerHTML;
}
