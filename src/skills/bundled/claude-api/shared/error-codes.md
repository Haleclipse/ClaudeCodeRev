# Errors

## HTTP errors

The API follows a predictable HTTP error code format:

* **400** - `invalid_request_error`: There was an issue with the format or content of your request. This error type may also be used for other 4XX status codes not listed below.
* **401** - `authentication_error`: There's an issue with your API key.
* **402** - `billing_error`: There's an issue with your billing or payment information. Check your payment details in the Console.
* **403** - `permission_error`: Your API key does not have permission to use the specified resource.
* **404** - `not_found_error`: The requested resource was not found.
* **413** - `request_too_large`: Request exceeds the maximum allowed number of bytes. The maximum request size is 32 MB for standard API endpoints.
* **429** - `rate_limit_error`: Your account has hit a rate limit.
* **500** - `api_error`: An unexpected error has occurred internal to Anthropic's systems.
* **529** - `overloaded_error`: The API is temporarily overloaded.

> **Warning:** 529 errors can occur when APIs experience high traffic across all users. In rare cases, if your organization has a sharp increase in usage, you might see 429 errors due to acceleration limits on the API. To avoid hitting acceleration limits, ramp up your traffic gradually and maintain consistent usage patterns.

When receiving a streaming response via SSE, it's possible that an error can occur after returning a 200 response, in which case error handling wouldn't follow these standard mechanisms.

## Request size limits

The API enforces request size limits to ensure optimal performance:

| Endpoint Type | Maximum Request Size |
|:---|:---|
| Messages API | 32 MB |
| Token Counting API | 32 MB |
| Batch API | 256 MB |
| Files API | 500 MB |

If you exceed these limits, you'll receive a 413 `request_too_large` error. The error is returned from Cloudflare before the request reaches the API servers.

## Error shapes

Errors are always returned as JSON, with a top-level `error` object that always includes a `type` and `message` value. The response also includes a `request_id` field for easier tracking and debugging. For example:

```json
{
  "type": "error",
  "error": {
    "type": "not_found_error",
    "message": "The requested resource could not be found."
  },
  "request_id": "req_011CSHoEeqs5C35K2UUqR7Fy"
}
```

In accordance with the versioning policy, the values within these objects may expand, and it is possible that the `type` values will grow over time.

## Request id

Every API response includes a unique `request-id` header. This header contains a value such as `req_018EeWyXxfu5pfWkrYcMdjWG`. When contacting support about a specific request, include this ID to help quickly resolve your issue.

The official SDKs provide this value as a property on top-level response objects, containing the value of the `request-id` header:

```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
)
print(f"Request ID: {message._request_id}")
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude" }]
});
console.log("Request ID:", message._request_id);
```

## Long requests

> **Warning:** Consider using the streaming Messages API or Message Batches API for long running requests, especially those over 10 minutes.

Avoid setting a large `max_tokens` value without using the streaming Messages API or Message Batches API:

- Some networks may drop idle connections after a variable period of time, which can cause the request to fail or timeout without receiving a response from Anthropic.
- Networks differ in reliability; the Message Batches API can help you manage the risk of network issues by allowing you to poll for results rather than requiring an uninterrupted network connection.

If you are building a direct API integration, you should be aware that setting a [TCP socket keep-alive](https://tldp.org/HOWTO/TCP-Keepalive-HOWTO/programming.html) can reduce the impact of idle connection timeouts on some networks.

The SDKs validate that your non-streaming Messages API requests are not expected to exceed a 10 minute timeout and also will set a socket option for TCP keep-alive.

If you don't need to process events incrementally, use `.stream()` with `.get_final_message()` (Python) or `.finalMessage()` (TypeScript) to get the complete `Message` object without writing event-handling code:

```python
with client.messages.stream(
    max_tokens=128000,
    messages=[{"role": "user", "content": "Write a detailed analysis..."}],
    model="claude-opus-4-6",
) as stream:
    message = stream.get_final_message()
```

```typescript
const stream = client.messages.stream({
  max_tokens: 128000,
  messages: [{ role: "user", content: "Write a detailed analysis..." }],
  model: "claude-opus-4-6"
});
const message = await stream.finalMessage();
```

## Common validation errors

### Prefill not supported

Claude Opus 4.6 does not support prefilling assistant messages. Sending a request with a prefilled last assistant message to this model returns a 400 `invalid_request_error`:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Prefilling assistant messages is not supported for this model."
  }
}
```

Use structured outputs, system prompt instructions, or `output_config.format` instead.
