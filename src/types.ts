export type Vector = {
  x: number
  y: number
}

export type Controls = { pre: Vector; post: Vector }
export type ProcessedControls = {
  pre: { unclamped: Vector; clamped: Vector }
  post: { unclamped: Vector; clamped: Vector }
}

export type InputAnchor = [Vector, Partial<Controls>?]
export type AbsoluteAnchor = [Vector, Partial<Controls>]
export type ProcessedAnchor = [Vector, Partial<ProcessedControls>]

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
