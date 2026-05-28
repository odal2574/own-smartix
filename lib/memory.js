import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WS = path.resolve(__dirname, '..', 'workspace');

const today = () => new Date().toISOString().slice(0, 10);

async function readIfExists(p) {
  try { return await fs.readFile(p, 'utf8'); }
  catch { return ''; }
}

async function listRecentDailies(limit = 3) {
  try {
    const files = await fs.readdir(path.join(WS, 'memory'));
    return files
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .slice(-limit);
  } catch { return []; }
}

export async function buildSystemContext() {
  const rules = await readIfExists(path.join(WS, 'CLAUDE.md'));
  const memory = await readIfExists(path.join(WS, 'MEMORY.md'));

  const dailies = await listRecentDailies(3);
  let recent = '';
  for (const f of dailies) {
    const content = await readIfExists(path.join(WS, 'memory', f));
    if (content.trim()) recent += `\n\n## ${f}\n${content}`;
  }

  return [
    rules && `# Правила (CLAUDE.md)\n${rules}`,
    memory && `# Память (MEMORY.md)\n${memory}`,
    recent && `# Последние дни\n${recent}`,
    `# Сегодня\n${today()}`,
  ].filter(Boolean).join('\n\n---\n\n');
}

export async function appendDailyNote(text) {
  const file = path.join(WS, 'memory', `${today()}.md`);
  const exists = await readIfExists(file);
  const header = exists ? '' : `# Дневник ${today()}\n\n`;
  const ts = new Date().toTimeString().slice(0, 5);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${header}## ${ts}\n${text}\n\n`);
}

export async function updateMemory(text) {
  const file = path.join(WS, 'MEMORY.md');
  await fs.appendFile(file, `\n${text}\n`);
}

export async function saveKnowledge(filename, content) {
  if (!/^[a-z0-9\-_]+\.md$/i.test(filename)) {
    throw new Error('filename должен быть kebab-case .md');
  }
  const file = path.join(WS, 'knowledge', filename);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

export async function readKnowledge(filename) {
  return readIfExists(path.join(WS, 'knowledge', filename));
}

export async function listSkills() {
  try {
    const dir = path.join(WS, '.claude', 'skills');
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const skills = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillFile = path.join(dir, e.name, 'SKILL.md');
      const content = await readIfExists(skillFile);
      if (content) {
        const firstLine = content.split('\n').find(l => l.trim()) || e.name;
        skills.push({ name: e.name, description: firstLine.replace(/^#+\s*/, '') });
      }
    }
    return skills;
  } catch { return []; }
}
