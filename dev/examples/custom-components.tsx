import clsx from 'clsx'
import { getStroke } from 'perfect-freehand'
import { createMemo, createSignal, onCleanup, Show, splitProps } from 'solid-js'
import { createTimeline, Sheet, useSheet } from 'solid-timeline'
import { createClock } from 'solid-timeline/create-clock'
import { useGraph } from 'solid-timeline/create-graph-component'
import { GraphComponents } from 'solid-timeline/graph-components'
import {
  addVector,
  divideVector,
  lengthVector,
  multiplyVector,
  subtractVector,
} from 'solid-timeline/lib/vector'
import { pointerHelper } from 'solid-timeline/utils/pointer-helper'
import styles from './custom-component.module.css'

const average = (a: number, b: number) => (a + b) / 2

function getSvgPathFromStroke(points: number[][], closed = true) {
  const len = points.length

  if (len < 4) {
    return ``
  }

  let a = points[0]
  let b = points[1]
  const c = points[2]

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1]
  ).toFixed(2)} T`

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]
    b = points[i + 1]
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2
    )} `
  }

  if (closed) {
    result += 'Z'
  }

  return result
}

function Circle(props: { top: number; left: number }) {
  return (
    <div
      class={styles.circle}
      style={{
        transform: `translate3d(calc(${props.left}px - 50%), calc(${props.top}px - 50%), 0)`,
      }}
    />
  )
}

const components: Partial<GraphComponents> = {
  Handle(props) {
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

    return (
      <circle
        stroke="none"
        class={clsx(active() ? styles.active : undefined, styles.handle)}
        opacity={0.9}
        cx={graph.project(props.position, 'x')}
        cy={graph.project(props.position, 'y')}
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
    )
  },
  Control(props) {
    const graph = useGraph()
    const sheet = useSheet()

    const [, rest] = splitProps(props, ['index'])

    const position = () => graph.absoluteAnchors[props.index][0]
    const control = () => graph.absoluteAnchors[props.index][1][props.type]

    return (
      <Show when={control()}>
        {(control) => {
          const outline = createMemo(() => {
            const delta = subtractVector(control(), position())

            const length = Math.max(15, Math.floor(lengthVector(delta) / 10))

            const tween = (t: number) =>
              addVector(position(), multiplyVector(delta, t))

            const samples = Array.from({ length }, (_, index) =>
              graph.project(tween(index / length))
            )

            return getStroke(samples, {
              simulatePressure: false,
              thinning: 0.1,
              start: {
                taper: true,
              },
            })
          })

          async function onPointerDown(event: MouseEvent) {
            const initialControl = { ...control() }

            const pairedType = props.type === 'pre' ? 'post' : 'pre'

            await pointerHelper(event, ({ delta }) => {
              delta = divideVector(delta, graph.zoom())

              const control = graph.absoluteToRelativeControl({
                ...props,
                absoluteControl: subtractVector(initialControl, delta),
              })
              graph.setAnchors(props.index, 1, props.type, control)

              // Symmetric dragging of paired control
              if (
                sheet.modifiers.meta &&
                props.index !== graph.absoluteAnchors.length - 1 &&
                props.index !== 0
              ) {
                graph.setAnchors(props.index, 1, pairedType, {
                  x: control.x,
                  y: control.y * -1,
                })
              }
            })

            graph.updatePadding()
          }

          return (
            <g data-timeline-control={props.type}>
              <path
                d={getSvgPathFromStroke(outline()!)}
                fill="var(--fill)"
                style={{ 'pointer-events': 'none' }}
                opacity={0.9}
              />
              <graph.Handle
                position={control()}
                onPointerDown={onPointerDown}
                {...rest}
              />
            </g>
          )
        }}
      </Show>
    )
  },
  Path() {
    const graph = useGraph()

    const outline = createMemo(() =>
      getStroke(
        graph
          .segments()
          .flatMap((segment) =>
            segment().map.map((vector) => graph.project(vector))
          )
      )
    )

    return (
      <path
        d={getSvgPathFromStroke(outline())}
        fill="var(--fill)"
        opacity={0.9}
        style={{ 'pointer-events': 'none' }}
      />
    )
  },
}

function App() {
  const [domRect, setDomRect] = createSignal<DOMRect>()
  const [time, clock] = createClock({
    get max() {
      return domRect()?.width
    },
    speed: 0.1,
  })

  const TopTimeline = createTimeline([
    [{ x: 0, y: 0 }],
    [
      { x: 400, y: 300 },
      {
        pre: { x: 100, y: 0 },
        post: { x: 100, y: 0 },
      },
    ],
    [
      { x: 800, y: 0 },
      {
        pre: { x: 100, y: 0 },
      },
    ],
  ])

  const LeftTimeline = createTimeline([
    [{ x: 0, y: 0 }],
    [{ x: 300, y: 750 }],
    [
      { x: 600, y: 0 },
      {
        pre: { x: 100, y: 0 },
      },
    ],
    [
      { x: 900, y: 500 },
      {
        pre: { x: 100, y: 0 },
        post: { x: 100, y: 0 },
      },
    ],
    [{ x: 1200, y: 100 }],
    [
      { x: 1500, y: 750 },
      {
        pre: { x: 100, y: 0 },
      },
    ],
  ])

  function onRef(element: HTMLDivElement) {
    function updateDomRect() {
      setDomRect(element.getBoundingClientRect())
    }
    const observer = new ResizeObserver(updateDomRect)
    observer.observe(element)
    updateDomRect()

    clock.start()

    onCleanup(() => observer.disconnect())
  }

  return (
    <div class={styles.app}>
      <Circle
        top={TopTimeline.getValue(time())}
        left={LeftTimeline.getValue(time())}
      />
      <Sheet
        time={time()}
        class={styles.sheet}
        ref={onRef}
        graphComponents={components}
      >
        <div class={styles.timelineContainer}>
          <TopTimeline.Graph
            min={0}
            max={window.innerHeight}
            class={styles.timeline}
            grid={{ x: 100, y: 250 }}
          />
        </div>
        <div class={styles.timelineContainer}>
          <LeftTimeline.Graph
            min={0}
            max={window.innerWidth}
            class={styles.timeline}
            grid={{ x: 100, y: 500 }}
          />
        </div>
      </Sheet>
    </div>
  )
}

export default App
