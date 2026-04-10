/**
 * AI Chat Page — streaming assistant with read-only tool use.
 *
 * Uses useChat from @ai-sdk/react which handles the AI SDK data stream protocol,
 * message state, and streaming text display.
 */

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { useAuth, AuthOverlay, getAuthToken } from 'deepspace'

export default function AssistantPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <>
        <div className="flex h-full items-center justify-center px-4">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-xl font-semibold text-foreground">Sign in to use the assistant</h2>
            <p className="text-sm text-muted-foreground">
              The AI assistant inspects live app data using your permissions.
            </p>
            <button
              onClick={() => setShowAuth(true)}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign In
            </button>
          </div>
        </div>
        {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
      </>
    )
  }

  return <Chat />
}

function Chat() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/ai/chat',
    // Inject a fresh auth token on every request — useChat's `headers` option
    // only accepts a plain object, not a function, so we use `fetch` instead.
    fetch: async (url, init) => {
      const token = await getAuthToken()
      const headers = new Headers(init?.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return fetch(url as string, { ...init, headers })
    },
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="space-y-2 text-center text-muted-foreground">
              <p className="text-lg font-medium">Ask about your app data</p>
              <p className="text-sm">The assistant can query records, list schemas, and inspect collections.</p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {m.content}

              {/* Show tool invocations inline */}
              {m.parts?.filter((p) => p.type === 'tool-invocation').map((p, i) => {
                const inv = p as any
                return (
                  <div key={i} className="mt-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">{inv.toolInvocation?.toolName}</span>
                    {inv.toolInvocation?.state === 'result' && (
                      <span className="ml-1 text-green-500">done</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your app data..."
          className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
