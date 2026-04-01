# Models overview

Claude is a family of state-of-the-art large language models developed by Anthropic. This guide introduces the available models and compares their performance.

## Choosing a model

If you're unsure which model to use, consider starting with **Claude Opus 4.6** for the most complex tasks. It is the latest generation model with exceptional performance in coding and reasoning.

All current Claude models support text and image input, text output, multilingual capabilities, and vision. Models are available via the Claude API, AWS Bedrock, and Google Vertex AI.

### Latest models comparison

| Feature | Claude Opus 4.6 | Claude Sonnet 4.6 | Claude Haiku 4.5 |
|:--------|:----------------|:------------------|:-----------------|
| **Description** | The most intelligent model for building agents and coding | The best combination of speed and intelligence | The fastest model with near-frontier intelligence |
| **Claude API ID** | claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |
| **Claude API alias** | claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5 |
| **AWS Bedrock ID** | anthropic.claude-opus-4-6-v1 | anthropic.claude-sonnet-4-6 | anthropic.claude-haiku-4-5-20251001-v1:0 |
| **GCP Vertex AI ID** | claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5@20251001 |
| **Pricing** | $5 / input MTok, $25 / output MTok | $3 / input MTok, $15 / output MTok | $1 / input MTok, $5 / output MTok |
| **Extended thinking** | Yes | Yes | Yes |
| **Adaptive thinking** | Yes | Yes | No |
| **Priority Tier** | Yes | Yes | Yes |
| **Comparative latency** | Moderate | Fast | Fastest |
| **Context window** | 1M tokens (~750k words) | 1M tokens (~750k words) | 200k tokens (~150k words) |
| **Max output** | 128k tokens | 64k tokens | 64k tokens |
| **Reliable knowledge cutoff** | May 2025 | Aug 2025 | Feb 2025 |
| **Training data cutoff** | Aug 2025 | Jan 2026 | Jul 2025 |

> **Notes:**
> - See the pricing page for complete pricing information including batch API discounts, prompt caching rates, extended thinking costs, and vision processing fees.
> - **Reliable knowledge cutoff** indicates the date through which a model's knowledge is most extensive and reliable. **Training data cutoff** is the broader date range of training data used.
> - Models with the same snapshot date (e.g., 20240620) are identical across all platforms and do not change.
> - You can query model capabilities and token limits programmatically with the Models API. The response includes `max_input_tokens`, `max_tokens`, and a `capabilities` object for every available model.
> - The Max output values above apply to the synchronous Messages API. On the Message Batches API, Opus 4.6 and Sonnet 4.6 support up to 300k output tokens by using the `output-300k-2026-03-24` beta header.

## Legacy models

The following models are still available. Consider migrating to current models for improved performance:

| Feature | Claude Sonnet 4.5 | Claude Opus 4.5 | Claude Opus 4.1 | Claude Sonnet 4 | Claude Opus 4 | Claude Haiku 3 (deprecated) |
|:--------|:------------------|:----------------|:----------------|:----------------|:--------------|:----------------------------|
| **Claude API ID** | claude-sonnet-4-5-20250929 | claude-opus-4-5-20251101 | claude-opus-4-1-20250805 | claude-sonnet-4-20250514 | claude-opus-4-20250514 | claude-3-haiku-20240307 |
| **Claude API alias** | claude-sonnet-4-5 | claude-opus-4-5 | claude-opus-4-1 | claude-sonnet-4-0 | claude-opus-4-0 | N/A |
| **AWS Bedrock ID** | anthropic.claude-sonnet-4-5-20250929-v1:0 | anthropic.claude-opus-4-5-20251101-v1:0 | anthropic.claude-opus-4-1-20250805-v1:0 | anthropic.claude-sonnet-4-20250514-v1:0 | anthropic.claude-opus-4-20250514-v1:0 | anthropic.claude-3-haiku-20240307-v1:0 |
| **GCP Vertex AI ID** | claude-sonnet-4-5@20250929 | claude-opus-4-5@20251101 | claude-opus-4-1@20250805 | claude-sonnet-4@20250514 | claude-opus-4@20250514 | claude-3-haiku@20240307 |
| **Pricing** | $3 / input MTok, $15 / output MTok | $5 / input MTok, $25 / output MTok | $15 / input MTok, $75 / output MTok | $3 / input MTok, $15 / output MTok | $15 / input MTok, $75 / output MTok | $0.25 / input MTok, $1.25 / output MTok |
| **Extended thinking** | Yes | Yes | Yes | Yes | Yes | No |
| **Priority Tier** | Yes | Yes | Yes | Yes | Yes | No |
| **Comparative latency** | Fast | Moderate | Moderate | Fast | Moderate | Fast |
| **Context window** | 200k tokens | 200k tokens | 200k tokens | 200k tokens | 200k tokens | 200k tokens |
| **Max output** | 64k tokens | 64k tokens | 32k tokens | 64k tokens | 32k tokens | 4k tokens |
| **Reliable knowledge cutoff** | Jan 2025 | May 2025 | Jan 2025 | Jan 2025 | Jan 2025 | N/A |
| **Training data cutoff** | Jul 2025 | Aug 2025 | Mar 2025 | Mar 2025 | Mar 2025 | Aug 2023 |

> **Warning:** Claude Haiku 3 (`claude-3-haiku-20240307`) is deprecated and will be retired on April 19, 2026. Migrate to Claude Haiku 4.5 before the retirement date.

## Prompt and output performance

Claude 4 models excel in:

- **Performance**: Top-tier results in reasoning, coding, multilingual tasks, long-context handling, honesty, and image processing.
- **Engaging responses**: Claude models are ideal for applications that require rich, human-like interactions. If you prefer more concise responses, you can adjust your prompts to guide the model toward the desired output length.
- **Output quality**: When migrating from previous model generations to Claude 4, you may notice larger improvements in overall performance.

## Migrating to Claude 4.6

If you're currently using older Claude models, consider migrating to Claude Opus 4.6 to take advantage of improved intelligence and enhanced capabilities.
