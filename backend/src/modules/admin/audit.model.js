import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  resourceType: { type: String, enum: ['Category', 'Service', 'Verification', 'Dispute', 'Review', 'User', 'Booking'], required: true },
  resource: { type: mongoose.Schema.Types.ObjectId, required: true },
  fields: [{ type: String }],
  reason: { type: String, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' });
schema.index({ resourceType: 1, resource: 1, createdAt: -1 });
export const AuditEvent = mongoose.model('AuditEvent', schema);
export async function recordAudit(actor, action, resourceType, resource, fields, session, reason) {
  await AuditEvent.create([{ actor, action, resourceType, resource, fields, ...(reason ? { reason } : {}) }], { session });
}
