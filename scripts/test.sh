#!/bin/bash
# test.sh — Run the full test suite
# Output: JSON to stdout on success, JSON to stderr on failure
# Exit: 0 = success, 1 = failure

# Load test environment variables (API keys etc.)
if [ -f .testEnvVars ]; then
  source .testEnvVars
else
  echo '{"status":"warn","message":".testEnvVars not found — API-dependent tests may fail"}' >&2
fi

echo "Running tests..."
npm test -- --watchAll=false 2>&1
if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"tests","message":"One or more tests failed. See output above."}' >&2
  exit 1
fi

echo '{"status":"pass","step":"tests","message":"All tests passed"}'
exit 0
