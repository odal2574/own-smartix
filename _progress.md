# Прогресс переделки own-smartix под Claude Agent SDK

Цель: убрать @anthropic-ai/sdk + ANTHROPIC_API_KEY. Использовать @anthropic-ai/claude-agent-sdk + claude login (MAX подписка).

## Шаги

- [x] Изучен Claude Agent SDK (TypeScript)
- [ ] package.json — заменить sdk
- [ ] lib/claude.js — переписать через query()
- [ ] lib/sessions.js — на sessionId mapping
- [ ] lib/memory.js — удалить (SDK сам через Read/Write/Edit + CLAUDE.md)
- [ ] bot.js — убрать ANTHROPIC_API_KEY
- [ ] workspace/CLAUDE.md — без упоминания tools
- [ ] install.sh — добавить установку claude code + claude login
- [ ] README.md — обновить
- [ ] build-own-smartix.html — без API ключа
- [ ] Пересобрать архив

## Архитектурные решения

- cwd для SDK = workspace/ (там CLAUDE.md, .claude/skills/, MEMORY.md, memory/, knowledge/)
- Кастомные tools не нужны — встроенные Read/Write/Edit пишут в workspace
- Сессии через resume sessionId, хранение в sessions/sessions.json
- Авторизация: claude login на VPS (MAX подписка), SDK подхватывает токены
