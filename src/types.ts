export type Vector = {
  x: number
  y: number
}

export type Anchor = { position: Vector; pre?: Vector; post?: Vector }
export type ProcessedAnchor = {
  position: Vector
  pre?: { unclamped: Vector; clamped: Vector }
  post?: { unclamped: Vector; clamped: Vector }
}

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
