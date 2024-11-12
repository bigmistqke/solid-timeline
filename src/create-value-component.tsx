import {
  Accessor,
  ComponentProps,
  createContext,
  Setter,
  useContext,
} from 'solid-js'
import { Api } from './create-timeline'
import { useSheet } from './sheet'
import { createWritable } from './utils/create-writable'

const ValueContext = createContext<{
  value: Accessor<number>
  setValue: Setter<number>
}>()
const useValue = () => {
  const context = useContext(ValueContext)
  if (!context) {
    throw `useValue should be used in a descendant of Value`
  }
  return context
}

export function createValueComponent({ addAnchor, query }: Api) {
  function Value(props: ComponentProps<'div'>) {
    const { time } = useSheet()
    const [value, setValue] = createWritable(() => query(time()))

    return (
      <ValueContext.Provider value={{ value, setValue }}>
        <div {...props} />
      </ValueContext.Provider>
    )
  }

  Value.Button = function (props: Omit<ComponentProps<'button'>, 'click'>) {
    const { time } = useSheet()
    const { value } = useValue()

    return (
      <button
        onClick={() => {
          addAnchor(time(), value())
        }}
        {...props}
      />
    )
  }

  Value.Input = function (
    props: Omit<ComponentProps<'input'>, 'onInput' | 'value'> & {
      decimals?: number
    }
  ) {
    const { value, setValue } = useValue()

    return (
      <input
        type="number"
        value={props.decimals ? value().toFixed(props.decimals) : value()}
        onInput={(e) => setValue(+e.currentTarget.value)}
        {...props}
      />
    )
  }

  return Value
}
