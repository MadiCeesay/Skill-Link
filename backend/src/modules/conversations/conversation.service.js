import mongoose from 'mongoose';
import { Conversation, Message, ChatPriceOffer } from './conversation.model.js';
import { priceOfferService } from './price-offer.service.js';
import { Booking } from '../bookings/booking.model.js';
import { DirectProposal } from '../bookings/proposal.model.js';
import { Quote } from '../quotes/quote.model.js';
import { JobRequest } from '../jobRequests/job.model.js';
import { participantSummaries } from '../bookings/participant-summary.js';
import { bookingStatus } from '../bookings/booking.serializer.js';
import { User } from '../users/user.model.js';
import { MediaAsset } from '../media/media.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertNoContact, hasContact } from './contact.service.js';
import { conversationDTO, messageDTO } from './conversation.serializer.js';
import { pageMetadata } from '../discovery/discovery.service.js';
/**
 * @param {object} voice optional voice-note transcription settings
 * @param {object} voice.transcriber ElevenLabsTranscriber or UnavailableTranscriber
 * @param {Function} voice.publish sends a live update to the conversation's participants
 * @param {Function} voice.fetchImpl downloads a signed media URL (injected for tests)
 * @param {boolean} voice.background false makes tests wait for the transcript
 */
export function conversationService(media, bookings, voice = {}) {
  const transcriber = voice.transcriber;
  const publishUpdate = voice.publish || (async () => {});
  const fetchMedia = voice.fetchImpl || globalThis.fetch;
  // Downloads the voice note, transcribes it and stores the result on the message.
  // Runs after the message is sent, so a slow or failed transcription never blocks chat.
  async function transcribeVoice(messageId) {
    const m = await Message.findById(messageId);
    if (!m || m.type !== 'VOICE' || !transcriber?.available) return;
    try {
      const asset = await MediaAsset.findById(m.media).select('+storageKey +resourceType +format +deliveryType');
      const { url } = await media.link(asset, 120);
      const response = await fetchMedia(url);
      if (!response?.ok) throw new Error('voice note could not be downloaded');
      const result = await transcriber.transcribe({
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: asset.mimeType,
        languageCode: m.spokenLanguage,
      });
      const text = result.text.slice(0, 4000);
      const conversation = await Conversation.findById(m.conversation);
      // Spoken phone numbers are kept out of the chat just like typed ones, until payment.
      const hidden = text && hasContact(text) && !(await confirmed(conversation));
      m.transcript = hidden
        ? { status: 'HIDDEN', languageCode: result.languageCode || undefined, completedAt: new Date() }
        : { status: text ? 'DONE' : 'FAILED', text: text || undefined, languageCode: result.languageCode || undefined, completedAt: new Date() };
    } catch (error) {
      console.warn('[transcription] message ' + messageId + ' failed: ' + error.message);
      m.transcript = { status: 'FAILED', completedAt: new Date() };
    }
    await m.save();
    await publishUpdate(String(m.conversation), 'message-updated', { message: messageDTO(m) }).catch(() => {});
  }
  async function scheduleTranscription(messageId) {
    if (voice.background === false) return transcribeVoice(messageId);
    setImmediate(() => transcribeVoice(messageId).catch(error => console.warn('[transcription] ' + error.message)));
  }
  async function present(rows, user) {
    const ids = type => rows.filter(c => c.contextType === type).map(c => c.contextId);
    const [quotes, proposals, bookings] = await Promise.all([
      Quote.find({ _id: mongoose.trusted({ $in: ids('QUOTE') }) }).select('customer worker jobRequest status expiresAt').lean(),
      DirectProposal.find({ _id: mongoose.trusted({ $in: ids('DIRECT_PROPOSAL') }) }).select('customer worker service status expiresAt').lean(),
      Booking.find({ $or: [
        { _id: mongoose.trusted({ $in: ids('BOOKING') }) }, { acceptedQuote: mongoose.trusted({ $in: ids('QUOTE') }) }, { directProposal: mongoose.trusted({ $in: ids('DIRECT_PROPOSAL') }) },
      ] }).select('customer worker service status reservationExpiresAt acceptedQuote directProposal').lean(),
    ]);
    const jobs = await JobRequest.find({ _id: mongoose.trusted({ $in: quotes.map(q => q.jobRequest) }) }).select('service').lean();
    const sources = rows.map(c => {
      const b = bookings.find(b => String(c.contextId) === String(c.contextType === 'BOOKING' ? b._id : c.contextType === 'QUOTE' ? b.acceptedQuote : b.directProposal));
      const source = b || (c.contextType === 'QUOTE' ? quotes : proposals).find(s => String(s._id) === String(c.contextId));
      // Never enrich a mismatched or stale context with another relationship's data.
      if (!source || String(source.customer) !== String(c.customer) || String(source.worker) !== String(c.worker)) return { customer: c.customer, worker: c.worker };
      const expired = source.expiresAt <= new Date() && ['PENDING', 'QUOTED'].includes(source.status);
      return { customer: c.customer, worker: c.worker, service: source.service || jobs.find(j => String(j._id) === String(source.jobRequest))?.service,
        status: b ? bookingStatus(b) : expired ? 'EXPIRED' : source.status };
    });
    const summaries = await participantSummaries(sources, user, media);
    return rows.map((c, i) => conversationDTO(c, { ...summaries[i], status: sources[i].status || null }));
  }
  async function own(id, user, session = null) {
    const c = await Conversation.findOne({ _id: id, participants: user._id }).session(session);
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
    ...priceOfferService(own, bookings),
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
      return { conversation: (await present([c], user))[0] };
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
        conversations: await present(rows, user),
        pagination: pageMetadata(page.page, page.limit, total),
      };
    },
    async get(id, user) {
      return { conversation: (await present([await own(id, user)], user))[0] };
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
      const offers = await ChatPriceOffer.find({ _id: mongoose.trusted({ $in: rows.filter(m => m.priceOffer).map(m => m.priceOffer) }), conversation: id });
      return {
        messages: rows.map(m => messageDTO(m, offers.find(o => String(o._id) === String(m.priceOffer)))),
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
        const transcribe = input.type === 'VOICE' && transcriber?.available;
        const { language, ...message } = input;
        const m = await Message.create({
          ...message,
          ...(language ? { spokenLanguage: language } : {}),
          conversation: id,
          sender: user._id,
          readBy: [user._id],
          ...(transcribe ? { transcript: { status: 'PENDING' } } : {}),
        });
        if (transcribe) await scheduleTranscription(m._id);
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
    // Lets a participant ask again when a transcript failed (for example, the service was busy).
    async retryTranscript(id, messageId, user) {
      await own(id, user);
      if (!transcriber?.available) throw new ApiError(503, 'TRANSCRIPTION_UNAVAILABLE', 'Voice transcription is not configured');
      const m = await Message.findOneAndUpdate(
        { _id: messageId, conversation: id, type: 'VOICE', 'transcript.status': mongoose.trusted({ $in: ['FAILED'] }) },
        { $set: { transcript: { status: 'PENDING' } } },
        { new: true },
      );
      if (!m) throw new ApiError(409, 'TRANSCRIPT_NOT_RETRYABLE', 'Only a failed voice-note transcript can be retried');
      await scheduleTranscription(m._id);
      return { message: messageDTO(voice.background === false ? await Message.findById(m._id) : m) };
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
