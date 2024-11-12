import { ClampedAnchor, Vector } from 'solid-timeline/types'

const isPreAnchor = (anchor: ClampedAnchor) => !!anchor?.pre
const isPostAnchor = (point: ClampedAnchor) => !!point?.post

export function createLookupMap(
  start: ClampedAnchor,
  end: ClampedAnchor,
  amount = 30
) {
  if (isPostAnchor(start) && isPreAnchor(end)) {
    return createCubicLookupMap(start, end, amount)
  } else if (!isPostAnchor(start) && !isPreAnchor(end)) {
    return [start.position, end.position]
  } else {
    return createQuadraticLookupMap(start, end, amount)
  }
}

export const createCubicLookupMap = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    Math.pow(1 - t, 3) * startAnchor.position[type] +
    3 * Math.pow(1 - t, 2) * t * startAnchor.post!.absolute.clamped[type] +
    3 * (1 - t) * Math.pow(t, 2) * endAnchor.pre!.absolute.clamped[type] +
    Math.pow(t, 3) * endAnchor.position[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}

const createQuadraticLookupMap = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  amount = 60
): Array<Vector> => {
  const step = (type: 'x' | 'y', t: number) =>
    Math.pow(1 - t, 2) * startAnchor.position[type] +
    2 *
      (1 - t) *
      t *
      (startAnchor.post
        ? startAnchor.post!.absolute.clamped[type]
        : endAnchor.pre!.absolute.clamped[type]) + // Use post if available, otherwise pre
    Math.pow(t, 2) * endAnchor.position[type]

  const res = []

  for (let t = 0; t <= amount; t++) {
    const valX = step('x', t / amount)
    const valY = step('y', t / amount)
    res.push({ x: valX, y: valY })
  }

  return res
}
