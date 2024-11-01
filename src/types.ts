export type Vector = {
  x: number
  y: number
}

export type PostPoint = [Vector, { post: Vector; pre?: never }]
export type CenterPoint = [Vector, { post: Vector; pre: Vector }]
export type PrePoint = [Vector, { pre: Vector; post?: never }]

export type CubicPoint = PostPoint | CenterPoint | PrePoint
export type QuadraticBezierPoint = [Vector, { pre?: Vector; post?: Vector }]
export type LinearBezierPoint = [Vector]

export type Point = [Vector, { pre?: Vector; post?: Vector }?]

export type Points = Array<Point>
