import { Accessor, createMemo, mapArray, mergeProps } from 'solid-js'
import { createStore, produce, SetStoreFunction } from 'solid-js/store'
import { createGraphComponent } from './create-graph-component'
import { createValueComponent } from './create-value-component'
import { createLookupMap } from './lib/create-lookup-map'
import { DConfig, dFromClampedAnchors } from './lib/d-from-clamped-anchors'
import { getValueFromSegments } from './lib/get-value-from-segments'
import { addVector, multiplyVector } from './lib/vector'
import type {
  AbsoluteAnchor,
  Anchor,
  ClampedAnchor,
  ClampedControl,
  Segment,
} from './types'

/**********************************************************************************/
/*                                                                                */
/*                                 Create Timeline                                */
/*                                                                                */
/**********************************************************************************/

export interface Api {
  clampedAnchors: Array<ClampedAnchor>
  segments: Accessor<Array<Accessor<Segment>>>
  anchors: Array<Anchor>
  d(config?: DConfig): string
  query(time: number): number
  setAnchors: SetStoreFunction<Array<Anchor>>
  deleteAnchor(index: number): void
  addAnchor(time: number, value?: number): void
}

export function createTimeline(initial?: Array<Anchor>) {
  const [anchors, setAnchors] = createStore<Array<Anchor>>(initial || [])

  const absoluteAnchors = createMemo(
    mapArray(
      () => anchors,
      (anchor): AbsoluteAnchor => {
        return {
          get position() {
            return anchor.position
          },
          get pre() {
            return anchor?.pre
              ? {
                  relative: anchor.pre,
                  absolute: addVector(
                    anchor.position,
                    multiplyVector(anchor.pre, { x: -1 })
                  ),
                }
              : undefined
          },
          get post() {
            return anchor?.post
              ? {
                  relative: anchor.post,
                  absolute: addVector(anchor.position, anchor.post),
                }
              : undefined
          },
        }
      }
    )
  )

  const clampedAnchors = createMemo(
    mapArray(absoluteAnchors, (anchor, index): ClampedAnchor => {
      const preAnchor = createMemo(() => absoluteAnchors()[index() - 1])
      const postAnchor = createMemo(() => absoluteAnchors()[index() + 1])

      const pre = createMemo(() => {
        if (anchor.pre) {
          return {
            relative: anchor.pre.relative,
            absolute: processControl('pre', anchor, preAnchor())!,
          }
        }
        return undefined
      })

      const post = createMemo(() => {
        if (anchor.post) {
          return {
            relative: anchor.post.relative,
            absolute: processControl('post', anchor, postAnchor())!,
          }
        }
        return undefined
      })
      return {
        get position() {
          return anchor.position
        },
        get pre() {
          return pre()
        },
        get post() {
          return post()
        },
      }
    })
  )

  const mapArraySegments = mapArray(clampedAnchors, (anchor, index) => {
    const nextAnchor = createMemo(() => clampedAnchors()[index() + 1])
    return createMemo(() => {
      const next = nextAnchor()
      const result = next
        ? {
            range: [anchor.position.x, next.position.x],
            map: createLookupMap(anchor, next),
          }
        : undefined
      return result
    })
  })

  const segments = createMemo(
    () => mapArraySegments().slice(0, -1) as Array<Accessor<Segment>>
  )

  function processControl(
    type: 'pre' | 'post',
    anchor: AbsoluteAnchor,
    pairedAnchor: AbsoluteAnchor
  ): ClampedControl['absolute'] | undefined {
    const absoluteControl = anchor[type]?.absolute
    const pairedPosition = pairedAnchor.position

    if (!absoluteControl) {
      throw `Attempting to process a control without absolute.`
    }

    if (!pairedPosition) {
      throw `Attempting to process a control without a paired anchor.`
    }

    const [min, max] =
      type === 'post'
        ? [anchor.position, pairedPosition]
        : [pairedPosition, anchor.position]

    // Clamp x to ensure monotonicity of the curve (https://en.wikipedia.org/wiki/Monotonic_function)
    const clampedX = Math.max(min.x, Math.min(max.x, absoluteControl.x))

    if (clampedX === absoluteControl.x) {
      return { unclamped: absoluteControl, clamped: absoluteControl }
    } else {
      const ratio =
        (anchor.position.x - clampedX) / (anchor.position.x - absoluteControl.x)
      const clampedY =
        (absoluteControl.y - anchor.position.y) * ratio + anchor.position.y
      return {
        unclamped: absoluteControl,
        clamped: {
          x: clampedX,
          y: clampedY,
        },
      }
    }
  }

  function d(config?: DConfig) {
    return dFromClampedAnchors(clampedAnchors(), config)
  }

  function query(time: number) {
    return getValueFromSegments(segments(), time)
  }

  function addAnchor(time: number, value = query(time)) {
    setAnchors(
      produce((anchors) => {
        let index = anchors.findIndex(({ position }) => {
          return position.x > time
        })

        // Last element
        if (index === -1) {
          const lastAnchor = anchors[anchors.length - 1]
          const maxX = Math.min((time - lastAnchor.position.x) / 2, 100)

          if (lastAnchor?.pre) {
            const scale = lastAnchor.pre.x > maxX ? maxX / lastAnchor.pre.x : 1

            lastAnchor.post = {
              x: lastAnchor.pre.x * scale,
              y: lastAnchor.pre.y * scale * -1,
            }
          } else {
            lastAnchor.post = { x: maxX, y: 0 }
          }

          anchors.push({
            position: { x: time, y: value },
            pre: { x: maxX, y: 0 },
          })
        }
        // First element
        else if (index === 0) {
          const firstAnchor = anchors[0]
          const maxX = Math.min((firstAnchor.position.x - time) / 2, 100)

          if (firstAnchor?.post) {
            const scale =
              firstAnchor.post.x > maxX ? maxX / firstAnchor.post.x : 1

            firstAnchor.pre = {
              x: firstAnchor.post.x * scale,
              y: firstAnchor.post.y * scale * -1,
            }
          } else {
            firstAnchor.pre = { x: maxX, y: 0 }
          }
          anchors.unshift({
            position: { x: time, y: value },
            post: { x: maxX, y: 0 },
          })
        } else {
          const preAnchor = anchors[index - 1]
          const postAnchor = anchors[index]

          const maxX = Math.min(
            (time - preAnchor.position.x) / 2,
            (postAnchor.position.x - time) / 2,
            100
          )

          if (preAnchor?.post?.x && maxX < preAnchor.post.x) {
            const scale = maxX / preAnchor.post.x
            preAnchor.post = {
              x: maxX,
              y: preAnchor.post.y * scale,
            }
          }

          if (postAnchor?.pre?.x && maxX < postAnchor.pre.x) {
            const scale = maxX / postAnchor.pre.x
            postAnchor.pre = {
              x: maxX,
              y: postAnchor.pre.y * scale,
            }
          }

          anchors.splice(index, 0, {
            position: { x: time, y: value },
            pre: { x: maxX, y: 0 },
            post: { x: maxX, y: 0 },
          })
        }
      })
    )
  }

  function deleteAnchor(index: number) {
    setAnchors(produce((anchors) => anchors.splice(index, 1)))
  }

  const api: Api = {
    addAnchor,
    anchors,
    get clampedAnchors() {
      return clampedAnchors()
    },
    d,
    deleteAnchor,
    query,
    segments,
    setAnchors,
  }

  return mergeProps(api, {
    Value: createValueComponent(api),
    Graph: createGraphComponent(api),
  })
}
