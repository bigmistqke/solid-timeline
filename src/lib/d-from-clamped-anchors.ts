import { ClampedAnchor, Vector } from 'solid-timeline/types'

export interface DConfig {
  zoom?: Partial<Vector>
  offset?: Partial<Vector>
  range?: [start: number, end: number]
}

export function dFromClampedAnchors(
  clampedAnchors: Array<ClampedAnchor>,
  config?: DConfig
) {
  let d = ''

  const zoom = {
    x: 1,
    y: 1,
    ...config?.zoom,
  }

  const offset = {
    x: 0,
    y: 0,
    ...config?.offset,
  }

  let currentCommand = ''

  if (config?.range) {
    clampedAnchors = clampedAnchors.slice(...config.range)
  }

  const lastIndex = config?.range ? config.range[1] : clampedAnchors.length - 1

  clampedAnchors.forEach((anchor, index) => {
    const { position, pre, post } = anchor
    let next = clampedAnchors[index + 1]

    let segment = ''
    if (d !== '' && pre) {
      segment += pre.absolute.clamped.x * zoom.x + offset.x
      segment += ' '
      segment += pre.absolute.clamped.y * zoom.y + offset.y
      segment += ' '
    }
    if (d === '') {
      currentCommand = 'M'
      segment += currentCommand
      segment += ' '
    }
    segment += position.x * zoom.x + offset.x
    segment += ' '
    segment += position.y * zoom.y + offset.y
    segment += ' '

    if (index !== lastIndex && next) {
      let command = !next.pre && !post ? 'L' : next.pre && post ? 'C' : 'Q'

      if (command !== currentCommand) {
        currentCommand = command
        segment += currentCommand
        segment += ' '
      }

      if (post) {
        segment += post.absolute.clamped.x * zoom.x + offset.x
        segment += ' '
        segment += post.absolute.clamped.y * zoom.y + offset.y
        segment += ' '
      }
    }

    d += segment
  })

  return d
}
