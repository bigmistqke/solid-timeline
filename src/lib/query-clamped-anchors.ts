import { ClampedAnchor, Vector } from 'solid-timeline/types'

/**********************************************************************************/
/*                                                                                */
/*                 Root-finding Algorithm using Cardano's Formula                 */
/*                                                                                */
/**********************************************************************************/

// Interpolated from stackoverflow: https://stackoverflow.com/a/51883347
// Ported to typescript and added more readable variable-names with chatgpt

/**
 * Checks if two numbers are approximately equal, accounting for floating-point imprecision.
 */
const approximately = (a: number, b: number, epsilon = 1e-16): boolean =>
  Math.abs(a - b) < epsilon

/**
 * Determines the interpolation type based on the anchors and computes the corresponding y value for a given x.
 */
export function queryClampedAnchors(
  anchor1: ClampedAnchor,
  anchor2: ClampedAnchor,
  x: number
): number | null {
  if (!anchor1.post && !anchor2.pre) {
    // Linear interpolation
    return linearInterpolation(anchor1, anchor2, x)
  } else if (anchor1.post && anchor2.pre) {
    // Cubic Bézier interpolation
    return cubicInterpolation(
      anchor1.position,
      anchor1.post.absolute.clamped,
      anchor2.pre.absolute.clamped,
      anchor2.position,
      x
    )
  } else {
    // Quadratic Bézier interpolation
    return quadraticInterpolation(
      anchor1.position,
      (anchor1.post || anchor2.pre)!.absolute.clamped,
      anchor2.position,
      x
    )
  }

  return null
}

/**
 * Linear interpolation between two points.
 */
function linearInterpolation(
  { position: start }: ClampedAnchor,
  { position: end }: ClampedAnchor,
  x: number
): number {
  return start.y + ((x - start.x) / (end.x - start.x)) * (end.y - start.y)
}

/**
 * Quadratic Bézier interpolation with one control point.
 */
function quadraticInterpolation(
  start: Vector,
  control: Vector,
  end: Vector,
  x: number
): number | null {
  const roots = findQuadraticRoots(start, control, end, x)
  for (const t of roots) {
    if (t >= 0 && t <= 1) {
      return computeQuadraticBezier(start, control, end, t)
    }
  }
  return null
}

/**
 * Computes the value of a quadratic Bézier curve at a given t.
 */
function computeQuadraticBezier(
  start: Vector,
  control: Vector,
  end: Vector,
  t: number
): number {
  const mt = 1 - t
  return start.y * mt * mt + 2 * control.y * mt * t + end.y * t * t
}

/**
 * Finds the roots of a quadratic polynomial
 */
function findQuadraticRoots(
  start: Vector,
  control: Vector,
  end: Vector,
  x: number
): number[] {
  // Quadratic coefficients
  const a = start.x - 2 * control.x + end.x
  const b = 2 * (control.x - start.x)
  const c = start.x - x

  // Handle linear and constant cases
  if (approximately(a, 0)) {
    if (approximately(b, 0)) {
      return [] // No solution
    }
    return [-c / b] // Linear solution
  }

  // Standard quadratic formula
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return [] // No real roots

  const sqrtDiscriminant = Math.sqrt(discriminant)
  return [(-b + sqrtDiscriminant) / (2 * a), (-b - sqrtDiscriminant) / (2 * a)]
}

/**
 * Cubic Bézier interpolation with two control points (post/pre)
 */
function cubicInterpolation(
  start: Vector,
  post: Vector,
  pre: Vector,
  end: Vector,
  x: number
): number | null {
  const roots = findCubicRoots(start, post, pre, end, x)
  for (const t of roots) {
    if (t >= 0 && t <= 1) {
      return computeCubicBezier(start, post, pre, end, t)
    }
  }
  return null
}

/**
 * Computes the cube root of a number, accounting for negative inputs.
 */
const cubeRoot = (x: number): number =>
  x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3)

/**
 * Finds the roots of a cubic polynomial uses Cardano's formula for cubic root-finding.
 */
function findCubicRoots(
  start: Vector,
  post: Vector,
  pre: Vector,
  end: Vector,
  x: number
): number[] {
  let cubicCoefficient = -start.x + 3 * post.x - 3 * pre.x + end!.x
  let quadraticCoefficient = 3 * start.x - 2 * 3 * post.x + 3 * pre.x
  let linearCoefficient = -3 * start.x + 3 * post.x
  let constantTerm = start.x - x

  // Check for lower-order curves.
  if (approximately(cubicCoefficient, 0)) {
    if (approximately(quadraticCoefficient, 0)) {
      if (approximately(linearCoefficient, 0)) {
        return []
      }
      // Linear solution.
      return [-constantTerm / linearCoefficient]
    }
    // Quadratic solution.
    const discriminant =
      linearCoefficient * linearCoefficient -
      4 * quadraticCoefficient * constantTerm
    if (discriminant < 0) return []
    const sqrtDiscriminant = Math.sqrt(discriminant)
    return [
      (-linearCoefficient + sqrtDiscriminant) / (2 * quadraticCoefficient),
      (-linearCoefficient - sqrtDiscriminant) / (2 * quadraticCoefficient),
    ]
  }

  // Normalize coefficients for cubic equation.
  quadraticCoefficient /= cubicCoefficient
  linearCoefficient /= cubicCoefficient
  constantTerm /= cubicCoefficient

  const normalizedQuadraticCoefficient = quadraticCoefficient / 3
  const depressedQuadraticCoefficient =
    (3 * linearCoefficient - quadraticCoefficient * quadraticCoefficient) / 3
  const depressedQuadraticTerm = depressedQuadraticCoefficient / 3
  const normalizedCubicTerm =
    (2 * quadraticCoefficient * quadraticCoefficient * quadraticCoefficient -
      9 * quadraticCoefficient * linearCoefficient +
      27 * constantTerm) /
    27
  const halfNormalizedCubicTerm = normalizedCubicTerm / 2
  const discriminant =
    halfNormalizedCubicTerm * halfNormalizedCubicTerm +
    depressedQuadraticTerm * depressedQuadraticTerm * depressedQuadraticTerm

  if (discriminant < 0) {
    // Three real roots.
    const negativeNormalizedQuadraticTerm = -depressedQuadraticCoefficient / 3
    const radius = Math.sqrt(
      negativeNormalizedQuadraticTerm *
        negativeNormalizedQuadraticTerm *
        negativeNormalizedQuadraticTerm
    )
    const angle = -normalizedCubicTerm / (2 * radius)
    const cosPhi = Math.max(-1, Math.min(1, angle))
    const phi = Math.acos(cosPhi)
    const realRootRadius = 2 * cubeRoot(radius)

    return [
      realRootRadius * Math.cos(phi / 3) - normalizedQuadraticCoefficient,
      realRootRadius * Math.cos((phi + 2 * Math.PI) / 3) -
        normalizedQuadraticCoefficient,
      realRootRadius * Math.cos((phi + 4 * Math.PI) / 3) -
        normalizedQuadraticCoefficient,
    ]
  } else if (approximately(discriminant, 0)) {
    // Triple root (or one real and a double root).
    const singleRoot = cubeRoot(-halfNormalizedCubicTerm)
    return [
      2 * singleRoot - normalizedQuadraticCoefficient,
      -singleRoot - normalizedQuadraticCoefficient,
    ]
  } else {
    // One real root.
    const sqrtDiscriminant = Math.sqrt(discriminant)
    const positiveCubicRoot = cubeRoot(
      -halfNormalizedCubicTerm + sqrtDiscriminant
    )
    const negativeCubicRoot = cubeRoot(
      halfNormalizedCubicTerm + sqrtDiscriminant
    )
    return [
      positiveCubicRoot - negativeCubicRoot - normalizedQuadraticCoefficient,
    ]
  }
}

/**
 * Computes the value of a cubic Bézier curve at a given t.
 */
function computeCubicBezier(
  start: Vector,
  post: Vector,
  pre: Vector,
  end: Vector,
  t: number
): number {
  const tMinusOne = 1 - t
  return (
    start.y * tMinusOne * tMinusOne * tMinusOne +
    3 * post.y * tMinusOne * tMinusOne * t +
    3 * pre.y * tMinusOne * t * t +
    end.y * t * t * t
  )
}
