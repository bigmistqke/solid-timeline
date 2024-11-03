/**
 * dragHelper
 *
 * @param e MouseEvent
 * @param callback called every onMouseMove
 * @returns Promise resolved onMouseUp
 */
export const pointerHelper = (
  e: MouseEvent,
  callback?: (
    delta: {
      x: number
      y: number
    },
    e: MouseEvent,
    time: number
  ) => void
) => {
  return new Promise<{
    delta: {
      x: number
      y: number
    }
    event: MouseEvent
    time: number
  }>((resolve) => {
    const start = {
      x: e.clientX,
      y: e.clientY,
    }
    const startTime = performance.now()

    const onPointerMove = (e: MouseEvent) => {
      callback?.(
        {
          x: start.x - e.clientX,
          y: start.y - e.clientY,
        },
        e,
        performance.now() - startTime
      )
    }
    const onPointerUp = (e: MouseEvent) => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      const delta = {
        x: start.x - e.clientX,
        y: start.y - e.clientY,
      }
      callback?.(delta, e, performance.now() - startTime)
      resolve({ delta, event: e, time: performance.now() - startTime })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  })
}
