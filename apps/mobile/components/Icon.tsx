import Svg, { Circle, Path, Rect } from 'react-native-svg'

export type IconName = 'globe' | 'globeOff' | 'arrowUp' | 'shield' | 'stop' | 'plus' | 'history' | 'trash' | 'close'

interface Props {
  name: IconName
  size?: number
  color: string
}

export default function Icon({ name, size = 20, color }: Props) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(name === 'globe' || name === 'globeOff') && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M3 12h18" {...stroke} />
          <Path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" {...stroke} />
          {name === 'globeOff' && <Path d="M4 4l16 16" {...stroke} />}
        </>
      )}
      {name === 'arrowUp' && (
        <>
          <Path d="M12 19V5" {...stroke} />
          <Path d="M5 12l7-7 7 7" {...stroke} />
        </>
      )}
      {name === 'shield' && <Path d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z" {...stroke} />}
      {name === 'stop' && <Rect x={7} y={7} width={10} height={10} rx={2} fill={color} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
      {name === 'history' && (
        <>
          <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" {...stroke} />
          <Path d="M3 3v5h5" {...stroke} />
          <Path d="M12 7v5l3 3" {...stroke} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16" {...stroke} />
          <Path d="M10 11v6M14 11v6" {...stroke} />
          <Path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" {...stroke} />
          <Path d="M9 7V4h6v3" {...stroke} />
        </>
      )}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...stroke} />}
    </Svg>
  )
}
