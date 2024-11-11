import {
  Accessor,
  ComponentProps,
  createContext,
  createSignal,
  onCleanup,
  onMount,
  Setter,
  useContext,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { createWritable } from './utils/create-writable'
import { processProps } from './utils/default-props'

const SheetContext = createContext<{
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
}>()

export function useSheet() {
  const context = useContext(SheetContext)
  if (!context) {
    throw `useSheet be used in a descendant of Sheet`
  }
  return context
}

export function Sheet(
  props: ComponentProps<'div'> & {
    time?: number
    pan?: number
    zoom?: number
  }
) {
  const [config, rest] = processProps(props, { time: 0, pan: 0, zoom: 1 }, [
    'children',
    'pan',
    'zoom',
    'time',
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

  return (
    <div {...rest}>
      <SheetContext.Provider
        value={{
          pan,
          setPan,
          zoomX,
          setZoomX,
          time,
          setTime,
          isDraggingHandle,
          setIsDraggingHandle,
          modifiers,
        }}
      >
        {props.children}
      </SheetContext.Provider>
    </div>
  )
}
