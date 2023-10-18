type Vector = { x: number; y: number }

/**
 * dragHelper
 *
 * @param e MouseEvent
 * @param callback called every onMouseMove
 * @returns Promise resolved onMouseUp
 */
export const dragHelper = (
  e: MouseEvent,
  callback?: (delta: Vector, e: MouseEvent, time: number) => void
) => {
  return new Promise<{ delta: Vector; event: MouseEvent; time: number }>(
    (resolve) => {
      const start = {
        x: e.clientX,
        y: e.clientY,
      }
      const startTime = performance.now()

      const onMouseMove = (e: MouseEvent) => {
        callback?.(
          {
            x: start.x - e.clientX,
            y: start.y - e.clientY,
          },
          e,
          performance.now() - startTime
        )
      }
      const onMouseUp = (e: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        const delta = {
          x: start.x - e.clientX,
          y: start.y - e.clientY,
        }
        callback?.(delta, e, performance.now() - startTime)
        resolve({ delta, event: e, time: performance.now() - startTime })
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
  )
}
