import React from 'react';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

type Variant = 'dark' | 'mono' | 'light';
type Shape = 'circle' | 'squircle' | 'none';

type Props = {
  size?: number;
  variant?: Variant;
  shape?: Shape;
};

const DARK = {
  bg: '#1C1C1E', ring: '#3A3A3C',
  f1: '#FFFFFF', f2: '#D9D9DC', f3: '#E8E8EB', f4: '#B4B4BA',
  f5: '#C6C6CB', f6: '#F2F2F4', f7: '#9E9EA5', f8: '#D0D0D5',
  eye: '#1C1C1E', key: '#2DD4BF', beak: '#1C1C1E',
};

const PALETTES: Record<Variant, typeof DARK> = {
  dark: DARK,
  mono: { ...DARK, key: '#FFFFFF' },
  light: {
    bg: '#F2F2F4', ring: '#D6D6DA',
    f1: '#1C1C1E', f2: '#3A3A3F', f3: '#2A2A2E', f4: '#55555C',
    f5: '#45454B', f6: '#232327', f7: '#67676E', f8: '#4A4A51',
    eye: '#F2F2F4', key: '#1C1C1E', beak: '#F2F2F4',
  },
};

const FACETS: [string, keyof typeof DARK][] = [
  ['50,24 30,30 50,46', 'f1'],
  ['30,30 22,40 50,46', 'f2'],
  ['50,24 70,30 50,46', 'f3'],
  ['70,30 78,40 50,46', 'f4'],
  ['22,40 25,63 50,46', 'f5'],
  ['25,63 50,80 50,46', 'f6'],
  ['78,40 75,63 50,46', 'f7'],
  ['75,63 50,80 50,46', 'f8'],
];

function Eye({ cx, c }: { cx: number; c: typeof DARK }) {
  const hex = [
    [cx, 44.5], [cx + 7.36, 48.75], [cx + 7.36, 57.25],
    [cx, 61.5], [cx - 7.36, 57.25], [cx - 7.36, 48.75],
  ].map((p) => p.join(',')).join(' ');
  return (
    <G>
      <Polygon points={hex} fill={c.eye} />
      <Circle cx={cx} cy={51.4} r={2.6} fill={c.key} />
      <Path d={`M${cx - 1.4} 52.4 L${cx + 1.4} 52.4 L${cx + 2.2} 57 L${cx - 2.2} 57 Z`} fill={c.key} />
    </G>
  );
}

export default function BurrowlLogo({ size = 64, variant = 'dark', shape = 'circle' }: Props) {
  const c = PALETTES[variant];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Burrowl AI">
      {shape === 'circle' && (
        <>
          <Circle cx={50} cy={50} r={50} fill={c.bg} />
          <Circle cx={50} cy={50} r={47.2} fill="none" stroke={c.ring} strokeWidth={1.6} />
        </>
      )}
      {shape === 'squircle' && <Rect width={100} height={100} rx={22.4} fill={c.bg} />}
      {FACETS.map(([pts, k]) => (
        <Polygon key={pts} points={pts} fill={c[k]} />
      ))}
      <Eye cx={37} c={c} />
      <Eye cx={63} c={c} />
      <Polygon points="47.5,60.5 52.5,60.5 50,67.5" fill={c.beak} />
    </Svg>
  );
}
