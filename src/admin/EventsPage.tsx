import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../lib/store'

export function EventsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { events, createEvent, deleteEvent } = useStore()
  const [name, setName] = useState('')

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const event = createEvent(trimmed)
    setName('')
    navigate(`/events/${event.id}`)
  }

  return (
    <>
      <div className="page-head">
        <h1>{t('events.title')}</h1>
        <div className="spacer" />
        <input
          type="text"
          placeholder={t('events.newPlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn primary" onClick={create} disabled={!name.trim()}>
          + {t('common.create')}
        </button>
      </div>

      {events.length === 0 && <div className="empty">{t('events.empty')}</div>}

      <div className="row-list">
        {events.map((ev) => (
          <div key={ev.id} className="row clickable" onClick={() => navigate(`/events/${ev.id}`)}>
            <div className="grow">
              <div className="title">{ev.name}</div>
              <div className="sub">
                {ev.date} · {t('events.gamesCount', { count: ev.games.length })} ·{' '}
                {ev.players.map((p) => p.name).join(', ') || t('common.none')}
              </div>
            </div>
            <button
              className="btn small danger"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`${t('common.confirmDelete')} (${ev.name})`)) deleteEvent(ev.id)
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
