import { Accessor, mapArray } from 'solid-js'

export function mapComputed<T, U>(
  accessor: Accessor<Array<T>>,
  callback: (value: T, index: Accessor<number>) => U
): Accessor<Array<U>> {
  const map = mapArray(accessor, (value, index) => () => callback(value, index))
  return () => map().map((fn) => fn())
}
