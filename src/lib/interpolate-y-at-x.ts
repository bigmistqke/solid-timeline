import { Vector } from '../types'

export const interpolateYAtX = (point1: Vector, point2: Vector, x: number) => {
  const m = (point1.y - point2.y) / (point1.x - point2.x)
  const c = point1.y - m * point1.x
  return m * x + c
}
