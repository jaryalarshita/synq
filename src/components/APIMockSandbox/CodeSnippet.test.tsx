import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodeSnippet from './CodeSnippet'

const writeText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

// userEvent.setup() installs its own navigator.clipboard stub, so ours has to
// be attached afterwards to be the one the component actually calls.
function setupWithClipboard() {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  })
  return user
}

describe('CodeSnippet', () => {
  it('shows the cURL snippet first', () => {
    render(<CodeSnippet method="GET" path="/api/users" />)

    expect(screen.getByText(/curl -X GET/)).toBeInTheDocument()
  })

  it('switches to the fetch snippet when that tab is chosen', async () => {
    const user = userEvent.setup()
    render(<CodeSnippet method="GET" path="/api/users" />)

    await user.click(screen.getByText('JavaScript (Fetch)'))

    expect(screen.getByText(/fetch\('http:\/\/localhost:5173\/api\/users'\)/)).toBeInTheDocument()
    expect(screen.queryByText(/curl -X GET/)).not.toBeInTheDocument()
  })

  it('reflects the POST method and body in the snippet', () => {
    render(<CodeSnippet method="POST" path="/api/users" body='{"email":"dev@example.com"}' />)

    expect(screen.getByText(/curl -X POST/)).toBeInTheDocument()
    expect(screen.getByText(/dev@example.com/)).toBeInTheDocument()
  })

  it('copies the currently visible snippet to the clipboard', async () => {
    const user = setupWithClipboard()
    render(<CodeSnippet method="GET" path="/api/users" />)

    await user.click(screen.getByText('Copy'))

    expect(writeText).toHaveBeenCalledWith('curl -X GET "http://localhost:5173/api/users"')
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('copies the fetch snippet once that tab is active', async () => {
    const user = setupWithClipboard()
    render(<CodeSnippet method="GET" path="/api/users" />)

    await user.click(screen.getByText('JavaScript (Fetch)'))
    await user.click(screen.getByText('Copy'))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('fetch('))
  })
})

describe('CodeSnippet — language tabs', () => {
  it('offers a tab for every supported language', () => {
    render(<CodeSnippet method="GET" path="/api/users" />)

    for (const label of ['cURL', 'JavaScript (Fetch)', 'Axios', 'Python', 'Rust']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the Python snippet when its tab is chosen', async () => {
    const user = userEvent.setup()
    render(<CodeSnippet method="GET" path="/api/users" />)

    await user.click(screen.getByText('Python'))

    expect(screen.getByText(/import requests/)).toBeInTheDocument()
    expect(screen.queryByText(/curl -X GET/)).not.toBeInTheDocument()
  })

  it('shows the Rust snippet when its tab is chosen', async () => {
    const user = userEvent.setup()
    render(<CodeSnippet method="GET" path="/api/users" />)

    await user.click(screen.getByText('Rust'))

    expect(screen.getByText(/tokio::main/)).toBeInTheDocument()
  })

  it('copies whichever language is active', async () => {
    const user = setupWithClipboard()
    render(<CodeSnippet method="GET" path="/api/users" />)

    await user.click(screen.getByText('Axios'))
    await user.click(screen.getByText('Copy'))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("import axios from 'axios';"))
  })
})
