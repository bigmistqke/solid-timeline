import { createTimeline } from '#/create-timeline'
import { createSignal, onCleanup } from 'solid-js'

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
  const [time, setTime] = createSignal(performance.now())
  const [domRect, setDomRect] = createSignal<DOMRect>()

  const TopTimeline = createTimeline({
    initial: [
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
    ],
  })

  const LeftTimeline = createTimeline({
    initial: [
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
    ],
  })

  function onRef(element: HTMLDivElement) {
    function updateDomRect() {
      setDomRect(element.getBoundingClientRect())
    }
    const observer = new ResizeObserver(updateDomRect)
    observer.observe(element)
    updateDomRect()

    function loop() {
      requestAnimationFrame(loop)
      setTime((performance.now() / 10) % (domRect()?.width || 1000))
    }
    loop()

    onCleanup(() => observer.disconnect())
  }

  return (
    <div style={{ overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <Circle
        left={LeftTimeline.getValue(time())}
        top={TopTimeline.getValue(time())}
      />
      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
        }}
        ref={onRef}
      >
        <TopTimeline.Component
          time={time()}
          min={0}
          max={window.innerHeight}
          onTimeChange={setTime}
        />
        <LeftTimeline.Component
          time={time()}
          min={0}
          max={window.innerWidth}
          onTimeChange={setTime}
        />
      </div>
    </div>
  )
}

export default App
