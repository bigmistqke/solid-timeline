import { For, Show, createMemo, createSignal, mapArray } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Vector } from './types'
import { createCubicLookupMap } from './utils/cubicLookup'
import { dragHelper } from './utils/dragHelper'
import { findYOnLine } from './utils/findYOnLine'
import { lerp } from './utils/lerp'
import { vector } from './utils/vector'

type Handle = Vector

type Points = [
  { position: Vector; handle2: Handle },
  ...{ position: Vector; handle2: Handle; handle1: Handle }[],
  { position: Vector; handle1: Handle }
]

const Handle = (props: {
  position: Vector
  absoluteHandle: Vector
  onChange: (position: Vector) => void
}) => {
  const onDrag = async (e: MouseEvent) => {
    const handle = { ...props.absoluteHandle }
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
        cx={props.absoluteHandle.x}
        cy={props.absoluteHandle.y}
        r="5"
        onMouseDown={onDrag}
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
        style={{ cursor: 'move' }}
      />
      <Show when={props.point.handle1 && props.point}>
        {(point) => (
          <Handle
            position={point().position}
            absoluteHandle={point().handle1}
            onChange={props.onHandle1Change}
          />
        )}
      </Show>
      <Show when={props.point.handle2 && props.point}>
        {(point) => (
          <Handle
            position={point().position}
            absoluteHandle={point().handle2}
            onChange={props.onHandle2Change}
          />
        )}
      </Show>
    </>
  )
}

const XY = (props: {
  points: {
    position: Vector
    handle1: Vector | undefined
    handle2: Vector | undefined
  }[]
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
    </>
  )
}

export const BezierEditor = () => {
  const [points, setPoints] = createStore<Points>([
    {
      position: { x: 50, y: 50 },
      handle2: { x: 0.5, y: 0 },
    },
    {
      position: { x: 400, y: 50 },
      handle1: { x: 0.5, y: 0 },
      handle2: { x: 0.5, y: 10 },
    },
    {
      position: { x: 400 + 350, y: 200 },
      handle1: { x: 0.5, y: 10 },
    },
  ])

  const [x, setX] = createSignal(150)

  const absolutePointsSegments = mapArray(
    () => points,
    (point, index) =>
      createMemo(() => {
        const result = {
          position: point.position,
          handle1: undefined as Vector | undefined,
          handle2: undefined as Vector | undefined,
        }

        if ('handle1' in point) {
          const prev = points[index() - 1].position
          const deltaX = vector.subtract(point.position, prev).x

          result.handle1 = vector.add(point.position, {
            x: deltaX * point.handle1.x * -1,
            y: point.handle1.y,
          })
        }

        if ('handle2' in point) {
          const next = points[index() + 1].position
          const deltaX = vector.subtract(next, point.position).x

          result.handle2 = vector.add(point.position, {
            x: deltaX * point.handle2.x,
            y: point.handle2.y,
          })
        }
        return result
      })
  )

  const absolutePoints = () => absolutePointsSegments().flatMap((fn) => fn())

  const dFromPoints = () => {
    let d = ''
    absolutePoints().forEach((point, index) => {
      let segment = ''
      if (point.handle1) {
        segment += point.handle1.x
        segment += ' '
        segment += point.handle1.y
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
      if (point.handle2) {
        segment += point.handle2.x
        segment += ' '
        segment += point.handle2.y
        segment += ' '
      }
      d += segment
    })
    return d
  }

  const onHandleChange = ({
    absoluteHandle,
    index,
    next,
  }: {
    absoluteHandle: Vector
    index: number
    next: boolean
  }) => {
    const point = points[index]
    const connectedPoint = next ? points[index + 1] : points[index - 1]
    const handleName = next ? 'handle2' : 'handle1'

    if (
      (next && connectedPoint.position.x < absoluteHandle.x) ||
      (!next && connectedPoint.position.x > absoluteHandle.x)
    ) {
      absoluteHandle.x = connectedPoint.position.x
    }

    if (
      (next && absoluteHandle.x < point.position.x) ||
      (!next && absoluteHandle.x > point.position.x)
    ) {
      absoluteHandle.x = point.position.x
    }

    const deltaX = Math.abs(point.position.x - connectedPoint.position.x)

    const relativeHandle = {
      y: absoluteHandle.y - point.position.y,
      x: Math.abs(point.position.x - absoluteHandle.x) / deltaX,
    }

    setPoints(index, handleName, relativeHandle)
  }

  const onPositionChange = (index: number, position: Vector) => {
    const prev = points[index - 1]
    const next = points[index + 1]
    const current = { ...points[index] }

    if (prev && position.x - 10 < prev.position.x) {
      position.x = prev.position.x + 10
    }
    if (next && position.x + 10 > next.position.x) {
      position.x = next.position.x - 10
    }

    if (next) {
      const deltaX = vector.subtract(current.position, position).x

      setPoints(index, 'handle2', (handle) => {
        const deltaLength = Math.sin(handle.angle) * deltaX
        return {
          angle: handle.angle,
          length: handle.length + deltaLength,
        }
      })
      setPoints(index + 1, 'handle1', (handle) => {
        const deltaLength = Math.sin(handle.angle) * deltaX
        return {
          angle: handle.angle,
          length: handle.length - deltaLength,
        }
      })
    }

    if (prev) {
      const oldDelta = vector.subtract(prev.position, current.position)
      const currentDelta = vector.subtract(prev.position, position)
      const ratio = vector.divide(oldDelta, currentDelta)

      setPoints(index, 'handle1', (handle) => ({
        angle: handle.angle,
        length: lerp(
          handle.length,
          handle.length / ratio.x,
          1 // Math.sin(handle.angle) * -1
        ),
      }))
      setPoints(index - 1, 'handle2', (handle) => ({
        angle: handle.angle,
        length: lerp(
          handle.length,
          handle.length / ratio.x,
          1 // Math.sin(handle.angle)
        ),
      }))
    }

    setPoints(index, 'position', position)
  }

  return (
    <svg width={window.innerWidth} height={window.innerHeight}>
      <For each={absolutePoints()}>
        {(point, index) => (
          <Point
            point={point}
            onPositionChange={(position) => onPositionChange(index(), position)}
            onHandle1Change={(absoluteHandle) =>
              onHandleChange({ absoluteHandle, index: index(), next: false })
            }
            onHandle2Change={(absoluteHandle) =>
              onHandleChange({ absoluteHandle, index: index(), next: true })
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
