import { Segment } from '#/types'
import { getLastArrayItem } from '#/utils/get-last-array-item'
import { interpolateYAtX } from './interpolate-y-at-x'

function closestPoint(segments: Array<Segment>, time: number) {
  if (segments.length === 0) {
    return []
  }

  const min = segments[0]
  const max = getLastArrayItem(segments)

  if (time < min.range[0]) {
    return [min.map[0], null]
  }

  if (time > max.range[1]) {
    return [null, getLastArrayItem(max.map)]
  }

  // NOTE:  this is not the fastest way of doing these lookups
  //        maybe we can investigate another method (binary search p.ex)
  const segment = segments.find((segment) => {
    return segment.range[0] <= time && time <= segment.range[1]
  })

  if (!segment) {
    console.error('This should not happen')
    return [null, null]
  }

  // NOTE:  this is not the fastest way of doing these lookups
  //        maybe we can investigate another method (binary search p.ex)
  for (let i = 0; i < segment.map.length; i++) {
    const current = segment.map[i]
    const next = segment.map[i + 1]

    if (!next) continue

    if (current.x <= time && time <= next.x) {
      return [current, next]
    }
  }

  return [null, null]
}

export function getValueFromSegments(segments: Array<Segment>, time: number) {
  const [left, right] = closestPoint(segments, time)

  if (left === null && right) return right.y
  if (right === null && left) return left.y
  if (left === null || right === null) return 0

  return interpolateYAtX(left, right, time)
}
