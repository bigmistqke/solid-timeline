import { Accessor, createRenderEffect, createSignal } from 'solid-js'

export function createWritable<T>(source: Accessor<T>) {
  const [signal, setSignal] = createSignal<T>(null!)
  createRenderEffect(() => setSignal(source() as any))
  return [signal, setSignal] as const
}
