import { Accessor } from 'solid-js'
import { Segment, Vector } from 'solid-timeline/types'
import { getLastArrayItem } from 'solid-timeline/utils/get-last-array-item'
import { interpolateYAtX } from './interpolate-y-at-x'

function binarySearchSegment(
  segments: Array<Accessor<Segment>>,
  time: number
): Segment | null {
  let low = 0
  let high = segments.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const segment = segments[mid]()
    if (time < segment.range[0]) {
      high = mid - 1
    } else if (time > segment.range[1]) {
      low = mid + 1
    } else {
      return segment
    }
  }
  return null
}

function binarySearchMap(
  map: Vector[],
  time: number
): [Vector | null, Vector | null] {
  let low = 0
  let high = map.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const current = map[mid]
    const next = map[mid + 1] || null

    if (next && time > current.x && time < next.x) {
      return [current, next]
    }

    if (time < current.x) {
      high = mid - 1
    } else if (time > current.x) {
      low = mid + 1
    } else {
      // Exact match or we are on the edge
      return [current, next]
    }
  }
  return [null, null]
}

function closestPoint(segments: Array<Accessor<Segment>>, time: number) {
  if (segments.length === 0) {
    return []
  }

  const min = segments[0]?.()
  const max = getLastArrayItem(segments)?.()

  if (time < min.range[0]) {
    return [min.map[0], null]
  }

  if (time > max.range[1]) {
    return [null, getLastArrayItem(max.map)]
  }

  const segment = binarySearchSegment(segments, time)
  if (!segment) {
    console.error('This should not happen')
    return [null, null]
  }

  return binarySearchMap(segment.map, time)
}

export function getValueFromSegments(
  segments: Array<Accessor<Segment>>,
  time: number
) {
  const [left, right] = closestPoint(segments, time)

  if (left === null && right) return right.y
  if (right === null && left) return left.y
  if (left === null || right === null) return 0

  return interpolateYAtX(left, right, time)
}
