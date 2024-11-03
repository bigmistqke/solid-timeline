import { createEffect, createSignal, onCleanup, Setter } from 'solid-js'
import { createTimeline } from './create-timeline'
import { Anchor } from './types'
import { pointerHelper } from './utils/pointer-helper'

function CustomTimeline(props: {
  initialPoints: Array<Anchor>
  time: number
  onTimeChange: Setter<number>
  onValueChange: (value: number | undefined) => void
  min: number
  max: number
}) {
  const Timeline = createTimeline({
    initialPoints: props.initialPoints,
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
      onOriginChange={setOrigin}
      onZoomChange={setZoom}
      min={props.min}
      max={props.max}
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
    </Timeline.Component>
  )
}

function Circle(props: { top: number; left: number }) {
  return (
    <div
      style={{
        position: 'fixed',
        'border-radius': '50%',
        background: 'blue',
        height: '100px',
        width: '100px',
        transform: `translate(calc(${props.left}px - 50%), calc(${props.top}px - 50%))`,
      }}
    />
  )
}

function App() {
  const [time, setTime] = createSignal(100)
  const [top, setTop] = createSignal(0)
  const [left, setLeft] = createSignal(0)
  const [domRect, setDomRect] = createSignal<DOMRect>()

  const loop = () => {
    requestAnimationFrame(loop)
    setTime((performance.now() / 10) % (domRect()?.width || 1000))
  }
  loop()

  function onRef(element: HTMLDivElement) {
    function updateDomRect() {
      setDomRect(element.getBoundingClientRect())
    }
    const observer = new ResizeObserver(updateDomRect)
    observer.observe(element)
    updateDomRect()
    onCleanup(() => observer.disconnect())
  }

  return (
    <div style={{ overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <Circle left={left()} top={top()} />
      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
        }}
        ref={onRef}
      >
        <CustomTimeline
          time={time()}
          min={0}
          max={window.innerHeight}
          onTimeChange={setTime}
          onValueChange={setTop}
          initialPoints={[
            [{ x: 0, y: 0 }],
            [
              { x: 400, y: 300 },
              {
                pre: { x: 0.5, y: 0 },
                post: { x: 0.5, y: 0 },
              },
            ],
            [
              { x: 800, y: 300 },
              {
                pre: { x: 0.5, y: 0 },
              },
            ],
            [
              { x: 1200, y: 500 },
              {
                pre: { x: 0.5, y: 0 },
              },
            ],
            [
              { x: 1600, y: 750 },
              {
                pre: { x: 0.5, y: 0 },
              },
            ],
          ]}
        />
        <CustomTimeline
          time={time()}
          min={0}
          max={window.innerWidth}
          onTimeChange={setTime}
          onValueChange={setLeft}
          initialPoints={[
            [{ x: 0, y: 0 }],
            [{ x: 300, y: 750 }],
            [
              { x: 600, y: 0 },
              {
                pre: { x: 0.5, y: 0 },
              },
            ],
            [
              { x: 900, y: 500 },
              {
                pre: { x: 0.5, y: 0 },
                post: { x: 0.5, y: 0 },
              },
            ],
            [{ x: 1200, y: 100 }],
            [
              { x: 1500, y: 750 },
              {
                pre: { x: 0.5, y: 0 },
              },
            ],
          ]}
        />
      </div>
    </div>
  )
}

export default App
