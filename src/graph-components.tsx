import clsx from 'clsx'
import {
  ComponentProps,
  Index,
  Show,
  createSignal,
  onCleanup,
  splitProps,
} from 'solid-js'
import { useGraph } from './create-graph-component'
import { absoluteToRelativeControl } from './lib/absolute-to-relative-control'
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
] as const satisfies Array<keyof GraphComponents>

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

  const offset = (axis: 'x' | 'y') => {
    const projectedGrid = graph.project(props.grid[axis], axis)
    return Math.floor(graph.offset()[axis] / projectedGrid) * projectedGrid
  }

  return (
    <Show when={graph.dimensions()}>
      {(dimensions) => (
        <g data-timeline-grid class={styles.grid} stroke="lightgrey">
          <g data-timeline-grid-horizontal style={graph.offsetStyle('y')}>
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
                  y1={graph.project(y * props.grid.y, 'y') - offset('y')}
                  y2={graph.project(y * props.grid.y, 'y') - offset('y')}
                />
              )}
            </Index>
          </g>
          <g data-timeline-grid-vertical style={graph.offsetStyle('x')}>
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
                  x1={graph.project(x * props.grid.x, 'x') - offset('x')}
                  x2={graph.project(x * props.grid.x, 'x') - offset('x')}
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
  onPointerDown(event: MouseEvent): void | Promise<void>
  onDblClick?(e: MouseEvent): void
  type: 'pre' | 'post' | 'position'
}

export function Handle(props: HandleProps) {
  const graph = useGraph()
  const sheet = useSheet()

  const [active, setActive] = createSignal(false)

  async function onPointerDown(event: MouseEvent) {
    setActive(true)
    sheet.setIsDraggingHandle(true)

    await props.onPointerDown(event)

    setActive(false)
    sheet.setIsDraggingHandle(false)
  }

  function onDblClick(event: MouseEvent) {
    if (props.onDblClick) {
      event.stopPropagation()
      props.onDblClick(event)
    }
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
        onDblClick={onDblClick}
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

export interface ControlProps {
  index: number
  type: 'pre' | 'post'
}

export function Control(props: ControlProps) {
  const graph = useGraph()
  const sheet = useSheet()

  const position = () => graph.anchors[props.index].position
  const controls = () => graph.processedAnchors[props.index][props.type]

  return (
    <Show when={controls()}>
      {(controls) => {
        async function onPointerDown(event: MouseEvent) {
          const initialControl = { ...controls().unclamped }
          const pairedType = props.type === 'pre' ? 'post' : 'pre'

          await pointerHelper(event, ({ delta }) => {
            delta = divideVector(delta, graph.zoom())

            const absoluteControl = subtractVector(initialControl, delta)
            const control = absoluteToRelativeControl({
              position: position(),
              type: props.type,
              absoluteControl,
            })
            graph.setAnchors(props.index, props.type, control)

            // Symmetric dragging of paired control
            if (
              sheet.modifiers.meta &&
              props.index !== graph.anchors.length - 1 &&
              props.index !== 0
            ) {
              graph.setAnchors(props.index, pairedType, {
                x: control.x,
                y: control.y * -1,
              })
            }
          })

          graph.updateOverflow()
        }

        return (
          <g data-timeline-control={props.type}>
            <g
              data-timeline-control-line={props.type}
              class={styles.controlLine}
            >
              <line
                data-timeline-control-line-clamped={props.type}
                x1={graph.project(position().x, 'x')}
                y1={graph.project(position().y, 'y')}
                x2={graph.project(controls().clamped, 'x')}
                y2={graph.project(controls().clamped, 'y')}
              />
              <line
                data-timeline-control-line-unclamped={props.type}
                stroke-dasharray="2px 2px"
                x1={graph.project(controls().clamped, 'x')}
                y1={graph.project(controls().clamped, 'y')}
                x2={graph.project(controls().unclamped, 'x')}
                y2={graph.project(controls().unclamped, 'y')}
              />
            </g>
            <graph.Handle
              position={controls().unclamped}
              onPointerDown={onPointerDown}
              {...props}
            />
          </g>
        )
      }}
    </Show>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                     Anchor                                     */
/*                                                                                */
/**********************************************************************************/

export interface AnchorProps {
  index: number
}

export function Anchor(props: AnchorProps) {
  const graph = useGraph()

  const projectedPosition = () => graph.projectedAnchors[props.index].position
  const position = () => graph.anchors[props.index].position

  async function onPointerDown(event: MouseEvent) {
    const initialPosition = { ...position() }

    const pre = graph.getPairedAnchorPosition('pre', props.index)
    const post = graph.getPairedAnchorPosition('post', props.index)

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

      graph.setAnchors(props.index, 'position', position)
    })

    graph.updateOverflow()
  }

  return (
    <g data-timeline-anchor>
      <graph.Control type="pre" index={props.index} />
      <graph.Control type="post" index={props.index} />
      <graph.Handle
        type="position"
        position={projectedPosition()}
        onDblClick={() => graph.deleteAnchor(props.index)}
        onPointerDown={onPointerDown}
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
  class?: string
  position: Vector
  name: string
  onPointerDown?(event: MouseEvent): void
}

export function Indicator(props: Indicator) {
  const graph = useGraph()

  return (
    <g
      data-timeline-indicator={props.name}
      class={clsx(styles.indicator, props.class)}
      onPointerDown={props.onPointerDown}
    >
      <line
        data-timeline-indicator-line={props.name}
        y1={0}
        y2={graph.dimensions()?.height}
        x1={graph.project(props.position, 'x')}
        x2={graph.project(props.position, 'x')}
        style={graph.offsetStyle('x')}
      />
      <circle
        style={graph.offsetStyle()}
        data-timeline-indicator-circle={props.name}
        cx={graph.project(props.position, 'x')}
        cy={graph.project(props.position, 'y')}
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
      y: graph.query(cursor.x),
    }
  })

  async function onPointerDown(event: MouseEvent) {
    if (event.target !== event.currentTarget) {
      return
    }
    const x = sheet.pan()
    await pointerHelper(event, ({ delta, event }) => {
      sheet.setPan(x - delta.x / graph.zoom().x)
      setCursor((cursor) => ({
        ...cursor!,
        x: graph.unproject(event.offsetX - graph.offset().x, 'x'),
      }))
    })
  }
  function onPointerMove(event: MouseEvent) {
    setCursor(
      graph.unproject({
        x: event.offsetX - graph.offset().x,
        y: event.offsetY - graph.offset().y,
      })
    )
  }

  function onPointerLeave() {
    setCursor(undefined)
  }

  function onDblClick() {
    const anchor = presence()
    if (anchor) {
      graph.addAnchor(anchor.x, anchor.y)
      graph.updateOverflow()
    }
  }

  function onWheel(event: WheelEvent) {
    sheet.setPan((pan) => pan - event.deltaX)
    setCursor((cursor) => ({
      ...cursor!,
      x: graph.unproject(event.offsetX - graph.offset().x, 'x'),
    }))
  }

  return (
    <div {...rest}>
      <svg
        data-timeline-root
        ref={(element) => {
          function updateDomRect() {
            graph.setDimensions(element.getBoundingClientRect())
            graph.updateOverflow()
          }
          const observer = new ResizeObserver(updateDomRect)
          observer.observe(element)
          updateDomRect()
          onCleanup(() => observer.disconnect())

          graph.updateOverflow()
        }}
        width="100%"
        height="100%"
        stroke="black"
        class={styles.timeline}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onDblClick={onDblClick}
        onWheel={onWheel}
      >
        <Show when={config.grid}>{(grid) => <Grid grid={grid()} />}</Show>
        <g style={graph.offsetStyle()}>
          <graph.Path />
          <Index each={graph.anchors}>
            {(_, index) => <graph.Anchor index={index} />}
          </Index>
          {props.children}
        </g>
        <Show when={!sheet.isDraggingHandle() && presence()}>
          {(presence) => (
            <graph.Indicator
              position={presence()}
              class={styles.presence}
              name="cursor"
            />
          )}
        </Show>
        <graph.Indicator
          position={{
            x: sheet.time(),
            y: graph.query(sheet.time()),
          }}
          name="time"
        />
      </svg>
    </div>
  )
}
