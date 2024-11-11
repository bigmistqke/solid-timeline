export type Vector = {
  x: number
  y: number
}

type BareControls = { pre: Vector; post: Vector }
export type Controls<
  TRequired extends keyof BareControls | undefined = undefined
> = TRequired extends keyof BareControls
  ? RequireKeys<Partial<BareControls>, TRequired>
  : Partial<BareControls>

export type CubicAnchor = PostAnchor | CenterAnchor | PreAnchor
export type QuadraticBezierAnchor = [Vector, Controls]
export type LinearBezierAnchor = [Vector]

export type Anchor = [Vector, Controls?]
export type PreAnchor = [Vector, Controls<'pre'>]
export type CenterAnchor = [Vector, Controls<'pre' | 'post'>]
export type PostAnchor = [Vector, Controls<'post'>]
export type Anchors = Array<Anchor>

export type Segment = {
  range: number[]
  map: Vector[]
}

/**********************************************************************************/
/*                                                                                */
/*                                      Utils                                     */
/*                                                                                */
/**********************************************************************************/

export type RequireKeys<
  TObject extends object,
  TKeys extends keyof TObject
> = Required<Pick<TObject, TKeys>> & Omit<TObject, TKeys>

export type Merge<T, U> = T & U
