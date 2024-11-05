import { Accessor } from 'solid-js'
import { createStore, produce, SetStoreFunction } from 'solid-js/store'
import { createTimelineComponent } from './create-timeline-component'
import { createValueComponent } from './create-value-component'
import { createLookupMap } from './lib/create-cubic-lookup-map'
import { dFromAbsoluteAnchors } from './lib/d-from-anchors'
import { getValueFromSegments } from './lib/get-value-from-segments'
import { addVector } from './lib/vector'
import type { Anchor, Anchors, Segment, Vector } from './types'
import { createIndexMemo } from './utils/create-index-memo'

/**********************************************************************************/
/*                                                                                */
/*                                 Create Timeline                                */
/*                                                                                */
/**********************************************************************************/

export type Api = {
  absoluteAnchors: Accessor<Array<Anchor>>
  anchors: Accessor<Array<Anchor>>
  d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }): string
  getValue(time: number): number
  setAnchors: SetStoreFunction<Array<Anchor>>
  deleteAnchor(index: number): void
  addAnchor(time: number, value?: number): void
}

export function createTimeline(config?: { initial?: Anchors }) {
  const [anchors, setAnchors] = createStore<Anchors>(config?.initial || [])

  const absoluteAnchors = createIndexMemo(
    () => anchors,
    ([point, relativeControls], index) => {
      const controls: { pre?: Vector; post?: Vector } = {
        pre: undefined,
        post: undefined,
      }

      const pre = relativeControls?.pre
      if (pre) {
        const prev = anchors[index - 1][0]
        const deltaX = point.x - prev.x
        controls.pre = addVector(point, {
          x: deltaX * pre.x * -1,
          y: pre.y,
        })
      }

      const post = relativeControls?.post
      if (post) {
        const next = anchors[index + 1][0]
        const deltaX = next.x - point.x
        controls.post = addVector(point, {
          x: deltaX * post.x,
          y: post.y,
        })
      }

      return [point, controls] as Anchor
    }
  )

  const lookupMapSegments = createIndexMemo(absoluteAnchors, (point, index) => {
    const next = absoluteAnchors()[index + 1]
    return next
      ? {
          range: [point[0].x, next[0].x],
          map: createLookupMap(point, next),
        }
      : undefined
  })

  function d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) {
    return dFromAbsoluteAnchors(absoluteAnchors(), config)
  }

  function getValue(time: number) {
    const segments = lookupMapSegments().slice(0, -1) as Array<Segment>
    return getValueFromSegments(segments, time)
  }

  function addAnchor(time: number, value = getValue(time)) {
    setAnchors(
      produce((anchors) => {
        let index = anchors.findIndex(([anchor]) => {
          return anchor.x > time
        })
        if (index === -1) {
          anchors[anchors.length - 1][1] = {
            ...anchors[anchors.length - 1][1],
            post: { x: 0.5, y: 0 },
          }
          anchors.push([{ x: time, y: value }, { pre: { x: 0.5, y: 0 } }])
        } else if (index === 0) {
          anchors[0][1] = {
            ...anchors[0][1],
            pre: { x: 0.5, y: 0 },
          }
          anchors.unshift([{ x: time, y: value }, { post: { x: 0.5, y: 0 } }])
        } else {
          anchors.splice(index, 0, [
            { x: time, y: value },
            { pre: { x: 0.5, y: 0 }, post: { x: 0.5, y: 0 } },
          ])
        }
      })
    )
  }

  function deleteAnchor(index: number) {
    setAnchors(produce((anchors) => anchors.splice(index, 1)))
  }

  const api: Api = {
    absoluteAnchors,
    anchors: () => anchors,
    addAnchor,
    d,
    deleteAnchor,
    getValue,
    setAnchors,
  }

  return {
    ...api,
    Value: createValueComponent(api),
    Component: createTimelineComponent(api),
  }
}
