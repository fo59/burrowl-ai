import Svg, { Circle, Path } from 'react-native-svg'

export type IconName = 'globe' | 'arrowUp' | 'shield'

interface Props {
  name: IconName
  size?: number
  color: string
}

// A few line icons drawn with react-native-svg, so no icon font dependency is needed.
export default function Icon({ name, size = 20, color }: Props) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'globe' && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M3 12h18" {...stroke} />
          <Path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" {...stroke} />
        </>
      )}
      {name === 'arrowUp' && (
        <>
          <Path d="M12 19V5" {...stroke} />
          <Path d="M5 12l7-7 7 7" {...stroke} />
        </>
      )}
      {name === 'shield' && (
        <Path d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z" {...stroke} />
      )}
    </Svg>
  )
}
