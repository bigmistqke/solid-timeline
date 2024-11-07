import {
  $PROXY,
  $TRACK,
  createMemo,
  createSignal,
  untrack,
  type Accessor,
  type Signal,
} from 'solid-js'

export function createArrayProxy<T>(get_source: Accessor<T[]>): T[] {
  let source_memo = createMemo(get_source)

  let memo = createMemo<Signal<T>[]>((prev) => {
    let source = source_memo()
    let i = 0
    for (; i < Math.min(prev.length, source.length); i++) {
      prev[i][1](() => source[i])
    }
    for (; i < source.length; i++) {
      prev[i] = createSignal(source[i])
    }
    for (; i < prev.length; i++) {
      prev[i][1](undefined as any)
    }
    return prev.slice()
  }, [])

  let length = createMemo(() => source_memo().length)

  const focusTrap = {
    get(_: any[], property: PropertyKey, receiver: any) {
      if (property === $PROXY) return receiver
      if (property === $TRACK) return memo(), receiver

      if (property === Symbol.iterator)
        return memo(), untrack(source_memo)[property as any]
      if (property === 'length') return length()

      if (typeof property === 'symbol') return source_memo()[property as any]

      if (property in Array.prototype)
        return Array.prototype[property as any].bind(receiver)

      const num = typeof property === 'string' ? parseInt(property) : property

      // invalid index - treat as obj property
      if (!Number.isInteger(num) || num < 0)
        return source_memo()[property as any]

      // out of bounds
      if (num >= untrack(length)) return length(), source_memo()[num]

      // valid index
      return untrack(memo)[num][0]()
    },

    has(target: T, property: PropertyKey) {
      if (
        property === $PROXY ||
        property === $TRACK ||
        property === '__proto__'
      )
        return true
      this.ownKeys()
      return property in untrack(source_memo)
    },

    ownKeys(): (string | symbol)[] {
      length()
      return Reflect.ownKeys(untrack(source_memo))
    },

    getOwnPropertyDescriptor(
      target: any,
      property: PropertyKey
    ): PropertyDescriptor | undefined {
      let desc = Reflect.getOwnPropertyDescriptor(target, property) as any

      if (desc) {
        if (desc.get) {
          desc.get = this.get.bind(this, target, property, this)
          delete desc.writable
        } else {
          desc.value = this.get(target, property, this)
        }
      } else {
        desc = this.has(target, property)
          ? {
              enumerable: true,
              configurable: true,
              get: this.get.bind(this, target, property, this),
            }
          : undefined
      }

      return desc
    },

    set() {
      return true
    },
    deleteProperty() {
      return true
    },
  }

  return new Proxy([], focusTrap)
}
