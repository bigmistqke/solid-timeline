import { Vector } from '../types'

export const vector = {
  subtract: (point1: Vector, point2: Vector) => ({
    x: point1.x - point2.x,
    y: point1.y - point2.y,
  }),
  add: (point1: Vector, point2: Vector) => ({
    x: point1.x + point2.x,
    y: point1.y + point2.y,
  }),
  divide: (point1: Vector, point2: Vector) => ({
    x: point1.x / point2.x,
    y: point1.y / point2.y,
  }),
  multiply: (point1: Vector, point2: Vector) => ({
    x: point1.x * point2.x,
    y: point1.y * point2.y,
  }),
}
