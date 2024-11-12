# ⌛ Solid Timeline




https://github.com/user-attachments/assets/704d9387-b4fa-4fb8-b324-6bbee66c4afd




## Example

This is the source code of the demo shown above.

```tsx
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

function App() {
  const [time] = createClock({
    get min() {
      const topAnchor = TopTimeline.anchors[0]
      const leftAnchor = LeftTimeline.anchors[0]
      return topAnchor[0].x < leftAnchor[0].x ? topAnchor[0].x : leftAnchor[0].x
    },
    get max() {
      const topAnchor = getLastArrayItem(TopTimeline.anchors)
      const leftAnchor = getLastArrayItem(LeftTimeline.anchors)
      return topAnchor[0].x > leftAnchor[0].x ? topAnchor[0].x : leftAnchor[0].x
    },
    speed: 0.1,
    autostart: true,
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

  return (
    <div class={styles.app}>
      <Circle
        top={TopTimeline.getValue(time())}
        left={LeftTimeline.getValue(time())}
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
```

