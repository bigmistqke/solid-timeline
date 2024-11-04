interface Vector {
  x: number
  y: number
}

/**
 * dragHelper
 *
 * @param e MouseEvent
 * @param callback called every onMouseMove
 * @returns Promise resolved onMouseUp
 */
export const pointerHelper = (
  e: MouseEvent,
  callback?: (event: {
    delta: Vector
    movement: Vector
    event: MouseEvent
    time: number
  }) => void
) => {
  return new Promise<{
    delta: Vector
    movement: Vector
    event: MouseEvent
    time: number
  }>((resolve) => {
    const start = {
      x: e.clientX,
      y: e.clientY,
    }
    const startTime = performance.now()
    let previousDelta = {
      x: 0,
      y: 0,
    }

    function getDataFromMouseEvent(event: MouseEvent) {
      const delta = {
        x: start.x - event.clientX,
        y: start.y - event.clientY,
      }
      const movement = {
        x: delta.x - previousDelta.x,
        y: delta.y - previousDelta.y,
      }
      previousDelta = delta
      return {
        delta: {
          x: start.x - event.clientX,
          y: start.y - event.clientY,
        },
        movement,
        event,
        time: performance.now() - startTime,
      }
    }

    const onPointerMove = (event: MouseEvent) => {
      callback?.(getDataFromMouseEvent(event))
    }

    const onPointerUp = (event: MouseEvent) => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      const data = getDataFromMouseEvent(event)
      callback?.(data)
      resolve(data)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  })
}
