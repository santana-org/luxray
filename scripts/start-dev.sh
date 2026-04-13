#!/usr/bin/env bash

# 🤖 Luxray Discord Bot - Development Startup Script
# ===================================================
# This script starts the bot in development mode with hot-reload

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
  echo -e "${BLUE}║${NC}  🤖 Luxray Discord Bot Dev Server  ${BLUE}║${NC}"
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

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# ✅ Check prerequisites
print_header

print_step "Checking prerequisites..."

# Check if .env file exists
if [ ! -f ".env" ]; then
  print_error ".env file not found!"
  echo ""
  print_step "Creating .env from .env.example..."
  cp .env.example .env
  print_warning "Please edit .env with your Discord bot credentials"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  print_warning "node_modules not found, installing dependencies..."
  pnpm install
fi

print_success "All prerequisites met"
echo ""

# 🔍 Validate .env file
print_step "Validating configuration..."

if ! grep -q "^DISCORD_TOKEN=" .env || grep -q "^DISCORD_TOKEN=your_bot_token_here$" .env; then
  print_error "DISCORD_TOKEN not configured in .env"
  exit 1
fi

if ! grep -q "^CLIENT_ID=" .env || grep -q "^CLIENT_ID=your_application_client_id_here$" .env; then
  print_error "CLIENT_ID not configured in .env"
  exit 1
fi

print_success "Configuration validated"
echo ""

# 🚀 Start the bot
print_step "Starting bot in development mode..."
print_warning "Press Ctrl+C to stop the bot"
echo ""

pnpm run dev
