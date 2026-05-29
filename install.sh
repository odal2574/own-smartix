#!/usr/bin/env bash
# Own-Smartix installer (Claude Agent SDK + MAX подписка)
# Usage: sudo bash install.sh
#   или: TELEGRAM_BOT_TOKEN=... OWNER_TELEGRAM_ID=... sudo -E bash install.sh
#
# Что делает:
#   1) Ставит Node.js LTS и зависимости
#   2) Создаёт пользователя smartix
#   3) Копирует проект в /opt/smartix
#   4) Ставит Claude Code CLI глобально (для команды `claude login`)
#   5) Спрашивает Telegram токен и Owner ID, создаёт .env
#   6) Регистрирует systemd-сервис
#   7) Подсказывает финальный шаг: `sudo -u smartix claude login` под MAX подпиской

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
apt-get install -y curl ca-certificates git rsync >/dev/null

echo "==> Шаг 2: Node.js LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
echo "    node $(node -v)"

echo "==> Шаг 3: Claude Code CLI (для claude login)"
if ! command -v claude >/dev/null 2>&1; then
  npm install -g @anthropic-ai/claude-code >/dev/null 2>&1
fi
echo "    claude $(claude --version 2>/dev/null || echo 'установлен')"

echo "==> Шаг 4: пользователь $USER_NAME"
if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "$USER_NAME"
fi

echo "==> Шаг 5: копирование в $TARGET"
mkdir -p "$TARGET"
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude sessions \
  --exclude _progress.md \
  "$SRC_DIR/" "$TARGET/"

mkdir -p "$TARGET/sessions"
chown -R "$USER_NAME:$USER_NAME" "$TARGET"

echo "==> Шаг 6: .env"
ENV_FILE="$TARGET/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "    .env уже существует — оставляю как есть"
else
  TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
  OWNER_TELEGRAM_ID="${OWNER_TELEGRAM_ID:-}"
  CLAUDE_MODEL="${CLAUDE_MODEL:-}"

  if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
    read -rp "TELEGRAM_BOT_TOKEN (от @BotFather): " TELEGRAM_BOT_TOKEN
  fi
  if [[ -z "$OWNER_TELEGRAM_ID" ]]; then
    read -rp "OWNER_TELEGRAM_ID (твой Telegram ID, узнать у @userinfobot): " OWNER_TELEGRAM_ID
  fi

  cat > "$ENV_FILE" <<EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
OWNER_TELEGRAM_ID=$OWNER_TELEGRAM_ID
CLAUDE_MODEL=$CLAUDE_MODEL
EOF
  chmod 600 "$ENV_FILE"
  chown "$USER_NAME:$USER_NAME" "$ENV_FILE"
fi

echo "==> Шаг 7: npm install"
sudo -u "$USER_NAME" bash -lc "cd $TARGET && npm install --omit=dev --silent"

echo "==> Шаг 8: systemd"
cp "$TARGET/smartix.service" /etc/systemd/system/smartix.service
touch /var/log/smartix.log
chown "$USER_NAME:$USER_NAME" /var/log/smartix.log
systemctl daemon-reload
systemctl enable smartix >/dev/null 2>&1

echo
echo "============================================================"
echo "  Установка завершена. Остался ОДИН шаг — авторизация Claude"
echo "============================================================"
echo
echo "  Войди под своей MAX подпиской:"
echo
echo "    sudo -u $USER_NAME -H claude login"
echo
echo "  Откроется ссылка — открой в браузере, авторизуйся, вернись"
echo "  и вставь код. Токен сохранится в /home/$USER_NAME/.claude/."
echo
echo "  После этого запусти бота:"
echo
echo "    systemctl start smartix"
echo "    systemctl status smartix"
echo
echo "  Логи:  journalctl -u smartix -f"
echo "============================================================"
