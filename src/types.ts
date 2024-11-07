export type Vector = {
  x: number
  y: number
}

type RequireKeys<
  TObject extends object,
  TKeys extends keyof TObject
> = Required<Pick<TObject, TKeys>> & Omit<TObject, TKeys>

type BareControls = { pre: Vector; post: Vector }
export type Controls<
  TRequired extends keyof BareControls | undefined = undefined
> = TRequired extends keyof BareControls
  ? RequireKeys<Partial<BareControls>, TRequired>
  : Partial<BareControls>

export type PostPoint = [Vector, Controls<'pre'>]
export type CenterPoint = [Vector, Controls<'pre' | 'post'>]
export type PrePoint = [Vector, Controls<'pre'>]

export type CubicPoint = PostPoint | CenterPoint | PrePoint
export type QuadraticBezierPoint = [Vector, Controls]
export type LinearBezierPoint = [Vector]

export type Anchor = [Vector, Controls?]
export type PreAnchor = [Vector, Controls<'pre'>]
export type PostAnchor = [Vector, Controls<'post'>]
export type Anchors = Array<Anchor>

export type Segment = {
  range: number[]
  map: Vector[]
}
