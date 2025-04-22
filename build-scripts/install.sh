#!/bin/bash

# Install dependencies with platform-specific flags
npm install --platform=linux --arch=x64

# Attempt to manually install lightningcss if needed
if [ ! -f "node_modules/lightningcss/node/lightningcss.linux-x64-gnu.node" ]; then
  echo "Installing lightningcss platform-specific binary"
  mkdir -p node_modules/lightningcss/node
  npm install lightningcss@latest --platform=linux --arch=x64
fi

# Clean problematic dependencies that might have platform-specific issues
npm run clean-deps 