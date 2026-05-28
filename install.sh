#!/usr/bin/env bash
# Own-Smartix installer
# Usage: sudo bash install.sh
#   или: TELEGRAM_BOT_TOKEN=... ANTHROPIC_API_KEY=... OWNER_TELEGRAM_ID=... sudo -E bash install.sh
#
# Что делает:
#   1) Ставит Node.js LTS и зависимости
#   2) Создаёт пользователя smartix
#   3) Копирует проект в /opt/smartix
#   4) Спрашивает токены (если не заданы через env) и создаёт .env
#   5) Регистрирует systemd-сервис и запускает бота

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Запусти от root: sudo bash install.sh"
  exit 1
fi

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET=/opt/smartix
USER_NAME=smartix

echo "==> Шаг 1: системные пакеты"
apt-get update -qq
apt-get install -y curl ca-certificates git >/dev/null

echo "==> Шаг 2: Node.js LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
echo "    node $(node -v)"

echo "==> Шаг 3: пользователь $USER_NAME"
if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$USER_NAME"
fi

echo "==> Шаг 4: копирование в $TARGET"
mkdir -p "$TARGET"
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude sessions \
  "$SRC_DIR/" "$TARGET/"

mkdir -p "$TARGET/sessions"
chown -R "$USER_NAME:$USER_NAME" "$TARGET"

echo "==> Шаг 5: .env"
ENV_FILE="$TARGET/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "    .env уже существует — оставляю как есть"
else
  TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
  OWNER_TELEGRAM_ID="${OWNER_TELEGRAM_ID:-}"
  CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"

  if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
    read -rp "TELEGRAM_BOT_TOKEN (от @BotFather): " TELEGRAM_BOT_TOKEN
  fi
  if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    read -rp "ANTHROPIC_API_KEY (с console.anthropic.com): " ANTHROPIC_API_KEY
  fi
  if [[ -z "$OWNER_TELEGRAM_ID" ]]; then
    read -rp "OWNER_TELEGRAM_ID (твой Telegram ID, узнать у @userinfobot): " OWNER_TELEGRAM_ID
  fi

  cat > "$ENV_FILE" <<EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
OWNER_TELEGRAM_ID=$OWNER_TELEGRAM_ID
CLAUDE_MODEL=$CLAUDE_MODEL
EOF
  chmod 600 "$ENV_FILE"
  chown "$USER_NAME:$USER_NAME" "$ENV_FILE"
fi

echo "==> Шаг 6: npm install"
sudo -u "$USER_NAME" bash -lc "cd $TARGET && npm install --omit=dev --silent"

echo "==> Шаг 7: systemd"
cp "$TARGET/smartix.service" /etc/systemd/system/smartix.service
touch /var/log/smartix.log
chown "$USER_NAME:$USER_NAME" /var/log/smartix.log
systemctl daemon-reload
systemctl enable smartix >/dev/null 2>&1
systemctl restart smartix

sleep 2
echo
echo "==> Готово"
systemctl --no-pager --lines=5 status smartix || true
echo
echo "Логи:  journalctl -u smartix -f"
echo "Файл:  tail -f /var/log/smartix.log"
echo
echo "Теперь напиши боту в Telegram /start"
