import { ProcessedAnchor, Vector } from 'solid-timeline/types'

export interface DConfig {
  zoom?: Partial<Vector>
  offset?: Partial<Vector>
}

export function dFromProcessedAnchors(
  absoluteAnchors: Array<ProcessedAnchor>,
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

  absoluteAnchors.forEach((anchor, index) => {
    const { position, pre, post } = anchor

    let next = absoluteAnchors[index + 1]

    let segment = ''
    if (pre) {
      segment += pre.clamped.x * zoom.x + offset.x
      segment += ' '
      segment += pre.clamped.y * zoom.y + offset.y
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

    if (next) {
      let command = !next.pre && !post ? 'L' : next.pre && post ? 'C' : 'Q'

      if (command !== currentCommand) {
        currentCommand = command
        segment += currentCommand
        segment += ' '
      }

      if (post) {
        segment += post.clamped.x * zoom.x + offset.x
        segment += ' '
        segment += post.clamped.y * zoom.y + offset.y
        segment += ' '
      }
    }

    d += segment
  })

  return d
}
