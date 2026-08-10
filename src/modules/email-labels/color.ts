// Labels use a free-form color picker (an explicit, scoped exception to the
// locked design system — see AGENTS.md), so we can no longer assume dark
// text always reads legibly. Standard relative-luminance formula.
export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const luminance = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

  return luminance > 0.5 ? '#000000' : '#ffffff'
}
