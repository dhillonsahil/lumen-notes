import { describe, it, expect } from 'vitest';
import { sanitizePastedHtml } from './clipboard';

describe('clipboard sanitization', () => {
  it('strips script tags and inline handlers', () => {
    const malicious = '<p>Hello <script>alert("xss")</script><span onclick="steal()">world</span></p>';
    const cleaned = sanitizePastedHtml(malicious);
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('alert');
    expect(cleaned).not.toContain('onclick');
    expect(cleaned).toContain('Hello');
    expect(cleaned).toContain('world');
  });

  it('removes remote image tags and preserves alt text', () => {
    const htmlWithImages = '<p>Check this out <img src="https://example.com/tracker.png" alt="tracker" /> and <img src="http://example.com/pic.jpg" /></p>';
    const cleaned = sanitizePastedHtml(htmlWithImages);
    expect(cleaned).not.toContain('<img');
    expect(cleaned).not.toContain('https://example.com/tracker.png');
    expect(cleaned).toContain('[Image: tracker]');
  });

  it('strips unsafe link schemes like javascript: and file:', () => {
    const unsafeLinks = '<p><a href="javascript:void(0)">Bad Link</a> and <a href="https://example.com">Good Link</a></p>';
    const cleaned = sanitizePastedHtml(unsafeLinks);
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).toContain('href="https://example.com"');
  });
});
