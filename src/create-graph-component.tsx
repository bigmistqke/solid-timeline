import clsx from 'clsx'
import {
  Accessor,
  ComponentProps,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import { Api } from './create-timeline'
import { divideVector, subtractVector } from './lib/vector'
import { useSheet } from './sheet'
import styles from './timeline.module.css'
import { Vector } from './types'
import { processProps } from './utils/default-props'
import { whenMemo } from './utils/once-every-when'
import { pointerHelper } from './utils/pointer-helper'

/**********************************************************************************/
/*                                                                                */
/*                                  Use Timeline                                  */
/*                                                                                */
/**********************************************************************************/

const TimelineContext = createContext<{
  project(point: Vector | number, type: 'x' | 'y'): number
  unproject(point: Vector | number, type: 'x' | 'y'): number
  dimensions: Accessor<{ width: number; height: number } | undefined>
  zoom: Accessor<Vector>
  offset: Accessor<Vector>
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
/*                                     Grid                                    */
/*                                                                                */
/**********************************************************************************/

function Grid(props: { grid: Vector }) {
  const timeline = useTimeline()

  const offset = () => ({
    x: Math.floor(timeline.offset().x / props.grid.x) * props.grid.x * -1,
    y: 0,
  })

  return (
    <Show when={timeline.dimensions()}>
      {(dimensions) => (
        <g data-timeline-grid class={styles.grid}>
          <g data-timeline-grid-horizontal class={styles.horizontal}>
            <Index
              each={Array.from({
                length: Math.floor(
                  dimensions().height / (props.grid.y * timeline.zoom().y) + 2
                ),
              })}
            >
              {(_, y) => (
                <line
                  x1={0}
                  x2={dimensions().width}
                  y1={timeline.project(y * props.grid.y, 'y') + offset().y}
                  y2={timeline.project(y * props.grid.y, 'y') + offset().y}
                />
              )}
            </Index>
          </g>
          <g data-timeline-grid-horizontal class={styles.vertical}>
            <Index
              each={Array.from({
                length:
                  Math.floor(
                    dimensions().width / (props.grid.x * timeline.zoom().x)
                  ) + 2,
              })}
            >
              {(_, x) => (
                <line
                  x1={timeline.project(x * props.grid.x, 'x') + offset().x}
                  x2={timeline.project(x * props.grid.x, 'x') + offset().x}
                  y1={0}
                  y2={dimensions().height}
                />
              )}
            </Index>
          </g>
        </g>
      )}
    </Show>
  )
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
  type: string
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
    <g
      data-timeline-handle={props.type}
      class={active() ? styles.active : undefined}
    >
      <circle
        data-timeline-handle-trigger={props.type}
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
        data-timeline-handle-visual={props.type}
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
  clampedControl: Vector
  control: Vector
  onDragStart(event: MouseEvent): Promise<void>
  position: Vector
  type: string
}) {
  const timeline = useTimeline()
  const [, rest] = splitProps(props, ['control', 'position'])
  return (
    <g data-timeline-control={props.type}>
      <line
        data-timeline-control-clamped={props.type}
        class={styles.controlClamped}
        stroke="black"
        x1={timeline.project(props.position, 'x')}
        y1={timeline.project(props.position, 'y')}
        x2={timeline.project(props.clampedControl, 'x')}
        y2={timeline.project(props.clampedControl, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
      <line
        data-timeline-control-unclamped={props.type}
        class={styles.controlUnclamped}
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
    <g data-timeline-anchor>
      <Show when={props.pre}>
        <Control
          type="pre"
          clampedControl={props.clampedPre!}
          control={props.pre!}
          onDragStart={(event) => props.onControlDragStart('pre', event)}
          position={props.position}
        />
      </Show>
      <Show when={props.post}>
        <Control
          type="post"
          clampedControl={props.clampedPost!}
          control={props.post!}
          onDragStart={(event) => props.onControlDragStart('post', event)}
          position={props.position}
        />
      </Show>
      <Handle
        type="position"
        position={props.position}
        onDragStart={(event) => props.onPositionDragStart(event)}
        onDblClick={props.onDeleteAnchor}
      />
    </g>
  )
}

export interface TimelineProps extends ComponentProps<'div'> {
  max: number
  min: number
  onPan?(pan: number): void
  onTimeChange?(time: number): void
  onZoomChange?(zoom: Vector): void
  paddingY?: number
  grid?: {
    x: number
    y: number
  }
}

export function createGraphComponent({
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
    type: string
  }) {
    const timeline = useTimeline()

    return (
      <g
        data-timeline-indicator={props.type}
        class={clsx(styles.indicator, props.class)}
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

  return function Graph(props: TimelineProps) {
    const sheet = useSheet()
    const [config, rest] = processProps(props, { paddingY: 10 }, [
      'max',
      'min',
      'onPan',
      'onTimeChange',
      'onZoomChange',
      'children',
      'paddingY',
      'grid',
    ])

    const [dimensions, setDimensions] = createSignal<{
      width: number
      height: number
    }>()
    const [paddingMax, setPaddingMax] = createSignal(0)
    const [paddingMin, setPaddingMin] = createSignal(0)

    const zoom = whenMemo(
      dimensions,
      (dimensions) => ({
        x: sheet.zoomX(),
        y:
          (dimensions.height - config.paddingY * 2) /
          (config.max - config.min + paddingMax() + paddingMin()),
      }),
      { x: 1, y: 1 }
    )

    const offset = createMemo(() => ({
      x: sheet.pan() * zoom().x,
      y: (paddingMin() - config.min) * zoom().y + config.paddingY,
    }))

    const [cursor, setCursor] = createSignal<Vector | undefined>(undefined)

    const presence = whenMemo(cursor, (cursor) => {
      if (sheet.modifiers.meta || isOutOfBounds(cursor.x)) {
        return cursor
      }
      return {
        x: cursor.x,
        y: getValue(cursor.x),
      }
    })

    function isOutOfBounds(x: number) {
      const [firstPosition] = absoluteAnchors[0]
      const [lastPosition] = absoluteAnchors[absoluteAnchors.length - 1]

      return x < firstPosition.x || x > lastPosition.x
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
      return value * zoom()[axis] + offset()[axis]
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
      return (value - offset()[axis]) / zoom()[axis]
    }

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

    return (
      <TimelineContext.Provider
        value={{
          project,
          unproject,
          dimensions,
          zoom,
          offset,
        }}
      >
        <div {...rest}>
          <svg
            ref={(element) => {
              function updateDomRect() {
                setDimensions(element.getBoundingClientRect())
                updatePadding()
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
            class={styles.timeline}
            onPointerDown={async (event) => {
              if (event.target !== event.currentTarget) {
                return
              }
              const x = sheet.pan()
              await pointerHelper(event, ({ delta, event }) => {
                sheet.setPan(x - delta.x / zoom().x)
                setCursor((presence) => ({
                  ...presence!,
                  x: unproject(event.offsetX, 'x'),
                }))
              })
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
              sheet.setPan((pan) => pan - e.deltaX)
            }}
          >
            <Show when={config.grid}>{(grid) => <Grid grid={grid()} />}</Show>
            <path
              data-timeline-path
              class={styles.path}
              d={d({
                zoom: zoom(),
                offset: offset(),
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
                  type="cursor"
                />
              )}
            </Show>
            <Indicator
              height={window.innerHeight}
              time={sheet.time()}
              type="time"
            />

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
                    onControlDragStart={async function (type, event) {
                      const initialControl = { ...controls![type]! }
                      const pairedType = type === 'pre' ? 'post' : 'pre'

                      await pointerHelper(event, ({ delta }) => {
                        delta = divideVector(delta, zoom())

                        const absoluteControl = subtractVector(
                          initialControl,
                          delta
                        )
                        const control = absoluteToRelativeControl({
                          index: index(),
                          type,
                          absoluteControl,
                        })
                        setAnchors(index(), 1, type, control)

                        // Symmetric dragging of paired control
                        if (
                          sheet.modifiers.meta &&
                          index() !== absoluteAnchors.length - 1 &&
                          index() !== 0
                        ) {
                          console.log(index(), absoluteAnchors.length)
                          setAnchors(index(), 1, pairedType, {
                            x: control.x,
                            y: control.y * -1,
                          })
                        }
                      })

                      updatePadding()
                    }}
                    onPositionDragStart={async function (event) {
                      const initialPosition = { ...anchor[0] }

                      const pre = getPairedAnchorPosition('pre', index())
                      const post = getPairedAnchorPosition('post', index())

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

                        setAnchors(index(), 0, position)
                      })

                      updatePadding()
                    }}
                  />
                )
              }}
            </For>
            {config.children}
          </svg>
        </div>
      </TimelineContext.Provider>
    )
  }
}
