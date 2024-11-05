import { createSignal } from 'solid-js'
import { defaultProps } from './utils/default-props'

export function createClock(options?: {
  time?: number
  max?: number
  min?: number
  speed?: number
}) {
  const config = defaultProps(options || {}, {
    time: 0,
    min: 0,
    speed: 1,
  })

  const [time, setTime] = createSignal(performance.now())

  let shouldLoop = true
  function loop() {
    if (!shouldLoop) return
    requestAnimationFrame(loop)
    if (config.max) {
      setTime(
        ((performance.now() * config.speed) % (config.max - config.min)) +
          config.min
      )
    } else {
      setTime(performance.now() * config.speed + config.min)
    }
  }

  return [
    time,
    {
      set: setTime,
      start: () => {
        shouldLoop = true
        loop()
      },
      stop: () => {
        shouldLoop = false
      },
    },
  ] as const
}
