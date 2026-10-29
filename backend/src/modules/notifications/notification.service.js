import mongoose from 'mongoose';
import { Notification } from './notification.model.js';
import { User } from '../users/user.model.js';
import { Quote } from '../quotes/quote.model.js';
import { JobRequest } from '../jobRequests/job.model.js';
import { DirectProposal } from '../bookings/proposal.model.js';
import { Booking } from '../bookings/booking.model.js';
import { Verification } from '../verifications/verification.model.js';
import { Dispute } from '../disputes/dispute.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageMetadata } from '../discovery/discovery.service.js';
export const notificationDTO = (n) => ({
  id: String(n._id),
  type: n.type,
  title: n.title,
  message: n.message,
  relatedResourceType: n.relatedResourceType,
  relatedResourceId: String(n.relatedResourceId),
  readAt: n.readAt,
  createdAt: n.createdAt,
});
export function notificationService(email) {
  return {
    async emit(recipient, type, resourceType, id, key) {
      const n = await Notification.findOneAndUpdate(
        { recipient, eventKey: key },
        {
          $setOnInsert: {
            recipient,
            eventKey: key,
            type,
            title: 'SkillLink update',
            message: type.replaceAll('_', ' ').toLowerCase(),
            relatedResourceType: resourceType,
            relatedResourceId: id,
          },
        },
        { new: true, upsert: true },
      );
      // Optional email is supplementary; provider failures never change marketplace success.
      if (
        [
          'BOOKING_CONFIRMED',
          'DISPUTE_RESOLVED',
          'VERIFICATION_APPROVED',
          'VERIFICATION_REJECTED',
        ].includes(type)
      ) {
        try {
          const user = await User.findById(recipient).select('email');
          if (user)
            await email.send({
              to: user.email,
              subject: 'SkillLink update',
              text: n.message,
              idempotencyKey: key,
            });
        } catch {
          /* Optional delivery has no effect on core state. */
        }
      }
      return n;
    },
    async result(data) {
      const send = async (recipient, type, kind, id) =>
        this.emit(recipient, type, kind, id, kind + ':' + id + ':' + type);
      if (data.quote) {
        const q = await Quote.findById(data.quote.id);
        if (q) {
          if (q.status === 'PENDING')
            await send(q.customer, 'NEW_QUOTE', 'Quote', q._id);
          else await send(q.worker, 'QUOTE_' + q.status, 'Quote', q._id);
          if (q.status === 'ACCEPTED') {
            const others = await Quote.find({
              jobRequest: q.jobRequest,
              status: 'REJECTED',
            }).select('worker');
            for (const other of others)
              await send(other.worker, 'QUOTE_REJECTED', 'Quote', other._id);
          }
        }
      }
      if (data.jobRequest?.status === 'CANCELLED') {
        const quotes = await Quote.find({
          jobRequest: data.jobRequest.id,
          status: 'REJECTED',
        }).select('worker');
        for (const q of quotes)
          await send(q.worker, 'QUOTE_REJECTED', 'Quote', q._id);
      }
      if (data.proposal) {
        const p = await DirectProposal.findById(data.proposal.id);
        if (p) {
          if (p.status === 'QUOTED') {
            await this.emit(p.customer, p.quoteRevision > 1 ? 'PROFESSIONAL_QUOTE_REVISED' : 'PROFESSIONAL_QUOTE_RECEIVED',
              'DirectProposal', p._id, 'DirectProposal:' + p._id + ':QUOTE:' + p.quoteRevision);
          } else {
            const recipients = p.status === 'PENDING' ? [p.worker]
              : p.status === 'CANCELLED' ? [p.worker] : [p.customer, p.worker];
            for (const recipient of recipients) await send(recipient,
              p.status === 'PENDING' && p.pricingMode === 'REQUEST_QUOTE' ? 'QUOTE_REQUESTED' : 'PROPOSAL_' + p.status,
              'DirectProposal', p._id);
          }
          if (p.booking) {
            const b = await Booking.findById(p.booking);
            await send(
              b.customer,
              'BOOKING_AWAITING_PAYMENT',
              'Booking',
              b._id,
            );
          }
        }
      }
      if (data.booking) {
        const b = await Booking.findById(data.booking.id);
        if (b) {
          await send(b.customer, 'BOOKING_' + b.status, 'Booking', b._id);
          await send(b.worker, 'BOOKING_' + b.status, 'Booking', b._id);
        }
      }
      if (data.payment) {
        const p = data.payment,
          b = await Booking.findById(p.booking);
        if (b) {
          await send(b.customer, 'PAYMENT_' + p.status, 'Payment', p.id);
          if (p.status === 'HELD')
            await send(b.worker, 'BOOKING_CONFIRMED', 'Booking', b._id);
        }
      }
      if (data.dispute) {
        const d = await Dispute.findById(data.dispute.id);
        if (d) {
          await send(d.customer, 'DISPUTE_' + d.status, 'Dispute', d._id);
          await send(d.worker, 'DISPUTE_' + d.status, 'Dispute', d._id);
        }
      }
      if (data.review)
        await send(data.review.worker, 'NEW_REVIEW', 'Review', data.review.id);
      if (data.verification?.id) {
        const v = await Verification.findById(data.verification.id);
        if (v && ['APPROVED', 'REJECTED'].includes(v.status))
          await send(
            v.worker,
            'VERIFICATION_' + v.status,
            'Verification',
            v._id,
          );
      }
      if (data.message) {
        const m = data.message;
        const { Conversation } =
          await import('../conversations/conversation.model.js');
        const c = await Conversation.findById(m.conversation);
        if (c)
          for (const id of c.participants)
            if (String(id) !== String(m.sender))
              await send(id, 'NEW_MESSAGE', 'Message', m.id);
      }
    },
    async list(user, page) {
      const f = { recipient: user };
      const [rows, total] = await Promise.all([
        Notification.find(f)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page.page - 1) * page.limit)
          .limit(page.limit),
        Notification.countDocuments(f),
      ]);
      return {
        notifications: rows.map(notificationDTO),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async read(id, user) {
      const n = await Notification.findOneAndUpdate(
        { _id: id, recipient: user },
        { $set: { readAt: new Date() } },
        { new: true },
      );
      if (!n) throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
      return { notification: notificationDTO(n) };
    },
    async readAll(user) {
      await Notification.updateMany(
        { recipient: user, readAt: null },
        { $set: { readAt: new Date() } },
      );
      return { read: true };
    },
    async unread(user) {
      return {
        unreadCount: await Notification.countDocuments({
          recipient: user,
          readAt: null,
        }),
      };
    },
  };
}
// Attach effects only to write methods; read requests never regenerate events.
export function notifying(service, names, notifications) {
  for (const name of names) {
    const original = service[name];
    service[name] = async (...args) => {
      const data = await original.apply(service, args);
      try {
        await notifications.result(data);
      } catch {
        /* Notification repair can be retried separately; committed business state wins. */
      }
      return data;
    };
  }
  return service;
}
