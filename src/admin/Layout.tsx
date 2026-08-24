import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { VolumeSlider } from '../components/VolumeSlider'
import { games } from '../games/registry'
import { setLanguage } from '../i18n'

export function AdminLayout() {
  const { t, i18n } = useTranslation()
  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-logo">
          <b>SHOWRUNNER</b>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {t('app.events')}
          </NavLink>
          <div className="nav-group">{t('app.backlogs')}</div>
          {Object.values(games).map((g) => (
            <NavLink
              key={g.type}
              to={`/backlog/${g.type}`}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {t(g.nameKey)}
            </NavLink>
          ))}
        </nav>
        <div className="side-footer">
          <VolumeSlider />
          <span>{t('app.language')}:</span>
          <button
            className="btn small"
            onClick={() => setLanguage(i18n.language.startsWith('de') ? 'en' : 'de')}
          >
            {i18n.language.startsWith('de') ? 'DE' : 'EN'}
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
