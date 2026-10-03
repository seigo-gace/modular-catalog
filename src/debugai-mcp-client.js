import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { CatalogError } from './catalog.js';

const REQUIRED_TOOLS = new Set(['debugai_analyze', 'debugai_verify']);

function inheritedEnv(extra = {}) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string')),
    ...extra
  };
}

function parseArgs(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error('string array required');
    return parsed;
  } catch (error) {
    throw new CatalogError(`MODULECATALOG_DEBUGAI_MCP_ARGS_JSON is invalid: ${error.message}`, 'DEBUGAI_MCP_NOT_CONFIGURED');
  }
}

function parseToolPayload(result, expectedTool) {
  if (result?.isError === true) {
    const text = result?.content?.find?.((block) => block?.type === 'text')?.text ?? '';
    throw new CatalogError(`DebugAI MCP tool failed: ${text || expectedTool}`, 'DEBUGAI_FAILED');
  }
  const text = result?.content?.find?.((block) => block?.type === 'text')?.text;
  if (typeof text !== 'string' || !text.trim()) throw new CatalogError('DebugAI MCP returned no JSON text result.', 'DEBUGAI_INVALID_RESPONSE');
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new CatalogError('DebugAI MCP returned invalid JSON text.', 'DEBUGAI_INVALID_RESPONSE');
  }
  if (payload?.schema !== 'debugai.mcp-result/v1' || payload?.tool !== expectedTool) {
    throw new CatalogError('DebugAI MCP response contract mismatch.', 'DEBUGAI_INVALID_RESPONSE');
  }
  return payload;
}

export function mapDebugDecisionToMcp(decision) {
  if (!decision || typeof decision !== 'object') throw new CatalogError('Debug decision is required.', 'DEBUG_CONTROLLER_INVALID_OUTPUT');
  if (decision.action === 'SKIP') return null;
  if (decision.action === 'ANALYZE') {
    if (!decision.request || !decision.repo) throw new CatalogError('ANALYZE requires request and repo.', 'DEBUG_CONTROLLER_INVALID_OUTPUT');
    return Object.freeze({
      name: 'debugai_analyze',
      arguments: { request: decision.request, repo: decision.repo }
    });
  }
  if (decision.action === 'VERIFY') {
    if (!decision.repo) throw new CatalogError('VERIFY requires repo.', 'DEBUG_CONTROLLER_INVALID_OUTPUT');
    return Object.freeze({
      name: 'debugai_verify',
      arguments: {
        repo: decision.repo,
        ...(decision.paths?.length ? { paths: decision.paths } : {}),
        ...(decision.change_scope?.length ? { change_scope: decision.change_scope } : {}),
        ...(decision.task ? { task: decision.task } : {})
      }
    });
  }
  throw new CatalogError(`Unsupported Debug Controller action: ${decision.action}`, 'DEBUG_CONTROLLER_INVALID_OUTPUT');
}

export async function executeDebugDecision(decision, callTool) {
  const mapped = mapDebugDecisionToMcp(decision);
  if (!mapped) return Object.freeze({ status: 'SKIPPED', tool: null, result: null });
  if (typeof callTool !== 'function') throw new CatalogError('DebugAI MCP caller is not configured.', 'DEBUGAI_MCP_NOT_CONFIGURED');
  const payload = parseToolPayload(await callTool(mapped), mapped.name);
  return Object.freeze({ status: 'COMPLETED', tool: mapped.name, result: payload.result, exit_code: payload.exit_code });
}

export async function createDebugAiMcpClient({
  command = process.env.MODULECATALOG_DEBUGAI_MCP_COMMAND,
  args = parseArgs(process.env.MODULECATALOG_DEBUGAI_MCP_ARGS_JSON),
  cwd = process.env.MODULECATALOG_DEBUGAI_MCP_CWD,
  env = {},
  clientName = 'modulecatalog-debug-controller',
  clientVersion = '1.0.0'
} = {}) {
  if (!command) throw new CatalogError('MODULECATALOG_DEBUGAI_MCP_COMMAND is required.', 'DEBUGAI_MCP_NOT_CONFIGURED');
  if (!cwd) throw new CatalogError('MODULECATALOG_DEBUGAI_MCP_CWD is required.', 'DEBUGAI_MCP_NOT_CONFIGURED');

  const client = new Client({ name: clientName, version: clientVersion });
  const transport = new StdioClientTransport({ command, args, cwd, env: inheritedEnv(env) });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const names = new Set((listed?.tools ?? []).map((tool) => tool.name));
    for (const required of REQUIRED_TOOLS) {
      if (!names.has(required)) throw new CatalogError(`DebugAI MCP required tool is unavailable: ${required}`, 'DEBUGAI_MCP_CONTRACT_MISMATCH');
    }
    if ([...names].some((name) => /approve|apply/i.test(name))) {
      throw new CatalogError('DebugAI MCP unexpectedly exposes an approve/apply mutation tool.', 'DEBUGAI_MCP_CONTRACT_MISMATCH');
    }
  } catch (error) {
    await client.close().catch(() => {});
    if (error instanceof CatalogError) throw error;
    throw new CatalogError(`DebugAI MCP connection failed: ${error?.message ?? String(error)}`, 'DEBUGAI_UNAVAILABLE');
  }

  return Object.freeze({
    async execute(decision) {
      return executeDebugDecision(decision, (request) => client.callTool(request));
    },
    async close() {
      await client.close();
    }
  });
}
