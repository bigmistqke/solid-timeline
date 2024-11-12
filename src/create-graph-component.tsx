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
import { DConfig } from './lib/d-from-processed-anchors'
import { useSheet } from './sheet'
import { Merge, Vector } from './types'
import { processProps } from './utils/default-props'
import { getLastArrayItem } from './utils/get-last-array-item'
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
  query(time: number): number
  updateOverflow(): void
  setDimensions(dimensions: { width: number; height: number }): void
  isOutOfBounds(x: number): boolean
  offsetStyle(axis?: 'x' | 'y'): { transform: string }
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

    const [overflow, setOverflow] = createSignal({ top: 0, bottom: 0 })

    const zoom = whenMemo(
      dimensions,
      (dimensions) => ({
        x: sheet.zoomX(),
        y:
          (dimensions.height - config.paddingY * 2) /
          (config.max - config.min + overflow().bottom + overflow().top),
      }),
      { x: 1, y: 1 }
    )

    const offset = createMemo(() => ({
      x: sheet.pan() * zoom().x,
      y: (overflow().top - config.min) * zoom().y + config.paddingY,
    }))

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
      return value * zoom()[axis]
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
      return value / zoom()[axis]
    }

    function isOutOfBounds(x: number) {
      const [firstPosition] = api.anchors[0]
      const [lastPosition] = getLastArrayItem(api.anchors)
      return x < firstPosition.x || x > lastPosition.x
    }

    function bottomOverflowFromVector(value: Vector) {
      return Math.max(value.y, config.max) - config.max
    }
    function topOverflowFromVector(value: Vector) {
      return config.min - Math.min(value.y, config.min)
    }

    function updateOverflow() {
      let top = 0
      let bottom = 0

      api.processedAnchors.forEach(([position, { pre, post } = {}]) => {
        top = Math.max(top, topOverflowFromVector(position))
        bottom = Math.max(bottom, bottomOverflowFromVector(position))
        if (pre) {
          top = Math.max(top, topOverflowFromVector(pre.absolute))
          bottom = Math.max(bottom, bottomOverflowFromVector(pre.absolute))
        }
        if (post) {
          top = Math.max(top, topOverflowFromVector(post.absolute))
          bottom = Math.max(bottom, bottomOverflowFromVector(post.absolute))
        }
      })

      setOverflow({ top, bottom })
    }

    function d(config?: DConfig) {
      return api.d(config ?? { zoom: zoom() })
    }

    function offsetStyle(axis?: 'x' | 'y') {
      if (!axis) {
        return {
          transform: `translate3d(${offset().x}px, ${offset().y}px, 0)`,
        }
      }
      if (axis === 'x') {
        return { transform: `translateX(${offset().x}px)` }
      }
      return { transform: `translateY(${offset().y}px)` }
    }

    createEffect(() => config.onZoomChange?.(zoom()))
    createEffect(() => config.onPan?.(sheet.pan()))

    const graph: GraphContext = mergeProps(sheetGraphComponents, api, {
      d,
      project,
      unproject,
      dimensions,
      zoom,
      offset,
      updateOverflow,
      isOutOfBounds,
      setDimensions,
      offsetStyle,
    })

    return (
      <graphContext.Provider value={graph}>
        <graph.Root {...rest} />
      </graphContext.Provider>
    )
  }
}
