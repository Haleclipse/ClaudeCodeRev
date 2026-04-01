# Claude API skill

An open-source Agent Skill that provides Claude with up-to-date API reference material, SDK documentation, and best practices for building applications with the Claude API.

---

The `claude-api` skill is an open-source Agent Skill that provides Claude with detailed, up-to-date reference material for building applications with the Claude API and Agent SDK. It covers 8 programming languages: Python, TypeScript, Java, Go, Ruby, C#, PHP, and cURL.

The skill comes bundled with Claude Code and is also available in the open-source [Anthropic skills repository](https://github.com/anthropics/skills/tree/main/skills/claude-api), where you can install it in any environment that supports Agent Skills.

The skill uses progressive disclosure to keep context efficient: Claude loads only the documentation relevant to your project's language and the specific task at hand (tool use, streaming, batches, and so on), rather than loading everything at once.

## What the skill provides

When triggered, the skill equips Claude with:

- **Language-specific SDK documentation:** Installation, quick start, common patterns, and error handling for your project's language
- **Tool use guidance:** Language-specific examples and conceptual foundations for function calling
- **Streaming patterns:** Implementation details for building chat UIs and handling incremental display
- **Batch processing:** Offline batch processing at 50% cost
- **Agent SDK reference:** Installation, built-in tools, permissions, MCP integration, and common patterns (Python and TypeScript)
- **Current model information:** Model IDs, context window sizes, and pricing
- **Common pitfalls:** Detailed guidance on avoiding frequent mistakes when integrating with the API

## When the skill activates

The skill activates in two ways:

**Automatic activation** occurs when Claude detects that your code imports an Anthropic SDK:

- `anthropic` (Python)
- `@anthropic-ai/sdk` (TypeScript/JavaScript)
- `claude_agent_sdk` (Agent SDK)

**Manual invocation** by typing `/claude-api` in any environment where the skill is installed.

The skill does not activate for general programming tasks, ML/data-science work, or code that imports other AI SDKs (such as OpenAI).

## Supported languages

The skill detects your project's language automatically by examining project files (for example, `requirements.txt` for Python, `tsconfig.json` for TypeScript, `go.mod` for Go) and loads the appropriate documentation.

| Language   | SDK documentation | Tool runner | Agent SDK |
|------------|-------------------|-------------|-----------|
| Python     | Yes               | Yes (beta)  | Yes       |
| TypeScript | Yes               | Yes (beta)  | Yes       |
| Java       | Yes               | No          | No        |
| Go         | Yes               | No          | No        |
| Ruby       | Yes               | Yes (beta)  | No        |
| C#         | Yes               | No          | No        |
| PHP        | Yes               | No          | No        |
| cURL       | Yes               | N/A         | N/A       |

If your project uses multiple languages, Claude asks which one applies. For unsupported languages (Rust, Swift, C++), the skill provides cURL/raw HTTP examples.

## How to use the skill

### In Claude Code (bundled)

The skill ships with Claude Code and requires no installation. When you ask Claude to help build something with the Claude API, or when your project already imports an Anthropic SDK, the skill activates automatically.

You can also invoke it directly:

```text
/claude-api
```

### From the skills repository

The skill source is available in the [Anthropic skills repository](https://github.com/anthropics/skills). You can install it using the `npx` command:

```bash
npx skills add https://github.com/anthropics/skills --skill claude-api
```

Or install it as a Claude Code plugin:

```bash
/plugin marketplace add anthropics/skills
/plugin install claude-api@anthropic-agent-skills
```

## Example usage

Here are examples of tasks the skill helps Claude handle:

**Building a chat application:**
```text
Build a streaming chat UI with the Claude API in TypeScript
```

**Working with the Agent SDK:**
```text
Create an agent with file and terminal tools using the Agent SDK
```

In each case, the skill loads the relevant language-specific documentation and guides Claude through the implementation using current API patterns and best practices.
