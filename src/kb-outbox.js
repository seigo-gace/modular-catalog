import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CatalogError } from './catalog.js';
import { preflightDelivery } from './kb-delivery.js';
import { exportReusableAssets } from './reusable-asset-export.js';

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

function fail(message, code, details = null) {
  const error = new CatalogError(message, code);
  if (details !== null) error.details = details;
  throw error;
}

async function assertSafeOutbox(rootDir, outboxRoot) {
  const root = path.resolve(rootDir);
  const outbox = path.resolve(outboxRoot);
  if (outbox === root || outbox.startsWith(root + path.sep)) {
    fail('KB outbox must be outside the ModuleCatalog working tree.', 'KB_OUTBOX_TARGET_UNSAFE');
  }
  const stat = await fs.lstat(outbox).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    fail(`KB outbox directory is unavailable or unsafe: ${outbox}`, 'KB_OUTBOX_NOT_CONFIGURED');
  }
  return outbox;
}

function sameIdentity(left, right) {
  return left.catalogCommit === right.catalogCommit
    && left.manifestSha256 === right.manifestSha256
    && left.assetCount === right.assetCount
    && left.knowledgeUnitCount === right.knowledgeUnitCount
    && left.relationshipCount === right.relationshipCount
    && left.caseCount === right.caseCount;
}

export async function prepareKbOutbox(rootDir, outboxRoot) {
  const root = path.resolve(rootDir);
  const outbox = await assertSafeOutbox(root, outboxRoot);
  const temp = path.join(outbox, `.incoming-${process.pid}-${crypto.randomUUID()}`);

  try {
    await exportReusableAssets(root, temp);
    const staged = await preflightDelivery(root, temp);
    const finalPath = path.join(outbox, staged.catalogCommit);

    if (await exists(finalPath)) {
      const finalStat = await fs.lstat(finalPath).catch(() => null);
      if (!finalStat?.isDirectory() || finalStat.isSymbolicLink()) {
        fail(`Existing KB outbox target is unsafe: ${finalPath}`, 'KB_OUTBOX_IDENTITY_CONFLICT');
      }
      let existing;
      try {
        existing = await preflightDelivery(root, finalPath);
      } catch (error) {
        fail('Existing KB outbox delivery is not a valid sealed delivery.', 'KB_OUTBOX_IDENTITY_CONFLICT', { cause: error?.code ?? error?.message ?? String(error) });
      }
      if (!sameIdentity(existing, staged)) {
        fail('Existing KB outbox delivery has the same Catalog commit but a different identity.', 'KB_OUTBOX_IDENTITY_CONFLICT');
      }
      await fs.rm(temp, { recursive: true, force: true });
      return Object.freeze({
        status: 'SEALED',
        code: 'SEALED',
        idempotent: true,
        outboxPath: finalPath,
        summary: existing
      });
    }

    await fs.rename(temp, finalPath);
    const sealed = await preflightDelivery(root, finalPath);
    if (!sameIdentity(sealed, staged)) {
      fail('KB outbox readback identity does not match the staged delivery.', 'KB_OUTBOX_READBACK_FAILED');
    }

    return Object.freeze({
      status: 'SEALED',
      code: 'SEALED',
      idempotent: false,
      outboxPath: finalPath,
      summary: sealed
    });
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
