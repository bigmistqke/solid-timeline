import { Anchor, Vector } from 'solid-timeline/types'

export interface DConfig {
  zoom?: Partial<Vector>
  offset?: Partial<Vector>
}

export function dFromAbsoluteAnchors(
  absoluteAnchors: Array<Anchor>,
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
    const [point, { pre, post } = {}] = anchor

    let next = absoluteAnchors[index + 1]

    let segment = ''
    if (pre) {
      segment += pre.x * zoom.x + offset.x
      segment += ' '
      segment += pre.y * zoom.y + offset.y
      segment += ' '
    }
    if (d === '') {
      currentCommand = 'M'
      segment += currentCommand
      segment += ' '
    }
    segment += point.x * zoom.x + offset.x
    segment += ' '
    segment += point.y * zoom.y + offset.y
    segment += ' '

    if (next) {
      let command =
        !next![1]?.pre && !post ? 'L' : next![1]?.pre && post ? 'C' : 'Q'

      if (command !== currentCommand) {
        currentCommand = command
        segment += currentCommand
        segment += ' '
      }

      if (post) {
        segment += post.x * zoom.x + offset.x
        segment += ' '
        segment += post.y * zoom.y + offset.y
        segment += ' '
      }
    }

    d += segment
  })

  return d
}
