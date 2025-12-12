# GPT-5.2 Backend Support

Status: intake
Created: 2025-12-12
Last Updated: 2025-12-12

## The Idea

Add GPT-5.2 as a backend option in hyperyolo, enabling users to leverage OpenAI's newest flagship model through the Codex CLI. GPT-5.2 is OpenAI's most advanced model released on December 11, 2025, featuring a massive 400k context window and three variants optimized for different use cases.

## Why

GPT-5.2 represents a significant upgrade over previous GPT models:

- **400,000 token context window** — Can ingest hundreds of documents or large code repositories at once
- **128,000 max output tokens** — Can generate extensive reports or full applications in a single response
- **Three specialized variants** — Optimized for speed (Instant), reasoning (Thinking), or accuracy (Pro)
- **Enhanced agentic coding** — Tops SWE-Bench Pro for agentic coding performance
- **New reasoning capabilities** — Includes `xhigh` reasoning effort level and concise reasoning summaries
- **Knowledge cutoff: August 31, 2025** — More recent than previous models

## Model Specifications

### API Model IDs

| Variant | Model ID | Optimized For |
|---------|----------|---------------|
| Thinking | `gpt-5.2` | Complex structured work: coding, document analysis, math, planning |
| Instant | `gpt-5.2-chat-latest` | Speed: information-seeking, writing, translation |
| Pro | `gpt-5.2-pro` | Maximum accuracy and reliability for difficult problems |

### Technical Specs

- **Context Window**: 400,000 tokens
- **Max Output Tokens**: 128,000 tokens
- **Input Types**: Text, Images
- **Output Types**: Text

### Pricing (per 1M tokens)

| Variant | Input | Output |
|---------|-------|--------|
| Thinking (`gpt-5.2`) | $1.75 | $14.00 |
| Pro (`gpt-5.2-pro`) | $21.00 | $168.00 |
| Instant | TBD | TBD |

### New Features

- **`xhigh` reasoning effort level** — New highest tier for complex reasoning tasks
- **Concise reasoning summaries** — Better visibility into model's thought process
- **Context compaction** — New context management feature for long sessions
- **CFG (Context-Free Grammar) support** — Custom tool outputs can be constrained to specific syntax/DSL using Lark grammar

## Implementation Plan

### 1. Update BackendName Type

Extend the `BackendName` type in `src/core/executor.ts`:

```typescript
export type BackendName = 'codex' | 'claude' | 'gemini' | 'gpt';
```

### 2. Determine CLI Strategy

**Option A: Extend Codex Adapter**
GPT-5.2 is accessed through the same Codex CLI with `--model gpt-5.2`. This may just require model validation rather than a new adapter.

**Option B: Create Dedicated GPT Adapter**
A separate adapter could provide cleaner UX with model variant shortcuts:
- `hyperyolo gpt "prompt"` — Uses default `gpt-5.2` (Thinking)
- `hyperyolo gpt --instant "prompt"` — Uses `gpt-5.2-chat-latest`
- `hyperyolo gpt --pro "prompt"` — Uses `gpt-5.2-pro`

### 3. Add Model Variant Support

If creating a dedicated adapter (`src/adapters/gpt.ts`):

```typescript
interface GptExecutionOptions extends ExecutionOptions {
  variant?: 'thinking' | 'instant' | 'pro';
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}
```

Model mapping:
```typescript
const GPT_MODEL_MAP = {
  thinking: 'gpt-5.2',
  instant: 'gpt-5.2-chat-latest',
  pro: 'gpt-5.2-pro'
} as const;
```

### 4. Add Reasoning Effort Flag

Support the new `xhigh` reasoning effort level:

```typescript
// CLI translation for Codex
if (options.reasoningEffort) {
  args.push('--reasoning-effort', options.reasoningEffort);
}
```

### 5. Update Versioning

Add GPT-5.2 to version baselines in `src/adapters/versioning.ts` if model version checking is needed.

### 6. Documentation Updates

- Update `docs/ai-cli-comparison.md` with GPT-5.2 CLI flags
- Update `docs/cli-compatibility.md` with GPT-5.2 requirements
- Update `CLAUDE.md` with new command examples

### 7. Testing

- Add unit tests for model ID mapping
- Add integration tests with mock GPT responses
- Test reasoning effort parameter passing

## Open Questions

- [ ] Does Codex CLI already support `gpt-5.2` model flag, or is a CLI update required?
- [ ] Should GPT variants be a top-level command (`hyperyolo gpt`) or just `--model` on `hyperyolo codex`?
- [ ] How should we handle the much larger context window (400k) for session management?
- [ ] Should we add cost estimation given the significant price difference between variants?
- [ ] Is there a different session ID format for GPT-5.2 conversations vs older models?
- [ ] How does context compaction affect session resumption?

## Notes

- GPT-5.2 was released December 11, 2025 as a response to competitive pressure from Google's Gemini 3
- OpenAI is positioning this as their "most capable model series yet"
- The Pro variant is significantly more expensive ($21/$168 vs $1.75/$14) — may want usage warnings
- Context compaction is a new feature that may interact with hyperyolo's session management

## Related

- `src/adapters/codex.ts` — Existing Codex adapter that may be extended
- `src/adapters/types.ts` — BackendAdapter interface
- `docs/architecture/backend-adapter-contract.md` — Adapter design principles
- [OpenAI GPT-5.2 Announcement](https://openai.com/index/introducing-gpt-5-2/)
- [OpenAI API Docs](https://platform.openai.com/docs/models/gpt-5.2)

## Sources

- [CNBC: Sam Altman expects OpenAI to exit 'code red' by January after launch of GPT-5.2 model](https://www.cnbc.com/2025/12/11/openai-intros-new-ai-model-gpt-5point2-says-better-at-professional-tasks.html)
- [TechCrunch: OpenAI fires back at Google with GPT-5.2 after 'code red' memo](https://techcrunch.com/2025/12/11/openai-fires-back-at-google-with-gpt-5-2-after-code-red-memo/)
- [OpenAI: Introducing GPT-5.2](https://openai.com/index/introducing-gpt-5-2/)
- [GitHub Blog: OpenAI's GPT-5.2 is now in public preview for GitHub Copilot](https://github.blog/changelog/2025-12-11-openais-gpt-5-2-is-now-in-public-preview-for-github-copilot/)
- [VentureBeat: OpenAI's GPT-5.2 is here: what enterprises need to know](https://venturebeat.com/ai/openais-gpt-5-2-is-here-what-enterprises-need-to-know)
- [Microsoft 365 Blog: Available today: GPT-5.2 in Microsoft 365 Copilot](https://www.microsoft.com/en-us/microsoft-365/blog/2025/12/11/available-today-gpt-5-2-in-microsoft-365-copilot/)
