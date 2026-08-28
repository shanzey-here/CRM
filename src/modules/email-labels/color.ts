// Labels use a free-form color picker with modern relative luminance and
// tint calculations to guarantee high readability and sleek design across light and dark modes.

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized.split('').map((c) => c + c).join('')
  }
  const r = parseInt(normalized.slice(0, 2), 16) || 0
  const g = parseInt(normalized.slice(2, 4), 16) || 0
  const b = parseInt(normalized.slice(4, 6), 16) || 0
  return { r, g, b }
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  const { r, g, b } = hexToRgb(hex)
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const luminance = 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255)

  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export function getReadableTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const luminance = 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255)

  // On light surfaces, bright colors need darkening for optimal contrast
  if (luminance > 0.25) {
    const factor = Math.max(0.4, 1 - luminance * 0.7)
    const dr = Math.round(r * factor)
    const dg = Math.round(g * factor)
    const db = Math.round(b * factor)
    return `rgb(${dr}, ${dg}, ${db})`
  }
  return hex
}
