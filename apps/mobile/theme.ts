export const brand = {
  graphite: '#1C1C1E',
  white: '#FFFFFF',
  teal: '#2DD4BF',
  canvas: '#F5F5F7',
  ring: '#3A3A3C',
  textSecondary: '#8E8E93',
  textBody: '#55555B',
  facet: ['#F2F2F4', '#E8E8EB', '#D9D9DC', '#D0D0D5', '#C6C6CB', '#B4B4BA', '#9E9EA5'],
} as const

export const colors = {
  background: brand.graphite,
  surface: '#2C2C2E',
  border: brand.ring,
  text: brand.white,
  textMuted: brand.textSecondary,
  accent: brand.teal,
  onAccent: brand.graphite,
  danger: '#FF6961',
} as const
