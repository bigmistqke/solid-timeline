import { Accessor, createMemo, mapArray } from 'solid-js'
import { createStore, produce, SetStoreFunction } from 'solid-js/store'
import { createTimelineComponent } from './create-timeline-component'
import { createValueComponent } from './create-value-component'
import { createLookupMap } from './lib/create-lookup-map'
import { dFromAbsoluteAnchors } from './lib/d-from-anchors'
import { getValueFromSegments } from './lib/get-value-from-segments'
import { addVector, multiplyVector } from './lib/vector'
import type { Anchor, Anchors, Segment, Vector } from './types'
import { createArrayProxy } from './utils/create-array-proxy'

/**********************************************************************************/
/*                                                                                */
/*                                 Create Timeline                                */
/*                                                                                */
/**********************************************************************************/

export type Api = {
  absoluteAnchors: Array<Anchor>
  anchors: Array<Anchor>
  d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }): string
  getValue(time: number): number
  setAnchors: SetStoreFunction<Array<Anchor>>
  deleteAnchor(index: number): void
  addAnchor(time: number, value?: number): void
  getPairedAnchorPosition(
    type: 'pre' | 'post',
    index: number
  ): Vector | undefined
}

export function createTimeline(config?: { initial?: Anchors }) {
  const [anchors, setAnchors] = createStore<Anchors>(config?.initial || [])

  const absoluteAnchors = createArrayProxy(
    mapArray(
      () => anchors,
      (anchor): Anchor => {
        const pre = createMemo(() =>
          anchor[1]?.pre
            ? addVector(anchor[0], multiplyVector(anchor[1].pre, { x: -1 }))
            : undefined
        )
        const post = createMemo(() =>
          anchor[1]?.post ? addVector(anchor[0], anchor[1].post) : undefined
        )

        return [
          anchor[0],
          {
            get pre() {
              return pre()
            },
            get post() {
              return post()
            },
          },
        ]
      }
    )
  )

  function getPairedAnchorPosition(
    type: 'pre' | 'post',
    index: number
  ): undefined | Vector {
    if (type === 'pre' && index === 0) {
      return undefined
    }
    if (type === 'post' && index === anchors.length - 1) {
      return undefined
    }
    return anchors[type === 'pre' ? index - 1 : index + 1][0]
  }

  function clampControl(
    type: 'pre' | 'post',
    index: number,
    [position, controls]: Anchor
  ) {
    const control = controls?.[type]

    if (!control) {
      return undefined
    }

    const pairedPosition = getPairedAnchorPosition(type, index)

    if (!pairedPosition) {
      throw `Attempting to process a control without a paired anchor.`
    }

    const [min, max] =
      type === 'post' ? [position, pairedPosition] : [pairedPosition, position]

    // Clamp x to ensure monotonicity of the curve (https://en.wikipedia.org/wiki/Monotonic_function)
    const clampedX = Math.max(min.x, Math.min(max.x, control.x))

    if (clampedX === control.x) {
      return control
    } else {
      const ratio = (position.x - clampedX) / (position.x - control.x)
      const clampedY = (control.y - position.y) * ratio + position.y
      return {
        x: clampedX,
        y: clampedY,
      }
    }
  }

  const clampedAbsoluteAnchors = createArrayProxy(
    mapArray(
      () => absoluteAnchors,
      (anchor, index): Anchor => {
        const pre = createMemo(() => clampControl('pre', index(), anchor))
        const post = createMemo(() => clampControl('post', index(), anchor))
        return [
          anchor[0],
          {
            get pre() {
              return pre()
            },
            get post() {
              return post()
            },
          },
        ]
      }
    )
  )

  const mapArraySegments = mapArray(
    () => clampedAbsoluteAnchors,
    (anchor, index) =>
      createMemo(() => {
        const next = clampedAbsoluteAnchors[index() + 1]
        return next
          ? {
              range: [anchor[0].x, next[0].x],
              map: createLookupMap(anchor, next),
            }
          : undefined
      })
  )

  const lookupMapSegments = createMemo(() => mapArraySegments().slice(0, -1))

  function d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) {
    return dFromAbsoluteAnchors(clampedAbsoluteAnchors, config)
  }

  function getValue(time: number) {
    const segments = lookupMapSegments() as Array<Accessor<Segment>>
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
            post: { x: 100, y: 0 },
          }
          anchors.push([{ x: time, y: value }, { pre: { x: 100, y: 0 } }])
        } else if (index === 0) {
          anchors[0][1] = {
            ...anchors[0][1],
            pre: { x: 100, y: 0 },
          }
          anchors.unshift([{ x: time, y: value }, { post: { x: 100, y: 0 } }])
        } else {
          anchors.splice(index, 0, [
            { x: time, y: value },
            { pre: { x: 100, y: 0 }, post: { x: 100, y: 0 } },
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
    anchors,
    addAnchor,
    d,
    deleteAnchor,
    getValue,
    setAnchors,
    getPairedAnchorPosition,
  }

  return {
    ...api,
    Value: createValueComponent(api),
    Component: createTimelineComponent(api),
  }
}
