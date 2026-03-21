import { marked } from "marked";
import DOMPurify from "dompurify";

const DEFAULT_MARKED_OPTIONS = {
  gfm: true,
  breaks: true,
};

const DEFAULT_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
};

export function markdownToHtml(markdown, options = {}) {
  const source = String(markdown ?? "");
  const markedOptions = {
    ...DEFAULT_MARKED_OPTIONS,
    ...(options.markedOptions || {}),
  };
  const sanitizeOptions = {
    ...DEFAULT_SANITIZE_OPTIONS,
    ...(options.sanitizeOptions || {}),
  };

  const unsafeHtml = marked.parse(source, markedOptions);
  return DOMPurify.sanitize(unsafeHtml, sanitizeOptions);
}
