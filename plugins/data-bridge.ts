/**
 * Vite plugin: local file bridge between the SPA and the `data/` folder.
 *
 * The app is fully offline; "no server" means no remote backend. This bridge
 * runs inside the local Vite process (dev AND preview) and maps a tiny REST
 * API onto plain JSON files, so everything the admin UI writes is an ordinary
 * file you can inspect, bulk-edit and `git commit`.
 *
 *   GET    /api/events                 -> all event JSONs
 *   PUT    /api/events/:id            <- write one event
 *   DELETE /api/events/:id
 *   GET    /api/backlog/:gameType      -> backlog JSON (empty default if new)
 *   PUT    /api/backlog/:gameType
 *   GET    /api/media/:gameType        -> list of media files for that game
 *   POST   /api/media/:gameType        <- raw file body + x-filename header
 *   GET    /data/media/...             -> static media serving
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json',
}

/**
 * Sanitize an upload filename instead of rejecting it: strip any path part,
 * replace control and Windows-reserved characters, forbid traversal, hidden
 * files and trailing dots/spaces. Apostrophes (' ’), umlauts, %, # … pass
 * through untouched. Returns null only when nothing usable remains.
 * Kept in sync with the FSA backend (src/lib/backend.ts).
 */
function safeName(raw: string): string | null {
  const base = (raw ?? '').split(/[/\\]/).pop() ?? ''
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[. ]+/, '')
    .replace(/[. ]+$/, '')
    .trim()
  return cleaned.length > 0 && cleaned.length <= 180 ? cleaned : null
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(data)
}

async function writeFileAtomic(file: string, content: Buffer | string) {
  const tmp = `${file}.tmp-${process.pid}`
  await fsp.writeFile(tmp, content)
  await fsp.rename(tmp, file)
}

/** `media/<type>/<file>` (pre-1.4 layout) → `games/<type>/media/<file>`. */
function migrateLegacyMediaPath(rel: string): string | null {
  const m = rel.match(/^media\/([\w-]+)\/(.+)$/)
  return m ? `games/${m[1]}/media/${m[2]}` : null
}

export function dataBridge(): Plugin {
  const dataDir = path.resolve(process.cwd(), 'data')
  const eventsDir = path.join(dataDir, 'events')
  const gamesDir = path.join(dataDir, 'games')

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const p = url.pathname

    try {
      // --- static media -----------------------------------------------------
      if (req.method === 'GET' && p.startsWith('/data/')) {
        let rel: string
        try {
          rel = decodeURIComponent(p.slice('/data/'.length))
        } catch {
          return sendJson(res, 400, { error: 'bad path encoding' })
        }
        if (rel.includes('..')) return sendJson(res, 400, { error: 'bad path' })
        let abs = path.join(dataDir, rel)
        if (!fs.existsSync(abs)) {
          // items saved before the per-game folder layout still resolve
          const migrated = migrateLegacyMediaPath(rel)
          if (migrated) abs = path.join(dataDir, migrated)
        }
        if (!abs.startsWith(dataDir) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          return sendJson(res, 404, { error: 'not found' })
        }
        const ext = path.extname(abs).toLowerCase()
        const stat = fs.statSync(abs)
        res.writeHead(200, {
          'content-type': MIME[ext] ?? 'application/octet-stream',
          'content-length': stat.size,
          'accept-ranges': 'none',
          'cache-control': 'no-cache',
        })
        fs.createReadStream(abs).pipe(res)
        return
      }

      if (!p.startsWith('/api/')) return next()

      // --- events -----------------------------------------------------------
      if (req.method === 'GET' && p === '/api/events') {
        await fsp.mkdir(eventsDir, { recursive: true })
        const files = (await fsp.readdir(eventsDir)).filter((f) => f.endsWith('.json'))
        const events = []
        for (const f of files) {
          try {
            events.push(JSON.parse(await fsp.readFile(path.join(eventsDir, f), 'utf8')))
          } catch {
            console.warn(`[data-bridge] skipping unparseable ${f}`)
          }
        }
        return sendJson(res, 200, events)
      }

      const evMatch = p.match(/^\/api\/events\/([\w-]+)$/)
      if (evMatch) {
        const file = path.join(eventsDir, `${evMatch[1]}.json`)
        if (req.method === 'PUT') {
          const body = await readBody(req)
          JSON.parse(body.toString('utf8')) // validate before writing
          await fsp.mkdir(eventsDir, { recursive: true })
          await writeFileAtomic(file, body)
          return sendJson(res, 200, { ok: true })
        }
        if (req.method === 'DELETE') {
          await fsp.rm(file, { force: true })
          return sendJson(res, 200, { ok: true })
        }
      }

      // --- backlogs ---------------------------------------------------------
      const blMatch = p.match(/^\/api\/backlog\/([\w-]+)$/)
      if (blMatch) {
        const gameType = blMatch[1]
        const file = path.join(gamesDir, gameType, 'backlog.json')
        if (req.method === 'GET') {
          if (!fs.existsSync(file)) return sendJson(res, 200, { gameType, items: [] })
          return sendJson(res, 200, JSON.parse(await fsp.readFile(file, 'utf8')))
        }
        if (req.method === 'PUT') {
          const body = await readBody(req)
          JSON.parse(body.toString('utf8'))
          await fsp.mkdir(path.dirname(file), { recursive: true })
          await writeFileAtomic(file, body)
          return sendJson(res, 200, { ok: true })
        }
      }

      // --- media (lives inside the game folder: data/games/<type>/media) ----
      const mediaMatch = p.match(/^\/api\/media\/([\w-]+)$/)
      if (mediaMatch) {
        const gameType = mediaMatch[1]
        const dir = path.join(gamesDir, gameType, 'media')
        if (req.method === 'GET') {
          if (!fs.existsSync(dir)) return sendJson(res, 200, [])
          const files = (await fsp.readdir(dir)).filter((f) => !f.startsWith('.'))
          return sendJson(
            res,
            200,
            files.map((f) => ({ name: f, path: `games/${gameType}/media/${f}` })),
          )
        }
        if (req.method === 'POST') {
          const rawName = decodeURIComponent((req.headers['x-filename'] as string) ?? '')
          const name = safeName(rawName)
          if (!name) return sendJson(res, 400, { error: `invalid filename: ${rawName}` })
          const body = await readBody(req)
          if (body.length === 0) return sendJson(res, 400, { error: 'empty body' })
          await fsp.mkdir(dir, { recursive: true })
          await writeFileAtomic(path.join(dir, name), body)
          return sendJson(res, 200, { name, path: `games/${gameType}/media/${name}` })
        }
      }

      return sendJson(res, 404, { error: `no route: ${req.method} ${p}` })
    } catch (err) {
      console.error('[data-bridge]', err)
      return sendJson(res, 500, { error: String(err) })
    }
  }

  return {
    name: 'showrunner-data-bridge',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
