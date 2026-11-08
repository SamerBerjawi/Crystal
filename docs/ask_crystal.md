# Ask Crystal

Plain-language questions about your own money: "How much did I spend eating out last month?", "Can I afford 2,000 in March?", "How are my budgets doing?". Open it with Ctrl or ⌘ and `/`, or choose **Ask Crystal…** in search.

## How it works

```
 you ──question──▶ browser ──messages + tool list──▶ Crystal server ──▶ model
                      ▲                                                   │
                      └── tool calls ◀────────────────────────────────────┘
        runs Crystal's own functions on the data it already holds
```

1. The browser sends your question, and a list of **tools**, to the model through the Crystal server.
2. The model answers with a tool call, such as `spending({ period: "last_month", category: "Dining Out" })`.
3. The browser **runs that tool on your data, here**, using the functions the rest of the app uses (`reportsModel`, `forecastModel`, `safeToSpend`, the budget and subscription models). It sends back the result.
4. The model words the answer from the result. It may look up several things first.

The model never does arithmetic and never sees your whole ledger. That is why the numbers match the Reports page and the Overview widgets: they come from the same code. Figures that no lookup contained are flagged under the answer.

The tools are in [`utils/assistantTools.ts`](../utils/assistantTools.ts), the loop in [`utils/assistantAgent.ts`](../utils/assistantAgent.ts), the server in [`server/src/assistant.ts`](../server/src/assistant.ts).

### What a tool will not do
- **Guess.** A category or account name that does not match exactly comes back as an error listing the real names, so the model asks again instead of answering from a near miss.
- **Calculate dates.** Periods are named (`last_month`, `last_12_months`, ...) or given as `YYYY-MM`, and resolved in code.
- **Change anything.** Every tool is read-only.

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
- Nothing is stored on the Crystal server except the connection settings. Conversations live in the browser tab and are gone when you reload. The key is encrypted at rest and never sent back.
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
