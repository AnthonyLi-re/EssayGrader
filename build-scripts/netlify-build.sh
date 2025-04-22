#!/bin/bash
set -e

echo "Running Netlify build script..."
echo "Current directory: $(pwd)"

# Make sure we're in the project root
if [ ! -f "package.json" ]; then
  echo "Error: package.json not found, attempting to change directory"
  cd "$(dirname "$0")/.." || exit 1
  echo "Changed to: $(pwd)"
  
  if [ ! -f "package.json" ]; then
    echo "Error: Still can't find package.json. Exiting."
    exit 1
  fi
fi

# Clean problematic dependencies first
echo "Cleaning problematic dependencies..."
rimraf node_modules/pdf-img-convert node_modules/canvas node_modules/@tailwindcss node_modules/lightningcss || true

# Remove the resolutions and overrides for lightningcss
echo "Updating package.json to remove lightningcss overrides..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  delete pkg.resolutions;
  delete pkg.overrides;
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

# Remove Tailwind CSS 4 and related dependencies
echo "Removing Tailwind CSS 4..."
npm uninstall tailwindcss @tailwindcss/postcss lightningcss || true

# Install dependencies with clean slate
echo "Installing dependencies..."
npm install --no-optional

# Install Tailwind CSS 3 (stable version for production)
echo "Installing Tailwind CSS 3..."
npm install --save-dev tailwindcss@3.3.6 postcss@8.4.32 autoprefixer@10.4.16

# Update PostCSS config
echo "Updating PostCSS config..."
cat > postcss.config.mjs << 'EOL'
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
EOL

# Fix globals.css for Tailwind 3 compatibility
echo "Fixing globals.css for Tailwind 3 compatibility..."
bash ./build-scripts/tailwind-fix.sh

echo "Build preparation completed successfully!" 