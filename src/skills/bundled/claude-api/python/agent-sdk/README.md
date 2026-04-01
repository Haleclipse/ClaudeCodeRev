# Agent SDK Reference - Python

Complete API reference for the Python Agent SDK, including all functions, types, and classes.

## Installation

```bash
pip install claude-agent-sdk
```

## Choosing between `query()` and `ClaudeSDKClient`

The Python SDK provides two ways to interact with Claude Code:

### Quick comparison

| Feature             | `query()`                     | `ClaudeSDKClient`                  |
| :------------------ | :---------------------------- | :--------------------------------- |
| **Session**         | Creates new session each time | Reuses same session                |
| **Conversation**    | Single exchange               | Multiple exchanges in same context |
| **Connection**      | Managed automatically         | Manual control                     |
| **Streaming Input** | Supported                     | Supported                          |
| **Interrupts**      | Not supported                 | Supported                          |
| **Hooks**           | Supported                     | Supported                          |
| **Custom Tools**    | Supported                     | Supported                          |
| **Continue Chat**   | New session each time         | Maintains conversation             |
| **Use Case**        | One-off tasks                 | Continuous conversations           |

### When to use `query()` (new session each time)

**Best for:**

- One-off questions where you don't need conversation history
- Independent tasks that don't require context from previous exchanges
- Simple automation scripts
- When you want a fresh start each time

### When to use `ClaudeSDKClient` (continuous conversation)

**Best for:**

- **Continuing conversations** - When you need Claude to remember context
- **Follow-up questions** - Building on previous responses
- **Interactive applications** - Chat interfaces, REPLs
- **Response-driven logic** - When next action depends on Claude's response
- **Session control** - Managing conversation lifecycle explicitly

## Functions

### `query()`

Creates a new session for each interaction with Claude Code. Returns an async iterator that yields messages as they arrive.

```python
async def query(
    *,
    prompt: str | AsyncIterable[dict[str, Any]],
    options: ClaudeAgentOptions | None = None,
    transport: Transport | None = None
) -> AsyncIterator[Message]
```

#### Example - With options

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions


async def main():
    options = ClaudeAgentOptions(
        system_prompt="You are an expert Python developer",
        permission_mode="acceptEdits",
        cwd="/home/user/project",
    )

    async for message in query(prompt="Create a Python web server", options=options):
        print(message)


asyncio.run(main())
```

### `tool()`

Decorator for defining MCP tools with type safety.

```python
def tool(
    name: str,
    description: str,
    input_schema: type | dict[str, Any],
    annotations: ToolAnnotations | None = None
) -> Callable[[Callable[[Any], Awaitable[dict[str, Any]]]], SdkMcpTool[Any]]
```

#### Example

```python
from claude_agent_sdk import tool
from typing import Any


@tool("greet", "Greet a user", {"name": str})
async def greet(args: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}
```

#### `ToolAnnotations`

Re-exported from `mcp.types`. All fields are optional hints.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `title` | `str \| None` | `None` | Human-readable title for the tool |
| `readOnlyHint` | `bool \| None` | `False` | If `True`, the tool does not modify its environment |
| `destructiveHint` | `bool \| None` | `True` | If `True`, the tool may perform destructive updates |
| `idempotentHint` | `bool \| None` | `False` | If `True`, repeated calls with the same arguments have no additional effect |
| `openWorldHint` | `bool \| None` | `True` | If `True`, the tool interacts with external entities |

### `create_sdk_mcp_server()`

Create an in-process MCP server that runs within your Python application.

```python
def create_sdk_mcp_server(
    name: str,
    version: str = "1.0.0",
    tools: list[SdkMcpTool[Any]] | None = None
) -> McpSdkServerConfig
```

#### Example

```python
from claude_agent_sdk import tool, create_sdk_mcp_server


@tool("add", "Add two numbers", {"a": float, "b": float})
async def add(args):
    return {"content": [{"type": "text", "text": f"Sum: {args['a'] + args['b']}"}]}


@tool("multiply", "Multiply two numbers", {"a": float, "b": float})
async def multiply(args):
    return {"content": [{"type": "text", "text": f"Product: {args['a'] * args['b']}"}]}


calculator = create_sdk_mcp_server(
    name="calculator",
    version="2.0.0",
    tools=[add, multiply],
)

options = ClaudeAgentOptions(
    mcp_servers={"calc": calculator},
    allowed_tools=["mcp__calc__add", "mcp__calc__multiply"],
)
```

### `list_sessions()`

Lists past sessions with metadata. Synchronous; returns immediately.

```python
def list_sessions(
    directory: str | None = None,
    limit: int | None = None,
    include_worktrees: bool = True
) -> list[SDKSessionInfo]
```

#### Example

```python
from claude_agent_sdk import list_sessions

for session in list_sessions(directory="/path/to/project", limit=10):
    print(f"{session.summary} ({session.session_id})")
```

### `get_session_messages()`

Retrieves messages from a past session. Synchronous; returns immediately.

```python
def get_session_messages(
    session_id: str,
    directory: str | None = None,
    limit: int | None = None,
    offset: int = 0
) -> list[SessionMessage]
```

### `get_session_info()`

Reads metadata for a single session by ID.

```python
def get_session_info(
    session_id: str,
    directory: str | None = None,
) -> SDKSessionInfo | None
```

### `rename_session()`

Renames a session by appending a custom-title entry.

```python
def rename_session(
    session_id: str,
    title: str,
    directory: str | None = None,
) -> None
```

### `tag_session()`

Tags a session. Pass `None` to clear the tag.

```python
def tag_session(
    session_id: str,
    tag: str | None,
    directory: str | None = None,
) -> None
```

## Classes

### `ClaudeSDKClient`

Maintains a conversation session across multiple exchanges.

```python
class ClaudeSDKClient:
    def __init__(self, options: ClaudeAgentOptions | None = None, transport: Transport | None = None)
    async def connect(self, prompt: str | AsyncIterable[dict] | None = None) -> None
    async def query(self, prompt: str | AsyncIterable[dict], session_id: str = "default") -> None
    async def receive_messages(self) -> AsyncIterator[Message]
    async def receive_response(self) -> AsyncIterator[Message]
    async def interrupt(self) -> None
    async def set_permission_mode(self, mode: str) -> None
    async def set_model(self, model: str | None = None) -> None
    async def rewind_files(self, user_message_id: str) -> None
    async def get_mcp_status(self) -> McpStatusResponse
    async def reconnect_mcp_server(self, server_name: str) -> None
    async def toggle_mcp_server(self, server_name: str, enabled: bool) -> None
    async def stop_task(self, task_id: str) -> None
    async def get_server_info(self) -> dict[str, Any] | None
    async def disconnect(self) -> None
```

#### Context Manager Support

```python
async with ClaudeSDKClient() as client:
    await client.query("Hello Claude")
    async for message in client.receive_response():
        print(message)
```

#### Example - Continuing a conversation

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, AssistantMessage, TextBlock, ResultMessage


async def main():
    async with ClaudeSDKClient() as client:
        # First question
        await client.query("What's the capital of France?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

        # Follow-up question - session retains previous context
        await client.query("What's the population of that city?")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")


asyncio.run(main())
```

#### Example - Using interrupts

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage


async def interruptible_task():
    options = ClaudeAgentOptions(allowed_tools=["Bash"], permission_mode="acceptEdits")

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Count from 1 to 100 slowly, using the bash sleep command")

        await asyncio.sleep(2)

        await client.interrupt()
        print("Task interrupted!")

        # Drain the interrupted task's messages
        async for message in client.receive_response():
            if isinstance(message, ResultMessage):
                print(f"Interrupted task finished with subtype={message.subtype!r}")

        # Send a new command
        await client.query("Just say hello instead")

        async for message in client.receive_response():
            if isinstance(message, ResultMessage) and message.subtype == "success":
                print(f"New result: {message.result}")


asyncio.run(interruptible_task())
```

> **Buffer behavior after interrupt:** `interrupt()` sends a stop signal but does not clear the message buffer. You must drain messages with `receive_response()` before reading the response to a new query.

#### Example - Advanced permission control

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import (
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)


async def custom_permission_handler(
    tool_name: str, input_data: dict, context: ToolPermissionContext
) -> PermissionResultAllow | PermissionResultDeny:
    if tool_name == "Write" and input_data.get("file_path", "").startswith("/system/"):
        return PermissionResultDeny(
            message="System directory write not allowed", interrupt=True
        )

    if tool_name in ["Write", "Edit"] and "config" in input_data.get("file_path", ""):
        safe_path = f"./sandbox/{input_data['file_path']}"
        return PermissionResultAllow(
            updated_input={**input_data, "file_path": safe_path}
        )

    return PermissionResultAllow(updated_input=input_data)


async def main():
    options = ClaudeAgentOptions(
        can_use_tool=custom_permission_handler, allowed_tools=["Read", "Write", "Edit"]
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Update the system config file")

        async for message in client.receive_response():
            print(message)


asyncio.run(main())
```

## Types

### `ClaudeAgentOptions`

Configuration dataclass for Claude Code queries.

| Property                      | Type                                         | Default              | Description                                                 |
| :---------------------------- | :------------------------------------------- | :------------------- | :---------------------------------------------------------- |
| `tools`                       | `list[str] \| ToolsPreset \| None`           | `None`               | Tools configuration                                          |
| `allowed_tools`               | `list[str]`                                  | `[]`                 | Tools to auto-approve without prompting                      |
| `system_prompt`               | `str \| SystemPromptPreset \| None`          | `None`               | System prompt configuration                                  |
| `mcp_servers`                 | `dict[str, McpServerConfig] \| str \| Path`  | `{}`                 | MCP server configurations or path to config file             |
| `permission_mode`             | `PermissionMode \| None`                     | `None`               | Permission mode for tool usage                               |
| `continue_conversation`       | `bool`                                       | `False`              | Continue the most recent conversation                        |
| `resume`                      | `str \| None`                                | `None`               | Session ID to resume                                         |
| `max_turns`                   | `int \| None`                                | `None`               | Maximum agentic turns                                        |
| `max_budget_usd`              | `float \| None`                              | `None`               | Maximum budget in USD for the session                        |
| `disallowed_tools`            | `list[str]`                                  | `[]`                 | Tools to always deny                                         |
| `model`                       | `str \| None`                                | `None`               | Claude model to use                                          |
| `cwd`                         | `str \| Path \| None`                        | `None`               | Current working directory                                    |
| `can_use_tool`                | `CanUseTool \| None`                         | `None`               | Tool permission callback function                            |
| `hooks`                       | `dict[HookEvent, list[HookMatcher]] \| None` | `None`               | Hook configurations for intercepting events                  |
| `thinking`                    | `ThinkingConfig \| None`                     | `None`               | Controls extended thinking behavior                          |
| `effort`                      | `Literal["low", "medium", "high", "max"] \| None` | `None`          | Effort level for thinking depth                              |
| `enable_file_checkpointing`   | `bool`                                       | `False`              | Enable file change tracking for rewinding                    |

### `ThinkingConfig`

Controls extended thinking behavior. A union of three configurations:

```python
class ThinkingConfigAdaptive(TypedDict):
    type: Literal["adaptive"]

class ThinkingConfigEnabled(TypedDict):
    type: Literal["enabled"]
    budget_tokens: int

class ThinkingConfigDisabled(TypedDict):
    type: Literal["disabled"]
```

### `PermissionMode`

```python
PermissionMode = Literal[
    "default",           # Standard permission behavior
    "acceptEdits",       # Auto-accept file edits
    "plan",              # Planning mode - no execution
    "bypassPermissions", # Bypass all permission checks (use with caution)
]
```

### `Message` Types

```python
Message = (
    UserMessage
    | AssistantMessage
    | SystemMessage
    | ResultMessage
    | StreamEvent
    | RateLimitEvent
)
```

#### `ResultMessage`

Final result message with cost and usage information.

```python
@dataclass
class ResultMessage:
    subtype: str
    duration_ms: int
    duration_api_ms: int
    is_error: bool
    num_turns: int
    session_id: str
    total_cost_usd: float | None = None
    usage: dict[str, Any] | None = None
    result: str | None = None
    stop_reason: str | None = None
    structured_output: Any = None
```

### `ContentBlock` Types

```python
ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock
```

## Error Types

### `ClaudeSDKError`

Base exception class for all SDK errors.

### `CLINotFoundError`

Raised when Claude Code CLI is not installed or not found.

### `CLIConnectionError`

Raised when connection to Claude Code fails.

### `ProcessError`

Raised when the Claude Code process fails. Contains `exit_code` and `stderr` attributes.
