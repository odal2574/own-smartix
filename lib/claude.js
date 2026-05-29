import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { getSessionId, setSessionId } from './sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..', 'workspace');
const MODEL = process.env.CLAUDE_MODEL || undefined;

const ALLOWED_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];

export async function askClaude(userId, userText) {
  const prevSession = await getSessionId(userId);

  const options = {
    cwd: WORKSPACE,
    allowedTools: ALLOWED_TOOLS,
    permissionMode: 'acceptEdits',
    settingSources: ['project', 'user'],
  };
  if (prevSession) options.resume = prevSession;
  if (MODEL) options.model = MODEL;

  let answer = '';
  let newSessionId = prevSession;
  let lastError = null;

  for await (const message of query({ prompt: userText, options })) {
    if (message.type === 'system' && message.subtype === 'init') {
      newSessionId = message.session_id;
    }
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        answer = message.result || '';
      } else {
        lastError = message.subtype || 'unknown';
      }
    }
  }

  if (newSessionId && newSessionId !== prevSession) {
    await setSessionId(userId, newSessionId);
  }

  if (!answer && lastError) throw new Error(`Claude вернул ${lastError}`);
  return answer.trim() || '(пустой ответ)';
}

export async function resetClaudeSession(userId) {
  await setSessionId(userId, null);
}
