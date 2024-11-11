import clsx from 'clsx'
import { getStroke } from 'perfect-freehand'
import { createMemo, createSignal, onCleanup, splitProps } from 'solid-js'
import { createTimeline, Sheet, useSheet } from 'solid-timeline'
import { createClock } from 'solid-timeline/create-clock'
import {
  GraphComponents,
  useGraph,
} from 'solid-timeline/create-graph-component'
import {
  addVector,
  lengthVector,
  multiplyVector,
  subtractVector,
} from 'solid-timeline/lib/vector'
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

function App() {
  const [domRect, setDomRect] = createSignal<DOMRect>()
  const [time, clock] = createClock({
    get max() {
      return domRect()?.width
    },
    speed: 0.1,
  })

  const TopTimeline = createTimeline({
    initial: [
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
    ],
  })

  const LeftTimeline = createTimeline({
    initial: [
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
    ],
  })

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

  const components: Partial<GraphComponents> = {
    Handle(props) {
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
        <circle
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
      const outline = createMemo(() => {
        const delta = subtractVector(props.control, props.position)

        const length = Math.max(15, Math.floor(lengthVector(delta) / 10))

        const tween = (t: number) =>
          addVector(props.position, multiplyVector(delta, t))

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

      const [, rest] = splitProps(props, ['control', 'position'])

      return (
        <g data-timeline-control={props.type}>
          <path
            d={getSvgPathFromStroke(outline())}
            fill="var(--fill)"
            style={{ 'pointer-events': 'none' }}
            opacity={0.9}
          />
          <graph.Handle {...rest} position={props.control} />
        </g>
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

  return (
    <div class={styles.app}>
      <Circle
        top={TopTimeline.getValue(time())}
        left={LeftTimeline.getValue(time())}
      />
      <Sheet time={time()} class={styles.sheet} ref={onRef}>
        <div class={styles.timelineContainer}>
          <TopTimeline.Graph
            min={0}
            max={window.innerHeight}
            class={styles.timeline}
            grid={{ x: 100, y: 250 }}
            {...components}
          />
        </div>
        <div class={styles.timelineContainer}>
          <LeftTimeline.Graph
            min={0}
            max={window.innerWidth}
            class={styles.timeline}
            grid={{ x: 100, y: 500 }}
            {...components}
          />
        </div>
      </Sheet>
    </div>
  )
}

export default App
