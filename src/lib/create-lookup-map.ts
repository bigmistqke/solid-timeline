import { ProcessedAnchor, Vector } from 'solid-timeline/types'

const isPreAnchor = (anchor: ProcessedAnchor) => !!anchor[1]?.pre
const isPostAnchor = (point: ProcessedAnchor) => !!point[1]?.post

export function createLookupMap(
  start: ProcessedAnchor,
  end: ProcessedAnchor,
  amount = 30
) {
  if (isPostAnchor(start) && isPreAnchor(end)) {
    return createCubicLookupMap(start, end, amount)
  } else if (!isPostAnchor(start) && !isPreAnchor(end)) {
    return [start[0], end[0]]
  } else {
    return createQuadraticLookupMap(start, end, amount)
  }
}

export const createCubicLookupMap = (
  [start, { post }]: ProcessedAnchor,
  [end, { pre }]: ProcessedAnchor,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    Math.pow(1 - t, 3) * start[type] +
    3 * Math.pow(1 - t, 2) * t * post!.clamped[type] +
    3 * (1 - t) * Math.pow(t, 2) * pre!.clamped[type] +
    Math.pow(t, 3) * end[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}

const createQuadraticLookupMap = (
  [start, { post }]: ProcessedAnchor,
  [end, { pre }]: ProcessedAnchor,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    Math.pow(1 - t, 2) * start[type] +
    2 * (1 - t) * t * (post ? post!.clamped[type] : pre!.clamped[type]) + // Use post if available, otherwise pre
    Math.pow(t, 2) * end[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}
