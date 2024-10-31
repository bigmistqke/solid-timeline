import { For, Show, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Point, Points, PostPoint, PrePoint, Vector } from './types'
import { createCubicLookupMap } from './utils/create-cubic-lookup-map'
import { findYOnLine } from './utils/find-y-on-line'
import { mapComputed } from './utils/map-computed'
import { pointerHelper } from './utils/pointer-helper'
import { vector } from './utils/vector'

const Handle = (props: {
  position: Vector
  absoluteHandle: Vector
  onChange: (position: Vector) => void
}) => {
  async function onPointerDown(e: MouseEvent) {
    const handle = { ...props.absoluteHandle }
    pointerHelper(e, (delta) =>
      props.onChange({
        x: handle.x - delta.x,
        y: handle.y - delta.y,
      })
    )
  }

  return (
    <>
      <circle
        cx={props.absoluteHandle.x}
        cy={props.absoluteHandle.y}
        r="5"
        onPointerDown={onPointerDown}
        style={{ cursor: 'move' }}
      />
      <line
        stroke="black"
        x1={props.position.x}
        y1={props.position.y}
        x2={props.absoluteHandle.x}
        y2={props.absoluteHandle.y}
        style={{ 'pointer-events': 'none' }}
      />
    </>
  )
}

const Point = (props: {
  position: Vector
  pre?: Vector
  post?: Vector
  onPositionChange: (point: Vector) => void
  onPreChange: (point: Vector) => void
  onPostChange: (point: Vector) => void
}) => {
  const onDrag = (e: MouseEvent) => {
    const position = { ...props.position }
    pointerHelper(e, (delta) =>
      props.onPositionChange(vector.subtract(position, delta))
    )
  }

  return (
    <>
      <circle
        cx={props.position.x}
        cy={props.position.y}
        r="5"
        onMouseDown={onDrag}
        style={{ cursor: 'move' }}
      />
      <Show when={props.pre}>
        <Handle
          position={props.position}
          absoluteHandle={props.pre!}
          onChange={props.onPreChange}
        />
      </Show>
      <Show when={props.post}>
        <Handle
          position={props.position}
          absoluteHandle={props.post!}
          onChange={props.onPostChange}
        />
      </Show>
    </>
  )
}

const XY = (props: {
  points: Point[]
  x: number
  onChange: (x: number) => void
}) => {
  const lookupMapSegments = mapComputed(
    () => props.points,
    (point, index) =>
      index() < props.points.length - 1
        ? createCubicLookupMap(
            point as PostPoint,
            props.points[index() + 1] as PrePoint,
            120
          )
        : []
  )
  const lookupMap = createMemo(() => lookupMapSegments().flat())

  const closestPoint = createMemo(() => {
    let closestPointLeft = undefined
    let closestPointRight = undefined

    for (const point of lookupMap()) {
      const delta = Math.abs(props.x - point.x)
      if (props.x < point.x) {
        if (
          !closestPointLeft ||
          delta < Math.abs(props.x - closestPointLeft.x)
        ) {
          closestPointLeft = point
        }
      } else {
        if (
          !closestPointRight ||
          delta < Math.abs(props.x - closestPointRight.x)
        ) {
          closestPointRight = point
        }
      }
    }
    return [closestPointLeft, closestPointRight] as const
  })

  const findYCoordinateOnBezier = createMemo<number | undefined>((prev) => {
    const [closestPointLeft, closestPointRight] = closestPoint()

    if (!closestPointLeft && closestPointRight) return closestPointRight.y
    if (!closestPointRight && closestPointLeft) return closestPointLeft.y
    if (!closestPointLeft || !closestPointRight) return prev

    return findYOnLine(closestPointLeft, closestPointRight, props.x)
  })

  const onDrag = async (e: MouseEvent) => {
    const x = props.x
    pointerHelper(e, (delta) => props.onChange(x - delta.x))
  }

  return (
    <>
      <line
        x1={props.x}
        x2={props.x}
        y1={0}
        y2={window.innerHeight}
        stroke="black"
        onMouseDown={onDrag}
        stroke-width={5}
        style={{
          cursor: 'ew-resize',
        }}
      />
      <line
        x1={0}
        x2={window.innerWidth}
        y1={findYCoordinateOnBezier()}
        y2={findYCoordinateOnBezier()}
        stroke="black"
      />
    </>
  )
}

export const BezierEditor = () => {
  const [points, setPoints] = createStore<Points>([
    [
      { x: 50, y: 50 },
      {
        post: { x: 0.5, y: 0 },
      },
    ],
    [
      { x: 400, y: 50 },
      {
        pre: { x: 0.5, y: 0 },
        post: { x: 0.5, y: 10 },
      },
    ],
    [
      { x: 400 + 350, y: 200 },
      {
        pre: { x: 0.5, y: 10 },
      },
    ],
  ])

  const [x, setX] = createSignal(150)

  const absolutePoints = mapComputed(
    () => points,
    ([point, { pre, post }], index) => {
      const controls = {} as Point[1]

      if (pre) {
        const prev = points[index() - 1][0]
        const deltaX = vector.subtract(point, prev).x

        controls.pre = vector.add(point, {
          x: deltaX * pre.x * -1,
          y: pre.y,
        })
      }

      if (post) {
        const next = points[index() + 1][0]
        const deltaX = vector.subtract(next, point).x

        controls.post = vector.add(point, {
          x: deltaX * post.x,
          y: post.y,
        })
      }

      return [point, controls] as Point
    }
  )

  const dFromPoints = () => {
    let d = ''

    absolutePoints().forEach(([point, { pre, post }]) => {
      let segment = ''
      if (pre) {
        segment += pre.x
        segment += ' '
        segment += pre.y
        segment += ' '
      }
      if (d === '') {
        segment += 'M'
        segment += ' '
      }
      segment += point.x
      segment += ' '
      segment += point.y
      segment += ' '
      if (d === '') {
        segment += 'C'
        segment += ' '
      }
      if (post) {
        segment += post.x
        segment += ' '
        segment += post.y
        segment += ' '
      }
      d += segment
    })
    return d
  }

  const onHandleChange = ({
    absoluteHandle,
    index,
    type,
  }: {
    absoluteHandle: Vector
    index: number
    type: 'pre' | 'post'
  }) => {
    const [point] = points[index]
    const [connectedPoint] =
      type === 'post' ? points[index + 1] : points[index - 1]

    if (
      (type === 'post' && connectedPoint.x < absoluteHandle.x) ||
      (type !== 'post' && connectedPoint.x > absoluteHandle.x)
    ) {
      absoluteHandle.x = connectedPoint.x
    }

    if (
      (type === 'post' && absoluteHandle.x < point.x) ||
      (type !== 'post' && absoluteHandle.x > point.x)
    ) {
      absoluteHandle.x = point.x
    }

    const deltaX = Math.abs(point.x - connectedPoint.x)

    const relativeHandle = {
      y: absoluteHandle.y - point.y,
      x: Math.abs(point.x - absoluteHandle.x) / deltaX,
    }

    setPoints(index, 1, type, relativeHandle)
  }

  const onPositionChange = (index: number, position: Vector) => {
    const [prev] = points[index - 1] || []
    const [next] = points[index + 1] || []

    if (prev && position.x - 10 < prev.x) {
      position.x = prev.x + 10
    }
    if (next && position.x + 10 > next.x) {
      position.x = next.x - 10
    }

    setPoints(index, 0, position)
  }

  return (
    <svg width={window.innerWidth} height={window.innerHeight}>
      <For each={absolutePoints()}>
        {([point, { pre, post }], index) => (
          <Point
            position={point}
            pre={pre}
            post={post}
            onPositionChange={(position) => onPositionChange(index(), position)}
            onPreChange={(absoluteHandle) =>
              onHandleChange({ absoluteHandle, index: index(), type: 'pre' })
            }
            onPostChange={(absoluteHandle) =>
              onHandleChange({ absoluteHandle, index: index(), type: 'post' })
            }
          />
        )}
      </For>
      <path
        stroke="black"
        fill="transparent"
        d={dFromPoints()}
        style={{ 'pointer-events': 'none' }}
      />
      <XY points={absolutePoints()} x={x()} onChange={setX} />
    </svg>
  )
}
