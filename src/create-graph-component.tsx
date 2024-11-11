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
import { DConfig } from './lib/d-from-anchors'
import { divideVector, subtractVector } from './lib/vector'
import { useSheet } from './sheet'
import styles from './timeline.module.css'
import { type Anchor, Merge, Vector } from './types'
import { processProps } from './utils/default-props'
import { whenMemo } from './utils/once-every-when'
import { pointerHelper } from './utils/pointer-helper'

/**********************************************************************************/
/*                                                                                */
/*                                  Use Graph                                  */
/*                                                                                */
/**********************************************************************************/

export interface GraphComponents {
  Anchor: typeof Anchor
  Control: typeof Control
  Grid: typeof Grid
  Handle: typeof Handle
  Indicator: typeof Indicator
  Path: typeof Path
}
interface GraphContext extends Merge<Api, GraphComponents> {
  project(point: Vector): Vector
  project(point: Vector | number, type: 'x' | 'y'): number
  unproject(point: Vector): Vector
  unproject(point: Vector | number, type: 'x' | 'y'): number
  dimensions: Accessor<{ width: number; height: number } | undefined>
  zoom: Accessor<Vector>
  offset: Accessor<Vector>
  getValue(time: number): number
}

const GraphContext = createContext<GraphContext>()

export function useGraph() {
  const context = useContext(GraphContext)
  if (!context) {
    throw `useGraph should be used in a descendant of Timeline`
  }
  return context
}

/**********************************************************************************/
/*                                                                                */
/*                                     Grid                                    */
/*                                                                                */
/**********************************************************************************/

export interface GridProps {
  grid: Vector
}

function Grid(props: GridProps) {
  const graph = useGraph()

  const offset = () => ({
    x: Math.floor(graph.offset().x / props.grid.x) * props.grid.x * -1,
    y: 0,
  })

  return (
    <Show when={graph.dimensions()}>
      {(dimensions) => (
        <g data-timeline-grid class={styles.grid}>
          <g data-timeline-grid-horizontal class={styles.horizontal}>
            <Index
              each={Array.from({
                length: Math.floor(
                  dimensions().height / (props.grid.y * graph.zoom().y) + 2
                ),
              })}
            >
              {(_, y) => (
                <line
                  x1={0}
                  x2={dimensions().width}
                  y1={graph.project(y * props.grid.y, 'y') + offset().y}
                  y2={graph.project(y * props.grid.y, 'y') + offset().y}
                />
              )}
            </Index>
          </g>
          <g data-timeline-grid-horizontal class={styles.vertical}>
            <Index
              each={Array.from({
                length:
                  Math.floor(
                    dimensions().width / (props.grid.x * graph.zoom().x)
                  ) + 2,
              })}
            >
              {(_, x) => (
                <line
                  x1={graph.project(x * props.grid.x, 'x') + offset().x}
                  x2={graph.project(x * props.grid.x, 'x') + offset().x}
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

export interface HandleProps {
  position: Vector
  onDragStart(event: MouseEvent): Promise<void>
  onDblClick?(e: MouseEvent): void
  type: string
}

function Handle(props: HandleProps) {
  const graph = useGraph()
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
        cx={graph.project(props.position, 'x')}
        cy={graph.project(props.position, 'y')}
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
        cx={graph.project(props.position, 'x')}
        cy={graph.project(props.position, 'y')}
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

export type ControlProps = {
  clampedControl: Vector
  control: Vector
  onDragStart(event: MouseEvent): Promise<void>
  position: Vector
  type: string
}

function Control(props: ControlProps) {
  const graph = useGraph()
  const [, rest] = splitProps(props, ['control', 'position'])
  return (
    <g data-timeline-control={props.type}>
      <line
        data-timeline-control-clamped={props.type}
        class={styles.controlClamped}
        stroke="black"
        x1={graph.project(props.position, 'x')}
        y1={graph.project(props.position, 'y')}
        x2={graph.project(props.clampedControl, 'x')}
        y2={graph.project(props.clampedControl, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
      <line
        data-timeline-control-unclamped={props.type}
        class={styles.controlUnclamped}
        stroke="lightgrey"
        x1={graph.project(props.clampedControl, 'x')}
        y1={graph.project(props.clampedControl, 'y')}
        x2={graph.project(props.control, 'x')}
        y2={graph.project(props.control, 'y')}
        style={{ 'pointer-events': 'none' }}
      />
      <graph.Handle position={props.control} {...rest} />
    </g>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                     Anchor                                     */
/*                                                                                */
/**********************************************************************************/

export interface AnchorProps {
  onDeleteAnchor(): void
  onControlDragStart(type: 'pre' | 'post', event: MouseEvent): Promise<void>
  onPositionDragStart(event: MouseEvent): Promise<void>
  position: Vector
  post?: Vector
  clampedPost?: Vector
  pre?: Vector
  clampedPre?: Vector
}

function Anchor(props: AnchorProps) {
  const graph = useGraph()
  return (
    <g data-timeline-anchor>
      <Show when={props.pre}>
        <graph.Control
          type="pre"
          clampedControl={props.clampedPre!}
          control={props.pre!}
          onDragStart={(event) => props.onControlDragStart('pre', event)}
          position={props.position}
        />
      </Show>
      <Show when={props.post}>
        <graph.Control
          type="post"
          clampedControl={props.clampedPost!}
          control={props.post!}
          onDragStart={(event) => props.onControlDragStart('post', event)}
          position={props.position}
        />
      </Show>
      <graph.Handle
        type="position"
        position={props.position}
        onDragStart={(event) => props.onPositionDragStart(event)}
        onDblClick={props.onDeleteAnchor}
      />
    </g>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                    Indicator                                   */
/*                                                                                */
/**********************************************************************************/

export interface Indicator {
  height: number
  time: number
  value?: number
  class?: string
  onPointerDown?: (event: MouseEvent) => void
  type: string
}

function Indicator(props: Indicator) {
  const graph = useGraph()

  return (
    <g
      data-timeline-indicator={props.type}
      class={clsx(styles.indicator, props.class)}
      onPointerDown={props.onPointerDown}
    >
      <line
        y1={0}
        y2={props.height}
        x1={graph.project(props.time, 'x')}
        x2={graph.project(props.time, 'x')}
      />
      <circle
        cx={graph.project(props.time, 'x')}
        cy={graph.project(props.value || graph.getValue(props.time), 'y')!}
        r={3}
      />
    </g>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                       Path                                     */
/*                                                                                */
/**********************************************************************************/

function Path() {
  const graph = useGraph()
  return (
    <path
      data-timeline-path
      class={styles.path}
      d={graph.d()}
      style={{ 'pointer-events': 'none' }}
    />
  )
}

/**********************************************************************************/
/*                                                                                */
/*                             Create Graph Component                             */
/*                                                                                */
/**********************************************************************************/

export interface TimelineProps
  extends Merge<ComponentProps<'div'>, Partial<GraphComponents>> {
  grid?: {
    x: number
    y: number
  }
  max: number
  min: number
  onPan?(pan: number): void
  onTimeChange?(time: number): void
  onZoomChange?(zoom: Vector): void
  paddingY?: number
}

export function createGraphComponent(api: Api) {
  return function Graph(props: TimelineProps) {
    const sheet = useSheet()
    const [config, rest] = processProps(
      props,
      {
        paddingY: 10,
        Path,
        Anchor,
        Indicator,
        Control,
        Handle,
        Grid,
      },
      [
        'children',
        'grid',
        'max',
        'min',
        'onPan',
        'onTimeChange',
        'onZoomChange',
        'paddingY',
        // Components
        'Anchor',
        'Control',
        'Grid',
        'Handle',
        'Indicator',
        'Path',
      ]
    )

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
        y: api.getValue(cursor.x),
      }
    })

    function isOutOfBounds(x: number) {
      const [firstPosition] = api.absoluteAnchors[0]
      const [lastPosition] = api.absoluteAnchors[api.absoluteAnchors.length - 1]

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
      const [position] = api.absoluteAnchors[index]
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
      api.absoluteAnchors.forEach(([position, { pre, post } = {}]) => {
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
      <GraphContext.Provider
        value={{
          ...api,
          d: (config?: DConfig) => {
            return api.d(config ?? { zoom: zoom(), offset: offset() })
          },
          project,
          unproject,
          dimensions,
          zoom,
          offset,
          getValue: api.getValue,
          get Path() {
            return config.Path
          },
          get Anchor() {
            return config.Anchor
          },
          get Control() {
            return config.Control
          },
          get Indicator() {
            return config.Indicator
          },
          get Grid() {
            return config.Grid
          },
          get Handle() {
            return config.Handle
          },
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
                api.addAnchor(anchor.x, anchor.y)
                updatePadding()
              }
            }}
            onWheel={(e) => {
              sheet.setPan((pan) => pan - e.deltaX)
            }}
          >
            <Show when={config.grid}>{(grid) => <Grid grid={grid()} />}</Show>
            <config.Path />
            <Show when={!sheet.isDraggingHandle() && presence()}>
              {(presence) => (
                <config.Indicator
                  height={window.innerHeight}
                  time={presence().x}
                  value={presence().y}
                  class={styles.presence}
                  type="cursor"
                />
              )}
            </Show>
            <config.Indicator
              height={window.innerHeight}
              time={sheet.time()}
              type="time"
            />
            <For each={api.absoluteAnchors}>
              {(anchor, index) => {
                const [position, controls] = anchor
                return (
                  <config.Anchor
                    position={position}
                    pre={controls?.pre}
                    post={controls?.post}
                    clampedPre={api.clampedAnchors[index()][1]?.pre}
                    clampedPost={api.clampedAnchors[index()][1]?.post}
                    onDeleteAnchor={() => api.deleteAnchor(index())}
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
                        api.setAnchors(index(), 1, type, control)

                        // Symmetric dragging of paired control
                        if (
                          sheet.modifiers.meta &&
                          index() !== api.absoluteAnchors.length - 1 &&
                          index() !== 0
                        ) {
                          console.log(index(), api.absoluteAnchors.length)
                          api.setAnchors(index(), 1, pairedType, {
                            x: control.x,
                            y: control.y * -1,
                          })
                        }
                      })

                      updatePadding()
                    }}
                    onPositionDragStart={async function (event) {
                      const initialPosition = { ...anchor[0] }

                      const pre = api.getPairedAnchorPosition('pre', index())
                      const post = api.getPairedAnchorPosition('post', index())

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

                        api.setAnchors(index(), 0, position)
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
      </GraphContext.Provider>
    )
  }
}
