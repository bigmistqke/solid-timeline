import { createSignal, onCleanup } from 'solid-js'
import { createTimeline, Sheet } from 'solid-timeline'
import { createClock } from 'solid-timeline/create-clock'
import styles from './App.module.css'

function Circle(props: { top: number; left: number }) {
  return (
    <div
      class={styles.circle}
      style={{
        transform: `translate(calc(${props.left}px - 50%), calc(${props.top}px - 50%))`,
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
          <TopTimeline.Component
            min={0}
            max={window.innerHeight}
            class={styles.timeline}
          />
        </div>
        <div class={styles.timelineContainer}>
          <LeftTimeline.Value class={styles.value}>
            <LeftTimeline.Value.Input decimals={2} style={{ width: '75px' }} />
            <LeftTimeline.Value.Button>+</LeftTimeline.Value.Button>
          </LeftTimeline.Value>
          <LeftTimeline.Component
            min={0}
            max={window.innerWidth}
            class={styles.timeline}
          />
        </div>
      </Sheet>
    </div>
  )
}

export default App
