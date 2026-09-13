import { ALL_SERIES, SERIES } from '@/theme/series';

/**
 * SVG pattern fills, one per series.
 *
 * The texture is the relief encoding for three cases colour cannot cover: a
 * reader who cannot separate two hues, a greyscale print, and Windows
 * forced-colors mode, which flattens every fill to one system colour. Angles
 * alternate 45° and 135° down the series order, so adjacent series differ in
 * direction as well as hue.
 *
 * Render once inside a Recharts chart as a child, then reference with
 * `fill={`url(#${SERIES.oa.pattern})`}`.
 */
export function ChartTextures() {
  return (
    <defs>
      {ALL_SERIES.map((key, index) => {
        const meta = SERIES[key];
        return (
          <pattern
            key={key}
            id={meta.pattern}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${index % 2 === 0 ? 45 : 135})`}
          >
            <rect width="6" height="6" fill={meta.soft} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={meta.color} strokeWidth="1.5" />
          </pattern>
        );
      })}
    </defs>
  );
}
