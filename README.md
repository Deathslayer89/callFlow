# CallFlow

A voice agent that picks up phone calls, listens, decides what to do, and speaks back. Tools defined once, served over two transports: WebRTC voice and a text chat for the dashboard.

## Stack

- **LiveKit Agents (Node)** for the voice loop — WebRTC media, STT/LLM/TTS plugins, semantic turn detection, interruption handling. One `voice.AgentSession` per call.
- **Vercel ai-sdk v6** for the text mirror — same tools, same instructions, streamed over `useChat`.
- **BullMQ + Postgres** for the workflow state machine. Tool calls enqueue jobs; a worker process drains them.
- **Next.js + Tailwind** dashboard with a chat page and a WebRTC voice page.

## Repo layout

```
agent/        LiveKit Agents worker. defineAgent → voice.AgentSession → CallFlowAgent.
              Tools defined twice: once with llm.tool (voice), once with tool() from 'ai' (chat).
backend/      Express. REST /calls, LiveKit /calls/:id/token, ai-sdk /chat.
workflows/    BullMQ producer + worker. Activities validate input with the same Zod schemas
              the tools use.
shared/       Three enums, three Zod schemas, a logger. Anything that needs to be a contract
              lives here.
frontend/     Next.js dashboard.
              /chat              text mirror (ai-sdk useChat)
              /calls/[id]/voice  WebRTC client (LiveKit components)
```

## How a call flows

```
caller (browser)                   backend                    LiveKit Cloud / self-hosted
     │  POST /calls/start         │                                       │
     │ ──────────────────────────►│ Postgres: Call row created            │
     │                            │                                       │
     │  POST /calls/:id/token     │                                       │
     │ ──────────────────────────►│ livekit-server-sdk mints JWT          │
     │ ◄──────────────────────────│                                       │
     │                                                                    │
     │  connect(token, url=room=callId) ────────────────────────────────► │
     │ ◄─── WebRTC media ───────────────────────────────────────────────► │
                                                                          │
                                                            agent worker ◄┘
                                                            voice.AgentSession
                                                            STT → LLM → TTS
                                                              │
                                                              │ tool call
                                                              ▼
                                                       enqueueWorkflow(callId, type, args)
                                                              │
                                                              ▼
                                                          BullMQ → worker → Postgres
```

Text path is the same minus the voice transport: dashboard `useChat` POSTs to `/api/chat`, the backend runs `streamText` with the same tools, results stream back as a UI message stream.

## Running it

```bash
# Bring up Postgres + Redis
npm run docker:up

# Optional: self-hosted LiveKit (otherwise use LiveKit Cloud's free tier)
docker compose -f docker/docker-compose.yml --profile livekit up -d

# Install + migrate
npm install
npm --workspace=@callflow/backend run db:generate
npm --workspace=@callflow/backend run migrate

# In separate terminals:
npm run dev:backend     # REST + chat + token endpoints on :3000
npm run dev:agent       # LiveKit Agents worker (joins every room)
npm run dev:workflows   # BullMQ worker
npm run dev:frontend    # Dashboard on :3001
```

Required env (`.env`):

```env
DATABASE_URL=postgresql://callflow:callflow_dev_password@localhost:5432/callflow
REDIS_URL=redis://localhost:6379

# Dashboard chat — any OpenRouter model
OPENROUTER_API_KEY=sk-or-v1-...
CHAT_MODEL=deepseek/deepseek-chat-v3-0324:free

# Voice agent
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxx
LIVEKIT_API_SECRET=xxxx
```

The agent worker by default uses LiveKit's managed inference (`deepgram/nova-3` STT, `openai/gpt-4o-mini` LLM, `cartesia/sonic-3` TTS). Set the provider-specific keys to swap any of them out.

## Test the voice path without writing a client

The browser voice page works, but for a quick sanity check you can use [LiveKit Meet](https://meet.livekit.io):

1. `POST /api/calls/start` → get a `callId`
2. `POST /api/calls/:id/token` with `{ identity: "me" }` → get `{ token, url }`
3. Open LiveKit Meet, paste the URL and token, join. The agent worker auto-joins.

## Test the text path

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","parts":[{"type":"text","text":"hi"}]}]}'
```

Or use the dashboard at `/chat`.

## Cross-call memory

The agent remembers callers across sessions. Backed by [mem0](https://mem0.ai)
(free cloud tier). Memory is keyed by caller email — the same value
`record_caller_email` writes to `Call.callerEmail`.

Flow:

```
/api/calls/end ──┐
                 │ enqueue SUMMARIZE_CALL { callId }
                 ▼
        BullMQ → worker → summarizeCall activity
                 │
                 │ Postgres: load messages
                 │ OpenRouter: compress to 1–2 sentences
                 │ mem0.add(summary, userId=email)
                 ▼

Next call from same email:
   record_caller_email ──► get_caller_context ──► mem0.search(userId=email)
                                  │
                                  ▼
                         "Welcome back — last time we
                          opened a ticket about wifi…"
```

- Set `MEM0_API_KEY` in `.env` to enable. Without it the system runs in
  noop mode — `get_caller_context` returns no memories, `SUMMARIZE_CALL`
  workflows complete with `reason: 'mem0-not-configured'`.
- The system prompt makes the agent call `get_caller_context` immediately
  after `record_caller_email` returns, and weave the result into its next
  reply. If the caller refuses email or claims to be new, that step is
  skipped.
- mem0 was picked over Letta (full agent runtime, heavier than we need)
  and Zep (requires standing up a server) because the SDK is the cleanest
  and the cloud tier removes the need for a self-hosted vector store.

## Evals

`evals/` is a [promptfoo](https://promptfoo.dev) suite that runs the agent's
system prompt + tool definitions against four OpenRouter-routed models and
scores them on 30 cases split across five categories:

- **intent** — does the right tool fire for the caller's request?
- **tool_args** — are priority / dates / emails extracted correctly?
- **refusal** — prompt injection, out-of-scope asks, fabricated facts
- **email_norm** — STT artifacts like `dinesh at dinesh dot com` round-trip to `@`/`.`
- **multi_turn** — context from earlier turns merges into one tool call

Run it:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npm run eval         # ~30s, writes evals/results.json + results.html
npm run eval:report  # writes evals/RESULTS.md
npm run eval:view    # opens the local web viewer
```

The full table + analysis lives in [`evals/RESULTS.md`](evals/RESULTS.md).
Latest run (2026-05-22): gemini-2.5-flash wins overall at 90%, gpt-4o-mini
trails at 70%. Free `llama-3.3-70b` is perfect on tool-calling but only 40%
on refusals — picks up prompt injection.

## What's mocked

Workflow activities (`checkCustomerStatus`, `createTicket`, `scheduleAppointment`) return canned data. Wire them to your real CRM / ticketing / calendar before shipping — the Zod schemas keep the input contract honest, so swapping the implementation doesn't ripple. `summarizeCall` is real if `MEM0_API_KEY` is set, no-op otherwise.

## Architectural choices, briefly

- **Why LiveKit?** Voice over WebSocket suffers head-of-line blocking on lost packets. WebRTC doesn't. LiveKit Agents is the only Node framework with a current 1.x release that bundles WebRTC + plugins + turn detection.
- **Why ai-sdk for chat?** `streamText` + `tool` give typed streaming with one library. The dashboard's `useChat` consumes the UI message stream without custom plumbing.
- **Why OpenRouter for the chat LLM?** Single key, dozens of providers, several `:free` models that handle tool calling. Swap providers by changing `CHAT_MODEL` — no code change.
- **Why share Zod schemas in `shared/`?** Single contract. The model can't pass a string where the activity expects a number, because the schema fails parse at the tool boundary.
- **Why BullMQ on top of LiveKit?** Tool calls should be sub-second to acknowledge; the actual work (CRM lookup, ticket creation) can take longer. Putting that work on a queue keeps the voice loop responsive.
