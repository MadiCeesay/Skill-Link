import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';
export async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } catch (error) {
    if (error.code === 20 || error.codeName === 'IllegalOperation') throw new ApiError(503, 'REPLICA_SET_REQUIRED', 'This operation requires a MongoDB replica set');
    throw error;
  } finally { await session.endSession(); }
}
