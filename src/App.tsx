import { createEffect, createSignal, Setter } from 'solid-js'
import { createTimeline } from './create-timeline'
import { pointerHelper } from './utils/pointer-helper'

function CustomTimeline(props: {
  time: number
  onTimeChange: Setter<number>
  onValueChange: (value: number) => void
}) {
  const Timeline = createTimeline({
    initialPoints: [
      [{ x: 50, y: -100 }],
      [{ x: 400, y: 100 }],
      [
        { x: 400 + 350, y: 0 },
        {
          pre: { x: 0.5, y: 0 },
        },
      ],
    ],
  })

  const onDrag = async (e: MouseEvent) => {
    const x = props.time
    pointerHelper(e, (delta) => props.onTimeChange(x - delta.x))
  }

  const [zoom, setZoom] = createSignal({ y: 1, x: 1 })
  const [origin, setOrigin] = createSignal({ y: 50, x: 0 })

  createEffect(() => props.onValueChange(Timeline.getValue(props.time)))

  return (
    <Timeline.Component
      max={100}
      min={-100}
      zoom={{ y: 0.5 }}
      onOriginChange={setOrigin}
      onZoomChange={setZoom}
      style={{
        height: '100px',
        width: '100vw',
        resize: 'both',
        overflow: 'auto',
      }}
    >
      <line
        x1={props.time + origin().x}
        x2={props.time + origin().x}
        y1={0}
        y2={window.innerHeight}
        stroke="black"
        onMouseDown={onDrag}
        stroke-width={1}
        style={{
          cursor: 'ew-resize',
        }}
      />
      <circle
        cx={props.time}
        // cx={(props.time + origin().x) * zoom().y}
        cy={(Timeline.getValue(props.time)! + origin().y) * zoom().y}
        r={3}
      />
      {/* <line
        x1={0}
        x2={window.innerWidth}
        y1={(Timeline.getValue(props.time)! + origin().y) * zoom().y}
        y2={(Timeline.getValue(props.time)! + origin().y) * zoom().y}
        stroke="black"
      /> */}
    </Timeline.Component>
  )
}

function Circle(props: { top: number; left: number }) {
  return (
    <div
      style={{
        'border-radius': '50%',
        background: 'blue',
        height: '100px',
        width: '100px',
        transform: `translate(${props.top}px, ${props.left}px)`,
      }}
    />
  )
}

function App() {
  const [time, setTime] = createSignal(100)
  const [top, setTop] = createSignal(0)
  const [left, setLeft] = createSignal(0)

  const loop = () => {
    requestAnimationFrame(loop)

    setTime((performance.now() / 10) % 1000)
  }
  loop()

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column' }}>
      <CustomTimeline
        time={time()}
        onTimeChange={setTime}
        onValueChange={setTop}
      />
      <CustomTimeline
        time={time()}
        onTimeChange={setTime}
        onValueChange={setLeft}
      />
      <Circle left={left()} top={top()} />
    </div>
  )
}

export default App
