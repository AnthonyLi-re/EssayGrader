#!/bin/bash
echo "Running custom install script..."
npm install --no-package-lock --omit=optional --ignore-scripts
echo "Removing problematic packages..."
rm -rf node_modules/pdf-img-convert
rm -rf node_modules/canvas
echo "Installing remaining dependencies..."
npm install --no-package-lock --omit=optional 