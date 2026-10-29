import mongoose from 'mongoose';
import { Conversation, Message } from './conversation.model.js';
import { Booking } from '../bookings/booking.model.js';
import { DirectProposal } from '../bookings/proposal.model.js';
import { Quote } from '../quotes/quote.model.js';
import { User } from '../users/user.model.js';
import { MediaAsset } from '../media/media.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertNoContact } from './contact.service.js';
import { conversationDTO, messageDTO } from './conversation.serializer.js';
import { pageMetadata } from '../discovery/discovery.service.js';
export function conversationService(media) {
  async function own(id, user) {
    const c = await Conversation.findOne({ _id: id, participants: user._id });
    if (!c) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found');
    return c;
  }
  async function confirmed(c) {
    const b =
      c.contextType === 'BOOKING'
        ? await Booking.findById(c.contextId)
        : await Booking.findOne(
            c.contextType === 'QUOTE'
              ? { acceptedQuote: c.contextId }
              : { directProposal: c.contextId },
          );
    return (
      b &&
      [
        'CONFIRMED',
        'IN_PROGRESS',
        'WORKER_MARKED_COMPLETED',
        'COMPLETED',
        'DISPUTED',
      ].includes(b.status)
    );
  }
  return {
    own,
    async create(user, input) {
      const Model = {
        QUOTE: Quote,
        DIRECT_PROPOSAL: DirectProposal,
        BOOKING: Booking,
      }[input.contextType];
      const source = await Model.findOne({
        _id: input.contextId,
        ...mongoose.trusted({
          $or: [{ customer: user._id }, { worker: user._id }],
        }),
      });
      if (!source)
        throw new ApiError(404, 'NOT_FOUND', 'Marketplace context not found');
      if (
        !(await User.exists({ _id: source.worker, accountStatus: 'ACTIVE' })) ||
        !(await User.exists({ _id: source.customer, accountStatus: 'ACTIVE' }))
      )
        throw new ApiError(
          409,
          'PARTICIPANT_INACTIVE',
          'Conversation participant is unavailable',
        );
      const c = await Conversation.findOneAndUpdate(
        { contextType: input.contextType, contextId: input.contextId },
        {
          $setOnInsert: {
            ...input,
            customer: source.customer,
            worker: source.worker,
            participants: [source.customer, source.worker],
            ...(input.contextType === 'BOOKING' ? { booking: source._id } : {}),
          },
        },
        { new: true, upsert: true },
      );
      return { conversation: conversationDTO(c) };
    },
    async list(user, page) {
      const f = { participants: user._id };
      const [rows, total] = await Promise.all([
        Conversation.find(f)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page.page - 1) * page.limit)
          .limit(page.limit),
        Conversation.countDocuments(f),
      ]);
      return {
        conversations: rows.map(conversationDTO),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async get(id, user) {
      return { conversation: conversationDTO(await own(id, user)) };
    },
    async history(id, user, page) {
      await own(id, user);
      const [rows, total] = await Promise.all([
        Message.find({ conversation: id })
          .sort({ createdAt: -1, _id: -1 })
          .skip((page.page - 1) * page.limit)
          .limit(page.limit),
        Message.countDocuments({ conversation: id }),
      ]);
      return {
        messages: rows.map(messageDTO),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async send(id, user, input) {
      const c = await own(id, user);
      const other =
        String(c.customer) === String(user._id) ? c.worker : c.customer;
      if (!(await User.exists({ _id: other, accountStatus: 'ACTIVE' })))
        throw new ApiError(
          409,
          'PARTICIPANT_INACTIVE',
          'Conversation participant is unavailable',
        );
      const existing = await Message.findOne({
        conversation: id,
        sender: user._id,
        clientMessageId: input.clientMessageId,
      });
      if (existing) {
        if (
          existing.type !== input.type ||
          existing.text !== input.text ||
          String(existing.media || '') !== String(input.media || '')
        )
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Message ID was used with a different payload',
          );
        return { message: messageDTO(existing) };
      }
      if (input.type === 'TEXT' && !(await confirmed(c)))
        assertNoContact(input.text);
      if (input.type !== 'TEXT')
        await media.owned(
          input.media,
          user._id,
          input.type === 'IMAGE' ? 'CHAT_IMAGE' : 'VOICE_NOTE',
        );
      try {
        const m = await Message.create({
          ...input,
          conversation: id,
          sender: user._id,
          readBy: [user._id],
        });
        return { message: messageDTO(m) };
      } catch (e) {
        if (e.code === 11000) {
          const m = await Message.findOne({
            conversation: id,
            sender: user._id,
            clientMessageId: input.clientMessageId,
          });
          if (
            m.type !== input.type ||
            m.text !== input.text ||
            String(m.media || '') !== String(input.media || '')
          )
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Message ID was used with a different payload',
            );
          return { message: messageDTO(m) };
        }
        throw e;
      }
    },
    async read(id, user) {
      await own(id, user);
      await Message.updateMany(
        { conversation: id },
        { $addToSet: { readBy: user._id } },
      );
      return { read: true };
    },
    async access(id, mediaId, user) {
      await own(id, user);
      if (!(await Message.exists({ conversation: id, media: mediaId })))
        throw new ApiError(404, 'NOT_FOUND', 'Message media not found');
      const asset = await MediaAsset.findOne({
        _id: mediaId,
        purpose: mongoose.trusted({ $in: ['CHAT_IMAGE', 'VOICE_NOTE'] }),
      }).select('+storageKey +resourceType +format +deliveryType');
      if (!asset)
        throw new ApiError(404, 'NOT_FOUND', 'Message media not found');
      return media.link(asset, 60);
    },
  };
}
