import mongoose from 'mongoose';
import { Booking } from '../bookings/booking.model.js';
import { DirectProposal } from '../bookings/proposal.model.js';
import { Quote } from '../quotes/quote.model.js';
import { JobRequest } from '../jobRequests/job.model.js';
import { Payment } from '../payments/payment.model.js';
import { Dispute } from '../disputes/dispute.model.js';
import { Review } from '../reviews/review.model.js';
import { Conversation, Message } from '../conversations/conversation.model.js';
import { User } from '../users/user.model.js';
import { Service } from '../catalog/service.model.js';

const titles = {
  BOOKING_AWAITING_PAYMENT: 'Your booking is ready for payment', BOOKING_CONFIRMED: 'Your booking is confirmed',
  BOOKING_IN_PROGRESS: 'Work has started', BOOKING_WORKER_MARKED_COMPLETED: 'Work is ready for confirmation',
  BOOKING_COMPLETED: 'Your booking is complete', BOOKING_CANCELLED: 'Your booking was cancelled', BOOKING_DISPUTED: 'A problem was reported',
  NEW_QUOTE: 'You received a quote', QUOTE_ACCEPTED: 'Your quote was accepted', QUOTE_REJECTED: 'Your quote was not accepted',
  QUOTE_WITHDRAWN: 'A quote was withdrawn', QUOTE_EXPIRED: 'A quote expired', QUOTE_REQUESTED: 'You received a quote request',
  PROFESSIONAL_QUOTE_RECEIVED: 'You received a service quote', PROFESSIONAL_QUOTE_REVISED: 'Your service quote was revised',
  PROPOSAL_PENDING: 'You received a service proposal', PROPOSAL_ACCEPTED: 'A service proposal was accepted',
  PROPOSAL_REJECTED: 'A service proposal was declined', PROPOSAL_CANCELLED: 'A service proposal was cancelled', PROPOSAL_EXPIRED: 'A service proposal expired',
  PAYMENT_HELD: 'Your simulated payment is held', PAYMENT_RELEASED: 'Your simulated payment was released',
  PAYMENT_REFUNDED: 'Your simulated payment was refunded', PAYMENT_FAILED: 'Your simulated payment failed',
  PAYMENT_PENDING: 'Your simulated payment is pending', PAYMENT_DISPUTED: 'Your simulated payment is under review',
  DISPUTE_OPEN: 'A problem was reported', DISPUTE_RESOLVED: 'Your dispute was resolved', NEW_REVIEW: 'You received a review',
  NEW_MESSAGE: 'You have a new message', VERIFICATION_APPROVED: 'Your identity verification was approved',
  VERIFICATION_REJECTED: 'Your identity verification needs attention',
};
export function notificationCopy(type, context = {}) {
  const title = titles[type] || 'You have a SkillLink update';
  const { other, customer, worker, viewerIsWorker, viewerIsCustomer, service, reference, kind = 'booking' } = context;
  const work = service ? `${service} ${kind}${reference ? ' #' + reference : ''}` : 'work';
  const withPerson = other ? ` with ${other}` : '';
  const actor = name => viewerIsWorker ? 'You' : name || 'Your professional';
  let message = service ? `There is an update to your ${work}${withPerson}.` : `${title}. Open the update for details.`;
  if (type === 'BOOKING_WORKER_MARKED_COMPLETED') message = `${actor(worker)} marked the ${work}${viewerIsWorker && other ? ' for ' + other : ''} complete. ${viewerIsWorker ? 'The customer can now confirm the work.' : 'Please check the work and confirm completion.'}`;
  else if (type === 'BOOKING_IN_PROGRESS') message = `${actor(worker)} started the ${work}${viewerIsWorker && other ? ' for ' + other : ''}.`;
  else if (type === 'BOOKING_COMPLETED') message = `${viewerIsCustomer ? 'You' : customer || 'The customer'} confirmed completion of the ${work}${viewerIsCustomer ? withPerson : ''}.`;
  else if (type === 'NEW_MESSAGE' && other) message = `${other} sent you a message about the ${work}.`;
  else if (type === 'NEW_REVIEW' && customer) message = `${customer} reviewed the ${work}.`;
  else if (type === 'BOOKING_CONFIRMED') message = `Your ${work}${withPerson} is confirmed.`;
  else if (type === 'BOOKING_AWAITING_PAYMENT') message = `Your ${work}${withPerson} is ready. Complete the simulated payment to confirm it.`;
  else if (['NEW_QUOTE', 'PROFESSIONAL_QUOTE_RECEIVED', 'PROFESSIONAL_QUOTE_REVISED'].includes(type) && other) message = `${other} ${type.endsWith('REVISED') ? 'revised the quote' : 'sent you a quote'} for the ${work}.`;
  else if (type === 'QUOTE_REQUESTED' && other) message = `${other} requested a quote for the ${work}.`;
  else if (type.startsWith('PAYMENT_')) message = `${title} for your ${work}${withPerson}.`;
  else if (type.startsWith('VERIFICATION_')) message = type === 'VERIFICATION_APPROVED' ? 'Your identity verification was approved. Check that your professional profile is published to receive work.' : 'Your identity verification was not approved. Open verification to read the decision and next steps.';
  else if (service) message = `${title} for the ${work}${withPerson}.`;
  return { title, message };
}

// Resolve names only through the notification recipient's existing relationships.
// Historical notifications get current readable copy without rewriting event history.
export async function notificationPresentation(rows, recipientId) {
  const load = (Model, ids, fields) => ids.length ? Model.find({ _id: mongoose.trusted({ $in: ids }) }).select(fields).lean() : Promise.resolve([]);
  const ids = type => rows.filter(n => n.relatedResourceType === type).map(n => n.relatedResourceId);
  const [payments, disputes, reviews, messages] = await Promise.all([
    load(Payment, ids('Payment'), 'booking'), load(Dispute, ids('Dispute'), 'booking'),
    load(Review, ids('Review'), 'booking'), load(Message, ids('Message'), 'conversation'),
  ]);
  const conversations = messages.length ? await Conversation.find({ _id: mongoose.trusted({ $in: messages.map(m => m.conversation) }), participants: recipientId }).select('customer worker contextType contextId').lean() : [];
  const contextIds = type => conversations.filter(c => c.contextType === type).map(c => c.contextId);
  const [bookings, quotes, proposals] = await Promise.all([
    load(Booking, [...ids('Booking'), ...payments.map(p => p.booking), ...disputes.map(d => d.booking), ...reviews.map(r => r.booking), ...contextIds('BOOKING')], 'customer worker service'),
    load(Quote, [...ids('Quote'), ...contextIds('QUOTE')], 'customer worker jobRequest'),
    load(DirectProposal, [...ids('DirectProposal'), ...contextIds('DIRECT_PROPOSAL')], 'customer worker service'),
  ]);
  const owns = source => source && [String(source.customer), String(source.worker)].includes(String(recipientId));
  const jobs = await load(JobRequest, quotes.filter(owns).map(q => q.jobRequest), 'service');
  const byId = (list, id) => list.find(item => String(item._id) === String(id));
  const resolve = (type, id) => {
    if (type === 'Booking') { const b = byId(bookings, id); return b && { ...b, kind: 'booking' }; }
    if (type === 'DirectProposal') { const p = byId(proposals, id); return p && { ...p, kind: 'request' }; }
    if (type === 'Quote') { const q = byId(quotes, id); return q && { ...q, kind: 'job', service: byId(jobs, q.jobRequest)?.service }; }
    return null;
  };
  const contexts = rows.map(n => {
    if (['Booking', 'DirectProposal', 'Quote'].includes(n.relatedResourceType)) return resolve(n.relatedResourceType, n.relatedResourceId);
    if (n.relatedResourceType === 'Message') {
      const c = byId(conversations, byId(messages, n.relatedResourceId)?.conversation);
      return c && resolve({ BOOKING: 'Booking', QUOTE: 'Quote', DIRECT_PROPOSAL: 'DirectProposal' }[c.contextType], c.contextId);
    }
    const linked = { Payment: payments, Dispute: disputes, Review: reviews }[n.relatedResourceType];
    return linked ? byId(bookings, byId(linked, n.relatedResourceId)?.booking) : null;
  });
  const permitted = contexts.filter(owns);
  const [people, services] = await Promise.all([
    load(User, [...new Set(permitted.flatMap(c => [c.customer, c.worker]).map(String))], 'firstName lastName'),
    load(Service, [...new Set(permitted.map(c => c.service).filter(Boolean).map(String))], 'name'),
  ]);
  const name = id => { const p = byId(people, id); return p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : null; };
  return rows.map((n, i) => {
    const c = contexts[i];
    if (!owns(c)) return notificationCopy(n.type);
    return notificationCopy(n.type, {
      other: name(String(c.customer) === String(recipientId) ? c.worker : c.customer),
      customer: name(c.customer), worker: name(c.worker), viewerIsCustomer: String(c.customer) === String(recipientId), viewerIsWorker: String(c.worker) === String(recipientId),
      service: byId(services, c.service)?.name, reference: String(c.jobRequest || c._id).slice(-6).toUpperCase(),
      kind: c.kind || 'booking',
    });
  });
}
