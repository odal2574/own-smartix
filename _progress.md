# Прогресс сборки own-smartix

Старт: 2026-05-28 (ночь)
Цель: рабочий шаблон личного Смартикса с install-скриптом для VPS.
Александр сам разворачивает на своём сервере за один вечер ~1.5 часа.

## Сделано
- [x] Структура папок (lib/, workspace/{memory,knowledge,.claude/skills/}, sessions/)
- [x] package.json (anthropic 0.100, telegraf 4.16, dotenv)
- [x] .env.example
- [x] .gitignore

## В работе
- [ ] lib/memory.js
- [ ] lib/sessions.js
- [ ] lib/claude.js
- [ ] bot.js
- [ ] workspace/CLAUDE.md + MEMORY.md
- [ ] 3 базовых скилла
- [ ] install.sh
- [ ] smartix.service
- [ ] README.md
- [ ] Локальный smoke-тест
