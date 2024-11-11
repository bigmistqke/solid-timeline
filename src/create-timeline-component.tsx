import clsx from 'clsx'
import {
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
import { Api } from './create-timeline'
import { divideVector, subtractVector } from './lib/vector'
import { useSheet } from './sheet'
import styles from './timeline.module.css'
import { Anchor as AnchorType, Vector } from './types'
import { processProps } from './utils/default-props'
import { when, whenMemo } from './utils/once-every-when'
import { pointerHelper } from './utils/pointer-helper'

/**********************************************************************************/
/*                                                                                */
/*                                  Use Timeline                                  */
/*                                                                                */
/**********************************************************************************/

const TimelineContext = createContext<{
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

/**********************************************************************************/
/*                                                                                */
/*                                     Handle                                     */
/*                                                                                */
/**********************************************************************************/

function Handle(props: {
  position: Vector
  onDragStart(event: MouseEvent): Promise<void>
  onDblClick?(e: MouseEvent): void
}) {
  const timeline = useTimeline()
  const sheet = useSheet()

  const [active, setActive] = createSignal(false)

  async function onPointerDown(event: MouseEvent) {
    setActive(true)
    sheet.setIsDraggingHandle(true)

    await props.onDragStart(event)

    setActive(false)
    sheet.setIsDraggingHandle(false)
  }

  return (
    <g class={clsx(styles.handleContainer, active() && styles.active)}>
      <circle
        cx={timeline.project(props.position, 'x')}
        cy={timeline.project(props.position, 'y')}
        fill="transparent"
        onDblClick={(e) => {
          if (props.onDblClick) {
            e.stopPropagation()
            props.onDblClick(e)
          }
        }}
        onPointerDown={onPointerDown}
        r="10"
        style={{ cursor: 'move' }}
      />
      <circle
        class={styles.handle}
        cx={timeline.project(props.position, 'x')}
        cy={timeline.project(props.position, 'y')}
        r="3"
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
  clampedControl: Vector
  onDragStart(event: MouseEvent): Promise<void>
}) {
  const timeline = useTimeline()
  const [, rest] = splitProps(props, ['control', 'position'])
  return (
    <g class={styles.controlContainer}>
      <line
        class={styles.clamped}
        stroke="black"
        x1={timeline.project(props.position, 'x')}
        y1={timeline.project(props.position, 'y')}
        x2={timeline.project(props.clampedControl, 'x')}
        y2={timeline.project(props.clampedControl, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
      <line
        class={styles.unclamped}
        stroke="lightgrey"
        x1={timeline.project(props.clampedControl, 'x')}
        y1={timeline.project(props.clampedControl, 'y')}
        x2={timeline.project(props.control, 'x')}
        y2={timeline.project(props.control, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
      <Handle position={props.control} {...rest} />
    </g>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                     Anchor                                     */
/*                                                                                */
/**********************************************************************************/

function Anchor(props: {
  onDeleteAnchor(): void
  onControlDragStart(type: 'pre' | 'post', event: MouseEvent): Promise<void>
  onPositionDragStart(event: MouseEvent): Promise<void>
  position: Vector
  post?: Vector
  clampedPost?: Vector
  pre?: Vector
  clampedPre?: Vector
}) {
  return (
    <>
      <Show when={props.pre}>
        <Control
          position={props.position}
          control={props.pre!}
          clampedControl={props.clampedPre!}
          onDragStart={(event) => props.onControlDragStart('pre', event)}
        />
      </Show>
      <Show when={props.post}>
        <Control
          position={props.position}
          control={props.post!}
          clampedControl={props.clampedPost!}
          onDragStart={(event) => props.onControlDragStart('post', event)}
        />
      </Show>
      <Handle
        position={props.position}
        onDragStart={(event) => props.onPositionDragStart(event)}
        onDblClick={props.onDeleteAnchor}
      />
    </>
  )
}

export function createTimelineComponent({
  absoluteAnchors,
  addAnchor,
  clampedAnchors,
  d,
  deleteAnchor,
  getPairedAnchorPosition,
  getValue,
  setAnchors,
}: Api) {
  function Indicator(props: {
    height: number
    time: number
    value?: number
    class?: string
    onPointerDown?: (event: MouseEvent) => void
  }) {
    const timeline = useTimeline()

    return (
      <g
        class={clsx(styles.timeIndicator, props.class)}
        onPointerDown={props.onPointerDown}
      >
        <line
          y1={0}
          y2={props.height}
          x1={timeline.project(props.time, 'x')}
          x2={timeline.project(props.time, 'x')}
        />
        <circle
          cx={timeline.project(props.time, 'x')}
          cy={timeline.project(props.value || getValue(props.time), 'y')!}
          r={3}
        />
      </g>
    )
  }

  return function Timeline(
    props: ComponentProps<'svg'> & {
      max: number
      min: number
      onPan?(pan: number): void
      onTimeChange?(time: number): void
      onZoomChange?(zoom: Vector): void
      paddingY?: number
    }
  ) {
    const sheet = useSheet()
    const [config, rest] = processProps(props, { paddingY: 10 }, [
      'max',
      'min',
      'onPan',
      'onTimeChange',
      'onZoomChange',
      'class',
      'children',
      'paddingY',
    ])

    const [domRect, setDomRect] = createSignal<DOMRect>()
    const [paddingMax, setPaddingMax] = createSignal(0)
    const [paddingMin, setPaddingMin] = createSignal(0)

    const [cursor, setCursor] = createSignal<
      { x: number; y?: number } | undefined
    >(undefined)
    const presence = createMemo(
      when(cursor, (cursor) => ({
        x: cursor.x,
        y:
          sheet.modifiers.meta || isOutOfBounds(cursor.x)
            ? cursor.y
            : getValue(cursor.x),
      }))
    )

    const zoom = whenMemo(
      domRect,
      (domRect) => ({
        x: sheet.zoomX(),
        y:
          (domRect.height - config.paddingY * 2) /
          (config.max - config.min + paddingMax() + paddingMin()),
      }),
      { x: 1, y: 1 }
    )

    const offset = {
      get x() {
        return sheet.pan() * zoom().x
      },
      get y() {
        return (paddingMin() - config.min) * zoom().y + config.paddingY
      },
    }

    function project(point: Vector | number): Vector
    function project(point: Vector | number, axis: 'x' | 'y'): number
    function project(
      point: Vector | number,
      axis?: 'x' | 'y'
    ): Vector | number {
      if (!axis) {
        return {
          x: project(point, 'x'),
          y: project(point, 'y'),
        }
      }

      const value = typeof point === 'object' ? point[axis] : point
      return value * zoom()[axis] + offset[axis]
    }

    function unproject(point: Vector): Vector
    function unproject(point: Vector | number, axis: 'x' | 'y'): number
    function unproject(
      point: Vector | number,
      axis?: 'x' | 'y'
    ): Vector | number {
      if (!axis) {
        return {
          x: unproject(point, 'x'),
          y: unproject(point, 'y'),
        }
      }

      const value = typeof point === 'object' ? point[axis] : point
      return (value - offset[axis]) / zoom()[axis]
    }

    /**
     * `absoluteToRelativeControl` applies 3 operations on the given absolute control-vector:
     * - Clamps absolute x-value to ensure monotonicity of the curve
     * - Absolute x-value to relative x-value (range 0-1)
     * - Absolute y-value to relative y-value (offset from position)
     */
    function absoluteToRelativeControl({
      type,
      index,
      absoluteControl,
    }: {
      type: 'pre' | 'post'
      index: number
      absoluteControl: Vector
    }) {
      const [position] = absoluteAnchors[index]
      return {
        // Absolute value to absolute offset from position
        y: Math.floor(absoluteControl.y - position.y),
        // Absolute value to relative range [0-1]
        x:
          type === 'pre'
            ? Math.floor(position.x - absoluteControl.x)
            : Math.floor(absoluteControl.x - position.x),
      }
    }

    async function onControlDragStart({
      type,
      event,
      anchor: [, controls],
      index,
    }: {
      type: 'pre' | 'post'
      event: MouseEvent
      anchor: AnchorType
      index: number
    }) {
      const initialControl = { ...controls![type]! }
      const pairedType = type === 'pre' ? 'post' : 'pre'

      await pointerHelper(event, ({ delta }) => {
        delta = divideVector(delta, zoom())

        const absoluteControl = subtractVector(initialControl, delta)
        const control = absoluteToRelativeControl({
          index,
          type,
          absoluteControl,
        })
        setAnchors(index, 1, type, control)

        // Symmetric dragging of paired control
        if (
          sheet.modifiers.meta &&
          index !== absoluteAnchors.length - 1 &&
          index !== 0
        ) {
          console.log(index, absoluteAnchors.length)
          setAnchors(index, 1, pairedType, {
            x: control.x,
            y: control.y * -1,
          })
        }
      })

      updatePadding()
    }

    async function onPositionDragStart({
      anchor,
      event,
      index,
    }: {
      anchor: AnchorType
      event: MouseEvent
      index: number
    }) {
      const initialPosition = { ...anchor[0] }

      const pre = getPairedAnchorPosition('pre', index)
      const post = getPairedAnchorPosition('post', index)

      await pointerHelper(event, ({ delta }) => {
        delta = divideVector(delta, zoom())

        const position = subtractVector(initialPosition, delta)

        // Clamp position with the pre-anchor's position
        if (pre && position.x - 1 < pre.x) {
          position.x = pre.x + 1
        }

        // Clamp position with the pre-anchor's position
        if (post && position.x + 1 > post.x) {
          position.x = post.x - 1
        }

        setAnchors(index, 0, position)
      })

      updatePadding()
    }

    function maxPaddingFromVector(value: Vector) {
      return Math.max(value.y, config.max) - config.max
    }
    function minPaddingFromVector(value: Vector) {
      return config.min - Math.min(value.y, config.min)
    }

    function updatePadding() {
      let min = 0
      let max = 0
      absoluteAnchors.forEach(([position, { pre, post } = {}]) => {
        min = Math.max(min, minPaddingFromVector(position))
        max = Math.max(max, maxPaddingFromVector(position))
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

    const isOutOfBounds = (x: number) => {
      const [firstPosition] = absoluteAnchors[0]
      const [lastPosition] = absoluteAnchors[absoluteAnchors.length - 1]
      const presenceX = unproject(x, 'x')
      return presenceX < firstPosition.x || presenceX > lastPosition.x
    }

    return (
      <TimelineContext.Provider
        value={{
          project,
          unproject,
        }}
      >
        <svg
          ref={(element) => {
            function updateDomRect() {
              setDomRect(element.getBoundingClientRect())
            }
            const observer = new ResizeObserver(updateDomRect)
            observer.observe(element)
            updateDomRect()
            onCleanup(() => observer.disconnect())

            updatePadding()
            createEffect(() => config.onZoomChange?.(zoom()))
            createEffect(() => config.onPan?.(sheet.pan()))
          }}
          width="100%"
          height="100%"
          class={clsx(config.class, styles.timeline)}
          {...rest}
          onPointerDown={async (event) => {
            if (event.target !== event.currentTarget) {
              return
            }
            if (sheet.modifiers.shift) {
              const x = sheet.pan()
              await pointerHelper(event, ({ delta, event }) => {
                sheet.setPan(x - delta.x / zoom().x)
                setCursor((presence) => ({
                  ...presence!,
                  x: unproject(event.offsetX, 'x'),
                }))
              })
            }
          }}
          onPointerMove={(e) => {
            setCursor(
              unproject({
                x: e.offsetX,
                y: e.offsetY,
              })
            )
          }}
          onPointerLeave={() => {
            setCursor(undefined)
          }}
          onDblClick={() => {
            const anchor = presence()
            if (anchor) {
              addAnchor(anchor.x, anchor.y)
              updatePadding()
            }
          }}
          onWheel={(e) => {
            sheet.setPan((pan) => pan + e.deltaX)
          }}
        >
          <path
            class={styles.path}
            d={d({
              zoom: zoom(),
              offset,
            })}
            style={{ 'pointer-events': 'none' }}
          />
          <Show when={!sheet.isDraggingHandle() && presence()}>
            {(presence) => (
              <Indicator
                height={window.innerHeight}
                time={presence().x}
                value={presence().y}
                class={styles.presence}
              />
            )}
          </Show>
          <Indicator height={window.innerHeight} time={sheet.time()} />
          <For each={absoluteAnchors}>
            {(anchor, index) => {
              const [position, controls] = anchor
              return (
                <Anchor
                  position={position}
                  pre={controls?.pre}
                  post={controls?.post}
                  clampedPre={clampedAnchors[index()][1]?.pre}
                  clampedPost={clampedAnchors[index()][1]?.post}
                  onDeleteAnchor={() => deleteAnchor(index())}
                  onControlDragStart={(type, event) =>
                    onControlDragStart({
                      type,
                      event,
                      index: index(),
                      anchor,
                    })
                  }
                  onPositionDragStart={(event) =>
                    onPositionDragStart({
                      event,
                      index: index(),
                      anchor,
                    })
                  }
                />
              )
            }}
          </For>
          {config.children}
        </svg>
      </TimelineContext.Provider>
    )
  }
}
