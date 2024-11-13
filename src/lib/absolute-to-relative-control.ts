import { Vector } from 'solid-timeline/types'

export function absoluteToRelativeControl({
  type,
  absoluteControl,
  position,
}: {
  type: 'pre' | 'post'
  absoluteControl: Vector
  position: Vector
}) {
  return {
    y: Math.floor(absoluteControl.y - position.y),
    x:
      type === 'pre'
        ? Math.max(0, Math.floor(position.x - absoluteControl.x))
        : Math.max(0, Math.floor(absoluteControl.x - position.x)),
  }
}
