# Own Smartix

Личный AI-ассистент в Telegram на Claude. Файловая память, скиллы, один скрипт установки. Работает на твоей MAX подписке через Claude Agent SDK — без API ключей и счетов за токены.

## Что внутри

```
own-smartix/
├── bot.js                  # Главный файл бота (Telegraf)
├── lib/
│   ├── claude.js           # Обёртка над Claude Agent SDK
│   └── sessions.js         # sessionId per Telegram user
├── workspace/
│   ├── CLAUDE.md           # Правила поведения (system prompt)
│   ├── MEMORY.md           # Долгосрочная память (пустой шаблон)
│   ├── memory/             # Дневники YYYY-MM-DD.md
│   ├── knowledge/          # База знаний
│   └── .claude/skills/     # 8 скиллов: content-writer, code-review,
│                           #            competitor-research, discovery-interview,
│                           #            frontend-design, fullstack-developer,
│                           #            instagram-stories, youtube-scenario
├── install.sh              # Установщик (Node + Claude Code CLI + systemd)
├── smartix.service         # systemd unit
└── .env.example            # Шаблон переменных
```

## Что нужно заранее

1. <b>VPS Ubuntu 24.04</b> — Hetzner CX22 (~€4.5/мес), Timeweb (~500₽/мес), Beget — что угодно
2. <b>Telegram-бот</b> — @BotFather → <code>/newbot</code> → сохрани токен
3. <b>Claude MAX подписка</b> — claude.ai/upgrade ($100/мес). Этого достаточно: SDK работает через подписку, отдельно платить за API не надо
4. Свой Telegram ID — узнай у [@userinfobot](https://t.me/userinfobot)

## Установка (1 вечер, ~20 минут)

### 1. Залить файлы на VPS

Распакуй архив или клонируй репо в любую папку, например /tmp/own-smartix.

### 2. Запустить установщик

```bash
sudo bash /tmp/own-smartix/install.sh
```

Скрипт спросит TELEGRAM_BOT_TOKEN и OWNER_TELEGRAM_ID, поставит Node, Claude Code CLI, скопирует проект в /opt/smartix и зарегистрирует systemd.

### 3. Авторизоваться под MAX

После завершения скрипт подскажет команду. Запусти её:

```bash
sudo -u smartix -H claude login
```

Откроется ссылка — открой в браузере, авторизуйся под своим MAX-аккаунтом, скопируй код обратно в терминал. Токен сохранится в /home/smartix/.claude/.

### 4. Запустить бота

```bash
systemctl start smartix
systemctl status smartix
```

Иди в Telegram, напиши боту /start.

## Управление

```bash
systemctl status smartix          # Статус
systemctl restart smartix         # Перезапустить
systemctl stop smartix            # Остановить
journalctl -u smartix -f          # Логи в реальном времени
```

## Что бот умеет из коробки

- Отвечает на любые сообщения через Claude
- Помнит диалог между сообщениями (resume по sessionId)
- Запоминает постоянные факты в workspace/MEMORY.md
- Ведёт дневник в workspace/memory/YYYY-MM-DD.md
- Сохраняет решения в workspace/knowledge/
- Видит и применяет 8 скиллов из workspace/.claude/skills/

Скажи «запомни что я люблю кофе с молоком» — допишет в MEMORY.md. Скажи «сохрани решение по деплою в knowledge» — создаст файл.

## Команды бота

- /start — приветствие
- /help — что умеет
- /reset — начать новую сессию (память не теряется)

## Архитектура

Бот = тонкий слой между Telegram и Claude Agent SDK. SDK сам запускает Claude Code локально под твоей MAX подпиской. Вся «душа» — в workspace/. Можешь бэкапить, переносить, клонировать workspace/ куда угодно — это и есть личность ассистента.

## Безопасность

- OWNER_TELEGRAM_ID в .env — только этот ID может писать боту. Пусто = любой
- .env имеет права 600, доступ только пользователю smartix
- ~/.claude/ под пользователем smartix содержит токен подписки — не публикуй

## Бэкапы

Храни workspace/ в приватном git-репозитории. Cron на ежедневный push:

```bash
0 3 * * * cd /opt/smartix/workspace && git add -A && git commit -m "auto $(date +\%F)" && git push
```

## Стоимость работы

- VPS: ~€5/мес
- Claude MAX: $100/мес (твоя личная подписка, через неё работает SDK)
- Telegram: 0₽

Никаких отдельных счетов за токены — лимиты подписки расходуются как обычно.

## Расширение

- Голос: <code>npm i @deepgram/sdk</code>, ключ DEEPGRAM_API_KEY, обработчик <code>bot.on('voice', ...)</code>
- Картинки: ключ GEMINI_API_KEY (Nano Banana) или FAL_API_KEY (Flux/Recraft)
- Веб-поиск: уже встроен в Claude Agent SDK (tools WebSearch / WebFetch)

## Лицензия

Делай с этим что хочешь. Использовать, форкать, продавать — твоё.
