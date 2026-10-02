import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { CatalogError } from './catalog.js';

const SCHEMA_PATH = path.join('schemas', 'reusable-asset-v1.schema.json');

function formatErrors(errors = []) {
  return errors.map((error) => ({
    instancePath: error.instancePath || '/',
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? 'schema validation failed',
    params: error.params
  }));
}

export async function createReusableAssetValidator(rootDir) {
  const schemaFile = path.join(path.resolve(rootDir), SCHEMA_PATH);
  let schema;
  try {
    schema = JSON.parse(await fs.readFile(schemaFile, 'utf8'));
  } catch (error) {
    throw new CatalogError(`Reusable Asset schema could not be loaded: ${error.message}`, 'REUSABLE_ASSET_SCHEMA_LOAD_FAILED');
  }

  try {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);
    return Object.freeze({
      schema,
      validate(value) {
        const valid = validate(value);
        return {
          valid: Boolean(valid),
          errors: valid ? [] : formatErrors(validate.errors)
        };
      }
    });
  } catch (error) {
    throw new CatalogError(`Reusable Asset schema could not be compiled: ${error.message}`, 'REUSABLE_ASSET_SCHEMA_COMPILE_FAILED');
  }
}

export function assertReusableAssetSchema(validator, asset, assetId = asset?.identity?.asset_id ?? 'unknown') {
  const result = validator.validate(asset);
  if (result.valid) return result;
  const detail = result.errors.map((error) => `${error.instancePath} ${error.message}`).join('; ');
  const failure = new CatalogError(`Reusable Asset schema validation failed for ${assetId}: ${detail}`, 'REUSABLE_ASSET_SCHEMA_INVALID');
  failure.details = result.errors;
  throw failure;
}
