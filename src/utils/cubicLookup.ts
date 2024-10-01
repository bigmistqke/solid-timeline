import { Vector } from '../types'

export const createCubicLookupMap = (
  start: { position: Vector; handle2: Vector },
  end: { position: Vector; handle1: Vector },
  amount = 60
) => {
  const x0 = start.position.x
  const y0 = start.position.y

  const x1 = start.handle2.x
  const y1 = start.handle2.y

  const x2 = end.handle1.x
  const y2 = end.handle1.y

  const x3 = end.position.x
  const y3 = end.position.y

  const y = (t: number) =>
    Math.pow(1 - t, 3) * y0 +
    3 * Math.pow(1 - t, 2) * t * y1 +
    3 * (1 - t) * Math.pow(t, 2) * y2 +
    Math.pow(t, 3) * y3

  const x = (t: number) =>
    Math.pow(1 - t, 3) * x0 +
    3 * Math.pow(1 - t, 2) * t * x1 +
    3 * (1 - t) * Math.pow(t, 2) * x2 +
    Math.pow(t, 3) * x3

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = x(t / amount)
    const valY = y(t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}
