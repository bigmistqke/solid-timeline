export interface Vector {
  x: number
  y: number
}

export interface Anchor {
  position: Vector
  pre?: Vector
  post?: Vector
}

export interface ClampedAnchor {
  position: Vector
  pre?: ClampedControl
  post?: ClampedControl
}

export interface ProjectedAnchor {
  position: ProjectedPosition
  pre?: ProjectedControl
  post?: ProjectedControl
}

export interface ClampedControl {
  relative: Vector
  absolute: { unclamped: Vector; clamped: Vector }
}

export interface ProjectedControl extends ClampedControl {
  projected: { unclamped: Vector; clamped: Vector }
}

export interface ProjectedPosition {
  absolute: Vector
  projected: Vector
}

export interface Segment {
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
