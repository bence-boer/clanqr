# Chat (`/chat`)

AI chat interface with session management, model selection, and streaming responses.

---

## Layout

Two-panel horizontal layout (stacks vertically on mobile):
- Left: Sessions panel (240px, or full width + 180px height on mobile)
- Right: Chat area (flex 1)

---

## Sessions Panel (left)

### Header
- "Sessions" title
- New chat button (secondary, circular, add icon) → creates new session

### State: Loading
- LoadingSpinner (small)

### State: Empty
- EmptyState: chat icon, "No sessions yet."

### State: Has Sessions
Scrollable list of session items.

### Session Item (per session)
- Clickable div (role="button", keyboard accessible)
- Session label: `session.title` or "Chat {date}"
- Delete button (ghost, close icon) — hidden by default, visible on hover/active
  - Click (stops propagation) → confirm dialog "Delete this session?" → `api.delete_chat_session()` → removes from list
- Active session: accent background + accent border
- Active session ID stored in `sessionStorage` for persistence across page navigations

---

## Chat Area (right)

### State: No Session Selected
- Centered empty state:
  - Chat icon (48px, accent)
  - "Select a session or create a new one"
  - "New Chat" button (primary, add icon) → creates new session

### State: Session Selected

#### Chat Header
- Session title (bold)
- Model selector (Select dropdown, right side):
  - Grouped by provider: Claude / Gemini / GPT
  - Models listed within each optgroup
  - Default: `claude-sonnet-4.5`
  - Changes apply to next sent message

#### Message Thread

**State: Loading messages**
- Centered LoadingSpinner: "Loading messages..."

**State: Empty messages**
- Centered EmptyState: chat icon, "No messages yet. Say something!"

**State: Has Messages**
Scrollable vertical list, auto-scrolls to bottom on new messages.

Each message:
- **User message:** Right-aligned bubble, accent background + accent border
- **Assistant message:** Left-aligned bubble, elevated background + border
- Content: pre-wrap text, 75% max-width (90% on mobile)

**Streaming state** (during AI response):
- Additional assistant bubble with `streaming` style (accent border)
- Content: streaming text or "..." if empty
- Blinking cursor (`▋`) at end

#### Error Banner (conditional)
- Shown below thread when `error_msg` is set

#### Chat Input
- Textarea (3 rows): "Type a message... (Enter to send, Shift+Enter for newline)"
- Disabled while streaming
- **Send button** (primary, icon-only, send icon):
  - Disabled when input empty or streaming
  - Click or Enter → sends message
- **Stop button** (danger, icon-only, stop icon) — replaces send button while streaming:
  - Click → `api.cancel_chat()` → appends partial content with "*(generation stopped)*"

---

## Message Flow

1. User types message, presses Enter (or clicks send)
2. Input clears immediately
3. User message bubble appears right-aligned
4. Streaming begins: assistant bubble appears with blinking cursor
5. SSE chunks arrive, `streaming_content` grows, bubble updates
6. Stream completes: final assistant message added to `messages` array
7. Sessions list reloads (to update title/timestamp)

### Error Handling
- Send failure: user message is removed from thread, error message displayed
- Stream error: error message displayed in ErrorBanner
- Session expired (401): redirects to login screen, shows "Session expired" toast
