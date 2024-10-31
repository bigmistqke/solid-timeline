import { PostPoint, PrePoint, Vector } from '../types'

export const createCubicLookupMap = (
  [start, { post }]: PostPoint,
  [end, { pre }]: PrePoint,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    Math.pow(1 - t, 3) * start[type] +
    3 * Math.pow(1 - t, 2) * t * post[type] +
    3 * (1 - t) * Math.pow(t, 2) * pre[type] +
    Math.pow(t, 3) * end[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}
