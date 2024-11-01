import { createSignal, Setter } from 'solid-js'
import { createTimeline } from './create-timeline'
import { pointerHelper } from './utils/pointer-helper'

function CustomTimeline(props: { time: number; onTimeChange: Setter<number> }) {
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
        stroke-width={5}
        style={{
          cursor: 'ew-resize',
        }}
      />
      <line
        x1={0}
        x2={window.innerWidth}
        y1={(Timeline.getValue(props.time)! + origin().y) * zoom().y}
        y2={(Timeline.getValue(props.time)! + origin().y) * zoom().y}
        stroke="black"
      />
    </Timeline.Component>
  )
}

function App() {
  const [time, setTime] = createSignal(100)

  const loop = () => {
    requestAnimationFrame(loop)

    setTime((performance.now() / 100) % 1000)
  }
  loop()

  return (
    <>
      <CustomTimeline time={time()} onTimeChange={setTime} />
      <CustomTimeline time={time()} onTimeChange={setTime} />
    </>
  )
}

export default App
