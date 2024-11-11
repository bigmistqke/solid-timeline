import clsx from 'clsx'
import {
  ComponentProps,
  For,
  Index,
  Show,
  createSignal,
  onCleanup,
  splitProps,
} from 'solid-js'
import { useGraph } from './create-graph-component'
import { divideVector, subtractVector } from './lib/vector'
import { useSheet } from './sheet'
import styles from './timeline.module.css'
import { Vector } from './types'
import { whenMemo } from './utils/once-every-when'
import { pointerHelper } from './utils/pointer-helper'

export const graphComponentNames = [
  'Anchor',
  'Control',
  'Grid',
  'Handle',
  'Indicator',
  'Path',
  'Root',
] as const

export interface GraphComponents {
  Anchor: typeof Anchor
  Control: typeof Control
  Grid: typeof Grid
  Handle: typeof Handle
  Indicator: typeof Indicator
  Path: typeof Path
  Root: typeof Root
}

/**********************************************************************************/
/*                                                                                */
/*                                     Grid                                    */
/*                                                                                */
/**********************************************************************************/

export interface GridProps {
  grid: Vector
}

export function Grid(props: GridProps) {
  const graph = useGraph()

  const offset = () => ({
    x: Math.floor(graph.offset().x / props.grid.x) * props.grid.x * -1,
    y: 0,
  })

  return (
    <Show when={graph.dimensions()}>
      {(dimensions) => (
        <g data-timeline-grid class={styles.grid} stroke="lightgrey">
          <g data-timeline-grid-horizontal>
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
          <g data-timeline-grid-vertical>
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

export function Handle(props: HandleProps) {
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
      stroke="none"
      fill="black"
    >
      <circle
        data-timeline-handle-trigger={props.type}
        cx={graph.project(props.position, 'x')}
        cy={graph.project(props.position, 'y')}
        class={styles.handleTrigger}
        fill="transparent"
        onDblClick={(e) => {
          if (props.onDblClick) {
            e.stopPropagation()
            props.onDblClick(e)
          }
        }}
        onPointerDown={onPointerDown}
        r="10"
      />
      <circle
        data-timeline-handle-visual={props.type}
        class={styles.handleVisual}
        cx={graph.project(props.position, 'x')}
        cy={graph.project(props.position, 'y')}
        r="3"
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

export function Control(props: ControlProps) {
  const graph = useGraph()
  const [, rest] = splitProps(props, ['control', 'position'])
  return (
    <g data-timeline-control={props.type}>
      <g data-timeline-control-line={props.type} class={styles.controlLine}>
        <line
          data-timeline-control-line-clamped={props.type}
          x1={graph.project(props.position, 'x')}
          y1={graph.project(props.position, 'y')}
          x2={graph.project(props.clampedControl, 'x')}
          y2={graph.project(props.clampedControl, 'y')}
        />
        <line
          data-timeline-control-line-unclamped={props.type}
          stroke-dasharray="2px 2px"
          x1={graph.project(props.clampedControl, 'x')}
          y1={graph.project(props.clampedControl, 'y')}
          x2={graph.project(props.control, 'x')}
          y2={graph.project(props.control, 'y')}
        />
      </g>
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

export function Anchor(props: AnchorProps) {
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

export function Indicator(props: Indicator) {
  const graph = useGraph()

  return (
    <g
      data-timeline-indicator={props.type}
      class={clsx(styles.indicator, props.class)}
      onPointerDown={props.onPointerDown}
    >
      <line
        data-timeline-indicator-line={props.type}
        y1={0}
        y2={props.height}
        x1={graph.project(props.time, 'x')}
        x2={graph.project(props.time, 'x')}
      />
      <circle
        data-timeline-indicator-circle={props.type}
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

export function Path() {
  const graph = useGraph()
  return (
    <path
      data-timeline-path
      fill="none"
      d={graph.d()}
      style={{ 'pointer-events': 'none' }}
    />
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                     Graph                                      */
/*                                                                                */
/**********************************************************************************/

export interface RootProps extends ComponentProps<'div'> {
  grid?: Vector
}

export function Root(props: RootProps) {
  const sheet = useSheet()
  const graph = useGraph()

  const [config, rest] = splitProps(props, ['children', 'grid'])

  const [cursor, setCursor] = createSignal<Vector | undefined>(undefined)

  const presence = whenMemo(cursor, (cursor) => {
    if (sheet.modifiers.meta || graph.isOutOfBounds(cursor.x)) {
      return cursor
    }
    return {
      x: cursor.x,
      y: graph.getValue(cursor.x),
    }
  })

  return (
    <div {...rest}>
      <svg
        data-timeline-root
        ref={(element) => {
          function updateDomRect() {
            graph.setDimensions(element.getBoundingClientRect())
            graph.updatePadding()
          }
          const observer = new ResizeObserver(updateDomRect)
          observer.observe(element)
          updateDomRect()
          onCleanup(() => observer.disconnect())

          graph.updatePadding()
        }}
        width="100%"
        height="100%"
        stroke="black"
        class={styles.timeline}
        onPointerDown={async (event) => {
          if (event.target !== event.currentTarget) {
            return
          }
          const x = sheet.pan()
          await pointerHelper(event, ({ delta, event }) => {
            sheet.setPan(x - delta.x / graph.zoom().x)
            setCursor((presence) => ({
              ...presence!,
              x: graph.unproject(event.offsetX, 'x'),
            }))
          })
        }}
        onPointerMove={(e) => {
          setCursor(
            graph.unproject({
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
            graph.addAnchor(anchor.x, anchor.y)
            graph.updatePadding()
          }
        }}
        onWheel={(e) => {
          sheet.setPan((pan) => pan - e.deltaX)
        }}
      >
        <Show when={config.grid}>{(grid) => <Grid grid={grid()} />}</Show>
        <graph.Path />
        <Show when={!sheet.isDraggingHandle() && presence()}>
          {(presence) => (
            <graph.Indicator
              height={window.innerHeight}
              time={presence().x}
              value={presence().y}
              class={styles.presence}
              type="cursor"
            />
          )}
        </Show>
        <graph.Indicator
          height={window.innerHeight}
          time={sheet.time()}
          type="time"
        />
        <For each={graph.absoluteAnchors}>
          {(anchor, index) => {
            const [position, controls] = anchor
            return (
              <graph.Anchor
                position={position}
                pre={controls?.pre}
                post={controls?.post}
                clampedPre={graph.clampedAnchors[index()][1]?.pre}
                clampedPost={graph.clampedAnchors[index()][1]?.post}
                onDeleteAnchor={() => graph.deleteAnchor(index())}
                onControlDragStart={async function (type, event) {
                  const initialControl = { ...controls![type]! }
                  const pairedType = type === 'pre' ? 'post' : 'pre'

                  await pointerHelper(event, ({ delta }) => {
                    delta = divideVector(delta, graph.zoom())

                    const absoluteControl = subtractVector(
                      initialControl,
                      delta
                    )
                    const control = graph.absoluteToRelativeControl({
                      index: index(),
                      type,
                      absoluteControl,
                    })
                    graph.setAnchors(index(), 1, type, control)

                    // Symmetric dragging of paired control
                    if (
                      sheet.modifiers.meta &&
                      index() !== graph.absoluteAnchors.length - 1 &&
                      index() !== 0
                    ) {
                      console.log(index(), graph.absoluteAnchors.length)
                      graph.setAnchors(index(), 1, pairedType, {
                        x: control.x,
                        y: control.y * -1,
                      })
                    }
                  })

                  graph.updatePadding()
                }}
                onPositionDragStart={async function (event) {
                  const initialPosition = { ...anchor[0] }

                  const pre = graph.getPairedAnchorPosition('pre', index())
                  const post = graph.getPairedAnchorPosition('post', index())

                  await pointerHelper(event, ({ delta }) => {
                    delta = divideVector(delta, graph.zoom())

                    const position = subtractVector(initialPosition, delta)

                    // Clamp position with the pre-anchor's position
                    if (pre && position.x - 1 < pre.x) {
                      position.x = pre.x + 1
                    }

                    // Clamp position with the pre-anchor's position
                    if (post && position.x + 1 > post.x) {
                      position.x = post.x - 1
                    }

                    graph.setAnchors(index(), 0, position)
                  })

                  graph.updatePadding()
                }}
              />
            )
          }}
        </For>
        {props.children}
      </svg>
    </div>
  )
}
