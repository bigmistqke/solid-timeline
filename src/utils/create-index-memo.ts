import { Accessor, createMemo, indexArray } from 'solid-js'

export function createIndexMemo<T, U>(
  accessor: Accessor<Array<T>>,
  callback: (value: T, index: number) => U
): Accessor<Array<U>> {
  const map = indexArray(accessor, (value, index) =>
    createMemo(() => callback(value(), index))
  )
  return createMemo(() => map().map((fn) => fn()))
}
