import { For, Show, createMemo, createSignal, mapArray } from 'solid-js'
import { createStore } from 'solid-js/store'

import { Vector } from './types'
import { cubicLookup as createCubicLookupMap } from './utils/cubicLookup'
import { dragHelper } from './utils/dragHelper'
import { findYOnLine } from './utils/findYOnLine'
import { vector } from './utils/vector'

export type Points = [
  { position: Vector; handle2: Vector },
  ...{ position: Vector; handle2: Vector; handle1: Vector }[],
  { position: Vector; handle1: Vector }
]

const Handle = (props: {
  position: Vector
  handle: Vector
  onChange: (position: Vector) => void
}) => {
  const onDrag = async (e: MouseEvent) => {
    const handle = { ...props.handle }
    dragHelper(e, (delta) =>
      props.onChange({
        x: handle.x - delta.x,
        y: handle.y - delta.y,
      })
    )
  }

  return (
    <>
      <circle
        cx={props.handle.x + props.position.x}
        cy={props.handle.y + props.position.y}
        r="5"
        onMouseDown={onDrag}
      />
      <line
        stroke="black"
        x1={props.position.x}
        y1={props.position.y}
        x2={props.handle.x + props.position.x}
        y2={props.handle.y + props.position.y}
      />
    </>
  )
}

const Point = (props: {
  point: Points[number]
  onPositionChange: (point: Vector) => void
  onHandle1Change: (point: Vector) => void
  onHandle2Change: (point: Vector) => void
}) => {
  const onDrag = (e: MouseEvent) => {
    const position = { ...props.point.position }
    dragHelper(e, (delta) =>
      props.onPositionChange(vector.subtract(position, delta))
    )
  }

  return (
    <>
      <circle
        cx={props.point.position.x}
        cy={props.point.position.y}
        r="5"
        onMouseDown={onDrag}
      />
      <Show when={'handle1' in props.point && props.point}>
        <Handle
          position={props.point.position}
          handle={props.point.handle1}
          onChange={props.onHandle1Change}
        />
      </Show>
      <Show when={'handle2' in props.point && props.point}>
        <Handle
          position={props.point.position}
          handle={props.point.handle2}
          onChange={props.onHandle2Change}
        />
      </Show>
    </>
  )
}

const XY = (props: {
  points: Points
  x: number
  onChange: (x: number) => void
}) => {
  const lookupMapSegments = createMemo(
    mapArray(
      () => props.points,
      (point, index) => () =>
        index() < props.points.length - 1
          ? createCubicLookupMap(point, props.points[index() + 1], 120)
          : []
    )
  )

  const lookupMap = () => lookupMapSegments().flatMap((fn) => fn())

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
    dragHelper(e, (delta) => props.onChange(x - delta.x))
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
      {/* {lookupMap().map((point) => (
        <circle
          cx={point.x}
          cy={point.y}
          r="5"
          style={{ 'pointer-events': 'none' }}
          fill={
            (closestPoint()[0]?.x === point.x &&
              closestPoint()[0]?.y === point.y) ||
            (closestPoint()[1]?.x === point.x &&
              closestPoint()[1]?.y === point.y)
              ? 'red'
              : 'black'
          }
        />
      ))} */}
    </>
  )
}

export const BezierEditor = () => {
  const [points, setPoints] = createStore<Points>([
    {
      position: { x: 50, y: 50 },
      handle2: { x: 100, y: 0 },
    },
    {
      position: { x: 400, y: 300 },
      handle1: { x: -150, y: 0 },
      handle2: { x: 150, y: 0 },
    },
    {
      position: { x: 600, y: 50 },
      handle1: { x: -150, y: 0 },
    },
  ])

  const [x, setX] = createSignal(150)

  const dFromSegments = () => {
    let d = ''
    points.forEach((point) => {
      let segment = ''
      if ('handle1' in point) {
        segment += point.handle1.x + point.position.x
        segment += ' '
        segment += point.handle1.y + point.position.y
        segment += ' '
      }
      if (d === '') {
        segment += 'M'
        segment += ' '
      }
      segment += point.position.x
      segment += ' '
      segment += point.position.y
      segment += ' '
      if (d === '') {
        segment += 'C'
        segment += ' '
      }
      if ('handle2' in point) {
        segment += point.handle2.x + point.position.x
        segment += ' '
        segment += point.handle2.y + point.position.y
        segment += ' '
      }
      d += segment
    })
    return d
  }

  return (
    <svg width={window.innerWidth} height={window.innerHeight}>
      <path stroke="black" fill="transparent" d={dFromSegments()}></path>
      <For each={points}>
        {(point, index) => (
          <Point
            point={point}
            onPositionChange={(position) => {
              const prev = points[index() - 1].position
              const next = points[index() + 1].position

              if (prev && position.x - 2 < prev.x) {
                setPoints(index(), 'position', {
                  x: prev.x + 2,
                  y: position.y,
                })
                return
              }
              if (next && position.x > next.x) {
                setPoints(index(), 'position', {
                  x: next.x - 1,
                  y: position.y,
                })
                return
              }

              if ('handle2' in point) {
                const delta1 = vector.subtract(next, point.position)
                const delta2 = vector.subtract(next, position)
                const ratio = vector.divide(delta1, delta2)
                setPoints(index(), 'handle2', (handle) =>
                  vector.divide(handle, ratio)
                )
                setPoints(index() + 1, 'handle1', (handle) =>
                  vector.divide(handle, ratio)
                )
              }
              if ('handle1' in point) {
                const delta1 = vector.subtract(prev, point.position)
                const delta2 = vector.subtract(prev, position)
                const ratio = vector.divide(delta1, delta2)
                setPoints(index(), 'handle1', (handle) =>
                  vector.divide(handle, ratio)
                )
                setPoints(index() - 1, 'handle2', (handle) =>
                  vector.divide(handle, ratio)
                )
              }
              setPoints(index(), 'position', position)
            }}
            onHandle1Change={(handle) => {
              const prev = points[index() - 1]
              // if handle is more to the right then the previous point
              // find the point that is on the intersection of
              // the y-axis of the previous point and
              // the line created by the handle and the point
              const absoluteHandle = vector.add(point.position, handle)
              if (prev && absoluteHandle.x < prev.position.x) {
                const y = findYOnLine(
                  point.position,
                  absoluteHandle,
                  prev.position.x
                )
                setPoints(
                  index(),
                  'handle1',
                  vector.subtract({ x: prev.position.x, y }, point.position)
                )
              }

              if (point.position.x < handle.x + point.position.x) {
                setPoints(index(), 'handle1', {
                  x: 0,
                  y: handle.y,
                })
                return
              }

              if (!prev || handle.x + point.position.x > prev?.position.x)
                setPoints(index(), 'handle1', handle)
            }}
            onHandle2Change={(handle) => {
              const next = points[index() + 1]

              // if handle is more to the left then the next point
              // find the point that is on the intersection of
              // the y-axis of the next point and
              // the line created by the handle and the point
              if (next && handle.x + point.position.x > next.position.x) {
                const y = findYOnLine(
                  point.position,
                  vector.add(point.position, handle),
                  next.position.x
                )
                setPoints(index(), 'handle2', {
                  x: next.position.x - point.position.x,
                  y: y - point.position.y,
                })
                return
              }

              if (point.position.x > handle.x + point.position.x) {
                setPoints(index(), 'handle2', {
                  x: 0,
                  y: handle.y,
                })
                return
              }

              if (!next || handle.x + point.position.x < next?.position.x)
                setPoints(index(), 'handle2', handle)
            }}
          />
        )}
      </For>
      <XY points={points} x={x()} onChange={setX} />
    </svg>
  )
}
