import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { askClaude, resetClaudeSession } from './lib/claude.js';

const { TELEGRAM_BOT_TOKEN, OWNER_TELEGRAM_ID } = process.env;

if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не задан в .env');

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const OWNER = OWNER_TELEGRAM_ID ? Number(OWNER_TELEGRAM_ID) : null;

function isAllowed(ctx) {
  if (!OWNER) return true;
  return ctx.from?.id === OWNER;
}

bot.use(async (ctx, next) => {
  if (!isAllowed(ctx)) {
    console.log(`[denied] from ${ctx.from?.id} (@${ctx.from?.username})`);
    return;
  }
  return next();
});

bot.start((ctx) => {
  ctx.reply(
    'Привет. Я твой персональный ассистент на Claude.\n\n' +
    'Просто пиши задачу, идею, вопрос — отвечу и запомню что важно.\n\n' +
    'Команды:\n' +
    '/help — что я умею\n' +
    '/reset — начать новую сессию (память останется)'
  );
});

bot.help((ctx) => {
  ctx.reply(
    'Что я умею:\n' +
    '• Отвечать на вопросы, помогать с задачами\n' +
    '• Запоминать факты (workspace/MEMORY.md)\n' +
    '• Вести дневник (workspace/memory/YYYY-MM-DD.md)\n' +
    '• Сохранять решения в базу знаний (workspace/knowledge/)\n' +
    '• Подключать скиллы (workspace/.claude/skills/)\n\n' +
    'Скажи «запомни это» — сохраню в MEMORY.md.\n' +
    'Скажи «сохрани в заметки» — добавлю в дневник.'
  );
});

bot.command('reset', async (ctx) => {
  await resetClaudeSession(ctx.from.id);
  ctx.reply('Новая сессия начата. Долгосрочная память (MEMORY.md, knowledge/) сохранена.');
});

const splitForTelegram = (text, limit = 4000) => {
  const chunks = [];
  let cur = text;
  while (cur.length > limit) {
    let cut = cur.lastIndexOf('\n', limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(cur.slice(0, cut));
    cur = cur.slice(cut).trimStart();
  }
  if (cur) chunks.push(cur);
  return chunks;
};

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  await ctx.replyWithChatAction('typing');
  const typingInterval = setInterval(
    () => ctx.replyWithChatAction('typing').catch(() => {}),
    4000
  );

  try {
    const answer = await askClaude(userId, text);
    for (const chunk of splitForTelegram(answer)) {
      await ctx.reply(chunk);
    }
  } catch (err) {
    console.error('[error]', err);
    await ctx.reply(`Ошибка: ${err.message}`);
  } finally {
    clearInterval(typingInterval);
  }
});

bot.catch((err) => console.error('[telegraf]', err));

bot.launch().then(() => {
  console.log(`[smartix] started, owner=${OWNER ?? 'any'}, model=${process.env.CLAUDE_MODEL || 'default'}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
