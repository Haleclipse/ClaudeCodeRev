# CLI Verification Example

## Pattern

For CLI tools, verify by running the command with test inputs and checking output:

```bash
# Build the project
npm run build

# Run with test input
node dist/cli.js --version
node dist/cli.js -p "test prompt"

# Check exit code
echo "Exit code: $?"
```

## What to check

1. **Exit code**: Should be 0 for success
2. **Output format**: Should match expected format (text, JSON, etc.)
3. **Error handling**: Invalid inputs should produce helpful error messages
4. **Side effects**: Check that files are written, APIs are called, etc.
