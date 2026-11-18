export const conversationDTO = (c, summary = {}) => ({
  id: String(c._id),
  contextType: c.contextType,
  contextId: String(c.contextId),
  participants: c.participants.map(String),
  booking: c.booking ? String(c.booking) : undefined,
  createdAt: c.createdAt,
  ...summary,
});
export const priceOfferDTO = o => ({ id: String(o._id), conversation: String(o.conversation), proposal: String(o.proposal), sender: String(o.sender), recipient: String(o.recipient), amountBututs: o.amountBututs, currency: o.currency, status: o.status, createdAt: o.createdAt, respondedAt: o.respondedAt });
export const messageDTO = (m, offer = null) => ({
  id: String(m._id),
  conversation: String(m.conversation),
  sender: String(m.sender),
  type: m.type,
  text: m.text,
  media: m.media ? String(m.media) : undefined,
  readBy: m.readBy.map(String),
  clientMessageId: m.clientMessageId,
  createdAt: m.createdAt,
  ...(offer && typeof offer === 'object' ? { priceOffer: priceOfferDTO(offer) } : {}),
});
