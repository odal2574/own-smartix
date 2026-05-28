import Anthropic from '@anthropic-ai/sdk';
import { appendDailyNote, updateMemory, saveKnowledge, buildSystemContext, listSkills } from './memory.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const TOOLS = [
  {
    name: 'save_note',
    description: 'Сохранить заметку в дневник сегодняшнего дня. Используй когда важно запомнить событие, решение или прогресс.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Текст заметки (1-5 предложений).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'update_memory',
    description: 'Дописать постоянный факт в MEMORY.md. Используй для долгосрочных фактов о пользователе, предпочтениях, проектах.',
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Короткий факт (одна строка).' },
      },
      required: ['fact'],
    },
  },
  {
    name: 'save_knowledge',
    description: 'Создать файл в базе знаний (workspace/knowledge/). Используй для решений, инструкций, конфигов, контактов.',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Имя файла, kebab-case, расширение .md.' },
        content: { type: 'string', description: 'Содержимое markdown.' },
      },
      required: ['filename', 'content'],
    },
  },
];

async function runTool(name, input) {
  try {
    switch (name) {
      case 'save_note':
        await appendDailyNote(input.text);
        return { ok: true, saved: 'daily' };
      case 'update_memory':
        await updateMemory(`- ${input.fact}`);
        return { ok: true, saved: 'MEMORY.md' };
      case 'save_knowledge':
        await saveKnowledge(input.filename, input.content);
        return { ok: true, saved: `knowledge/${input.filename}` };
      default:
        return { ok: false, error: `unknown tool ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function buildSystem() {
  const ctx = await buildSystemContext();
  const skills = await listSkills();
  const skillsBlock = skills.length
    ? `\n\n# Доступные скиллы\n${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}\n\nЕсли задача попадает под скилл — следуй его инструкциям из workspace/.claude/skills/<name>/SKILL.md.`
    : '';
  return ctx + skillsBlock;
}

export async function askClaude(history) {
  const system = await buildSystem();
  let messages = [...history];

  for (let round = 0; round < 5; round++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      tools: TOOLS,
      messages,
    });

    const toolUses = res.content.filter(b => b.type === 'tool_use');
    const textBlocks = res.content.filter(b => b.type === 'text').map(b => b.text);

    if (toolUses.length === 0 || res.stop_reason === 'end_turn') {
      return textBlocks.join('\n').trim() || '(пустой ответ)';
    }

    messages.push({ role: 'assistant', content: res.content });
    messages.push({
      role: 'user',
      content: await Promise.all(toolUses.map(async tu => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(await runTool(tu.name, tu.input)),
      }))),
    });
  }

  return '(превышен лимит инструментов за один ход)';
}
