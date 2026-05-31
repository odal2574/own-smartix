import 'dotenv/config';
import { Telegraf } from 'telegraf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askClaude, resetClaudeSession } from './lib/claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, 'workspace');
const INBOX = path.join(WORKSPACE, 'inbox');
fs.mkdirSync(INBOX, { recursive: true });

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
    '• Подключать скиллы (workspace/.claude/skills/)\n' +
    '• Отправлять файлы: HTML, PDF, презентации, картинки, видео\n' +
    '• Принимать твои фото и документы\n\n' +
    'Команды:\n' +
    '/start — приветствие\n' +
    '/help — это сообщение\n' +
    '/reset — новая сессия (память останется)\n\n' +
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

const MEDIA_TAG_RE = /\[(ФАЙЛ|ФОТО|ВИДЕО|АУДИО|GIF)\s*:\s*([^\]\n]+?)\]/g;

function extractMediaTags(text) {
  const items = [];
  const cleaned = text.replace(MEDIA_TAG_RE, (_, kind, body) => {
    const trimmed = body.trim();
    const spaceIdx = trimmed.search(/\s/);
    const filePath = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const caption = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
    items.push({ kind, path: filePath, caption });
    return '';
  });
  return { cleanText: cleaned.trim(), items };
}

function resolveMediaPath(p) {
  if (p.startsWith('~/')) return path.join(process.env.HOME || '/root', p.slice(2));
  if (p.startsWith('/')) return p;
  return path.resolve(WORKSPACE, p);
}

async function sendMediaItem(ctx, item) {
  const abs = resolveMediaPath(item.path);
  if (!fs.existsSync(abs)) {
    await ctx.reply(`Не нашёл файл: ${item.path}`);
    return;
  }
  const source = { source: abs };
  const extra = item.caption ? { caption: item.caption } : {};
  switch (item.kind) {
    case 'ФОТО':
      await ctx.replyWithPhoto(source, extra);
      break;
    case 'ВИДЕО':
      await ctx.replyWithVideo(source, extra);
      break;
    case 'АУДИО':
      await ctx.replyWithAudio(source, extra);
      break;
    case 'GIF':
      await ctx.replyWithAnimation(source, extra);
      break;
    case 'ФАЙЛ':
    default:
      await ctx.replyWithDocument(source, extra);
  }
}

async function downloadTelegramFile(ctx, fileId, suggestedName) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safe = (suggestedName || `file_${ts}`).replace(/[^\w.\-]/g, '_');
  const finalPath = path.join(INBOX, `${ts}_${safe}`);
  fs.writeFileSync(finalPath, buf);
  return finalPath;
}

async function runClaudeAndReply(ctx, prompt) {
  const userId = ctx.from.id;
  await ctx.replyWithChatAction('typing');
  const typingInterval = setInterval(
    () => ctx.replyWithChatAction('typing').catch(() => {}),
    4000
  );
  try {
    const answer = await askClaude(userId, prompt);
    const { cleanText, items } = extractMediaTags(answer);
    if (cleanText) {
      for (const chunk of splitForTelegram(cleanText)) {
        await ctx.reply(chunk);
      }
    }
    for (const item of items) {
      try {
        await sendMediaItem(ctx, item);
      } catch (e) {
        console.error('[media]', item, e.message);
        await ctx.reply(`Не смог отправить ${item.kind}: ${e.message}`);
      }
    }
  } catch (err) {
    console.error('[error]', err);
    await ctx.reply(`Ошибка: ${err.message}`);
  } finally {
    clearInterval(typingInterval);
  }
}

bot.on('photo', async (ctx) => {
  try {
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const filePath = await downloadTelegramFile(ctx, largest.file_id, `photo_${largest.file_unique_id}.jpg`);
    const caption = ctx.message.caption || '';
    const prompt = caption
      ? `Клиент прислал фото. Путь: ${filePath}\nПодпись: ${caption}`
      : `Клиент прислал фото. Путь: ${filePath}\nПосмотри что на нём и ответь.`;
    await runClaudeAndReply(ctx, prompt);
  } catch (err) {
    console.error('[photo]', err);
    await ctx.reply(`Не смог принять фото: ${err.message}`);
  }
});

bot.on('document', async (ctx) => {
  try {
    const doc = ctx.message.document;
    const filePath = await downloadTelegramFile(ctx, doc.file_id, doc.file_name);
    const caption = ctx.message.caption || '';
    const prompt = caption
      ? `Клиент прислал документ. Путь: ${filePath}\nИмя: ${doc.file_name}\nПодпись: ${caption}`
      : `Клиент прислал документ. Путь: ${filePath}\nИмя: ${doc.file_name}\nПосмотри и ответь.`;
    await runClaudeAndReply(ctx, prompt);
  } catch (err) {
    console.error('[document]', err);
    await ctx.reply(`Не смог принять документ: ${err.message}`);
  }
});

bot.on('text', async (ctx) => {
  await runClaudeAndReply(ctx, ctx.message.text);
});

bot.catch((err) => console.error('[telegraf]', err));

bot.launch().then(async () => {
  console.log(`[smartix] started, owner=${OWNER ?? 'any'}, model=${process.env.CLAUDE_MODEL || 'default'}`);
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Приветствие' },
      { command: 'help', description: 'Что я умею' },
      { command: 'reset', description: 'Новая сессия (память останется)' },
    ]);
  } catch (e) {
    console.error('[setMyCommands]', e.message);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
