import { createSignal } from 'solid-js'
import { defaultProps } from './utils/props'

export function createClock(options?: {
  time?: number
  max?: number
  min?: number
  speed?: number
  autostart?: boolean
}) {
  const config = defaultProps(options || {}, {
    time: 0,
    min: 0,
    speed: 1,
  })

  const [time, setTime] = createSignal(performance.now())

  let shouldLoop = true
  let previous: number = 0
  function loop(now: number) {
    let delta = now - previous
    previous = now
    if (!shouldLoop) return
    requestAnimationFrame(loop)
    if (!delta) return

    setTime((time) => {
      let newTime = time + delta * config.speed

      if (config.max) {
        let range = config.max - config.min
        // Adjust for negative values by ensuring newTime is within the range
        newTime =
          ((((newTime - config.min) % range) + range) % range) + config.min
      } else {
        newTime += config.min
      }

      return newTime
    })
  }

  const clock = {
    set: setTime,
    start: () => {
      previous = performance.now()
      shouldLoop = true
      loop(performance.now())
    },
    stop: () => {
      shouldLoop = false
    },
  }

  if (options?.autostart) {
    clock.start()
  }

  return [time, clock] as const
}
