#!/bin/bash

# 🤖 Luxray Discord Bot - Initial Setup Script
# =============================================
# Interactive setup for first-time configuration

set -e

# 🎨 Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 📝 Functions
print_header() {
  echo -e "${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  🤖 Luxray Discord Bot - Initial Setup Guide   ${BLUE}║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

# 🎯 Start setup
print_header

# Step 1: Check prerequisites
print_section "Step 1️⃣: Checking Prerequisites"

if ! command -v pnpm &> /dev/null; then
  print_error "pnpm is not installed. Please install it first:"
  echo "  npm install -g pnpm"
  exit 1
fi

print_success "pnpm found"
echo ""

# Step 2: Install dependencies
print_section "Step 2️⃣: Installing Dependencies"

if [ -d "node_modules" ]; then
  print_warning "node_modules already exists"
  read -p "Update dependencies? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    pnpm install
    print_success "Dependencies updated"
  fi
else
  print_step "Installing dependencies with pnpm..."
  pnpm install
  print_success "Dependencies installed"
fi

echo ""

# Step 3: Setup .env file
print_section "Step 3️⃣: Environment Configuration"

if [ -f ".env" ]; then
  print_warning ".env file already exists"
  read -p "Reconfigure? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping configuration..."
    echo ""
  else
    cp .env.example .env
    print_success "Reset .env to defaults"
  fi
else
  cp .env.example .env
  print_success "Created .env from .env.example"
fi

echo ""

# Step 4: Collect Discord credentials
print_section "Step 4️⃣: Discord Bot Credentials"

echo ""
echo -e "${CYAN}📖 Get your credentials from:${NC}"
echo -e "   https://discord.com/developers/applications"
echo ""

# DISCORD_TOKEN
print_step "Discord Bot Token (required):"
read -s -p "  🔐 Enter your bot token: " discord_token
echo ""

if [ -z "$discord_token" ]; then
  print_error "Discord token is required"
  exit 1
fi

# CLIENT_ID
print_step "Application Client ID (required):"
read -p "  🆔 Enter your client ID: " client_id
echo ""

if [ -z "$client_id" ]; then
  print_error "Client ID is required"
  exit 1
fi

# GUILD_ID (optional)
print_step "Guild ID (optional, for development):"
read -p "  🏢 Enter guild ID (leave blank to skip): " guild_id
echo ""

# BOT_PREFIX (optional)
print_step "Bot Prefix (optional, default: !):"
read -p "  📌 Enter prefix (leave blank for !): " bot_prefix
echo ""

# 💾 Update .env file
print_section "Step 5️⃣: Saving Configuration"

print_step "Updating .env file..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|your_bot_token_here|$discord_token|" .env
  sed -i '' "s|your_application_client_id_here|$client_id|" .env
  [ -n "$guild_id" ] && sed -i '' "s|# GUILD_ID=your_guild_id_here|GUILD_ID=$guild_id|" .env
  [ -n "$bot_prefix" ] && sed -i '' "s|# BOT_PREFIX=!|BOT_PREFIX=$bot_prefix|" .env
else
  sed -i "s|your_bot_token_here|$discord_token|" .env
  sed -i "s|your_application_client_id_here|$client_id|" .env
  [ -n "$guild_id" ] && sed -i "s|# GUILD_ID=your_guild_id_here|GUILD_ID=$guild_id|" .env
  [ -n "$bot_prefix" ] && sed -i "s|# BOT_PREFIX=!|BOT_PREFIX=$bot_prefix|" .env
fi

print_success "Configuration saved to .env"
echo ""

# Step 6: Build the project
print_section "Step 6️⃣: Building Project"

print_step "Building TypeScript..."
pnpm run build
print_success "Build completed"
echo ""

# Step 7: Summary
print_section "✅ Setup Complete!"

echo ""
echo -e "${GREEN}Your Luxray Discord Bot is ready to run!${NC}"
echo ""
echo -e "${CYAN}🚀 Next steps:${NC}"
echo -e "  ${BLUE}Development:${NC}   ${YELLOW}pnpm run dev${NC} or ${YELLOW}./scripts/start-dev.sh${NC}"
echo -e "  ${BLUE}Production:${NC}    ${YELLOW}pnpm run start${NC} or ${YELLOW}./scripts/start-prod.sh${NC}"
echo ""
echo -e "${CYAN}📚 Useful commands:${NC}"
echo -e "  ${BLUE}Lint code:${NC}     ${YELLOW}pnpm run lint${NC}"
echo -e "  ${BLUE}Format code:${NC}   ${YELLOW}pnpm run format${NC}"
echo -e "  ${BLUE}Check code:${NC}    ${YELLOW}pnpm run check${NC}"
echo ""
echo -e "${CYAN}📖 Documentation:${NC}"
echo -e "  • Commands:     ${YELLOW}src/commands/${NC}"
echo -e "  • Events:       ${YELLOW}src/events/${NC}"
echo -e "  • Configuration:${YELLOW}.env${NC}"
echo ""
