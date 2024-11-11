import { createClock } from '#/create-clock'
import { createTimeline } from '#/create-timeline'
import { Sheet } from '#/sheet'
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
    <div style={{ overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <Circle
        top={TopTimeline.getValue(time())}
        left={LeftTimeline.getValue(time())}
      />
      <Sheet
        time={time()}
        style={{
          display: 'flex',
          'flex-direction': 'column',
        }}
        ref={onRef}
      >
        <TopTimeline.Component
          min={0}
          max={window.innerHeight}
          style={{
            height: '50px',
            background: '#ededed',
            'border-top': '1px solid black',
            'border-bottom': '1px solid black',
            resize: 'vertical',
            overflow: 'hidden',
          }}
        />
        <LeftTimeline.Component
          min={0}
          max={window.innerWidth}
          style={{
            height: '50px',
            background: '#ededed',
            'border-bottom': '1px solid black',
            resize: 'vertical',
            overflow: 'hidden',
          }}
        />
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
          }}
        >
          <TopTimeline.Value>
            <TopTimeline.Value.Input decimals={2} style={{ width: '75px' }} />
            <TopTimeline.Value.Button>+</TopTimeline.Value.Button>
          </TopTimeline.Value>
          <LeftTimeline.Value>
            <LeftTimeline.Value.Input decimals={2} style={{ width: '75px' }} />
            <LeftTimeline.Value.Button>+</LeftTimeline.Value.Button>
          </LeftTimeline.Value>
        </div>
      </Sheet>
    </div>
  )
}

export default App
