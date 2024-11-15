import { Accessor, createMemo, createSignal, Setter } from 'solid-js'

export function createWritable<T>(source: Accessor<T>) {
  const memo = createMemo(() => createSignal(source()))
  return [() => memo()[0](), (v) => memo()[1](v)] as [Accessor<T>, Setter<T>]
}
