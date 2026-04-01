# Ruby SDK

Install and configure the Anthropic Ruby SDK with Sorbet types, streaming helpers, and connection pooling

---

The Anthropic Ruby library provides convenient access to the Anthropic REST API from any Ruby 3.2.0+ application. It ships with comprehensive types and docstrings in Yard, RBS, and RBI. The standard library's `net/http` is used as the HTTP transport, with connection pooling via the `connection_pool` gem.

> **Note:** For API feature documentation with code examples, see the [API reference](/docs/en/api/overview). This page covers Ruby-specific SDK features and configuration.

## Installation

To use this gem, install via Bundler by adding the following to your application's `Gemfile`:

```ruby
gem "anthropic", "~> 1.25.0"
```

## Requirements

Ruby 3.2.0 or higher.

## Usage

```ruby
require "anthropic"

anthropic = Anthropic::Client.new(
  api_key: ENV["ANTHROPIC_API_KEY"] # This is the default and can be omitted
)

message = anthropic.messages.create(
  max_tokens: 1024,
  messages: [{role: "user", content: "Hello, Claude"}],
  model: :"claude-opus-4-6"
)

puts(message.content)
```

## Streaming

The SDK provides support for streaming responses using Server-Sent Events (SSE).

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
stream = anthropic.messages.stream(
  max_tokens: 1024,
  messages: [{role: "user", content: "Hello, Claude"}],
  model: :"claude-opus-4-6"
)

stream.each do |message|
  puts(message.type)
end
```

### Streaming helpers

This library provides several conveniences for streaming messages, for example:

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
stream = anthropic.messages.stream(
  max_tokens: 1024,
  messages: [{role: :user, content: "Say hello there!"}],
  model: :"claude-opus-4-6"
)

stream.text.each do |text|
  print(text)
end
```

Streaming with `anthropic.messages.stream(...)` exposes various helpers including accumulation and SDK-specific events.

## Input schema and tool calling

The SDK provides helper mechanisms to define structured data classes for tools and let Claude automatically execute them.

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
class CalculatorInput < Anthropic::BaseModel
  required :lhs, Float
  required :rhs, Float
  required :operator, Anthropic::InputSchema::EnumOf[:+, :-, :*, :/]
end

class Calculator < Anthropic::BaseTool
  input_schema CalculatorInput

  def call(expr)
    expr.lhs.public_send(expr.operator, expr.rhs)
  end
end

# Automatically handles tool execution loop
anthropic.beta.messages.tool_runner(
  model: "claude-opus-4-6",
  max_tokens: 1024,
  messages: [{role: "user", content: "What's 15 * 7?"}],
  tools: [Calculator.new]
).each_message { puts _1.content }
```

## Structured outputs

For complete structured outputs documentation including Ruby examples, see [Structured Outputs](/docs/en/build-with-claude/structured-outputs).

## Handling errors

When the library is unable to connect to the API, or if the API returns a non-success status code (i.e., 4xx or 5xx response), a subclass of `Anthropic::Errors::APIError` will be thrown:

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
begin
  message = anthropic.messages.create(
    max_tokens: 1024,
    messages: [{role: "user", content: "Hello, Claude"}],
    model: :"claude-opus-4-6"
  )
rescue Anthropic::Errors::APIConnectionError => e
  puts("The server could not be reached")
  puts(e.cause)  # an underlying Exception, likely raised within `net/http`
rescue Anthropic::Errors::RateLimitError => e
  puts("A 429 status code was received; we should back off a bit.")
rescue Anthropic::Errors::APIStatusError => e
  puts("Another non-200-range status code was received")
  puts(e.status)
end
```

Error codes are as follows:

| Cause            | Error Type                 |
| ---------------- | -------------------------- |
| HTTP 400         | `BadRequestError`          |
| HTTP 401         | `AuthenticationError`      |
| HTTP 403         | `PermissionDeniedError`    |
| HTTP 404         | `NotFoundError`            |
| HTTP 409         | `ConflictError`            |
| HTTP 422         | `UnprocessableEntityError` |
| HTTP 429         | `RateLimitError`           |
| HTTP >= 500      | `InternalServerError`      |
| Other HTTP error | `APIStatusError`           |
| Timeout          | `APITimeoutError`          |
| Network error    | `APIConnectionError`       |

## Retries

Certain errors will be automatically retried 2 times by default, with a short exponential backoff.

Connection errors (for example, due to a network connectivity problem), 408 Request Timeout, 409 Conflict, 429 Rate Limit, >=500 Internal errors, and timeouts will all be retried by default.

You can use the `max_retries` option to configure or disable this:

```ruby
# Configure the default for all requests:
anthropic = Anthropic::Client.new(
  max_retries: 0 # default is 2
)

# Or, configure per-request:
anthropic.messages.create(
  max_tokens: 1024,
  messages: [{role: "user", content: "Hello, Claude"}],
  model: :"claude-opus-4-6",
  request_options: {max_retries: 5}
)
```

## Timeouts

By default, requests will time out after 600 seconds. You can use the timeout option to configure or disable this:

```ruby
# Configure the default for all requests:
anthropic = Anthropic::Client.new(
  timeout: nil # default is 600
)

# Or, configure per-request:
anthropic.messages.create(
  max_tokens: 1024,
  messages: [{role: "user", content: "Hello, Claude"}],
  model: :"claude-opus-4-6",
  request_options: {timeout: 5}
)
```

On timeout, `Anthropic::Errors::APITimeoutError` is raised.

Note that requests that time out are retried by default.

## Pagination

List methods in the Claude API are paginated.

This library provides auto-paginating iterators with each list response, so you do not have to request successive pages manually:

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
page = anthropic.messages.batches.list(limit: 20)

# Fetch single item from page.
batch = page.data[0]
puts(batch.id)

# Automatically fetches more pages as needed.
page.auto_paging_each do |batch|
  puts(batch.id)
end
```

Alternatively, you can use the `#next_page?` and `#next_page` methods for more granular control working with pages.

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
page = anthropic.messages.batches.list(limit: 20)
while page.next_page?
  page = page.next_page
  page.data&.each { |batch| puts(batch.id) }
end
```

## File uploads

Request parameters that correspond to file uploads can be passed as raw contents, a [`Pathname`](https://rubyapi.org/3.2/o/pathname) instance, [`StringIO`](https://rubyapi.org/3.2/o/stringio), or more.

```ruby
require "anthropic"
require "pathname"

anthropic = Anthropic::Client.new

# Use `Pathname` to send the filename and/or avoid paging a large file into memory:
file_metadata = anthropic.beta.files.upload(file: Pathname("/path/to/file"))

# Alternatively, pass file contents or a `StringIO` directly:
file_metadata = anthropic.beta.files.upload(file: File.read("/path/to/file"))

# Or, to control the filename and/or content type:
file = Anthropic::FilePart.new(File.read("/path/to/file"), filename: "/path/to/file", content_type: "...")
file_metadata = anthropic.beta.files.upload(file: file)

puts(file_metadata.id)
```

Note that you can also pass a raw `IO` descriptor, but this disables retries, as the library can't be sure if the descriptor is a file or pipe (which cannot be rewound).

## Sorbet

This library provides comprehensive [RBI](https://sorbet.org/docs/rbi) definitions, and has no dependency on sorbet-runtime.

You can provide typesafe request parameters like so:

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
anthropic.messages.create(
  max_tokens: 1024,
  messages: [Anthropic::MessageParam.new(role: "user", content: "Hello, Claude")],
  model: :"claude-opus-4-6"
)
```

Or, equivalently:

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
# Hashes work, but are not typesafe:
anthropic.messages.create(
  max_tokens: 1024,
  messages: [{role: "user", content: "Hello, Claude"}],
  model: :"claude-opus-4-6"
)

# You can also splat a full Params class:
params = Anthropic::MessageCreateParams.new(
  max_tokens: 1024,
  messages: [Anthropic::MessageParam.new(role: "user", content: "Hello, Claude")],
  model: :"claude-opus-4-6"
)
anthropic.messages.create(**params)
```

### Enums

Since this library does not depend on `sorbet-runtime`, it cannot provide [`T::Enum`](https://sorbet.org/docs/tenum) instances. Instead, the SDK provides "tagged symbols":

```ruby
# :auto
puts(Anthropic::MessageCreateParams::ServiceTier::AUTO)

# Using the enum constants preserves the tagged type information:
anthropic.messages.create(
  service_tier: Anthropic::MessageCreateParams::ServiceTier::AUTO,
  # ...
)

# Literal values are also permissible:
anthropic.messages.create(
  service_tier: :auto,
  # ...
)
```

## BaseModel

All parameter and response objects inherit from `Anthropic::Internal::Type::BaseModel`, which provides several conveniences, including:

1. All fields, including unknown ones, are accessible with `obj[:prop]` syntax, and can be destructured with `obj => {prop: prop}` or pattern-matching syntax.
2. Structural equivalence for equality; if two API calls return the same values, comparing the responses with == will return true.
3. Both instances and the classes themselves can be pretty-printed.
4. Helpers such as `#to_h`, `#deep_to_h`, `#to_json`, and `#to_yaml`.

## Concurrency and connection pooling

The `Anthropic::Client` instances are threadsafe, but are only fork-safe when there are no in-flight HTTP requests.

Each instance of `Anthropic::Client` has its own HTTP connection pool with a default size of 99. As such, the recommendation is to instantiate the client once per application in most settings.

When all available connections from the pool are checked out, requests wait for a new connection to become available, with queue time counting towards the request timeout.

## Making custom or undocumented requests

### Undocumented properties

You can send undocumented parameters to any endpoint, and read undocumented response properties:

> **Warning:** The `extra_` parameters of the same name override the documented parameters. For security reasons, ensure these methods are only used with trusted input data.

```ruby
require "anthropic"

anthropic = Anthropic::Client.new
value = "example"
message =
  anthropic.messages.create(
    max_tokens: 1024,
    messages: [{role: "user", content: "Hello, Claude"}],
    model: :"claude-opus-4-6",
    request_options: {
      extra_query: {my_query_parameter: value},
      extra_body: {my_body_parameter: value},
      extra_headers: {"my-header": value}
    }
  )

puts(message[:my_undocumented_property])
```

### Undocumented endpoints

To make requests to undocumented endpoints while retaining the benefit of auth, retries, and so on:

```ruby
response = anthropic.request(
  method: :post,
  path: '/undocumented/endpoint',
  query: {"dog": "woof"},
  headers: {"useful-header": "interesting-value"},
  body: {"hello": "world"}
)
```

## Platform integrations

> **Note:** For detailed platform setup guides with code examples, see:
> - [Amazon Bedrock](/docs/en/build-with-claude/claude-on-amazon-bedrock)
> - [Google Vertex AI](/docs/en/build-with-claude/claude-on-vertex-ai)

The Ruby SDK supports Bedrock and Vertex AI through dedicated client classes:

- **Bedrock:** `Anthropic::BedrockClient`. Requires the `aws-sdk-bedrockruntime` gem.
- **Vertex AI:** `Anthropic::VertexClient`. Requires the `googleauth` gem.

## Semantic versioning

This package follows [SemVer](https://semver.org/spec/v2.0.0.html) conventions. As the library is in initial development and has a major version of `0`, APIs may change at any time.

This package considers improvements to the (non-runtime) `*.rbi` and `*.rbs` type definitions to be non-breaking changes.

## Additional resources

- [GitHub repository](https://github.com/anthropics/anthropic-sdk-ruby)
- [RubyDoc documentation](https://gemdocs.org/gems/anthropic)
- [API reference](/docs/en/api/overview)
- [Streaming guide](/docs/en/build-with-claude/streaming)
