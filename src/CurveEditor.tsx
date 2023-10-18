import { For, Show, createMemo, createSignal, mapArray } from 'solid-js'
import { createStore } from 'solid-js/store'

import { Vector } from './types'
import { addVectors } from './utils/addVectors'
import { cubicLookup as createCubicLookupMap } from './utils/cubicLookup'
import { dragHelper } from './utils/dragHelper'
import { findYOnLine } from './utils/findYOnLine'
import { subtractVectors } from './utils/subtractVectors'

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
  next: Points[number] | undefined
  prev: Points[number] | undefined
}) => {
  const [point, setPoint] = createStore(props.point)

  const onDrag = (e: MouseEvent) => {
    const position = { ...point.position }
    dragHelper(e, (delta) => {
      setPoint('position', {
        x: position.x - delta.x,
        y: position.y - delta.y,
      })
    })
  }

  const onChangeHandle1 = (handle: Vector) => {
    // if handle is more to the right then the previous point
    // find the point that is on the intersection of
    // the y-axis of the previous point and
    // the line created by the handle and the point
    if (
      props.prev &&
      handle.x + props.point.position.x < props.prev.position.x
    ) {
      const y = findYOnLine(
        props.point.position,
        addVectors(props.point.position, handle),
        props.prev.position.x
      )
      setPoint(
        'handle1',
        subtractVectors({ x: props.prev.position.x, y }, props.point.position)
      )
    }

    if (props.point.position.x < handle.x + props.point.position.x) {
      setPoint('handle1', {
        x: 0,
        y: handle.y,
      })
      return
    }

    if (
      !props.prev ||
      handle.x + props.point.position.x > props.prev?.position.x
    )
      setPoint('handle1', handle)
  }

  const onChangeHandle2 = (handle: Vector) => {
    // if handle is more to the left then the next point
    // find the point that is on the intersection of
    // the y-axis of the next point and
    // the line created by the handle and the point
    if (
      props.next &&
      handle.x + props.point.position.x > props.next.position.x
    ) {
      const y = findYOnLine(
        props.point.position,
        addVectors(props.point.position, handle),
        props.next.position.x
      )
      setPoint('handle2', {
        x: props.next.position.x - props.point.position.x,
        y: y - props.point.position.y,
      })
      return
    }

    if (props.point.position.x > handle.x + props.point.position.x) {
      setPoint('handle2', {
        x: 0,
        y: handle.y,
      })
      return
    }

    if (
      !props.next ||
      handle.x + props.point.position.x < props.next?.position.x
    )
      setPoint('handle2', handle)
  }

  return (
    <>
      <circle
        cx={point.position.x}
        cy={point.position.y}
        r="5"
        onMouseDown={onDrag}
      />
      <Show when={'handle1' in point && point}>
        <Handle
          position={point.position}
          handle={point.handle1}
          onChange={onChangeHandle1}
        />
      </Show>
      <Show when={'handle2' in point && point}>
        <Handle
          position={point.position}
          handle={point.handle2}
          onChange={onChangeHandle2}
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
      {lookupMap().map((point) => (
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
      ))}
    </>
  )
}

export const CurveEditor = () => {
  const [points] = createStore<Points>([
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
            next={points[index() + 1]}
            prev={points[index() - 1]}
          />
        )}
      </For>
      <XY points={points} x={x()} onChange={setX} />
    </svg>
  )
}
