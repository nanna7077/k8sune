#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting k8sune development environment..."

# 1. Frontend Setup
echo "📦 Syncing sprites and installing frontend dependencies..."
mkdir -p frontend/public/sprites
cp sprites/*.png frontend/public/sprites/
cd frontend
npm install
cd ..

# 2. Backend Setup
echo "🐍 Setting up Python backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Launch Tauri
echo "✨ Launching k8sune (Tauri + Vite + Python)..."
npm install # Ensure tauri-cli is available
npx tauri dev
