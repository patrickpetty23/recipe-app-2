#!/bin/bash
# build.sh — Install dependencies and verify project setup
# Output: JSON to stdout on success, JSON to stderr on failure
# Exit: 0 = success, 1 = failure

echo "Installing dependencies..."
npm install 2>&1
if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"npm install","message":"Dependency installation failed"}' >&2
  exit 1
fi

echo "Checking Expo CLI..."
npx expo --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"expo check","message":"Expo CLI not found. Run: npm install -g expo"}' >&2
  exit 1
fi

echo '{"status":"pass","step":"build","message":"All dependencies installed"}'
exit 0
