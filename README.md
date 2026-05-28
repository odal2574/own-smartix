# Own Smartix

Личный AI-ассистент в Telegram на Claude. Файловая память + скиллы + один скрипт установки.

## Что внутри

```
own-smartix/
├── bot.js                  # Главный файл бота (Telegraf + Claude)
├── lib/
│   ├── claude.js           # Обёртка над Anthropic SDK + 3 tool
│   ├── memory.js           # MEMORY.md, дневники, knowledge, скиллы
│   └── sessions.js         # История диалога по userId
├── workspace/
│   ├── CLAUDE.md           # Правила поведения
│   ├── MEMORY.md           # Долгосрочная память (пустой шаблон)
│   ├── memory/             # Дневники YYYY-MM-DD.md
│   ├── knowledge/          # База знаний
│   └── .claude/skills/     # 8 скиллов: content-writer, code-review,
│                           #            competitor-research, discovery-interview,
│                           #            frontend-design, fullstack-developer,
│                           #            instagram-stories, youtube-scenario
├── install.sh              # Установщик (Node + systemd одной командой)
├── smartix.service         # systemd unit
└── .env.example            # Шаблон переменных
```

## Что купить заранее

1. **VPS Ubuntu 24.04** — Hetzner CX22 (€4.51/мес) или Timeweb Cloud (~500₽/мес)
2. **Telegram-бот** — @BotFather → `/newbot` → сохрани токен
3. **Anthropic API** — console.anthropic.com → Billing → пополни на $20 → API Keys → создай ключ

Дополнительно: узнай свой Telegram ID у [@userinfobot](https://t.me/userinfobot) — только ты сможешь писать боту.

## Установка (1 вечер, ~30 минут)

### Вариант 1 — интерактивный

На VPS под root:

```bash
git clone <URL_РЕПО> /tmp/own-smartix
cd /tmp/own-smartix
sudo bash install.sh
```

Скрипт сам спросит токены и запустит бота.

### Вариант 2 — одной строкой

Если хочешь без интерактива (например в скрипте):

```bash
TELEGRAM_BOT_TOKEN=123:abc \
ANTHROPIC_API_KEY=sk-ant-... \
OWNER_TELEGRAM_ID=123456 \
sudo -E bash install.sh
```

### Что делает install.sh

1. `apt update` + ставит Node.js LTS
2. Создаёт системного пользователя `smartix`
3. Копирует проект в `/opt/smartix`
4. Спрашивает токены (или берёт из env) и пишет `.env`
5. `npm install`
6. Регистрирует и запускает systemd-сервис

После завершения — иди в Telegram, напиши боту `/start`.

## Управление

```bash
systemctl status smartix          # Статус
systemctl restart smartix         # Перезапустить
systemctl stop smartix            # Остановить
journalctl -u smartix -f          # Логи в реальном времени
tail -f /var/log/smartix.log      # Логи через файл
```

## Что бот умеет из коробки

- Отвечает на любые сообщения через Claude (модель в `.env`, по умолчанию sonnet)
- Помнит контекст до 40 последних сообщений (`sessions/USER_ID.json`)
- Запоминает постоянные факты в `workspace/MEMORY.md`
- Ведёт дневник в `workspace/memory/YYYY-MM-DD.md`
- Сохраняет решения в `workspace/knowledge/`
- Видит и применяет 8 скиллов из `workspace/.claude/skills/`

## Tool calling

В `lib/claude.js` подключены 3 инструмента, которые бот может вызывать сам:

- `save_note(text)` — добавить заметку в дневник
- `update_memory(fact)` — дописать факт в MEMORY.md
- `save_knowledge(filename, content)` — создать файл в knowledge/

Скажи боту «запомни что я люблю кофе с молоком» — он позовёт `update_memory`. Скажи «сохрани решение по деплою в knowledge» — вызовет `save_knowledge`.

## Команды бота

- `/start` — приветствие
- `/help` — что умеет
- `/reset` — забыть текущий диалог (память не теряется)

## Безопасность

- `OWNER_TELEGRAM_ID` в `.env` — только этот ID может писать боту. Если оставить пустым — бот ответит любому
- `.env` имеет права 600, доступ только пользователю smartix
- Сессии в `sessions/` в `.gitignore` (если решишь подключить git)

## Бэкапы

Рекомендую хранить `workspace/` в приватном git-репозитории. Cron-задача на ежедневный push:

```bash
0 3 * * * cd /opt/smartix/workspace && git add -A && git commit -m "auto $(date +\%F)" && git push
```

## Стоимость работы

- VPS: ~€5/мес
- Anthropic API: $30-100/мес при активном использовании одним человеком (sonnet)
- Telegram: 0₽

## Расширение

Если хочешь голосовые, картинки, веб-поиск:
- Голос: `npm i @deepgram/sdk`, ключ `DEEPGRAM_API_KEY`, обработчик `bot.on('voice', ...)`
- Картинки: ключ `GEMINI_API_KEY` (Nano Banana) или `FAL_API_KEY` (Flux/Recraft)
- Веб: добавь tool `web_search` через библиотеку или прокинь Tavily/Perplexity

## Архитектура

Бот = тонкий слой между Telegram и Claude. Вся «душа» — в `workspace/`. Можешь бэкапить, переносить, клонировать `workspace/` куда угодно — это и есть личность ассистента.

## Лицензия

Делай с этим что хочешь. Использовать, форкать, продавать — твоё.
