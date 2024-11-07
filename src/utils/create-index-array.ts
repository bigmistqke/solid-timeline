import {
  $PROXY,
  $TRACK,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  getListener,
  indexArray,
  mapArray,
  onCleanup,
  type Accessor,
} from 'solid-js'

// Interpolated from https://github.com/solidjs/solid/blob/main/packages/solid/store/src/store.ts

const $RAW = Symbol('store-raw')
const $NODE = Symbol('store-node')
const $HAS = Symbol('store-has')
const $SELF = Symbol('store-self')
const $MEMO = Symbol('store-memo')

type DataNode = {
  (): any
  $(value?: any): void
}
type DataNodes = Record<PropertyKey, DataNode | undefined>

interface StoreNode {
  [$NODE]?: DataNodes
  [key: PropertyKey]: any
}

function wrap<T extends StoreNode>(value: T): T {
  let p = value[$PROXY]
  if (!p) {
    Object.defineProperty(value, $PROXY, {
      value: (p = new Proxy(value, proxyTraps)),
    })
  }
  return p
}

function getNodes(
  target: StoreNode,
  symbol: typeof $NODE | typeof $HAS
): DataNodes {
  let nodes = target[symbol]
  if (!nodes)
    Object.defineProperty(target, symbol, {
      value: (nodes = Object.create(null) as DataNodes),
    })
  return nodes
}

function getNode(nodes: DataNodes, property: PropertyKey, value?: any) {
  if (nodes[property]) return nodes[property]!
  const [s, set] = createSignal<any>(value, {
    equals: false,
    internal: true,
  })
  ;(s as DataNode).$ = set
  return (nodes[property] = s as DataNode)
}

function proxyDescriptor(target: StoreNode, property: PropertyKey) {
  const desc = Reflect.getOwnPropertyDescriptor(target, property)
  if (
    !desc ||
    desc.get ||
    !desc.configurable ||
    property === $PROXY ||
    property === $NODE
  )
    return desc
  delete desc.value
  delete desc.writable
  desc.get = () => {
    return target[$PROXY][property]
  }
  return desc
}

function trackSelf(target: StoreNode) {
  if (getListener()) {
    const node = getNode(getNodes(target, $NODE), $SELF)
    node()
  }
}

function ownKeys(target: StoreNode) {
  trackSelf(target)
  return Reflect.ownKeys(target)
}

const proxyTraps: ProxyHandler<StoreNode> = {
  get(target, property, receiver) {
    if (property === $RAW) return target
    if (property === $PROXY) return receiver
    if (property === $TRACK) {
      trackSelf(target)
      return receiver
    }
    const nodes = getNodes(target, $NODE)
    const tracked = nodes[property]
    let value = tracked ? tracked() : target[property]
    if (property === $NODE || property === $HAS || property === '__proto__')
      return value

    if (!tracked) {
      const desc = Object.getOwnPropertyDescriptor(target, property)
      if (
        getListener() &&
        (typeof value !== 'function' || target.hasOwnProperty(property)) &&
        !(desc && desc.get)
      ) {
        value = getNode(nodes, property, value)()
      }
    }

    if (typeof value === 'function' && $MEMO in value) {
      const result = value()
      return result
    }

    return value
  },

  has(target, property) {
    if (
      property === $RAW ||
      property === $PROXY ||
      property === $TRACK ||
      property === $NODE ||
      property === $HAS ||
      property === '__proto__'
    )
      return true
    getListener() && getNode(getNodes(target, $HAS), property)()
    return property in target
  },

  set() {
    return true
  },

  deleteProperty() {
    return true
  },

  ownKeys: ownKeys,

  getOwnPropertyDescriptor: proxyDescriptor,
}

function setProperty(
  state: StoreNode,
  property: PropertyKey,
  value: Accessor<any> | undefined
): void {
  const prev = state[property],
    len = state.length

  if (value === undefined) {
    if (typeof property === 'number' && property > state.length) {
      state.splice(property, 1)
    } else {
      state[property] = undefined
    }
    if (state[$HAS] && state[$HAS][property] && prev !== undefined)
      state[$HAS][property].$()
  } else {
    state[property] = value
    if (state[$HAS] && state[$HAS][property] && prev === undefined)
      state[$HAS][property].$()
  }
  let nodes = getNodes(state, $NODE),
    node: DataNode | undefined
  if ((node = getNode(nodes, property, prev))) node.$(() => value)

  if (Array.isArray(state) && state.length !== len) {
    for (let i = state.length; i < len; i++) (node = nodes[i]) && node.$()
    ;(node = getNode(nodes, 'length', len)) && node.$(state.length)
  }

  node = nodes[$SELF]
  if (node) {
    node.$()
  }
}

export function createIndexProxy<T extends Array<any>, U>(
  source: () => T,
  callback: (value: T[number], index: number) => U
): Array<U> {
  const unwrappedStore: Array<U> = []
  const wrappedStore = wrap(unwrappedStore)
  const nodes = getNodes(wrappedStore, $NODE)

  createRenderEffect(
    indexArray(source, (value, index) => {
      const memo = createMemo(() => {
        // NOTE: setting signal inside a memo is a bit :-/
        nodes[$SELF]?.$()
        return callback(value(), index)
      })
      memo[$MEMO] = true
      setProperty(unwrappedStore, index, memo)
      onCleanup(() => {
        console.log('cleanup!')
        setProperty(unwrappedStore, index, undefined)
      })
    })
  )

  return wrappedStore
}

export function createMapProxy<T extends Array<any>, U>(
  source: () => T,
  callback: (value: T[number], index: Accessor<number>) => U
): Array<U> {
  const unwrappedStore: Array<U> = []
  const wrappedStore = wrap(unwrappedStore)
  const nodes = getNodes(wrappedStore, $NODE)

  createRenderEffect(
    mapArray(source, (value, index) => {
      const memo = createMemo(() => {
        // NOTE: setting signal inside a memo is a bit :-/
        nodes[$SELF]?.$()
        return callback(value, index)
      })
      memo[$MEMO] = true
      setProperty(unwrappedStore, index(), memo)
      createEffect(() => {
        onCleanup(() => {
          setProperty(unwrappedStore, index(), undefined)
        })
      })
    })
  )

  return wrappedStore
}
