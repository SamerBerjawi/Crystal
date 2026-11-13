# Ask Crystal

Plain-language questions about your own money: "How much did I spend eating out last month?", "Can I afford 2,000 in March?", "How are my budgets doing?". Open it with Ctrl or ⌘ and `/`, or choose **Ask Crystal…** in search.

## How it works

```
 you ──question──▶ Crystal server (agent loop) ──messages + tools──▶ model
                      │   ▲                                            │
                      │   └──────────── tool calls ◀───────────────────┘
                      ├── Crystal's own tools ........ run on the server, on your data
                      ├── browser tools ............... asked of your browser over the same stream
                      └── connected MCP servers ....... read-only tools of servers you added
```

1. The browser sends your question, and the list of tools it can run itself, to the Crystal server.
2. The server runs the loop. It sends the model your question and every tool, and the model answers with a tool call such as `spending({ period: "last_month", category: "Dining Out" })`.
3. The server runs the tool where it lives. **Crystal's own tools** (`get_summary`, `list_transactions`, `spending_by_category`, `search_merchants`, `get_investments`, `get_planning`) are the same ones the MCP endpoint offers, so the assistant and an outside client give identical answers. **Browser tools** use the functions the rest of the app uses (`reportsModel`, `forecastModel`, `safeToSpend`, the budget and subscription models): the server asks the browser for the result over the open stream and waits up to a minute. **Connected servers** are covered below.
4. The model words the answer from the results. It may look up several things first.

The model never does arithmetic and never sees your whole ledger. Where a browser tool and a server tool answer the same question (overview, transactions, spending), only the browser's is offered, so the model has one choice and the numbers match the Reports page. Figures that no lookup contained are flagged under the answer. Each lookup in "How I found this" shows where it ran, and lookups on an outside server are marked.

Older servers and the dev mock have no agent loop; the app then runs the loop in the browser, with the same tools.

The tools are in [`utils/assistantTools.ts`](../utils/assistantTools.ts) (browser) and [`server/src/toolRegistry.ts`](../server/src/toolRegistry.ts) (server). The loop is in [`server/src/agentLoop.ts`](../server/src/agentLoop.ts), the routes in [`server/src/assistant.ts`](../server/src/assistant.ts).

## Connected tools (outside MCP servers)

Under **Settings, Connections, Ask Crystal, Connected tools** you can add up to five MCP servers (Streamable HTTP), with an optional bearer token. For each one:

- Crystal lists its tools and **only offers those that declare `readOnlyHint: true`**. Tools that do not say so are left out, and "Test" tells you how many.
- Its tools appear to the model as `name__tool` and run on the server with a 30-second limit and a 20,000-character result cap.
- What comes back is treated as data: the model is told never to follow instructions found in it. Nothing an outside server returns can change anything in Crystal, because no tool can write.
- Your question and the arguments the model chooses are sent to that server. Add only servers you trust with that.
- The same address rules as a custom model server apply: no redirects, and addresses on your own network only for a sole user or with `ASSISTANT_ALLOW_PRIVATE_URLS=true`. The token is encrypted at rest and never returned.

### What a tool will not do
- **Guess.** A category or account name that does not match exactly comes back as an error listing the real names, so the model asks again instead of answering from a near miss.
- **Calculate dates.** Periods are named (`last_month`, `last_12_months`, ...) or given as `YYYY-MM`, and resolved in code.
- **Change anything.** Every tool is read-only.

## Suggestions

Ask Crystal can suggest two tidy-ups: filing a merchant under another category, and renaming a merchant (for example to merge two spellings). A suggestion never changes anything. The exact edits wait in the **Tidy-ups** section of the Queue tab (Transactions), marked "Ask Crystal", and happen only when you approve. Approving skips any transaction you have changed since, and Undo puts the old values back. The assistant names a merchant and the new value; Crystal works out which transactions are affected, so none can be invented or missed.

## Choosing a model

Open **Settings, Connections, Ask Crystal**.

**Built-in engine.** Run `docker compose --profile ai up -d` to start an [Ollama](https://ollama.com) container next to Crystal. Then pick a model from the list and press Download. Progress is shown live, and you can leave the page. The list is short on purpose (the Ollama library changes often), and any model name can be typed in. After a download Crystal asks the engine whether the model supports **tools**, which Ask Crystal needs, and warns if not. Models are kept under `${DATA_ROOT}/ollama`.

| Model | Download | Good for |
|---|---|---|
| `qwen3:4b` | about 2.5 GB | A NAS CPU. A good place to start. |
| `qwen3:8b` / `llama3.1:8b` | about 5 GB | More reliable on multi-step questions. Wants about 8 GB of free memory, or a GPU. |
| `llama3.2:3b` / `phi4-mini` | about 2 GB | The smallest and fastest. Weaker when a question needs several lookups. |

Sizes are approximate. The first answer after a model has been idle can take a while, because it is loading into memory.

**A model server you already have.** Choose "A model server I already have" and enter its address: Ollama (`http://192.168.1.10:11434`), LM Studio, llama.cpp, vLLM, or a hosted service such as OpenAI or OpenRouter (add the API key). Anything that speaks the OpenAI chat API with tool calling works. On Umbrel, where the built-in engine is not available, this is the way.

## Privacy

- **Built-in engine, or a server on your network:** your questions and the figures looked up go to that machine only.
- **A hosted service:** they go to that provider. That is what you chose when you entered its address and key.
- Nothing is stored on the Crystal server except the connection settings and the list of connected servers. Conversations live in the browser tab and are gone when you reload. The key is encrypted at rest and never sent back.
- With **privacy mode** on, answers and lookup details are blurred like any other amount.

## Security notes

- The browser never talks to the model directly; the server relays it, so the key stays on the server and the address is checked.
- A custom address pointing at your own network is allowed when you are the **only user** of the server, or when `ASSISTANT_ALLOW_PRIVATE_URLS=true`. With several users, a private address would let any of them reach machines on your network through the server, so it is refused (a saved one stops working) unless the operator opts in. The built-in engine's address comes from `OLLAMA_URL`, which only the operator sets.
- Redirects are never followed, requests have a size limit, and each user is limited to 60 questions a minute.

## Limits, honestly

- Small models make mistakes: they pick the wrong tool, or misread a result. The lookups are shown ("How I found this") so you can check, and unmatched figures are flagged. They are an aid, not an advisor, and are told not to give investment, tax or legal advice.
- A question that needs more than six lookups in a row is cut off, and the model answers with what it has.
- Questions that need facts Crystal does not hold ("since I moved") are met with a clarifying question.

## Development

`npm run dev` with `CRYSTAL_MOCK_API=1` serves a scripted stand-in for a model ([`dev/fakeLlm.ts`](../dev/fakeLlm.ts)) and a pretend download, so the whole feature can be tried with nothing installed.

Tests:
- `npx tsx --test tests/unit/assistantTools.test.ts` - every tool, against a small hand-checked ledger.
- `npx tsx --test tests/unit/assistantAgent.test.ts` - the loop, stream parsing, figure checking.
- `npx tsx server/src/assistant.test.ts` - request validation, URL rules, error messages.
- `npx tsx server/src/assistant.integration.test.ts` - the real routes against a fake model server: streaming, downloads, keys, errors.

Server tests for the agent: `npx tsx server/src/agent.test.ts` (loop, hand-off to the browser, request checks), `npx tsx server/src/externalMcp.test.ts`, and the routes, including a real outside MCP server, in `assistant.integration.test.ts`. The browser side is `npx tsx --test tests/unit/serverAgent.test.ts`.
