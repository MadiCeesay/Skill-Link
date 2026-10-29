// Test-only startup policy. These servers never use the configured Atlas URI.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer as Server, MongoMemoryReplSet as ReplSet } from 'mongodb-memory-server';

const cachedBinary = fileURLToPath(new URL('../../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe', import.meta.url));
const binary = existsSync(cachedBinary) ? { systemBinary: cachedBinary } : {};
export const MongoMemoryServer = {
  create(options = {}) {
    return Server.create({ ...options, binary: { ...binary, ...options.binary }, instance: { launchTimeout: 120000, ...options.instance } });
  },
};
export const MongoMemoryReplSet = {
  create(options = {}) {
    return ReplSet.create({ ...options, binary: { ...binary, ...options.binary }, instanceOpts: (options.instanceOpts?.length ? options.instanceOpts : [{}]).map(instance => ({ launchTimeout: 120000, ...instance })) });
  },
};
