import { Vector } from '../types'

export const addVectors = (point1: Vector, point2: Vector) => ({
  x: point1.x + point2.x,
  y: point1.y + point2.y,
})
