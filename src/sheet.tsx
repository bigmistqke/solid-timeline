import {
  Accessor,
  ComponentProps,
  createContext,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
  Setter,
  useContext,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  Anchor,
  Control,
  GraphComponents,
  Grid,
  Handle,
  Indicator,
  Path,
  Root,
} from './graph-components'
import { createWritable } from './utils/create-writable'
import { processProps } from './utils/default-props'

interface SheetContext extends GraphComponents {
  pan: Accessor<number>
  setPan: Setter<number>
  zoomX: Accessor<number>
  setZoomX: Setter<number>
  time: Accessor<number>
  setTime: Setter<number>
  isDraggingHandle: Accessor<boolean>
  setIsDraggingHandle: Setter<boolean>
  modifiers: {
    meta: boolean
    shift: boolean
    alt: boolean
  }
  graphComponents?: Partial<GraphComponents>
}

const sheetContext = createContext<SheetContext>()

export function useSheet() {
  const context = useContext(sheetContext)
  if (!context) {
    throw `useSheet be used in a descendant of Sheet`
  }
  return context
}

export interface SheetProps extends ComponentProps<'div'> {
  time?: number
  pan?: number
  zoom?: number
  graphComponents?: Partial<GraphComponents>
}

export function Sheet(props: SheetProps) {
  const [config, rest] = processProps(props, { time: 0, pan: 0, zoom: 1 }, [
    'children',
    'pan',
    'zoom',
    'time',
    'graphComponents',
  ])

  const [pan, setPan] = createWritable(() => config.pan)
  const [zoomX, setZoomX] = createWritable(() => config.zoom)
  const [time, setTime] = createWritable(() => config.time)
  const [isDraggingHandle, setIsDraggingHandle] = createSignal(false)
  const [modifiers, setModifiers] = createStore({
    meta: false,
    shift: false,
    alt: false,
  })

  onMount(() => {
    const abortController = new AbortController()
    window.addEventListener(
      'keydown',
      (event) => {
        setModifiers({
          meta: event.metaKey,
          shift: event.shiftKey,
          alt: event.altKey,
        })
      },
      { signal: abortController.signal }
    )
    window.addEventListener(
      'keyup',
      (event) => {
        setModifiers({
          meta: event.metaKey,
          shift: event.shiftKey,
          alt: event.altKey,
        })
      },
      { signal: abortController.signal }
    )
    onCleanup(() => abortController.abort())
  })

  const sheet = mergeProps(
    { Path, Anchor, Indicator, Control, Handle, Grid, Root },
    () => config.graphComponents,
    {
      pan,
      setPan,
      zoomX,
      setZoomX,
      time,
      setTime,
      isDraggingHandle,
      setIsDraggingHandle,
      modifiers,
    }
  )

  return (
    <div {...rest}>
      <sheetContext.Provider value={sheet}>
        {props.children}
      </sheetContext.Provider>
    </div>
  )
}
