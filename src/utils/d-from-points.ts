import { Points } from '../types'

export function dFromPoints(points: Points) {
  let d = ''

  points.forEach(([point, { pre, post }]) => {
    let segment = ''
    if (pre) {
      segment += pre.x
      segment += ' '
      segment += pre.y
      segment += ' '
    }
    if (d === '') {
      segment += 'M'
      segment += ' '
    }
    segment += point.x
    segment += ' '
    segment += point.y
    segment += ' '
    if (d === '') {
      segment += 'C'
      segment += ' '
    }
    if (post) {
      segment += post.x
      segment += ' '
      segment += post.y
      segment += ' '
    }
    d += segment
  })

  return d
}
