#!/bin/bash
# run.sh — Start the Expo development server
# Usage: ./scripts/run.sh [--ios | --android | --web]
# Exit: 0 = clean exit, 1 = error

if [ -f .testEnvVars ]; then
  source .testEnvVars
fi

export EXPO_PUBLIC_OPENAI_API_KEY="${OPENAI_API_KEY}"
export EXPO_PUBLIC_WALMART_CLIENT_ID="${WALMART_CLIENT_ID}"
export EXPO_PUBLIC_WALMART_PRIVATE_KEY="${WALMART_PRIVATE_KEY}"
export EXPO_PUBLIC_WALMART_KEY_VERSION="${WALMART_KEY_VERSION:-1}"

PLATFORM=${1:---ios}

echo "Starting Expo dev server ($PLATFORM)..."
npx expo start $PLATFORM

if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"expo start","message":"Expo failed to start. Check output above."}' >&2
  exit 1
fi

exit 0
