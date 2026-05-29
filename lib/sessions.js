import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', 'sessions', 'sessions.json');

async function load() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function save(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

export async function getSessionId(userId) {
  const all = await load();
  return all[String(userId)] || null;
}

export async function setSessionId(userId, sessionId) {
  const all = await load();
  if (sessionId) {
    all[String(userId)] = sessionId;
  } else {
    delete all[String(userId)];
  }
  await save(all);
}
