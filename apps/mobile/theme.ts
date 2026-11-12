// Burrowl AI brand palette (see proje_yeni_markarengi).
// 90% graphite, white and greys; amber is the single accent, used sparingly.
export const brand = {
  graphite: '#1C1C1E',
  white: '#FFFFFF',
  amber: '#F6C21A',
  canvas: '#F5F5F7',
  ring: '#3A3A3C',
  textSecondary: '#8E8E93',
  textBody: '#55555B',
  facet: ['#F2F2F4', '#E8E8EB', '#D9D9DC', '#D0D0D5', '#C6C6CB', '#B4B4BA', '#9E9EA5'],
} as const

// Semantic roles used by the UI. Dark theme is the default.
export const colors = {
  background: brand.graphite,
  surface: '#2C2C2E',
  border: brand.ring,
  text: brand.white,
  textMuted: brand.textSecondary,
  // Amber marks what leaves the device (the search query) and the "AI" wordmark.
  accent: brand.amber,
  onAccent: brand.graphite,
  danger: '#FF6961',
} as const
