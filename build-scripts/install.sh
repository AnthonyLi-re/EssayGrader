#!/bin/bash

# Install dependencies with platform-specific flags
echo "Installing dependencies with platform-specific flags..."
npm install --platform=linux --arch=x64

# Install specific lightningcss version that works with Tailwind CSS 4
echo "Installing lightningcss compatible with Tailwind CSS 4..."
npm install lightningcss@latest --platform=linux --arch=x64

# Force rebuild of problematic native modules
echo "Forcing rebuild of native modules..."
cd node_modules/@tailwindcss/node/node_modules/lightningcss && npm rebuild --platform=linux --arch=x64 || true
cd ../../../../../

# Create the GNU binary link if it doesn't exist
echo "Setting up lightningcss binary links..."
if [ -f "node_modules/@tailwindcss/node/node_modules/lightningcss/node/lightningcss.linux-x64-musl.node" ]; then
  cp node_modules/@tailwindcss/node/node_modules/lightningcss/node/lightningcss.linux-x64-musl.node node_modules/@tailwindcss/node/node_modules/lightningcss/node/lightningcss.linux-x64-gnu.node
fi

# Clean problematic dependencies that might have platform-specific issues
echo "Cleaning problematic dependencies..."
npm run clean-deps

# Downgrade Tailwind if needed as a fallback
if [ ! -f "node_modules/@tailwindcss/node/node_modules/lightningcss/node/lightningcss.linux-x64-gnu.node" ]; then
  echo "Falling back to Tailwind CSS 3..."
  npm uninstall tailwindcss @tailwindcss/postcss
  npm install tailwindcss@3 postcss@8 autoprefixer@10
fi 