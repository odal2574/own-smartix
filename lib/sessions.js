import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'sessions');

const MAX_MESSAGES = 40;

async function load(userId) {
  const file = path.join(DIR, `${userId}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { userId, messages: [] };
  }
}

async function save(session) {
  await fs.mkdir(DIR, { recursive: true });
  const file = path.join(DIR, `${session.userId}.json`);
  await fs.writeFile(file, JSON.stringify(session, null, 2));
}

export async function getHistory(userId, limit = 20) {
  const session = await load(userId);
  return session.messages
    .slice(-limit)
    .map(({ role, content }) => ({ role, content }));
}

export async function appendMessage(userId, role, content) {
  const session = await load(userId);
  session.messages.push({ role, content, ts: new Date().toISOString() });

  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  await save(session);
}

export async function resetHistory(userId) {
  const file = path.join(DIR, `${userId}.json`);
  try { await fs.unlink(file); } catch {}
}
