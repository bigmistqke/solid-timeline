import { Vector } from '#/types'

export const subtractVector = (
  point1: Vector,
  point2: Partial<Vector> | number
) =>
  typeof point2 === 'number'
    ? {
        x: point1.x - point2,
        y: point1.y - point2,
      }
    : {
        x: point1.x - (point2.x ?? 0),
        y: point1.y - (point2.y ?? 0),
      }
export const addVector = (point1: Vector, point2: Partial<Vector> | number) =>
  typeof point2 === 'number'
    ? {
        x: point1.x + point2,
        y: point1.y + point2,
      }
    : {
        x: point1.x + (point2.x ?? 0),
        y: point1.y + (point2.y ?? 0),
      }
export const divideVector = (
  point1: Vector,
  point2: Partial<Vector> | number
) =>
  typeof point2 === 'number'
    ? {
        x: point1.x / point2,
        y: point1.y / point2,
      }
    : {
        x: point1.x / (point2.x ?? 1),
        y: point1.y / (point2.y ?? 1),
      }
export const multiplyVector = (
  point1: Vector,
  point2: Partial<Vector> | number
) =>
  typeof point2 === 'number'
    ? {
        x: point1.x * point2,
        y: point1.y * point2,
      }
    : {
        x: point1.x * (point2.x ?? 1),
        y: point1.y * (point2.y ?? 1),
      }
