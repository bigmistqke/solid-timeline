import {
  Accessor,
  ComponentProps,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import { createStore, SetStoreFunction } from 'solid-js/store'
import type { Point, Points, Vector } from './types'
import { when } from './utils/conditionals'
import { createLookupMap } from './utils/create-cubic-lookup-map'
import { indexComputed } from './utils/index-computed'
import { interpolateYAtX } from './utils/interpolate-y-at-x'
import { pointerHelper } from './utils/pointer-helper'
import { vector } from './utils/vector'

/**********************************************************************************/
/*                                                                                */
/*                                      Anchor                                    */
/*                                                                                */
/**********************************************************************************/

const Anchor = (props: {
  position: Vector
  control: Vector
  onChange: (position: Vector) => void
}) => {
  const { project, zoom, clamp } = useTimeline()

  async function onPointerDown(e: MouseEvent) {
    const control = props.control
    pointerHelper(e, (delta) =>
      props.onChange({
        x: control.x - delta.x / zoom().x,
        y: clamp(control.y - delta.y / zoom().y),
      })
    )
  }

  return (
    <>
      <circle
        cx={project(props.control, 'x')}
        cy={project(props.control, 'y')}
        r="5"
        onPointerDown={onPointerDown}
        style={{ cursor: 'move' }}
      />
      <line
        stroke="black"
        x1={project(props.position, 'x')}
        y1={project(props.position, 'y')}
        x2={project(props.control, 'x')}
        y2={project(props.control, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
    </>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                      Point                                     */
/*                                                                                */
/**********************************************************************************/

function Point(props: {
  position: Vector
  pre?: Vector
  post?: Vector
  onPositionChange: (point: Vector) => void
  onPreChange: (point: Vector) => void
  onPostChange: (point: Vector) => void
}) {
  const { project, zoom, clamp } = useTimeline()

  function onDrag(e: MouseEvent) {
    const position = { ...props.position }
    pointerHelper(e, (delta) => {
      const newPosition = vector.subtract(position, {
        x: delta.x / zoom().x,
        y: delta.y / zoom().y,
      })
      props.onPositionChange({
        ...newPosition,
        y: clamp(newPosition.y),
      })
    })
  }

  return (
    <>
      <circle
        cx={project(props.position, 'x')}
        cy={project(props.position, 'y')}
        r="5"
        onMouseDown={onDrag}
        style={{ cursor: 'move' }}
      />
      <Show when={props.pre}>
        <Anchor
          position={props.position}
          control={props.pre!}
          onChange={props.onPreChange}
        />
      </Show>
      <Show when={props.post}>
        <Anchor
          position={props.position}
          control={props.post!}
          onChange={props.onPostChange}
        />
      </Show>
    </>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                    Timeline                                    */
/*                                                                                */
/**********************************************************************************/

const TimelineContext = createContext<{
  origin: Accessor<Vector>
  zoom: Accessor<Vector>
  project(point: Vector | number, type: 'x' | 'y'): number
  unproject(point: Vector | number, type: 'x' | 'y'): number
  clamp(y: number): number
}>()

function useTimeline() {
  const context = useContext(TimelineContext)
  if (!context) {
    throw `useTimeline should be used in a descendant of Timeline`
  }
  return context
}

function Timeline(
  props: ComponentProps<'svg'> & {
    min: number
    max: number
    zoom?: Partial<Vector>
    onZoomChange?: (zoom: Vector) => void
    onOriginChange?: (origin: Vector) => void
    absoluteAnchors: Array<Point>
    onAnchorChange: SetStoreFunction<Array<Point>>
    d: (config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) => string
  }
) {
  const [, rest] = splitProps(props, [
    'min',
    'max',
    'onZoomChange',
    'onOriginChange',
  ])
  const [domRect, setDomRect] = createSignal<DOMRect>()

  const yPose = createMemo(
    when(domRect, (domRect) => {
      const rangeHeight = props.max - props.min
      return {
        zoom: domRect.height / rangeHeight,
        origin: rangeHeight / 2,
      }
    })
  )

  const zoom = createMemo(() => ({
    x: 1,
    y: (yPose()?.zoom || 1) * (props.zoom?.y || 1),
  }))

  const origin = createMemo(() => ({
    x: 0,
    y: (yPose()?.origin || 0) / (props.zoom?.y || 1),
  }))

  function project(point: Vector | number, type: 'x' | 'y') {
    const value = typeof point === 'object' ? point[type] : point
    return (value + origin()[type]) * zoom()[type]
  }

  function unproject(point: Vector | number, type: 'x' | 'y') {
    const value = typeof point === 'object' ? point[type] : point
    return (value - origin()[type]) / zoom()[type]
  }

  function clamp(y: number) {
    const userZoomY = props.zoom?.y || 1
    return Math.max(props.min / userZoomY, Math.min(props.max / userZoomY, y))
  }

  function onAnchorChange({
    absoluteAnchor,
    index,
    type,
  }: {
    absoluteAnchor: Vector
    index: number
    type: 'pre' | 'post'
  }) {
    const [point] = props.absoluteAnchors[index]
    const [connectedPoint] =
      type === 'post'
        ? props.absoluteAnchors[index + 1]
        : props.absoluteAnchors[index - 1]

    let absoluteX = unproject(absoluteAnchor, 'x')

    // Clamp anchor w the connected point
    if (
      (type === 'post' && connectedPoint.x < absoluteX) ||
      (type !== 'post' && connectedPoint.x > absoluteX)
    ) {
      absoluteX = connectedPoint.x
    }

    // Clamp anchor w the current point
    if (
      (type === 'post' && absoluteX < point.x) ||
      (type !== 'post' && absoluteX > point.x)
    ) {
      absoluteX = point.x
    }

    const deltaX = Math.abs(point.x - connectedPoint.x)

    const anchor = {
      y: absoluteAnchor.y - point.y,
      x: Math.abs(point.x - absoluteX) / deltaX,
    }

    props.onAnchorChange(index, 1, type, anchor)
  }

  const onPositionChange = (index: number, position: Vector) => {
    const [prev] = props.absoluteAnchors[index - 1] || []
    const [next] = props.absoluteAnchors[index + 1] || []

    // Clamp position w the previous anchor
    if (prev && position.x - 1 < prev.x) {
      position.x = prev.x + 1
    }
    // Clamp position w the next anchor
    if (next && position.x + 1 > next.x) {
      position.x = next.x - 1
    }

    props.onAnchorChange(index, 0, position)
  }

  function onRef(element: SVGSVGElement) {
    function updateDomRect() {
      setDomRect(element.getBoundingClientRect())
    }
    const observer = new ResizeObserver(updateDomRect)
    observer.observe(element)
    updateDomRect()
    onCleanup(() => observer.disconnect())
  }

  createEffect(() => props.onZoomChange?.(zoom()))
  createEffect(() => props.onOriginChange?.(origin()))

  return (
    <TimelineContext.Provider
      value={{
        origin,
        zoom,
        project,
        unproject,
        clamp,
      }}
    >
      <svg ref={onRef} width="100%" height="100%" {...rest}>
        <For each={props.absoluteAnchors}>
          {([point, { pre, post } = {}], index) => (
            <Point
              position={point}
              pre={pre}
              post={post}
              onPositionChange={(position) =>
                onPositionChange(index(), position)
              }
              onPreChange={(absoluteHandle) =>
                onAnchorChange({
                  absoluteAnchor: absoluteHandle,
                  index: index(),
                  type: 'pre',
                })
              }
              onPostChange={(absoluteHandle) =>
                onAnchorChange({
                  absoluteAnchor: absoluteHandle,
                  index: index(),
                  type: 'post',
                })
              }
            />
          )}
        </For>
        <path
          stroke="black"
          fill="transparent"
          d={props.d({ zoom: zoom(), origin: origin() })}
          style={{ 'pointer-events': 'none' }}
        />
        {props.children}
      </svg>
    </TimelineContext.Provider>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                 Create Timeline                                */
/*                                                                                */
/**********************************************************************************/

export function createTimeline(config?: { initialPoints?: Points }) {
  const [anchors, setAnchors] = createStore<Points>(config?.initialPoints || [])

  const absoluteAnchors = indexComputed(
    () => anchors,
    ([point, relativeControls], index) => {
      const controls: { pre?: Vector; post?: Vector } = {
        pre: undefined,
        post: undefined,
      }

      const pre = relativeControls?.pre
      if (pre) {
        const prev = anchors[index - 1][0]
        const deltaX = vector.subtract(point, prev).x

        controls.pre = vector.add(point, {
          x: deltaX * pre.x * -1,
          y: pre.y,
        })
      }

      const post = relativeControls?.post
      if (post) {
        const next = anchors[index + 1][0]
        const deltaX = vector.subtract(next, point).x

        controls.post = vector.add(point, {
          x: deltaX * post.x,
          y: post.y,
        })
      }

      return [point, controls] as Point
    }
  )

  const lookupMapSegments = indexComputed(absoluteAnchors, (point, index) =>
    index < absoluteAnchors().length - 1
      ? createLookupMap(point, absoluteAnchors()[index + 1], 120)
      : []
  )
  const lookupMap = createMemo(() => lookupMapSegments().flat())

  // TODO: there must be a faster way of doing these lookups
  function closestPoint(time: number) {
    let closestPointLeft = undefined
    let closestPointRight = undefined

    for (const point of lookupMap()) {
      const delta = Math.abs(time - point.x)
      if (time < point.x) {
        if (!closestPointLeft || delta < Math.abs(time - closestPointLeft.x)) {
          closestPointLeft = point
        }
      } else {
        if (
          !closestPointRight ||
          delta < Math.abs(time - closestPointRight.x)
        ) {
          closestPointRight = point
        }
      }
    }
    return [closestPointLeft, closestPointRight] as const
  }

  function d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) {
    let d = ''

    const zoom = {
      x: 1,
      y: 1,
      ...config?.zoom,
    }

    const origin = {
      x: 0,
      y: 0,
      ...config?.origin,
    }

    let currentCommand = ''

    absoluteAnchors().forEach(([point, { pre, post } = {}], index, array) => {
      let next = array[index + 1]

      let segment = ''
      if (pre) {
        segment += (pre.x + origin.x) * zoom.x
        segment += ' '
        segment += (pre.y + origin.y) * zoom.y
        segment += ' '
      }
      if (d === '') {
        currentCommand = 'M'
        segment += currentCommand
        segment += ' '
      }
      segment += (point.x + origin.x) * zoom.x
      segment += ' '
      segment += (point.y + origin.y) * zoom.y
      segment += ' '

      if (index !== array.length - 1) {
        let command =
          !next![1]?.pre && !post ? 'L' : next![1]?.pre && post ? 'C' : 'Q'

        if (command !== currentCommand) {
          currentCommand = command
          segment += currentCommand
          segment += ' '
        }

        if (post) {
          segment += (post.x + origin.x) * zoom.x
          segment += ' '
          segment += (post.y + origin.y) * zoom.y
          segment += ' '
        }
      }

      d += segment
    })

    return d
  }

  function getValue(time: number) {
    const [left, right] = closestPoint(time)

    if (!left && right) return right.y
    if (!right && left) return left.y
    if (!left || !right) return undefined

    return interpolateYAtX(left, right, time)
  }

  return {
    absoluteAnchors,
    anchors,
    d,
    getValue,
    setAnchors,
    Component: (
      props: Omit<
        ComponentProps<typeof Timeline>,
        'onAnchorChange' | 'absoluteAnchors' | 'd'
      >
    ) => (
      <Timeline
        onAnchorChange={setAnchors}
        absoluteAnchors={absoluteAnchors()}
        d={d}
        {...props}
      />
    ),
  }
}
