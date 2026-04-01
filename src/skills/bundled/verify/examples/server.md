# Server Verification Example

## Pattern

For server applications, verify by starting the server and making test requests:

```bash
# Start the server in the background
npm run dev &
SERVER_PID=$!

# Wait for startup
sleep 2

# Test health endpoint
curl -s http://localhost:3000/health | jq .

# Test the changed endpoint
curl -s -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check response
echo "Status: $?"

# Cleanup
kill $SERVER_PID
```

## What to check

1. **Server starts**: No crash on startup
2. **Endpoint responds**: Returns expected status code and body
3. **Data integrity**: Response matches expected schema
4. **Error cases**: Invalid requests return proper error responses
5. **Logs**: No unexpected errors in server logs
