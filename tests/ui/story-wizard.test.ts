// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost"}
import React from 'react'
import { renderToString } from 'react-dom/server'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryWizard } from '@/components/wizard/StoryWizard'

const { chat } = vi.hoisted(() => ({ chat: vi.fn() }))

vi.mock('@/lib/api', () => ({
  api: { storySetup: { chat } },
}))

function emptyStream() {
  return {
    getReader: () => ({
      read: async () => ({ done: true, value: undefined }),
    }),
  }
}

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(StoryWizard, {
        storyId: 'story-test',
        onComplete: () => undefined,
      }),
    ),
  )
}

beforeEach(() => {
  chat.mockReset()
  chat.mockResolvedValue(emptyStream())
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
      get length() { return values.size },
    } satisfies Storage,
  })
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
})

describe('StoryWizard', () => {
  it('does not send when Enter confirms an active IME composition', async () => {
    renderWizard()
    const textarea = screen.getByRole('textbox', { name: 'Your story idea' })

    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1))

    fireEvent.change(textarea, { target: { value: '注音' } })
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })
    expect(chat).toHaveBeenCalledTimes(1)
    expect((textarea as HTMLTextAreaElement).value).toBe('注音')

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(chat).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(chat).toHaveBeenCalledTimes(2)
    expect(chat.mock.calls[1][1]).toEqual([{ role: 'user', content: '注音' }])
  })

  it('opens as an unstructured story conversation rather than a step form', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const html = renderToString(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(StoryWizard, {
          storyId: 'story-test',
          onComplete: () => undefined,
        }),
      ),
    )

    expect(html).toContain('Shape your story')
    expect(html).toContain('Tell Errata whatever you have')
    expect(html).toContain('Fragments are saved as the conversation develops')
    expect(html).toContain('Open story')
    expect(html).toContain('Story checklist')
    expect(html).toContain('Starting point')
    expect(html).toContain('What it is about')
    expect(html).toContain('Characters')
    expect(html).toContain('Goal and stakes')
    expect(html).toContain('Setting')
    expect(html).toContain('Voice and tone')
    expect(html).toContain('Opening direction')
    expect(html).toContain('Story fragments')
    expect(html).toContain('Fragments will appear here as the idea takes shape')
    expect(html).toContain('data-component-id="story-setup-composer-column"')
    expect(html).not.toContain('Begin your story')
    expect(html).not.toContain('Step 1 of')
    expect(html).not.toContain('Create story')
  })
})
