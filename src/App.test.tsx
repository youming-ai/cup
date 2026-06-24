import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the loading state on initial mount', () => {
    render(<App />)
    expect(screen.getByText('载入流媒体源中，请稍候...')).toBeInTheDocument()
  })
})
