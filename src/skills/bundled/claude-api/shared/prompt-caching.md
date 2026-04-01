# Prompt Caching

Prompt caching optimizes your API usage by allowing you to resume from specific prefixes in your prompts, significantly reducing processing time and costs for repetitive tasks or prompts with consistent elements.

## How It Works

When you send a request with prompt caching enabled:

1. The system checks if a prompt prefix (up to a specified cache breakpoint) is already cached from a recent query
2. If found, it uses the cached version, reducing processing time and costs
3. Otherwise, it processes the full prompt and caches the prefix once the response begins

By default, the cache has a **5-minute lifetime**. The cache is refreshed at no additional cost each time the cached content is used. A 1-hour cache duration is also available at 2x the base input token price.

## Two Ways to Enable Caching

### 1. Automatic Caching (Simplest)

Add a single `cache_control` field at the top level of your request:

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},
    system="You are an AI assistant tasked with analyzing literary works.",
    messages=[
        {
            "role": "user",
            "content": "Analyze the major themes in 'Pride and Prejudice'.",
        }
    ],
)
print(response.usage.model_dump_json())
```

The system automatically applies the cache breakpoint to the last cacheable block and moves it forward as conversations grow. Best for multi-turn conversations.

### 2. Explicit Cache Breakpoints

Place `cache_control` directly on individual content blocks for fine-grained control:

```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "You are a helpful assistant.",
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[
        {
            "role": "user",
            "content": "What are the key terms?"
        }
    ]
)
```

You can define up to **4 cache breakpoints** for different sections that change at different frequencies.

## Pricing

Cache introduces a new pricing structure (per million tokens):

| Model | Base Input | 5m Cache Write | 1h Cache Write | Cache Hits | Output |
|-------|-----------|---|---|---|---|
| Claude Opus 4.6 | $5 | $6.25 | $10 | $0.50 | $25 |
| Claude Sonnet 4.6 | $3 | $3.75 | $6 | $0.30 | $15 |
| Claude Haiku 4.5 | $1 | $1.25 | $2 | $0.10 | $5 |

**Key multipliers:**
- 5-minute cache writes: 1.25x base input price
- 1-hour cache writes: 2x base input price
- Cache reads: 0.1x base input price

## Cache Limitations

Minimum cacheable prompt length:
- 4096 tokens: Claude Opus 4.6, 4.5 & Claude Haiku 4.5
- 2048 tokens: Claude Sonnet 4.6 & Claude Haiku 3.5
- 1024 tokens: Claude Sonnet 4.5, Opus 4.1, 4 & Haiku 3

Shorter prompts cannot be cached. To verify if caching worked, check the response usage fields -- if both `cache_creation_input_tokens` and `cache_read_input_tokens` are 0, the prompt wasn't cached.

## What Can Be Cached

**Cacheable:**
- Tool definitions
- System messages
- Text messages
- Images & documents
- Tool use and tool results

**Cannot be cached directly:**
- Thinking blocks (though they cache with other content)
- Sub-content blocks like citations
- Empty text blocks

## Tracking Cache Performance

Monitor cache using these API response fields:

- `cache_creation_input_tokens`: Tokens written to cache
- `cache_read_input_tokens`: Tokens retrieved from cache
- `input_tokens`: Tokens after the last cache breakpoint (not cached)

```
total_input_tokens = cache_read_input_tokens + cache_creation_input_tokens + input_tokens
```

## Best Practices

1. **Start with automatic caching** for multi-turn conversations
2. **Place cached content at the prompt's beginning** for best performance
3. **Put the breakpoint on the last block that stays identical** across requests
4. **Cache stable, reusable content** like system instructions, background information, large contexts
5. **Avoid placing breakpoints on changing content** (timestamps, per-request context) -- this defeats caching

## Use Cases

- **Conversational agents**: Reduce cost and latency for extended conversations
- **Coding assistants**: Keep codebases or relevant sections in the prompt
- **Large document processing**: Incorporate complete long-form material without increasing latency
- **Detailed instruction sets**: Share 20+ diverse examples for fine-tuning responses
- **Agentic tool use**: Enhance performance for multiple tool calls and iterative changes

## 1-Hour Cache Duration

Use extended cache when prompts are used less frequently than every 5 minutes but more frequently than every hour:

```json
{
  "cache_control": {
    "type": "ephemeral",
    "ttl": "1h"
  }
}
```

You can mix TTLs in the same request, but longer TTLs must appear before shorter ones.

## Supported Models

Prompt caching is currently supported on:
- Claude Opus 4.6, 4.5, 4.1, 4
- Claude Sonnet 4.6, 4.5, 4
- Claude Haiku 4.5, 3.5, 3
