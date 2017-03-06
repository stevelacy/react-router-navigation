/* @flow */
/* eslint no-duplicate-imports: 0 */

import { Component } from 'react'
import { BackAndroid } from 'react-native'
import { matchPath } from 'react-router'
import { StateUtils } from 'react-navigation'
import type { ContextRouter } from 'react-router'
import type { CardsRendererProps, NavigationState, Card, CardProps, Route } from './TypeDefinitions'
import * as StackUtils from './StackUtils'

type State = {
  navigationState: NavigationState<Route & {
    path?: string,
    params?: Object,
  }>,
  cards: Array<Card>,
}

type Props = ContextRouter & {
  children?: Array<React$Element<CardProps>>,
  render: (props: CardsRendererProps) => React$Element<any>,
}

class CardStack extends Component<void, Props, State> {

  props: Props
  state: State

  // Initialyze navigation state with initial history
  constructor(props: Props): void {
    super(props)
    // Build the card stack $FlowFixMe
    const { children, history: { entries, location } } = props
    const cards = children && StackUtils.build(children)
    // Get initial route of navigation state
    if (!entries) throw new Error('No history entries found')
    // Build navigation state
    const navigationState = entries.reduce((state, entry) => {
      const card = cards.find(({ path, exact, strict }) => {
        return matchPath(entry.pathname, { path, exact, strict })
      })
      if (!card || !card.path) return state
      const route = StackUtils.getRoute(cards, entry)
      return {
        index: matchPath(location.pathname, card)
          ? state.routes.length
          : state.index,
        routes: [
          ...state.routes,
          route,
        ],
      }
    }, { index: -1, routes: [] })
    // Save everything in component state
    this.state = { navigationState, cards }
  }

  // Listen hardware BackAndroid event
  componentDidMount(): void {
    BackAndroid.addEventListener('hardwareBackPress', this.onNavigateBack)
  }

  // Remove all listeners
  componentWillUnmount(): void {
    BackAndroid.removeEventListener('hardwareBackPress', this.onNavigateBack)
  }

  // Listen all history events
  componentWillReceiveProps(nextProps: Props): void {
    const { location, history: { action } } = nextProps
    const { cards, navigationState } = this.state
    // Get current card
    const currentRoute = navigationState.routes[navigationState.index]
    const currentCard = cards.find(({ key }) => key === currentRoute.routeName)
    // Get next card
    const nextRoute = StackUtils.getRoute(cards, location)
    if (!nextRoute) return
    const nextCard = cards.find(({ key }) => key === nextRoute.routeName)
    // Local state must be updated ?
    if (
      currentCard && nextCard &&
      StackUtils.shouldUpdate(currentCard, nextCard, this.props, nextProps)
    ) {
      const key = StackUtils.createKey(nextRoute)
      switch (action) {
        case 'PUSH': {
          this.setState({
            navigationState: StateUtils.push(
              navigationState,
              { ...nextRoute, key },
            ),
          })
          break
        }
        case 'POP': {
          if (this.props.history.index === undefined || nextProps.history.index === undefined) {
            return
          }
          const n = this.props.history.index - nextProps.history.index
          if (n > 1) {
            this.setState({
              navigationState: StateUtils.reset(
                navigationState,
                navigationState.routes.slice(
                  0,
                  (navigationState.index - n) + 1,
                ),
                navigationState.index - n,
              ),
            })
          } else {
            this.setState({
              navigationState: StateUtils.pop(navigationState),
            })
          }
          break
        }
        case 'REPLACE': {
          this.setState({
            navigationState: StateUtils.replaceAtIndex(
              navigationState,
              navigationState.index,
              { ...nextRoute, key },
            ),
          })
          break
        }
        default:
      }
    }
  }

  // Pop to previous scene (n-1)
  onNavigateBack = (): boolean => {
    if (this.state.navigationState.index > 0) {
      this.props.history.goBack()
      return true
    }
    return false
  }

  // Render view
  render(): React$Element<any> {
    return this.props.render({
      ...this.state,
      onNavigateBack: this.onNavigateBack,
    })
  }

}

export default StackUtils.withRouter(CardStack)
