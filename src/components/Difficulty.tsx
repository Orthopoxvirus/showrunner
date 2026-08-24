import { useTranslation } from 'react-i18next'
import type { Difficulty } from '../lib/types'

const LEVELS = [1, 2, 3] as const

/** Compact 3-dot difficulty indicator; renders nothing while unrated. */
export function DifficultyDots({ level }: { level?: Difficulty }) {
  const { t } = useTranslation()
  if (!level) return null
  return (
    <span className={`diff-dots diff-${level}`} title={t(`common.diff${level}`)}>
      {LEVELS.map((n) => (
        <i key={n} className={n <= level ? 'on' : ''} />
      ))}
    </span>
  )
}

/** Three-pill selector; clicking the active level clears the rating. */
export function DifficultyPicker({
  value,
  onChange,
}: {
  value?: Difficulty
  onChange(value: Difficulty | undefined): void
}) {
  const { t } = useTranslation()
  return (
    <div className="diff-picker">
      <span>{t('common.difficulty')}:</span>
      {LEVELS.map((n) => (
        <button
          key={n}
          className={`btn small diff-btn diff-${n}${value === n ? ' on' : ''}`}
          onClick={() => onChange(value === n ? undefined : n)}
        >
          {t(`common.diff${n}`)}
        </button>
      ))}
    </div>
  )
}
