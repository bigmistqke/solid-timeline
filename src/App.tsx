import { createSignal } from 'solid-js'
import { createTimeline } from './create-timeline'
import { pointerHelper } from './utils/pointer-helper'

function App() {
  const [time, setTime] = createSignal(100)

  const Timeline = createTimeline({
    initialPoints: [
      [
        { x: 50, y: 50 },
        {
          post: { x: 0.5, y: 0 },
        },
      ],
      [
        { x: 400, y: 50 },
        {
          pre: { x: 0.5, y: 0 },
          post: { x: 0.5, y: 0 },
        },
      ],
      [
        { x: 400 + 350, y: 200 },
        {
          pre: { x: 0.5, y: 0 },
        },
      ],
    ],
  })

  const onDrag = async (e: MouseEvent) => {
    const x = time()
    pointerHelper(e, (delta) => setTime(x - delta.x))
  }

  const zoom = { y: 3, x: 1 }

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Timeline.Component zoom={zoom}>
        <line
          x1={time()}
          x2={time()}
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
          y1={Timeline.getValue(time())! * zoom.y}
          y2={Timeline.getValue(time())! * zoom.y}
          stroke="black"
        />
      </Timeline.Component>
    </div>
  )
}

export default App
