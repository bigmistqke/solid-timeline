import { createTimeline, Sheet } from 'solid-timeline'
import { createClock } from 'solid-timeline/create-clock'
import { getLastArrayItem } from 'solid-timeline/utils/get-last-array-item'
import styles from './App.module.css'

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

function createRandomAnchors(amount = 5000) {
  return Array.from({ length: amount }, (_, index) =>
    index !== 0 && index !== amount - 1
      ? {
          position: { x: index * 100, y: Math.random() * 500 },
          pre: { x: 50, y: 0 },
          post: { x: 50, y: 0 },
        }
      : { position: { x: index * 100, y: Math.random() * 500 } }
  )
}

function App() {
  const [time] = createClock({
    get min() {
      const topAnchor = TopTimeline.anchors[0]
      const leftAnchor = LeftTimeline.anchors[0]
      return topAnchor.position.x < leftAnchor.position.x
        ? topAnchor.position.x
        : leftAnchor.position.x
    },
    get max() {
      const topAnchor = getLastArrayItem(TopTimeline.anchors)
      const leftAnchor = getLastArrayItem(LeftTimeline.anchors)
      return topAnchor.position.x > leftAnchor.position.x
        ? topAnchor.position.x
        : leftAnchor.position.x
    },
    speed: 0.1,
    autostart: true,
  })

  const TopTimeline = createTimeline(createRandomAnchors())
  const LeftTimeline = createTimeline(createRandomAnchors())

  return (
    <div class={styles.app}>
      <Circle
        top={TopTimeline.query(time())}
        left={LeftTimeline.query(time())}
      />
      <Sheet time={time()} class={styles.sheet}>
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
