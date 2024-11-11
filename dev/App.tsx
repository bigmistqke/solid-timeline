import { createSignal, onCleanup } from 'solid-js'
import { createTimeline, Sheet } from 'solid-timeline'
import { createClock } from 'solid-timeline/create-clock'
import styles from './App.module.css'

const average = (a, b) => (a + b) / 2

function getSvgPathFromStroke(points, closed = true) {
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
      <Sheet time={time()} class={styles.sheet} ref={onRef}>
        <div class={styles.timelineContainer}>
          <TopTimeline.Value class={styles.value}>
            <TopTimeline.Value.Input decimals={2} style={{ width: '75px' }} />
            <TopTimeline.Value.Button>+</TopTimeline.Value.Button>
          </TopTimeline.Value>
          <TopTimeline.Graph
            min={0}
            max={window.innerHeight}
            class={styles.timeline}
            grid={{ x: 100, y: 250 }}
          />
        </div>
        <div class={styles.timelineContainer}>
          <LeftTimeline.Value class={styles.value}>
            <LeftTimeline.Value.Input decimals={2} style={{ width: '75px' }} />
            <LeftTimeline.Value.Button>+</LeftTimeline.Value.Button>
          </LeftTimeline.Value>
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
