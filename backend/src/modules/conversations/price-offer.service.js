import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ChatPriceOffer, Message } from './conversation.model.js';
import { DirectProposal } from '../bookings/proposal.model.js';
import { Booking } from '../bookings/booking.model.js';
import { User } from '../users/user.model.js';
import { ensureWorkerLock, lockWorker } from '../availability/availability.service.js';
import { transaction } from '../../utils/transaction.js';
import { ApiError } from '../../utils/ApiError.js';
import { messageDTO, priceOfferDTO } from './conversation.serializer.js';

export function priceOfferService(own, bookings) {
  async function work(id, user, fn) {
    const initial = await own(id, user);
    if (initial.contextType !== 'DIRECT_PROPOSAL') throw new ApiError(409, 'PRICE_OFFER_UNAVAILABLE', 'Price offers require a pending proposal conversation');
    await ensureWorkerLock(initial.worker);
    return transaction(async session => {
      // Same row used by proposal acceptance, cancellation, checkout and scheduling.
      await lockWorker(initial.worker, session);
      const c = await own(id, user, session);
      if (![String(c.customer), String(c.worker)].includes(String(user._id))) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found');
      const p = await DirectProposal.findOne({ _id: c.contextId, customer: c.customer, worker: c.worker }).session(session);
      if (!p || !['PENDING', 'QUOTED'].includes(p.status) || p.expiresAt <= new Date() || p.booking || await Booking.exists({ directProposal: p._id }).session(session))
        throw new ApiError(409, 'PRICE_OFFER_CLOSED', 'Price offers are only available before a pending proposal becomes a booking');
      if (!await User.exists({ _id: c.customer, role: 'CUSTOMER', accountStatus: 'ACTIVE' }).session(session) || !await User.exists({ _id: c.worker, role: 'WORKER', accountStatus: 'ACTIVE' }).session(session))
        throw new ApiError(409, 'PARTICIPANT_INACTIVE', 'A conversation participant is unavailable');
      return fn(c, p, session);
    });
  }
  return {
    sendPriceOffer(id, user, input) {
      return work(id, user, async (c, p, session) => {
        await ChatPriceOffer.updateMany({ proposal: p._id, status: 'OPEN' }, { $set: { status: 'REPLACED', respondedAt: new Date() } }, { session });
        const [offer] = await ChatPriceOffer.create([{ conversation: c._id, proposal: p._id, sender: user._id, recipient: String(c.customer) === String(user._id) ? c.worker : c.customer, amountBututs: input.amountBututs }], { session });
        const [message] = await Message.create([{ conversation: c._id, sender: user._id, type: 'PRICE_OFFER', priceOffer: offer._id, readBy: [user._id], clientMessageId: randomUUID() }], { session });
        return { offer: priceOfferDTO(offer), message: messageDTO(message, offer) };
      });
    },
    respondPriceOffer(id, offerId, user, input) {
      return work(id, user, async (c, p, session) => {
        const offer = await ChatPriceOffer.findOne({ _id: offerId, conversation: c._id, proposal: p._id, recipient: user._id }).session(session);
        if (!offer) throw new ApiError(404, 'NOT_FOUND', 'Price offer not found');
        if (offer.status !== 'OPEN') throw new ApiError(409, 'PRICE_OFFER_CHANGED', 'This price offer has already been answered or replaced');
        if (input.decision === 'ACCEPTED') await bookings.agreeChatPrice(p, offer.amountBututs, session);
        offer.status = input.decision; offer.respondedAt = new Date(); await offer.save({ session });
        const amount = BigInt(offer.amountBututs);
        const price = 'GMD ' + amount / 100n + '.' + (amount % 100n).toString().padStart(2, '0');
        const [message] = await Message.create([{ conversation: c._id, sender: user._id, type: 'SYSTEM', text: input.decision === 'ACCEPTED' ? `Price offer accepted: ${price}. The worker can confirm the proposal to create a booking.` : `Price offer declined: ${price}.`, readBy: [user._id], clientMessageId: randomUUID() }], { session });
        return { offer: priceOfferDTO(offer), message: messageDTO(message) };
      });
    },
  };
}
