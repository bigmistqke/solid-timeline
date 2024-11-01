export type Vector = {
  x: number
  y: number
}

export type PostPoint = [Vector, { post: Vector; pre?: never }?]
export type CenterPoint = [Vector, { post: Vector; pre: Vector }?]
export type PrePoint = [Vector, { pre: Vector; post?: never }?]

export type Point = PostPoint | CenterPoint | PrePoint

export type Points = [PostPoint, ...CenterPoint[], PrePoint] | []
