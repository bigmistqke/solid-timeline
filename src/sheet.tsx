import {
  Accessor,
  ComponentProps,
  createContext,
  mergeProps,
  Setter,
  splitProps,
  useContext,
} from 'solid-js'
import { createWritable } from './utils/create-writable'

const SheetContext = createContext<{
  pan: Accessor<number>
  setPan: Setter<number>
  zoomX: Accessor<number>
  setZoomX: Setter<number>
  time: Accessor<number>
  setTime: Setter<number>
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
  const config = mergeProps({ time: 0, pan: 0, zoom: 1 }, props)
  const [, rest] = splitProps(props, ['children'])
  const [pan, setPan] = createWritable(() => config.pan)
  const [zoomX, setZoomX] = createWritable(() => config.zoom)
  const [time, setTime] = createWritable(() => config.time)

  return (
    <div {...rest}>
      <SheetContext.Provider
        value={{ pan, setPan, zoomX, setZoomX, time, setTime }}
      >
        {props.children}
      </SheetContext.Provider>
    </div>
  )
}
