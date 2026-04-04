#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Luxray Bot Setup${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
echo ""

if [ -f .env ]; then
  echo -e "${YELLOW}⚠️  .env file already exists${NC}"
  read -p "Do you want to overwrite it? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Skipping .env creation${NC}"
    exit 0
  fi
fi

cp .env.example .env
echo -e "${GREEN}✓ Created .env file${NC}"
echo ""

echo -e "${BLUE}📝 Enter your Discord Bot Token:${NC}"
read -r DISCORD_TOKEN
if [ -z "$DISCORD_TOKEN" ]; then
  echo -e "${RED}✗ Discord Token is required${NC}"
  exit 1
fi

echo -e "${BLUE}📝 Enter your Application Client ID:${NC}"
read -r CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}✗ Client ID is required${NC}"
  exit 1
fi

echo -e "${BLUE}📝 Enter Guild ID for development (optional, press Enter to skip):${NC}"
read -r GUILD_ID

echo -e "${BLUE}📝 Enter Bot Prefix (optional, default: !, press Enter to skip):${NC}"
read -r BOT_PREFIX

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|your_bot_token_here|$DISCORD_TOKEN|" .env
  sed -i '' "s|your_application_client_id_here|$CLIENT_ID|" .env
else
  sed -i "s|your_bot_token_here|$DISCORD_TOKEN|" .env
  sed -i "s|your_application_client_id_here|$CLIENT_ID|" .env
fi

if [ -n "$GUILD_ID" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|# GUILD_ID=your_guild_id_here|GUILD_ID=$GUILD_ID|" .env
  else
    sed -i "s|# GUILD_ID=your_guild_id_here|GUILD_ID=$GUILD_ID|" .env
  fi
fi

if [ -n "$BOT_PREFIX" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|# BOT_PREFIX=!|BOT_PREFIX=$BOT_PREFIX|" .env
  else
    sed -i "s|# BOT_PREFIX=!|BOT_PREFIX=$BOT_PREFIX|" .env
  fi
fi

echo ""
echo -e "${GREEN}✓ .env file configured successfully!${NC}"
echo ""
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pnpm install

echo ""
echo -e "${GREEN}╔════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup Complete! ✓${NC}"
echo -e "${GREEN}╚════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  • Dev mode:  ${BLUE}pnpm run dev${NC}"
echo -e "  • Build:     ${BLUE}pnpm run build${NC}"
echo -e "  • Start:     ${BLUE}pnpm start${NC}"
echo -e "  • Lint:      ${BLUE}pnpm run lint${NC}"
echo -e "  • Format:    ${BLUE}pnpm run format${NC}"
echo ""
