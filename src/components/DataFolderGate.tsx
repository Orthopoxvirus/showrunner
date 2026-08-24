import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pickDataFolder, restoreDataFolder } from '../lib/backend'

interface Props {
  restorable: boolean
  supported: boolean
}

/**
 * Standalone-mode entry: the app runs without a local process, so the user
 * grants access to the data/ folder once (File System Access API, Chromium).
 */
export function DataFolderGate({ restorable, supported }: Props) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  return (
    <div className="stage-center" style={{ minHeight: '100vh' }}>
      <div className="stage-kicker">{t('app.title')}</div>
      <div className="card" style={{ maxWidth: 520, textAlign: 'left' }}>
        <h2 style={{ textTransform: 'none', letterSpacing: 0, fontSize: 18, color: 'var(--text)' }}>
          {t('standalone.title')}
        </h2>
        {supported ? (
          <>
            <p className="hint" style={{ fontSize: 14 }}>
              {t('standalone.explain')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {restorable && (
                <button
                  className="btn primary"
                  onClick={async () => setFailed(!(await restoreDataFolder()))}
                >
                  ↻ {t('standalone.restore')}
                </button>
              )}
              <button
                className={`btn${restorable ? '' : ' primary'}`}
                onClick={async () => setFailed(!(await pickDataFolder()))}
              >
                📁 {t('standalone.pick')}
              </button>
            </div>
            {failed && (
              <p className="hint" style={{ color: 'var(--red)', marginTop: 12, marginBottom: 0 }}>
                {t('standalone.denied')}
              </p>
            )}
          </>
        ) : (
          <p className="hint" style={{ fontSize: 14, marginBottom: 0 }}>
            {t('standalone.unsupported')}
          </p>
        )}
      </div>
    </div>
  )
}
