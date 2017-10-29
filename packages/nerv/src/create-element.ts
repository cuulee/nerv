import h from './vdom/h'
import SVGPropertyConfig from './vdom/svg-property-config'
import {
  isFunction,
  isString,
  isNumber,
  isBoolean,
  isObject,
  supportSVG
} from 'nerv-utils'
import FullComponent from './full-component'
import StatelessComponent from './stateless-component'
import CurrentOwner from './current-owner'
import RefHook from './hooks/ref-hook'
import HtmlHook from './hooks/html-hook'
import EventHook from './hooks/event-hook'
import AttributeHook from './hooks/attribute-hook'
import { Props, VirtualChildren, Component, VNode } from 'nerv-shared'

const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i

const EMPTY_CHILDREN = []
const isSupportSVG = supportSVG()

function transformPropsForRealTag (tagName: string, props: Props) {
  const newProps: any = {}
  const DOMAttributeNamespaces = SVGPropertyConfig.DOMAttributeNamespaces
  for (let propName in props) {
    const propValue = props[propName]
    const originalPropName = propName
    const domAttributeName = SVGPropertyConfig.DOMAttributeNames[propName]
    propName = domAttributeName || propName
    if (
      (propName === 'id' ||
        propName === 'className' ||
        propName === 'namespace') &&
      propValue !== undefined
    ) {
      newProps[propName] = propValue
      continue
    }
    if (propName === 'ref') {
      newProps[propName] = !(propValue instanceof RefHook)
        ? new RefHook(propValue)
        : propValue
      continue
    }
    if (propName === 'dangerouslySetInnerHTML') {
      newProps[propName] = !(propValue instanceof HtmlHook)
        ? new HtmlHook(propValue)
        : propValue
      continue
    }
    // 收集事件
    if (propName.charAt(0) === 'o' && propName.charAt(1) === 'n') {
      newProps[propName] = !(propValue instanceof EventHook)
        ? new EventHook(propName, propValue)
        : propValue
      continue
    }
    if (
      isSupportSVG &&
      DOMAttributeNamespaces.hasOwnProperty(originalPropName) &&
      (isString(propValue) || isNumber(propValue) || isBoolean(propValue))
    ) {
      const namespace = DOMAttributeNamespaces[originalPropName]
      newProps[propName] = new AttributeHook(namespace, propValue)
      continue
    }
    if (propName === 'defaultValue') {
      newProps.value = props.value || props.defaultValue
      continue
    }
    if (propName === 'style') {
      if (isString(propValue)) {
        newProps[propName] = propValue
      } else if (isObject(propValue)) {
        for (const styleName in propValue) {
          let styleValue = propValue[styleName]
          if (
            styleValue !== undefined &&
            (isString(styleValue) || !isNaN(styleValue))
          ) {
            styleValue =
              isNumber(styleValue) &&
              IS_NON_DIMENSIONAL.test(styleName) === false
                ? styleValue + 'px'
                : styleValue
            newProps[propName] = newProps[propName] || {}
            newProps[propName][styleName] = styleValue
          }
        }
      }
      continue
    }
    newProps[propName] = propValue
  }
  return newProps
}

/**
 *
 * @param props
 * @param defaultProps
 * defaultProps should respect null but ignore undefined
 * @see: https://facebook.github.io/react/docs/react-component.html#defaultprops
 */
function transformPropsForComponent (props: Props, defaultProps?: Props) {
  const newProps: any = {}
  for (const propName in props) {
    const propValue = props[propName]
    newProps[propName] = propValue
  }
  if (defaultProps) {
    for (const propName in defaultProps) {
      if (newProps[propName] === undefined) {
        newProps[propName] = defaultProps[propName]
      }
    }
  }
  return newProps
}

function createElement<T> (
  tagName: string | Function | Component<any, any>,
  properties?: T & Props | null,
  ..._children: Array<VirtualChildren | null>
) {
  let children: any[] = EMPTY_CHILDREN
  for (let i = 2, len = arguments.length; i < len; i++) {
    const argumentsItem = arguments[i]
    if (Array.isArray(argumentsItem)) {
      argumentsItem.forEach((item) => {
        if (children === EMPTY_CHILDREN) {
          children = [item]
        } else {
          children.push(item)
        }
      })
    } else if (children === EMPTY_CHILDREN) {
      children = [argumentsItem]
    } else {
      children.push(argumentsItem)
    }
  }
  let props
  if (isString(tagName)) {
    props = transformPropsForRealTag(tagName, properties as Props)
    props.owner = CurrentOwner.current
    return h(tagName, props, children as any) as VNode
  } else if (isFunction(tagName)) {
    props = transformPropsForComponent(
      properties as any,
      (tagName as any).defaultProps
    )
    if (props.children) {
      if (!Array.isArray(props.children)) {
        props.children = [props.children]
      }
    } else {
      props.children = children
    }
    props.owner = CurrentOwner.current
    return tagName.prototype && tagName.prototype.render
      ? new FullComponent(tagName, props)
      : new StatelessComponent(tagName, props)
  }
  return tagName
}

export default createElement
