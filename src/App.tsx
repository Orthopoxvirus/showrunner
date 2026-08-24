import { useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BacklogPage } from './admin/BacklogPage'
import { EventDetailPage } from './admin/EventDetailPage'
import { EventGamePage } from './admin/EventGamePage'
import { EventsPage } from './admin/EventsPage'
import { AdminLayout } from './admin/Layout'
import { DataFolderGate } from './components/DataFolderGate'
import { detectInitialBackend, getBackend, subscribeBackend, type InitialBackendState } from './lib/backend'
import { useStore } from './lib/store'
import { AudiencePage } from './show/AudiencePage'
import { ShowHostPage } from './show/ShowHostPage'

// The audience window renders from broadcast snapshots and never shows the
// folder gate — but it still adopts a backend silently when one is available
// (bridge server, or an already-authorized standalone folder), so game views
// can resolve media like images. Checked once at startup (own window).
const isAudienceWindow = window.location.hash.startsWith('#/audience')

export function App() {
  const { t } = useTranslation()
  const { loaded, error, load } = useStore()
  const [initial, setInitial] = useState<InitialBackendState | null>(null)
  const backend = useSyncExternalStore(subscribeBackend, getBackend)

  useEffect(() => {
    void detectInitialBackend().then((state) => {
      if (!isAudienceWindow) setInitial(state)
    })
  }, [])

  useEffect(() => {
    if (backend) void load()
  }, [backend, load])

  if (isAudienceWindow) return <AudiencePage />

  if (!backend) {
    if (initial?.state === 'gate') {
      return <DataFolderGate restorable={initial.restorable} supported={initial.supported} />
    }
    return <div className="empty" style={{ paddingTop: '30vh' }}>{t('app.loading')}</div>
  }

  if (!loaded) return <div className="empty" style={{ paddingTop: '30vh' }}>{t('app.loading')}</div>
  if (error)
    return (
      <div className="empty" style={{ paddingTop: '30vh' }}>
        {t('app.loadError', { error })}
      </div>
    )

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/audience" element={<AudiencePage />} />
        <Route path="/show/:eventId" element={<ShowHostPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<EventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/events/:eventId/games/:gameId" element={<EventGamePage />} />
          <Route path="/backlog/:gameType" element={<BacklogPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
