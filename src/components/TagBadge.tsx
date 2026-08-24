import type { CSSProperties } from 'react'

/** Extra color class for the ♂/♀ gender tags; empty for normal tags. */
export function genderClass(tag: string): string {
  return tag === '♂' ? ' tag-m' : tag === '♀' ? ' tag-f' : ''
}

/** Deterministic hue (0–359) from the tag text, so each category always gets the same color. */
function tagHue(tag: string): number {
  let h = 2166136261
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h % 360
}

/** Auto color for free-text tags (categories); null for ♂/♀, which keep their fixed classes. */
export function tagStyle(tag: string): CSSProperties | null {
  if (genderClass(tag)) return null
  const hue = tagHue(tag)
  return {
    color: `hsl(${hue} 85% 70%)`,
    background: `hsl(${hue} 85% 70% / 0.14)`,
  }
}

/** Border color matching tagStyle, for active filter chips. */
export function tagBorder(tag: string): string {
  return `hsl(${tagHue(tag)} 85% 70% / 0.5)`
}

/** Item tag as a small badge; ♂/♀ are color-coded (blue/pink), categories get an auto color. */
export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className={`badge dim${genderClass(tag)}`} style={tagStyle(tag) ?? undefined}>
      {tag}
    </span>
  )
}
