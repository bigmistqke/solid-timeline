import { Accessor, indexArray } from 'solid-js'

export function indexComputed<T, U>(
  accessor: Accessor<Array<T>>,
  callback: (value: T, index: number) => U
): Accessor<Array<U>> {
  const map = indexArray(
    accessor,
    (value, index) => () => callback(value(), index)
  )
  return () => map().map((fn) => fn())
}
