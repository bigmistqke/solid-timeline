import {
  Anchor,
  PostAnchor,
  PreAnchor,
  QuadraticBezierAnchor,
  Vector,
} from 'solid-timeline/types'

const isPreAnchor = (anchor: Anchor): anchor is PreAnchor => !!anchor[1]?.pre
const isPostAnchor = (point: Anchor): point is PostAnchor => !!point[1]?.post

export function createLookupMap(start: Anchor, end: Anchor, amount = 30) {
  if (isPostAnchor(start) && isPreAnchor(end)) {
    return createCubicLookupMap(start, end, amount)
  } else if (!isPostAnchor(start) && !isPreAnchor(end)) {
    return createLinearLookupMap(start, end, amount)
  } else {
    return createQuadraticLookupMap(
      start as QuadraticBezierAnchor,
      end as QuadraticBezierAnchor,
      amount
    )
  }
}

export const createCubicLookupMap = (
  [start, { post }]: PostAnchor,
  [end, { pre }]: PreAnchor,
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

const createLinearLookupMap = (
  [start]: Anchor,
  [end]: Anchor,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    (1 - t) * start[type] + t * end[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}

const createQuadraticLookupMap = (
  [start, { post }]: QuadraticBezierAnchor,
  [end, { pre }]: QuadraticBezierAnchor,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    Math.pow(1 - t, 2) * start[type] +
    2 * (1 - t) * t * (post ? post[type] : pre![type]) + // Use post if available, otherwise pre
    Math.pow(t, 2) * end[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}
