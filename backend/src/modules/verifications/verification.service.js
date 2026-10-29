import { Verification } from './verification.model.js';
import { WorkerProfile } from '../workers/worker.model.js';
import { User } from '../users/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { transaction } from '../../utils/transaction.js';
import { recordAudit } from '../admin/audit.model.js';
import { verificationDTO } from './verification.serializer.js';
export function verificationService(media) {
  return {
    async own(user) { return { verification: verificationDTO(await Verification.findOne({ worker: user }).sort({ createdAt: -1, _id: -1 })) }; },
    async submit(user, input) {
      if (!await WorkerProfile.exists({ user })) throw new ApiError(400, 'PROFILE_REQUIRED', 'Complete professional onboarding before verification');
      try {
        return await transaction(async session => {
          const current = await Verification.findOne({ worker: user }).sort({ createdAt: -1, _id: -1 }).session(session);
          if (current && current.status !== 'REJECTED') throw new ApiError(409, 'INVALID_VERIFICATION_STATE', 'Only a first submission or a rejected application can be submitted');
          await media.owned(input.identityDocument, user, 'IDENTITY_DOCUMENT', session);
          await media.ownedMany(input.skillCertificates, user, 'SKILL_CERTIFICATE', session);
          await media.ownedMany(input.workEvidence, user, 'WORK_EVIDENCE', session);
          const [doc] = await Verification.create([{ worker: user, identityDocument: input.identityDocument, skillCertificates: input.skillCertificates, workEvidence: input.workEvidence, reference: input.reference }], { session });
          return { verification: verificationDTO(doc) };
        });
      } catch (error) {
        if (error.code === 11000) throw new ApiError(409, 'INVALID_VERIFICATION_STATE', 'A pending or approved submission already exists');
        throw error;
      }
    },
    async pending(paging) {
      const data = await Verification.find({ status: 'PENDING' }).sort({ submittedAt: 1, _id: 1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit);
      return { verifications: data.map(d => ({ id: d.id, worker: String(d.worker), status: d.status, submittedAt: d.submittedAt })), ...paging };
    },
    async details(id) {
      const doc = await Verification.findById(id).select('+adminNotes');
      if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Verification not found');
      return { verification: verificationDTO(doc, true) };
    },
    async review(id, input, actor) {
      return transaction(async session => {
        const doc = await Verification.findOne({ _id: id, status: 'PENDING' }).session(session);
        if (!doc) throw new ApiError(409, 'INVALID_VERIFICATION_STATE', 'Only pending submissions may be reviewed');
        if (String(doc.worker) === String(actor)) throw new ApiError(403, 'SELF_REVIEW_FORBIDDEN', 'You cannot review your own application');
        if (!await User.exists({ _id: doc.worker, role: 'WORKER', accountStatus: 'ACTIVE' }).session(session)) throw new ApiError(409, 'WORKER_INACTIVE', 'Only active worker accounts may be reviewed');
        if (input.workEvidenceReviewed && !doc.workEvidence.length) throw new ApiError(400, 'WORK_EVIDENCE_REQUIRED', 'A work-evidence badge requires submitted evidence');
        const reviewed = await Verification.findOneAndUpdate({ _id: id, status: 'PENDING' }, { $set: { status: input.decision, reviewedAt: new Date(), reviewedBy: actor,
          adminNotes: input.adminNotes || '', rejectionReason: input.rejectionReason || '', workEvidenceReviewed: input.decision === 'APPROVED' && input.workEvidenceReviewed } }, { new: true, runValidators: true, session }).select('+adminNotes');
        if (!reviewed) throw new ApiError(409, 'INVALID_VERIFICATION_STATE', 'This submission was already reviewed');
        await recordAudit(actor, 'VERIFICATION_' + input.decision, 'Verification', doc._id, ['status', 'reviewedAt', 'reviewedBy', 'workEvidenceReviewed'], session);
        return { verification: verificationDTO(reviewed, true) };
      });
    },
  };
}
