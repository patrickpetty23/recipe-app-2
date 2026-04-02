#!/bin/bash
# run.sh — Start the Expo development server
# Usage: ./scripts/run.sh [--ios | --android | --web]
# Exit: 0 = clean exit, 1 = error

PLATFORM=${1:---ios}

echo "Starting Expo dev server ($PLATFORM)..."
npx expo start $PLATFORM

if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"expo start","message":"Expo failed to start. Check output above."}' >&2
  exit 1
fi

exit 0
