export const conversationDTO = (c) => ({
  id: String(c._id),
  contextType: c.contextType,
  contextId: String(c.contextId),
  participants: c.participants.map(String),
  booking: c.booking ? String(c.booking) : undefined,
  createdAt: c.createdAt,
});
export const messageDTO = (m) => ({
  id: String(m._id),
  conversation: String(m.conversation),
  sender: String(m.sender),
  type: m.type,
  text: m.text,
  media: m.media ? String(m.media) : undefined,
  readBy: m.readBy.map(String),
  clientMessageId: m.clientMessageId,
  createdAt: m.createdAt,
});
