import {
  Accessor,
  ComponentProps,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  mergeProps,
  splitProps,
  useContext,
} from 'solid-js'
import { Api } from './create-timeline'
import { graphComponentNames, GraphComponents } from './graph-components'
import { DConfig } from './lib/d-from-anchors'
import { useSheet } from './sheet'
import { Merge, Vector } from './types'
import { processProps } from './utils/default-props'
import { whenMemo } from './utils/once-every-when'

/**********************************************************************************/
/*                                                                                */
/*                                  Use Graph                                  */
/*                                                                                */
/**********************************************************************************/

interface GraphContext extends Merge<Api, GraphComponents> {
  project(point: Vector): Vector
  project(point: Vector | number, type: 'x' | 'y'): number
  unproject(point: Vector): Vector
  unproject(point: Vector | number, type: 'x' | 'y'): number
  dimensions: Accessor<{ width: number; height: number } | undefined>
  zoom: Accessor<Vector>
  offset: Accessor<Vector>
  getValue(time: number): number
  updatePadding(): void
  absoluteToRelativeControl(config: {
    type: 'pre' | 'post'
    index: number
    absoluteControl: Vector
  }): Vector
  setDimensions(dimensions: { width: number; height: number }): void
  isOutOfBounds(x: number): boolean
}

const graphContext = createContext<GraphContext>()

export function useGraph() {
  const context = useContext(graphContext)
  if (!context) {
    throw `useGraph should be used in a descendant of Timeline`
  }
  return context
}

/**********************************************************************************/
/*                                                                                */
/*                             Create Graph Component                             */
/*                                                                                */
/**********************************************************************************/

export interface RootProps
  extends Merge<ComponentProps<'div'>, Partial<GraphComponents>> {
  grid?: {
    x: number
    y: number
  }
  max: number
  min: number
  onPan?(pan: number): void
  onTimeChange?(time: number): void
  onZoomChange?(zoom: Vector): void
  paddingY?: number
}

export function createGraphComponent(api: Api) {
  return function Graph(props: RootProps) {
    const sheet = useSheet()
    const [config, rest] = processProps(
      props,
      {
        paddingY: 10,
      },
      ['max', 'min', 'onPan', 'onTimeChange', 'onZoomChange', 'paddingY']
    )
    const [sheetGraphComponents] = splitProps(sheet, graphComponentNames)

    const [dimensions, setDimensions] = createSignal<{
      width: number
      height: number
    }>()
    const [paddingMax, setPaddingMax] = createSignal(0)
    const [paddingMin, setPaddingMin] = createSignal(0)

    const zoom = whenMemo(
      dimensions,
      (dimensions) => ({
        x: sheet.zoomX(),
        y:
          (dimensions.height - config.paddingY * 2) /
          (config.max - config.min + paddingMax() + paddingMin()),
      }),
      { x: 1, y: 1 }
    )

    const offset = createMemo(() => ({
      x: sheet.pan() * zoom().x,
      y: (paddingMin() - config.min) * zoom().y + config.paddingY,
    }))

    function isOutOfBounds(x: number) {
      const [firstPosition] = api.absoluteAnchors[0]
      const [lastPosition] = api.absoluteAnchors[api.absoluteAnchors.length - 1]

      return x < firstPosition.x || x > lastPosition.x
    }

    function project(point: Vector | number): Vector
    function project(point: Vector | number, axis: 'x' | 'y'): number
    function project(
      point: Vector | number,
      axis?: 'x' | 'y'
    ): Vector | number {
      if (!axis) {
        return {
          x: project(point, 'x'),
          y: project(point, 'y'),
        }
      }

      const value = typeof point === 'object' ? point[axis] : point
      return value * zoom()[axis] + offset()[axis]
    }

    function unproject(point: Vector): Vector
    function unproject(point: Vector | number, axis: 'x' | 'y'): number
    function unproject(
      point: Vector | number,
      axis?: 'x' | 'y'
    ): Vector | number {
      if (!axis) {
        return {
          x: unproject(point, 'x'),
          y: unproject(point, 'y'),
        }
      }

      const value = typeof point === 'object' ? point[axis] : point
      return (value - offset()[axis]) / zoom()[axis]
    }

    function absoluteToRelativeControl({
      type,
      index,
      absoluteControl,
    }: {
      type: 'pre' | 'post'
      index: number
      absoluteControl: Vector
    }) {
      const [position] = api.absoluteAnchors[index]
      return {
        // Absolute value to absolute offset from position
        y: Math.floor(absoluteControl.y - position.y),
        // Absolute value to relative range [0-1]
        x:
          type === 'pre'
            ? Math.floor(position.x - absoluteControl.x)
            : Math.floor(absoluteControl.x - position.x),
      }
    }

    function maxPaddingFromVector(value: Vector) {
      return Math.max(value.y, config.max) - config.max
    }
    function minPaddingFromVector(value: Vector) {
      return config.min - Math.min(value.y, config.min)
    }

    function updatePadding() {
      let min = 0
      let max = 0
      api.absoluteAnchors.forEach(([position, { pre, post } = {}]) => {
        min = Math.max(min, minPaddingFromVector(position))
        max = Math.max(max, maxPaddingFromVector(position))
        if (pre) {
          min = Math.max(min, minPaddingFromVector(pre))
          max = Math.max(max, maxPaddingFromVector(pre))
        }
        if (post) {
          min = Math.max(min, minPaddingFromVector(post))
          max = Math.max(max, maxPaddingFromVector(post))
        }
      })

      setPaddingMin(min)
      setPaddingMax(max)
    }

    createEffect(() => config.onZoomChange?.(zoom()))
    createEffect(() => config.onPan?.(sheet.pan()))

    const graph: GraphContext = mergeProps(sheetGraphComponents, api, {
      d(config?: DConfig) {
        return api.d(config ?? { zoom: zoom(), offset: offset() })
      },
      project,
      unproject,
      dimensions,
      zoom,
      offset,
      getValue: api.getValue,
      updatePadding,
      absoluteToRelativeControl,
      isOutOfBounds,
      setDimensions,
    })

    return (
      <graphContext.Provider value={graph}>
        <graph.Root {...rest} />
      </graphContext.Provider>
    )
  }
}
