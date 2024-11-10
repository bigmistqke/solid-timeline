import { Anchor, Vector } from '#/types'

export interface DConfig {
  zoom?: Partial<Vector>
  origin?: Partial<Vector>
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

  const origin = {
    x: 0,
    y: 0,
    ...config?.origin,
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
      segment += (pre.x + origin.x) * zoom.x + offset.x
      segment += ' '
      segment += (pre.y + origin.y) * zoom.y + offset.y
      segment += ' '
    }
    if (d === '') {
      currentCommand = 'M'
      segment += currentCommand
      segment += ' '
    }
    segment += (point.x + origin.x) * zoom.x + offset.x
    segment += ' '
    segment += (point.y + origin.y) * zoom.y + offset.y
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
        segment += (post.x + origin.x) * zoom.x + offset.x
        segment += ' '
        segment += (post.y + origin.y) * zoom.y + offset.y
        segment += ' '
      }
    }

    d += segment
  })

  return d
}
