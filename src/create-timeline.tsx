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
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import { createStore, SetStoreFunction } from 'solid-js/store'
import { createLookupMap } from './lib/create-cubic-lookup-map'
import { dFromAbsoluteAnchors } from './lib/d-from-anchors'
import { getValueFromSegments } from './lib/get-value-from-segments'
import { vector } from './lib/vector'
import styles from './timeline.module.css'
import type { Anchor, Anchors, Segment, Vector } from './types'
import { indexComputed } from './utils/index-computed'
import { whenMemo } from './utils/once-every-when'
import { pointerHelper } from './utils/pointer-helper'

/**********************************************************************************/
/*                                                                                */
/*                                     Handle                                     */
/*                                                                                */
/**********************************************************************************/

const [draggingHandle, setDraggingHandle] = createSignal(false)

function Handle(props: {
  position: Vector
  onChange: (position: Vector) => void
  onChangeEnd: () => void
}) {
  const { project, zoom } = useTimeline()

  const [active, setActive] = createSignal(false)

  async function onPointerDown(e: MouseEvent) {
    setActive(true)
    setDraggingHandle(true)

    const position = { ...props.position }

    await pointerHelper(e, (delta) => {
      props.onChange(
        vector.subtract(position, {
          x: delta.x / zoom().x,
          y: delta.y / zoom().y,
        })
      )
    })

    props.onChangeEnd()
    setActive(false)
    setDraggingHandle(false)
  }

  return (
    <g class={clsx(styles.handleContainer, active() && styles.active)}>
      <circle
        cx={project(props.position, 'x')}
        cy={project(props.position, 'y')}
        r="10"
        onPointerDown={onPointerDown}
        fill="transparent"
        style={{ cursor: 'move' }}
      />
      <circle
        class={styles.handle}
        cx={project(props.position, 'x')}
        cy={project(props.position, 'y')}
        r="3"
        fill="black"
        style={{ 'pointer-events': 'none' }}
      />
    </g>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                     Control                                     */
/*                                                                                */
/**********************************************************************************/

function Control(props: {
  position: Vector
  control: Vector
  onChange: (position: Vector) => void
  onChangeEnd: () => void
}) {
  const { project } = useTimeline()
  const [, rest] = splitProps(props, ['control', 'position'])
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
      <Handle position={props.control} {...rest} />
    </>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                     Anchor                                     */
/*                                                                                */
/**********************************************************************************/

function Anchor(props: {
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
  return (
    <>
      <Handle
        position={props.position}
        onChange={props.onPositionChange}
        onChangeEnd={props.onPositionChangeEnd}
      />
      <Show when={props.pre}>
        <Control
          position={props.position}
          control={props.pre!}
          onChange={props.onPreChange}
          onChangeEnd={props.onPreChangeEnd}
        />
      </Show>
      <Show when={props.post}>
        <Control
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

    updatePadding()
    createEffect(() => props.onZoomChange?.(zoom()))
    createEffect(() => props.onOriginChange?.(origin()))
  }

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
        <Show when={!draggingHandle() && presence()}>
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
            <Anchor
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
          y1={project(props.max, 'y') - 1}
          y2={project(props.max, 'y') - 1}
          stroke="lightgrey"
        />
        <line
          x1={0}
          x2={domRect()?.width}
          y1={project(props.min, 'y') + 1}
          y2={project(props.min, 'y') + 1}
          stroke="lightgrey"
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

  const absoluteAnchors = createMemo(
    indexComputed(
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
  )

  const lookupMapSegments = createMemo(
    indexComputed(absoluteAnchors, (point, index) => {
      const next = absoluteAnchors()[index + 1]
      return next
        ? {
            range: [point[0].x, next[0].x],
            map: createLookupMap(point, next),
          }
        : undefined
    })
  )

  function d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) {
    return dFromAbsoluteAnchors(absoluteAnchors(), config)
  }

  function getValue(time: number) {
    const segments = lookupMapSegments().slice(0, -1) as Array<Segment>
    return getValueFromSegments(segments, time)
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
