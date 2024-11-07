import clsx from 'clsx'
import {
  Accessor,
  ComponentProps,
  createContext,
  createEffect,
  createSignal,
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
import { Anchor as AnchorType, Vector } from './types'
import { once, whenMemo } from './utils/once-every-when'
import { pointerHelper } from './utils/pointer-helper'

/**********************************************************************************/
/*                                                                                */
/*                                  Use Timeline                                  */
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
  const { project } = useTimeline()
  const { setIsDraggingHandle } = useSheet()

  const [active, setActive] = createSignal(false)

  async function onPointerDown(event: MouseEvent) {
    setActive(true)
    setIsDraggingHandle(true)

    await props.onDragStart(event)

    setActive(false)
    setIsDraggingHandle(false)
  }

  return (
    <g class={clsx(styles.handleContainer, active() && styles.active)}>
      <circle
        cx={project(props.position, 'x')}
        cy={project(props.position, 'y')}
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
        cx={project(props.position, 'x')}
        cy={project(props.position, 'y')}
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
  onDragStart(event: MouseEvent): Promise<void>
}) {
  const { project } = useTimeline()
  const [, rest] = splitProps(props, ['control', 'position'])
  return (
    <g class={styles.controlContainer}>
      <line
        stroke="black"
        x1={project(props.position, 'x')}
        y1={project(props.position, 'y')}
        x2={project(props.control, 'x')}
        y2={project(props.control, 'y')}
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
  pre?: Vector
}) {
  return (
    <>
      <Show when={props.pre}>
        <Control
          position={props.position}
          control={props.pre!}
          onDragStart={(event) => props.onControlDragStart('pre', event)}
        />
      </Show>
      <Show when={props.post}>
        <Control
          position={props.position}
          control={props.post!}
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
  getValue,
  addAnchor,
  d,
  absoluteAnchors,
  setAnchors,
  deleteAnchor,
  getPairedAnchorPosition,
}: Api) {
  function Indicator(props: {
    height: number
    time: number
    class?: string
    onPointerDown?: (event: MouseEvent) => void
  }) {
    const { project } = useTimeline()

    return (
      <g
        class={clsx(styles.timeIndicator, props.class)}
        onPointerDown={props.onPointerDown}
      >
        <line
          y1={0}
          y2={props.height}
          x1={project(props.time, 'x')}
          x2={project(props.time, 'x')}
        />
        <circle
          cx={project(props.time, 'x')}
          cy={project(getValue(props.time), 'y')!}
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
      zoomY?: number
    }
  ) {
    const { isDraggingHandle, setPan, zoomX, time, pan } = useSheet()
    const [config, rest] = splitProps(props, [
      'max',
      'min',
      'onPan',
      'onTimeChange',
      'onZoomChange',
      'zoomY',
    ])

    const [domRect, setDomRect] = createSignal<DOMRect>()
    const [paddingMax, setPaddingMax] = createSignal(0)
    const [paddingMin, setPaddingMin] = createSignal(0)
    const [presence, setPresence] = createSignal<number | undefined>(undefined)

    const zoom = whenMemo(
      domRect,
      (domRect) => ({
        x: zoomX(),
        y:
          (domRect.height /
            (props.max + paddingMax() + paddingMin() - props.min * 2)) *
          (config.zoomY || 1),
      }),
      { x: 1, y: 1 }
    )

    const origin = {
      get x() {
        return pan()
      },
      get y() {
        return (paddingMin() - props.min) / (config.zoomY || 1)
      },
    }

    function project(point: Vector | number, type: 'x' | 'y') {
      const value = typeof point === 'object' ? point[type] : point
      return (value + origin[type]) * zoom()[type]
    }

    function unproject(point: Vector | number, type: 'x' | 'y') {
      const value = typeof point === 'object' ? point[type] : point
      return (value + origin[type]) / zoom()[type]
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

      await pointerHelper(event, ({ delta, event }) => {
        delta = divideVector(delta, zoom())

        const absoluteControl = subtractVector(initialControl, delta)
        const control = absoluteToRelativeControl({
          index,
          type,
          absoluteControl,
        })
        setAnchors(index, 1, type, control)

        // Symmetric dragging of paired control
        if (event.metaKey) {
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
      return Math.max(value.y, props.max) - props.max + 100
    }
    function minPaddingFromVector(value: Vector) {
      return props.min - Math.min(value.y, props.min) + 100
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
          origin: () => origin,
          zoom,
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
            createEffect(() => props.onZoomChange?.(zoom()))
            createEffect(() => props.onPan?.(pan()))
          }}
          width="100%"
          height="100%"
          class={clsx(props.class, styles.timeline)}
          {...rest}
          onPointerDown={async (event) => {
            if (event.target !== event.currentTarget) {
              return
            }
            if (event.metaKey) {
              const x = pan()
              await pointerHelper(event, ({ delta, event }) => {
                setPan(x - delta.x / zoom().x)
                setPresence(event.layerX / zoom().x - pan())
              })
            }
          }}
          onPointerMove={(e) => {
            setPresence(e.layerX / zoom().x - pan())
          }}
          onPointerLeave={() => {
            setPresence(undefined)
          }}
          onDblClick={() => {
            once(presence, addAnchor)
          }}
          onWheel={(e) => {
            setPan((pan) => pan + e.deltaX)
          }}
        >
          <path
            class={styles.path}
            d={d({ zoom: zoom(), origin: origin })}
            style={{ 'pointer-events': 'none' }}
          />
          <Show when={!isDraggingHandle() && presence()}>
            {(presence) => (
              <Indicator
                height={window.innerHeight}
                time={presence()}
                class={styles.presence}
              />
            )}
          </Show>
          <Indicator height={window.innerHeight} time={time()} />
          <Index each={absoluteAnchors}>
            {(anchor, index) => {
              const position = () => anchor()[0]
              const control = (type: 'pre' | 'post') => anchor()[1]?.[type]

              return (
                <Anchor
                  position={position()}
                  pre={control('pre')}
                  post={control('post')}
                  onDeleteAnchor={() => deleteAnchor(index)}
                  onControlDragStart={(type, event) =>
                    onControlDragStart({
                      type,
                      event,
                      index,
                      anchor: anchor(),
                    })
                  }
                  onPositionDragStart={(event) =>
                    onPositionDragStart({
                      event,
                      index,
                      anchor: anchor(),
                    })
                  }
                />
              )
            }}
          </Index>
          {props.children}
        </svg>
      </TimelineContext.Provider>
    )
  }
}
