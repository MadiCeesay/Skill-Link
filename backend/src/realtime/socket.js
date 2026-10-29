import { Server } from 'socket.io';
import { z } from 'zod';
import { objectId } from '../utils/validation.js';
import { messageWrite } from '../modules/conversations/conversation.validator.js';
const room = (id) => 'conversation:' + id;
export function attachSocket(server, app, config) {
  const { auth, conversations } = app.locals.services;
  const io = new Server(server, {
    maxHttpBufferSize: 16384,
    cors: { origin: config.FRONTEND_ORIGIN, methods: ['GET', 'POST'] },
    allowRequest: (req, done) =>
      done(
        null,
        !req.headers.origin || req.headers.origin === config.FRONTEND_ORIGIN,
      ),
  });
  const credential = (socket) => socket.handshake.auth?.token;
  io.use(async (socket, next) => {
    try {
      if (
        typeof credential(socket) !== 'string' ||
        credential(socket).length > 4096
      )
        throw Error();
      socket.data.auth = await auth.authenticate(credential(socket));
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
  // Reauthenticate recipients before every delivery; room membership alone cannot outlive revocation.
  async function publish(id, event, data) {
    const sockets = await io.in(room(id)).fetchSockets();
    await Promise.all(
      sockets.map(async (socket) => {
        try {
          const a = await auth.authenticate(credential(socket));
          await conversations.own(id, a.user);
          socket.emit(event, data);
        } catch {
          socket.disconnect(true);
        }
      }),
    );
  }
  app.locals.publish = publish;
  io.on('connection', (socket) => {
    let window = Date.now(),
      count = 0;
    const handle = (fn) => async (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (Date.now() - window > 60000) {
          window = Date.now();
          count = 0;
        }
        if (++count > 30) {
          ack({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many socket actions' },
          });
          return;
        }
        const principal = await auth.authenticate(credential(socket));
        const data = await fn(payload, principal.user);
        ack({ success: true, data });
      } catch (e) {
        ack({
          success: false,
          error: {
            code:
              e.code && typeof e.code === 'string' ? e.code : 'INVALID_REQUEST',
            message: e.status ? e.message : 'Invalid or unauthorized request',
          },
        });
      }
    };
    socket.on(
      'conversation:join',
      handle(async (payload, user) => {
        const id = objectId.parse(payload?.conversation);
        await conversations.own(id, user);
        await socket.join(room(id));
        return { joined: true };
      }),
    );
    socket.on(
      'message:send',
      handle(async (payload, user) => {
        const input = z
          .object({ conversation: objectId, message: messageWrite })
          .strict()
          .parse(payload);
        const data = await conversations.send(
          input.conversation,
          user,
          input.message,
        );
        await publish(input.conversation, 'message', data);
        return data;
      }),
    );
    socket.on(
      'conversation:read',
      handle(async (payload, user) =>
        conversations.read(objectId.parse(payload?.conversation), user),
      ),
    );
  });
  return io;
}
