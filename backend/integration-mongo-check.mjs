import { MongoMemoryReplSet } from './tests/helpers/mongo-memory.js';
console.log('Starting disposable replica set');
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
console.log('Disposable replica set ready');
await mongo.stop();
console.log('Disposable replica set stopped');
