import { ClampedAnchor } from 'solid-timeline/types'

const isPreAnchor = (anchor: ClampedAnchor) => !!anchor?.pre
const isPostAnchor = (anchor: ClampedAnchor) => !!anchor?.post

export function binarySearchCurve(
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  targetX: number,
  tolerance = 0.001
): number | null {
  if (!isPostAnchor(startAnchor) && !isPreAnchor(endAnchor)) {
    return solveLinear(startAnchor, endAnchor, targetX)
  } else {
    if (isPostAnchor(startAnchor) && isPreAnchor(endAnchor)) {
      return binarySearchCubic(startAnchor, endAnchor, targetX, tolerance)
    } else {
      return binarySearchQuadratic(startAnchor, endAnchor, targetX, tolerance)
    }
  }
}

const solveLinear = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  targetX: number
): number | null => {
  const { position: start } = startAnchor
  const { position: end } = endAnchor

  const t = (targetX - start.x) / (end.x - start.x)

  if (t < 0 || t > 1) {
    // Target X is out of bounds
    return null
  }

  // Linear interpolation for Y
  return start.y + t * (end.y - start.y)
}

const binarySearchCubic = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  targetX: number,
  tolerance: number
): number | null => {
  return binarySearch(
    (t) => cubicBezier(startAnchor, endAnchor, 'x', t),
    (t) => cubicBezier(startAnchor, endAnchor, 'y', t),
    targetX,
    tolerance
  )
}

const binarySearchQuadratic = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  targetX: number,
  tolerance: number
): number | null => {
  return binarySearch(
    (t) => quadraticBezier(startAnchor, endAnchor, 'x', t),
    (t) => quadraticBezier(startAnchor, endAnchor, 'y', t),
    targetX,
    tolerance
  )
}

const cubicBezier = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  axis: 'x' | 'y',
  t: number
): number => {
  return (
    Math.pow(1 - t, 3) * startAnchor.position[axis] +
    3 * Math.pow(1 - t, 2) * t * startAnchor.post!.absolute.clamped[axis] +
    3 * (1 - t) * Math.pow(t, 2) * endAnchor.pre!.absolute.clamped[axis] +
    Math.pow(t, 3) * endAnchor.position[axis]
  )
}

const quadraticBezier = (
  startAnchor: ClampedAnchor,
  endAnchor: ClampedAnchor,
  axis: 'x' | 'y',
  t: number
): number => {
  const controlPoint =
    startAnchor.post?.absolute.clamped ?? endAnchor.pre!.absolute.clamped

  return (
    Math.pow(1 - t, 2) * startAnchor.position[axis] +
    2 * (1 - t) * t * controlPoint[axis] +
    Math.pow(t, 2) * endAnchor.position[axis]
  )
}

const binarySearch = (
  getX: (t: number) => number,
  getY: (t: number) => number,
  targetX: number,
  tolerance: number
): number | null => {
  let low = 0
  let high = 1

  let attempts = 0

  while (low <= high) {
    const mid = (low + high) / 2
    const midX = getX(mid)

    if (Math.abs(midX - targetX) < tolerance) {
      return getY(mid)
    }

    if (midX < targetX) {
      low = mid
    } else {
      high = mid
    }

    attempts++
  }

  // Target X not found within tolerance
  return null
}
