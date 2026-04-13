#!/usr/bin/env bash

# 🤖 Luxray Discord Bot - Production Startup Script
# =================================================
# This script builds and starts the bot in production mode

set -e

# 🎨 Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 📝 Functions
print_header() {
  echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  🤖 Luxray Discord Bot Production  ${BLUE}║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() {
  echo -e "${BLUE}▶${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# ✅ Check prerequisites
print_header

print_step "Checking prerequisites..."

if [ ! -f ".env" ]; then
  print_error ".env file not found!"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  print_error "Dependencies not installed. Run: pnpm install"
  exit 1
fi

print_success "Prerequisites met"
echo ""

# 🔨 Build the project
print_step "Building project..."
pnpm run build
print_success "Build completed"
echo ""

# 🚀 Start the bot
print_step "Starting bot in production mode..."
node dist/index.js
