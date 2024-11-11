import { Vector } from 'solid-timeline/types'

export function subtractVector(
  vector1: Vector,
  vector2: Partial<Vector> | number
) {
  return typeof vector2 === 'number'
    ? {
        x: vector1.x - vector2,
        y: vector1.y - vector2,
      }
    : {
        x: vector1.x - (vector2.x ?? 0),
        y: vector1.y - (vector2.y ?? 0),
      }
}
export function addVector(vector1: Vector, vector2: Partial<Vector> | number) {
  return typeof vector2 === 'number'
    ? {
        x: vector1.x + vector2,
        y: vector1.y + vector2,
      }
    : {
        x: vector1.x + (vector2.x ?? 0),
        y: vector1.y + (vector2.y ?? 0),
      }
}
export function divideVector(
  vector1: Vector,
  vector2: Partial<Vector> | number
) {
  return typeof vector2 === 'number'
    ? {
        x: vector1.x / vector2,
        y: vector1.y / vector2,
      }
    : {
        x: vector1.x / (vector2.x ?? 1),
        y: vector1.y / (vector2.y ?? 1),
      }
}
export function multiplyVector(
  vector1: Vector,
  vector2: Partial<Vector> | number
) {
  return typeof vector2 === 'number'
    ? {
        x: vector1.x * vector2,
        y: vector1.y * vector2,
      }
    : {
        x: vector1.x * (vector2.x ?? 1),
        y: vector1.y * (vector2.y ?? 1),
      }
}
export function lengthVector(vector: Vector) {
  return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2))
}
