import clsx from 'clsx'
import {
  Accessor,
  ComponentProps,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import { createStore, SetStoreFunction } from 'solid-js/store'
import { createLookupMap } from './lib/create-cubic-lookup-map'
import { interpolateYAtX } from './lib/interpolate-y-at-x'
import styles from './timeline.module.css'
import type { Anchor, Anchors, Segment, Vector } from './types'
import { getLastArrayItem } from './utils/get-last-array-item'
import { indexComputed } from './utils/index-computed'
import { whenMemo } from './utils/once-every-when'
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
  onChangeEnd: () => void
}) => {
  const [dragging, setDragging] = createSignal(false)
  const { project, zoom } = useTimeline()

  async function onPointerDown(e: MouseEvent) {
    setDragging(true)
    const control = props.control
    await pointerHelper(e, (delta) =>
      props.onChange({
        x: control.x - delta.x / zoom().x,
        y: control.y - delta.y / zoom().y,
      })
    )
    props.onChangeEnd()
    setDragging(false)
  }

  return (
    <>
      <line
        stroke="black"
        x1={project(props.position, 'x')}
        y1={project(props.position, 'y')}
        x2={project(props.control, 'x')}
        y2={project(props.control, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
      <g class={clsx(styles.handleContainer, dragging() && styles.active)}>
        <circle
          cx={project(props.control, 'x')}
          cy={project(props.control, 'y')}
          r="10"
          onPointerDown={onPointerDown}
          fill="transparent"
          style={{ cursor: 'move' }}
        />
        <circle
          class={styles.handle}
          cx={project(props.control, 'x')}
          cy={project(props.control, 'y')}
          r="3"
          fill="black"
          style={{ 'pointer-events': 'none' }}
        />
      </g>
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
  onPositionChangeEnd: () => void
  onPreChange: (point: Vector) => void
  onPreChangeEnd: () => void
  onPostChange: (point: Vector) => void
  onPostChangeEnd: () => void
}) {
  const { project, zoom } = useTimeline()

  async function onDrag(e: MouseEvent) {
    const position = { ...props.position }
    const { delta } = await pointerHelper(e, (delta) => {
      const newPosition = vector.subtract(position, {
        x: delta.x / zoom().x,
        y: delta.y / zoom().y,
      })
      props.onPositionChange(newPosition)
    })
    props.onPositionChangeEnd()
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
          onChangeEnd={props.onPreChangeEnd}
        />
      </Show>
      <Show when={props.post}>
        <Anchor
          position={props.position}
          control={props.post!}
          onChange={props.onPostChange}
          onChangeEnd={props.onPostChangeEnd}
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
    onTimeChange?: (time: number) => void
    absoluteAnchors: Array<Anchor>
    onAnchorChange: SetStoreFunction<Array<Anchor>>
    d: (config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) => string
    getValue: (time: number) => number
    time?: number
  }
) {
  const [, rest] = splitProps(props, [
    'min',
    'max',
    'onZoomChange',
    'onOriginChange',
    'absoluteAnchors',
    'd',
    'zoom',
    'time',
  ])
  const [domRect, setDomRect] = createSignal<DOMRect>()
  const [paddingMax, setPaddingMax] = createSignal(0)
  const [paddingMin, setPaddingMin] = createSignal(0)
  const [presence, setPresence] = createSignal<number | undefined>(undefined)

  const rangeHeight = () =>
    props.max + paddingMax() + paddingMin() - props.min * 2

  const zoom = whenMemo(
    domRect,
    (domRect) => ({
      x: 1,
      y: (domRect.height / rangeHeight()) * (props.zoom?.y || 1),
    }),
    { x: 1, y: 1 }
  )

  const origin = createMemo(() => ({
    x: 0,
    y: (paddingMin() - props.min) / (props.zoom?.y || 1),
  }))

  function project(point: Vector | number, type: 'x' | 'y') {
    const value = typeof point === 'object' ? point[type] : point
    return (value + origin()[type]) * zoom()[type]
  }

  function unproject(point: Vector | number, type: 'x' | 'y') {
    const value = typeof point === 'object' ? point[type] : point
    return (value - origin()[type]) / zoom()[type]
  }

  function onAnchorChange({
    position,
    index,
    type,
  }: {
    position: Vector
    index: number
    type: 'pre' | 'post'
  }) {
    const [point] = props.absoluteAnchors[index]
    const [connectedPoint] =
      type === 'post'
        ? props.absoluteAnchors[index + 1]
        : props.absoluteAnchors[index - 1]

    let absoluteX = unproject(position, 'x')

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
      y: Math.floor(position.y - point.y),
      x: Math.abs(point.x - absoluteX) / deltaX,
    }

    props.onAnchorChange(index, 1, type, anchor)
  }

  function onPositionChange(index: number, position: Vector) {
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

  function maxPaddingFromVector(value: Vector) {
    return Math.max(value.y, props.max) - props.max
  }
  function minPaddingFromVector(value: Vector) {
    return props.min - Math.min(value.y, props.min)
  }

  function updatePadding() {
    let min = 0
    let max = 0
    props.absoluteAnchors.forEach(([anchor, { pre, post } = {}]) => {
      min = Math.max(min, minPaddingFromVector(anchor))
      max = Math.max(max, maxPaddingFromVector(anchor))
      if (pre) {
        min = Math.max(min, minPaddingFromVector(pre))
        max = Math.max(max, maxPaddingFromVector(pre))
      }
      if (post) {
        min = Math.max(min, minPaddingFromVector(post))
        max = Math.max(max, maxPaddingFromVector(post))
      }
    })

    setPaddingMin(min)
    setPaddingMax(max)
  }

  function onDrag(e: MouseEvent) {
    const time = props.time!
    pointerHelper(e, (delta) => props.onTimeChange?.(time - delta.x))
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

  onMount(updatePadding)

  return (
    <TimelineContext.Provider
      value={{
        origin,
        zoom,
        project,
        unproject,
      }}
    >
      <svg
        ref={onRef}
        width="100%"
        height="100%"
        {...rest}
        onPointerMove={(e) => {
          setPresence(e.clientX)
        }}
        onPointerLeave={() => {
          setPresence(undefined)
        }}
      >
        <Show when={presence()}>
          {(presence) => (
            <>
              <line
                y1={0}
                y2={domRect()?.height}
                x1={presence()}
                x2={presence()}
                stroke="black"
              />
              <circle
                cx={presence()}
                cy={project(props.getValue(presence()), 'y')!}
                r={3}
              />
            </>
          )}
        </Show>
        <Show when={props.time}>
          {(time) => (
            <>
              <line
                x1={time()}
                x2={time()}
                y1={0}
                y2={window.innerHeight}
                onPointerDown={onDrag}
                stroke="black"
                style={{
                  cursor: 'ew-resize',
                }}
              />
              <circle
                cx={time()}
                cy={project(props.getValue(time()), 'y')!}
                r={3}
              />
            </>
          )}
        </Show>
        <For each={props.absoluteAnchors}>
          {([point, { pre, post } = {}], index) => (
            <Point
              position={point}
              pre={pre}
              post={post}
              onPositionChange={(position) =>
                onPositionChange(index(), position)
              }
              onPositionChangeEnd={updatePadding}
              onPreChange={(position) =>
                onAnchorChange({
                  position,
                  index: index(),
                  type: 'pre',
                })
              }
              onPreChangeEnd={updatePadding}
              onPostChange={(position) =>
                onAnchorChange({
                  position,
                  index: index(),
                  type: 'post',
                })
              }
              onPostChangeEnd={updatePadding}
            />
          )}
        </For>
        <path
          stroke="black"
          fill="transparent"
          d={props.d({ zoom: zoom(), origin: origin() })}
          style={{ 'pointer-events': 'none' }}
        />
        <line
          x1={0}
          x2={domRect()?.width}
          y1={project(props.max, 'y')}
          y2={project(props.max, 'y')}
          stroke="black"
          stroke-dasharray="20 10"
        />
        <line
          x1={0}
          x2={domRect()?.width}
          y1={project(props.min, 'y')}
          y2={project(props.min, 'y')}
          stroke="black"
          stroke-dasharray="20 10"
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

export function createTimeline(config?: { initial?: Anchors }) {
  const [anchors, setAnchors] = createStore<Anchors>(config?.initial || [])

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

      return [point, controls] as Anchor
    }
  )

  const _lookupMapSegments = indexComputed(absoluteAnchors, (point, index) => {
    const next = absoluteAnchors()[index + 1]
    return next
      ? {
          range: [point[0].x, next[0].x],
          map: createLookupMap(point, next),
        }
      : undefined
  })

  const lookupMapSegments = createMemo(
    () => _lookupMapSegments().slice(0, -1) as Array<Segment>
  )

  function closestPoint(time: number) {
    const segments = lookupMapSegments()

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
      return segment.range[0] < time && time < segment.range[1]
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

      if (current.x < time && time < next.x) {
        return [current, next]
      }
    }

    return [null, null]
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

    if (left === null && right) return right.y
    if (right === null && left) return left.y
    if (left === null || right === null) return 0

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
        'onAnchorChange' | 'absoluteAnchors' | 'd' | 'getValue'
      >
    ) => (
      <Timeline
        onAnchorChange={setAnchors}
        absoluteAnchors={absoluteAnchors()}
        getValue={getValue}
        d={d}
        {...props}
      />
    ),
  }
}
