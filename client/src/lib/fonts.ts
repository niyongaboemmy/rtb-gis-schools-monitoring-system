/**
 * Font stacks for text drawn outside CSS (canvas labels, inline styles).
 * Canvas text can't read CSS variables, so these mirror
 * `--font-family-primary` / `--font-family-mono` in styles/typography.css —
 * keep them in step.
 */
export const FONT_SANS = `"Google Sans Flex Variable", "Google Sans Flex", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
export const FONT_MONO = `"Maple Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
