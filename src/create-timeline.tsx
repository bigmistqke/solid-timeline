import {
  ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  splitProps,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Point, Points, PostPoint, PrePoint, Vector } from './types'
import { createCubicLookupMap } from './utils/create-cubic-lookup-map'
import { findYOnLine } from './utils/find-y-on-line'
import { indexComputed } from './utils/index-computed'
import { pointerHelper } from './utils/pointer-helper'
import { vector } from './utils/vector'

const Handle = (props: {
  position: Vector
  absoluteHandle: Vector
  onChange: (position: Vector) => void
  zoom: Vector
  origin: Vector
}) => {
  async function onPointerDown(e: MouseEvent) {
    const handle = { ...props.absoluteHandle }
    pointerHelper(e, (delta) =>
      props.onChange({
        x: handle.x - delta.x / props.zoom.x,
        y: handle.y - delta.y / props.zoom.y,
      })
    )
  }

  return (
    <>
      <circle
        cx={(props.absoluteHandle.x + props.origin.x) * props.zoom.x}
        cy={(props.absoluteHandle.y + props.origin.y) * props.zoom.y}
        r="5"
        onPointerDown={onPointerDown}
        style={{ cursor: 'move' }}
      />
      <line
        stroke="black"
        x1={(props.position.x + props.origin.x) * props.zoom.x}
        y1={(props.position.y + props.origin.y) * props.zoom.y}
        x2={(props.absoluteHandle.x + props.origin.x) * props.zoom.x}
        y2={(props.absoluteHandle.y + props.origin.y) * props.zoom.y}
        style={{ 'pointer-events': 'none' }}
      />
    </>
  )
}

function Point(props: {
  position: Vector
  zoom: Vector
  origin: Vector
  pre?: Vector
  post?: Vector
  onPositionChange: (point: Vector) => void
  onPreChange: (point: Vector) => void
  onPostChange: (point: Vector) => void
}) {
  function onDrag(e: MouseEvent) {
    const position = { ...props.position }
    pointerHelper(e, (delta) =>
      props.onPositionChange(
        vector.subtract(position, {
          x: delta.x / props.zoom.x,
          y: delta.y / props.zoom.y,
        })
      )
    )
  }

  return (
    <>
      <circle
        cx={(props.position.x + props.origin.x) * props.zoom.x}
        cy={(props.position.y + props.origin.y) * props.zoom.y}
        r="5"
        onMouseDown={onDrag}
        style={{ cursor: 'move' }}
      />
      <Show when={props.pre}>
        <Handle
          position={props.position}
          absoluteHandle={props.pre!}
          onChange={props.onPreChange}
          origin={props.origin}
          zoom={props.zoom}
        />
      </Show>
      <Show when={props.post}>
        <Handle
          position={props.position}
          absoluteHandle={props.post!}
          onChange={props.onPostChange}
          origin={props.origin}
          zoom={props.zoom}
        />
      </Show>
    </>
  )
}

export function createTimeline(config?: { initialPoints?: Points }) {
  const [anchors, setAnchors] = createStore<Points>(config?.initialPoints || [])

  const absoluteAnchors = indexComputed(
    () => anchors,
    ([point, relativeControls], index) => {
      const controls: { pre?: Vector; post?: Vector } = {
        pre: undefined,
        post: undefined,
      }

      const pre = relativeControls?.pre
      if (pre) {
        const prev = anchors[index - 1][0]
        const deltaX = vector.subtract(point, prev).x

        controls.pre = vector.add(point, {
          x: deltaX * pre.x * -1,
          y: pre.y,
        })
      }

      const post = relativeControls?.post
      if (post) {
        const next = anchors[index + 1][0]
        const deltaX = vector.subtract(next, point).x

        controls.post = vector.add(point, {
          x: deltaX * post.x,
          y: post.y,
        })
      }

      return [point, controls] as const
    }
  )

  const lookupMapSegments = indexComputed(absoluteAnchors, (point, index) =>
    index < absoluteAnchors().length - 1
      ? createCubicLookupMap(
          point as unknown as PostPoint,
          absoluteAnchors()[index + 1] as unknown as PrePoint,
          120
        )
      : []
  )
  const lookupMap = createMemo(() => lookupMapSegments().flat())

  function closestPoint(time: number) {
    let closestPointLeft = undefined
    let closestPointRight = undefined

    for (const point of lookupMap()) {
      const delta = Math.abs(time - point.x)
      if (time < point.x) {
        if (!closestPointLeft || delta < Math.abs(time - closestPointLeft.x)) {
          closestPointLeft = point
        }
      } else {
        if (
          !closestPointRight ||
          delta < Math.abs(time - closestPointRight.x)
        ) {
          closestPointRight = point
        }
      }
    }
    return [closestPointLeft, closestPointRight] as const
  }

  function d(config?: { zoom?: Partial<Vector>; origin?: Partial<Vector> }) {
    let d = ''

    const zoom = {
      x: 1,
      y: 1,
      ...config?.zoom,
    }

    const origin = {
      x: 0,
      y: 0,
      ...config?.origin,
    }

    absoluteAnchors().forEach(([point, { pre, post } = {}]) => {
      let segment = ''
      if (pre) {
        segment += (pre.x + origin.x) * zoom.x
        segment += ' '
        segment += (pre.y + origin.y) * zoom.y
        segment += ' '
      }
      if (d === '') {
        segment += 'M'
        segment += ' '
      }
      segment += (point.x + origin.x) * zoom.x
      segment += ' '
      segment += (point.y + origin.y) * zoom.y
      segment += ' '
      if (d === '') {
        segment += 'C'
        segment += ' '
      }
      if (post) {
        segment += (post.x + origin.x) * zoom.x
        segment += ' '
        segment += (post.y + origin.y) * zoom.y
        segment += ' '
      }
      d += segment
    })

    return d
  }

  function getValue(time: number) {
    const [closestPointLeft, closestPointRight] = closestPoint(time)

    if (!closestPointLeft && closestPointRight) return closestPointRight.y
    if (!closestPointRight && closestPointLeft) return closestPointLeft.y
    if (!closestPointLeft || !closestPointRight) return undefined

    return findYOnLine(closestPointLeft, closestPointRight, time)
  }

  return {
    absoluteAnchors,
    anchors,
    d,
    getValue,
    setAnchors,
    Component: (
      props: ComponentProps<'svg'> & {
        min: number
        max: number
        zoom?: Partial<Vector>
        onZoomChange?: (zoom: Vector) => void
        onOriginChange?: (origin: Vector) => void
      }
    ) => {
      const [, rest] = splitProps(props, [
        'min',
        'max',
        'onZoomChange',
        'onOriginChange',
      ])
      const [domRect, setDomRect] = createSignal<DOMRect>()

      const y = createMemo(() => {
        const _domRect = domRect()

        if (!_domRect) {
          return
        }

        const { height } = _domRect

        const rangeHeight = props.max - props.min

        return {
          zoom: height / rangeHeight,
          origin: rangeHeight / 2,
        }
      })

      const zoom = () => ({
        x: 1,
        y: (y()?.zoom || 1) * (props.zoom?.y || 1),
      })

      const origin = () => ({
        x: 0,
        y: (y()?.origin || 0) / (props.zoom?.y || 1),
      })

      createEffect(() => props.onZoomChange?.(zoom()))
      createEffect(() => props.onOriginChange?.(origin()))

      function onAnchorChange({
        absoluteAnchor,
        index,
        type,
      }: {
        absoluteAnchor: Vector
        index: number
        type: 'pre' | 'post'
      }) {
        const [point] = absoluteAnchors()[index]
        const [connectedPoint] =
          type === 'post'
            ? absoluteAnchors()[index + 1]
            : absoluteAnchors()[index - 1]

        let absoluteX = (absoluteAnchor.x + origin().x) * zoom().x

        if (
          (type === 'post' &&
            (connectedPoint.x + origin().x) * zoom().x < absoluteX) ||
          (type !== 'post' &&
            (connectedPoint.x + origin().x) * zoom().x > absoluteX)
        ) {
          absoluteX = connectedPoint.x
        }

        if (
          (type === 'post' && absoluteX < (point.x + origin().x) * zoom().x) ||
          (type !== 'post' && absoluteX > (point.x + origin().x) * zoom().x)
        ) {
          absoluteX = point.x
        }

        const deltaX = Math.abs(point.x - connectedPoint.x)

        const anchor = {
          y: absoluteAnchor.y - point.y,
          x: Math.abs(point.x - absoluteX) / deltaX,
        }

        setAnchors(index, 1, type, anchor)
      }

      const onPositionChange = (index: number, position: Vector) => {
        const [prev] = absoluteAnchors()[index - 1] || []
        const [next] = absoluteAnchors()[index + 1] || []

        if (prev && position.x - 10 < prev.x) {
          position.x = prev.x + 10
        }
        if (next && position.x + 10 > next.x) {
          position.x = next.x - 10
        }

        setAnchors(index, 0, position)
      }

      function onRef(element: SVGSVGElement) {
        function updateDomRect() {
          setDomRect(element.getBoundingClientRect())
        }
        const observer = new ResizeObserver(updateDomRect)
        observer.observe(element)
        updateDomRect()
        onCleanup(() => observer.disconnect())
      }

      return (
        <svg ref={onRef} width="100%" height="100%" {...rest}>
          <For each={absoluteAnchors()}>
            {([point, { pre, post }], index) => (
              <Point
                position={point}
                pre={pre}
                post={post}
                origin={origin()}
                zoom={zoom()}
                onPositionChange={(position) =>
                  onPositionChange(index(), position)
                }
                onPreChange={(absoluteHandle) =>
                  onAnchorChange({
                    absoluteAnchor: absoluteHandle,
                    index: index(),
                    type: 'pre',
                  })
                }
                onPostChange={(absoluteHandle) =>
                  onAnchorChange({
                    absoluteAnchor: absoluteHandle,
                    index: index(),
                    type: 'post',
                  })
                }
              />
            )}
          </For>
          <path
            stroke="black"
            fill="transparent"
            d={d({ zoom: zoom(), origin: origin() })}
            style={{ 'pointer-events': 'none' }}
          />
          {props.children}
        </svg>
      )
    },
  }
}
