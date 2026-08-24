import { useEffect, useRef, useState } from 'react'
import { audio } from '../lib/audio'

interface Props {
  /** Absolute epoch-ms deadline; null renders the full ring, idle. */
  deadline: number | null
  totalSec: number
  /** Host window plays tick/time-up cues; the audience stays silent. */
  withSound?: boolean
  size?: number
}

export function Countdown({ deadline, totalSec, withSound = false, size }: Props) {
  const [remaining, setRemaining] = useState(totalSec)
  const lastWholeRef = useRef<number>(-1)

  useEffect(() => {
    if (deadline === null) {
      setRemaining(totalSec)
      return
    }
    let raf = 0
    const loop = () => {
      const rem = Math.max(0, (deadline - Date.now()) / 1000)
      setRemaining(rem)
      const whole = Math.ceil(rem)
      if (withSound && whole !== lastWholeRef.current) {
        if (lastWholeRef.current !== -1) audio.cue(whole === 0 ? 'timeup' : 'tick')
        lastWholeRef.current = whole
      }
      if (rem > 0) raf = requestAnimationFrame(loop)
    }
    lastWholeRef.current = -1
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [deadline, totalSec, withSound])

  // The ring visualizes the CURRENT second: it wraps around once per second
  // (full at each new second, draining to empty), for every second alike.
  const within = remaining > 0 ? remaining - Math.floor(remaining) : 0
  const frac = deadline === null ? 1 : remaining > 0 && within === 0 ? 1 : within
  const R = 46
  const circ = 2 * Math.PI * R
  const urgent = deadline !== null && remaining <= 1 && remaining > 0
  const style = size ? { width: size, height: size } : undefined

  return (
    <div className={`countdown${urgent || remaining === 0 ? ' urgent' : ''}`} style={style}>
      <svg viewBox="0 0 100 100">
        <circle className="track" cx="50" cy="50" r={R} strokeWidth="6" />
        <circle
          className="arc"
          cx="50"
          cy="50"
          r={R}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
        />
      </svg>
      <div className="num">{Math.ceil(remaining)}</div>
    </div>
  )
}
