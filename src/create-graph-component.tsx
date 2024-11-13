import {
  Accessor,
  ComponentProps,
  createContext,
  createEffect,
  createMemo,
  createSelector,
  createSignal,
  indexArray,
  mapArray,
  mergeProps,
  useContext,
} from 'solid-js'
import { Api } from './create-timeline'
import { graphComponentNames, GraphComponents } from './graph-components'
import { DConfig } from './lib/d-from-clamped-anchors'
import { useSheet } from './sheet'
import { Merge, ProjectedAnchor, Vector } from './types'
import { getLastArrayItem } from './utils/get-last-array-item'
import { whenMemo } from './utils/once-every-when'
import { pickProps, processProps, removeProps } from './utils/props'

/**********************************************************************************/
/*                                                                                */
/*                                  Use Graph                                  */
/*                                                                                */
/**********************************************************************************/

interface GraphContext
  extends Merge<Omit<Api, 'clampedAnchors'>, GraphComponents> {
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
  projectedAnchors: Array<ProjectedAnchor>
  isAnchorVisible(index: number): boolean
  isRangeVisible(index: number): boolean
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

    const projectedAnchors = createMemo(
      mapArray(
        () => api.clampedAnchors,
        (anchor): ProjectedAnchor => {
          function control(type: 'pre' | 'post') {
            if (!anchor[type]) {
              return undefined
            }
            return mergeProps(anchor[type], {
              projected: {
                get clamped() {
                  return project(anchor[type]!.absolute.clamped)
                },
                get unclamped() {
                  return project(anchor[type]!.absolute.unclamped)
                },
              },
            })
          }
          const pre = createMemo(() => control('pre'))
          const post = createMemo(() => control('post'))

          return {
            position: {
              get projected() {
                return project(anchor.position)
              },
              get absolute() {
                return anchor.position
              },
            },
            get pre() {
              return pre()
            },
            get post() {
              return post()
            },
          }
        }
      )
    )

    const rangeSize = 100
    const ranges = createMemo(
      indexArray(
        () =>
          Array.from({
            length: Math.floor(projectedAnchors().length / rangeSize) + 1,
          }),
        (_, index) => {
          return createMemo(() => {
            let min = Infinity
            let max = -Infinity

            for (
              let i = index * rangeSize;
              i < Math.min((index + 1) * rangeSize, projectedAnchors().length);
              i++
            ) {
              max = Math.max(
                max,
                projectedAnchors()[i].position.absolute.x,
                projectedAnchors()[i].post?.absolute.unclamped.x || -Infinity
              )
              min = Math.min(
                min,
                projectedAnchors()[i].position.absolute.x,
                projectedAnchors()[i].pre?.absolute.unclamped.x || Infinity
              )
            }
            return {
              min,
              max,
            }
          })
        }
      )
    )

    const isRangeVisible = createSelector(
      () => [ranges(), sheet.pan(), dimensions()] as const,
      (index: number, [ranges, pan, dimensions]) => {
        const range = ranges[index]()
        const viewportMin = pan * -1
        const viewportMax = pan * -1 + (dimensions?.width || 0)
        if (
          (range.min - 200 > viewportMax && range.max - 200 > viewportMax) ||
          (range.min + 200 < viewportMin && range.max + 200 < viewportMin)
        ) {
          return false
        }
        return true
      }
    )

    function isAnchorVisible(index: number) {
      return isRangeVisible(Math.floor(index / rangeSize))
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
      const firstAnchor = api.anchors[0]
      const lastAnchor = getLastArrayItem(api.anchors)
      return x < firstAnchor.position.x || x > lastAnchor.position.x
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

      api.clampedAnchors.forEach(({ position, pre, post }) => {
        top = Math.max(top, topOverflowFromVector(position))
        bottom = Math.max(bottom, bottomOverflowFromVector(position))
        if (pre) {
          top = Math.max(top, topOverflowFromVector(pre.absolute.unclamped))
          bottom = Math.max(
            bottom,
            bottomOverflowFromVector(pre.absolute.unclamped)
          )
        }
        if (post) {
          top = Math.max(top, topOverflowFromVector(post.absolute.unclamped))
          bottom = Math.max(
            bottom,
            bottomOverflowFromVector(post.absolute.unclamped)
          )
        }
      })

      setOverflow({ top, bottom })
    }

    function d(config?: DConfig) {
      return api.d({ zoom: zoom(), ...config })
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

    const graph: GraphContext = mergeProps(
      pickProps(sheet, graphComponentNames),
      removeProps(api, ['clampedAnchors']),
      {
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
        get projectedAnchors() {
          return projectedAnchors()
        },
        isAnchorVisible,
        isRangeVisible,
      }
    )

    return (
      <graphContext.Provider value={graph}>
        <graph.Root {...rest} />
      </graphContext.Provider>
    )
  }
}
