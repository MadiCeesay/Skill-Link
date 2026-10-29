import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Mic,
  Square,
  Trash2,
  ImagePlus,
  Paperclip,
  MessageSquare,
  ArrowLeft,
  ShieldCheck,
  Wifi,
  WifiOff,
  CheckCheck,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../api/auth';
import { useRealtime } from '../api/realtime';
import { useApi, useAction, useCatalog } from '../api/hooks';
import { api, upload } from '../api/client';
import {
  PageTitle,
  Button,
  Panel,
  Empty,
  QueryState,
  ErrorNotice,
  ProtectedMedia,
  Pager,
  Notice,
  Field,
  Chip,
} from '../components/ui';
import { homeFor } from '../utils/policy';
import { dateTime, money } from '../utils/format';
import { recordedVoice } from '../utils/voice';
export function StartChat({ type, id }) {
  const action = useAction(),
    { user } = useAuth(),
    navigate = useNavigate();
  return (
    <>
      <Button
        variant="outline"
        disabled={action.isPending}
        onClick={async () => {
          try {
            const d = await action.mutateAsync({
              path: '/conversations',
              body: { contextType: type, contextId: id },
            });
            navigate(homeFor(user.role) + '/messages/' + d.conversation.id);
          } catch {
            /* Error displayed below. */
          }
        }}
      >
        <MessageSquare size={16} />
        {action.isPending ? 'Opening…' : 'Message'}
      </Button>
      {action.error && <ErrorNotice error={action.error} />}
    </>
  );
}
function ConversationRow({ conversation: c, active }) {
  const { user } = useAuth(),
    latest = useApi(
      '/conversations/' + c.id + '/messages',
      { page: 1, limit: 1 },
      { staleTime: 60000 },
    ),
    m = latest.data?.messages[0],
    unread = m && m.sender !== user.id && !m.readBy.includes(user.id);
  return (
    <Link
      to={homeFor(user.role) + '/messages/' + c.id}
      className={'conversation-row ' + (active ? 'active' : '')}
    >
      <span className="conversation-avatar">
        <MessageSquare size={21} />
      </span>
      <div>
        <strong>
          {c.contextType === 'BOOKING'
            ? 'Booking conversation'
            : c.contextType === 'QUOTE'
              ? 'Your service quote'
              : 'Service proposal'}
        </strong>
        <p>
          {m
            ? m.type === 'TEXT'
              ? m.text
              : m.type === 'VOICE'
                ? 'Voice message'
                : 'Shared image'
            : 'Start the conversation'}
        </p>
        <small>Project discussion</small>
      </div>
      {unread && (
        <span className="unread-dot" aria-label="Latest message unread" />
      )}
    </Link>
  );
}
export function Messages() {
  const { id } = useParams(),
    [page, setPage] = useState(1),
    query = useApi('/conversations/me', { page, limit: 15 }),
    { user } = useAuth();
  return (
    <>
      <PageTitle
        eyebrow="KEEP THE DETAILS TOGETHER"
        title="A good conversation goes a long way."
        description="Talk through your project with messages, photos and voice notes."
      />
      <div className={'messenger ' + (id ? 'has-conversation' : '')}>
        <aside className="conversation-sidebar">
          <h2>Your conversations</h2>
          <QueryState query={query}>
            {(data) => (
              <>
                {data.conversations.length ? (
                  data.conversations.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      active={c.id === id}
                    />
                  ))
                ) : (
                  <Empty
                    icon={MessageSquare}
                    title="Your next connection"
                    description="Open a conversation from a quote, direct proposal or booking."
                  />
                )}
                <Pager
                  pagination={data.pagination}
                  page={page}
                  onChange={setPage}
                />
              </>
            )}
          </QueryState>
        </aside>
        {id ? (
          <Conversation key={id} id={id} />
        ) : (
          <div className="conversation-placeholder">
            <MessageSquare size={42} />
            <h2>A little clarity makes a big difference.</h2>
            <p>
              Choose a conversation, or open one from a quote, proposal or
              booking.
            </p>
            <Button to={homeFor(user.role) + '/bookings'} variant="secondary">
              Go to bookings
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
function Conversation({ id }) {
  const realtime = useRealtime();
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    query = useApi('/conversations/' + id),
    history = useApi(
      '/conversations/' + id + '/messages',
      { page, limit: 30 },
      { refetchInterval: realtime.status === 'connected' ? false : 60000 },
    ),
    { setActive, status } = realtime,
    cache = useQueryClient(),
    bottom = useRef(null);
  const unread = (history.data?.messages || [])
    .filter((m) => m.sender !== user.id && !m.readBy.includes(user.id))
    .map((m) => m.id)
    .join(',');
  useEffect(() => {
    setActive(id);
    return () => setActive(null);
  }, [id, setActive]);
  useEffect(() => {
    if (!unread) return;
    let alive = true;
    api('/conversations/' + id + '/read', { method: 'POST', body: {} })
      .then(() => {
        if (alive)
          cache.invalidateQueries({
            queryKey: ['api', '/conversations/' + id + '/messages'],
          });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [unread, id, cache]);
  useEffect(() => {
    if (page === 1) bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [history.data, page]);
  return (
    <QueryState query={query}>
      {({ conversation: c }) => (
        <section className="conversation-main">
          <header className="chat-header">
            <Link
              className="icon-button chat-back"
              to={homeFor(user.role) + '/messages'}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={19} />
            </Link>
            <span className="conversation-avatar">
              <MessageSquare size={22} />
            </span>
            <div>
              <h2>
                {c.contextType === 'BOOKING'
                  ? 'Your booking conversation'
                  : c.contextType === 'QUOTE'
                    ? 'Your quote conversation'
                    : 'Your service proposal'}
              </h2>
              <p>
                {status === 'connected' ? (
                  <>
                    <Wifi size={13} />
                    Connected
                  </>
                ) : (
                  <>
                    <WifiOff size={13} />
                    History sync · reconnecting when available
                  </>
                )}
              </p>
            </div>
            {c.contextType === 'BOOKING' && (
              <Link
                className="text-link"
                to={homeFor(user.role) + '/bookings/' + c.contextId}
              >
                View booking →
              </Link>
            )}
          </header>
          <ConversationContext conversation={c} />
          <div className="chat-safety">
            <ShieldCheck size={15} />
            Keep the project, the plan and the conversation in SkillLink.
          </div>
          <div className="message-history">
            <QueryState query={history}>
              {(data) => (
                <>
                  <Pager
                    pagination={data.pagination}
                    page={page}
                    onChange={setPage}
                  />
                  {data.messages.length ? (
                    data.messages
                      .slice()
                      .reverse()
                      .map((m) => (
                        <article
                          key={m.id}
                          className={
                            'message ' +
                            (m.sender === user.id ? 'outgoing' : 'incoming')
                          }
                        >
                          <div className="message-bubble">
                            {m.type === 'TEXT' || m.type === 'SYSTEM' ? (
                              <p>{m.text}</p>
                            ) : (
                              <ProtectedMedia
                                path={
                                  '/conversations/' +
                                  id +
                                  '/media/' +
                                  m.media +
                                  '/access'
                                }
                                kind={m.type === 'VOICE' ? 'audio' : 'image'}
                                alt="Shared project photo"
                              />
                            )}
                          </div>
                          <small>
                            {dateTime(m.createdAt)}
                            {m.sender === user.id && m.readBy.length > 1 && (
                              <CheckCheck size={13} aria-label="Read" />
                            )}
                          </small>
                        </article>
                      ))
                  ) : (
                    <Empty
                      title="Start with a hello"
                      description="Introduce your project, ask a question or share a voice note."
                    />
                  )}
                  <div ref={bottom} />
                </>
              )}
            </QueryState>
          </div>
          <Composer id={id} />
        </section>
      )}
    </QueryState>
  );
}
function ConversationContext({ conversation: c }) {
  const { user } = useAuth(), { services } = useCatalog();
  const path = c.contextType === 'BOOKING' ? '/bookings/' : c.contextType === 'DIRECT_PROPOSAL' ? '/direct-proposals/' : '/quotes/';
  const query = useApi(path + c.contextId, undefined, { refetchInterval: 60000 });
  const item = query.data?.booking || query.data?.proposal || query.data?.quote;
  if (!item) return <div className="chat-context"><span>Messages discuss the work. Formal actions confirm the agreement.</span></div>;
  const bookingId = c.contextType === 'BOOKING' ? item.id : item.booking;
  return <div className="chat-context"><strong>{services.find(s => s.id === item.service)?.name || 'Your project'}</strong><span>{item.pricingMode === 'REQUEST_QUOTE' && item.status !== 'ACCEPTED'
    ? item.quotes?.length ? 'Professional quote: ' + money(item.quotes.at(-1).amountBututs) : 'Quote requested'
    : money(item.agreedAmountBututs ?? item.proposedAmountBututs)}</span><Chip status={item.status} />
    {item.scheduledStart && <span>{dateTime(item.scheduledStart)}</span>}
    <Link className="text-link" to={homeFor(user.role) + (bookingId ? '/bookings/' + bookingId : c.contextType === 'DIRECT_PROPOSAL' ? '/proposals' : user.role === 'WORKER' ? '/quotes/' + item.id : '/jobs')}>{bookingId ? 'View booking' : 'Review formal terms'} →</Link>
  </div>;
}
function Composer({ id }) {
  const [text, setText] = useState(''),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [audio, setAudio] = useState(null),
    [preview, setPreview] = useState(null);
  const recorder = useRef(null),
    stream = useRef(null),
    chunks = useRef([]),
    cancelled = useRef(false),
    action = useAction();
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (recording && seconds >= 180) recorder.current?.stop();
  }, [recording, seconds]);
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!audio) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(audio);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  async function send(body) {
    await action.mutateAsync({
      path: '/conversations/' + id + '/messages',
      body: { ...body, clientMessageId: crypto.randomUUID() },
    });
  }
  async function sendText(e) {
    e.preventDefault();
    setError(null);
    const submittedText = text;
    try {
      await send({ type: 'TEXT', text: submittedText });
      setText((draft) => draft === submittedText ? '' : draft);
    } catch (err) {
      setError(err);
    }
  }
  async function fileMessage(file, type) {
    setBusy(true);
    setError(null);
    try {
      const media = await upload(
        file,
        type === 'VOICE' ? 'VOICE_NOTE' : 'CHAT_IMAGE',
      );
      await send({ type, media: media.id });
      if (type === 'VOICE') setAudio(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setError(null);
    cancelled.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error(
          'This browser cannot record audio. Use a supported browser or attach an existing WAV, Ogg or WebM recording.',
        );
      const mime = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus'].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      if (!mime)
        throw Error(
          'Your browser cannot record the supported Opus format. You can attach a WAV, Ogg or WebM recording instead.',
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const r = new MediaRecorder(stream.current, {
        mimeType: mime,
        audioBitsPerSecond: 48000,
      });
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = async () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (!cancelled.current) {
          try { const file = await recordedVoice(chunks.current, r.mimeType); if (!cancelled.current) setAudio(file); }
          catch (error) { setError(error); }
        }
      };
      r.onerror = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setError(Error('The recording could not finish. Please try again.'));
      };
      setSeconds(0);
      setRecording(true);
      // Stop produces one complete container, rather than treating a streamed
      // fragment as an independently uploadable recording.
      r.start();
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        Error(
          e.name === 'NotAllowedError'
            ? 'Microphone permission was not granted. You can still type or attach an audio file.'
            : e.message,
        ),
      );
    }
  }
  return (
    <div className="composer">
      {error && <ErrorNotice error={error} />}{' '}
      {recording ? (
        <div className="recording-bar">
          <span className="recording-dot" />
          <strong>
            Recording {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, '0')}
          </strong>
          <Button variant="outline" onClick={() => recorder.current?.stop()}>
            <Square size={16} />
            Stop & preview
          </Button>
          <button
            className="icon-button"
            aria-label="Cancel recording"
            onClick={() => {
              cancelled.current = true;
              recorder.current?.stop();
              setAudio(null);
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ) : audio ? (
        <div className="recording-bar">
          <audio controls src={preview} />
          <Button disabled={busy} onClick={() => fileMessage(audio, 'VOICE')}>
            {busy ? 'Sending…' : 'Send voice note'}
            <Send size={16} />
          </Button>
          <button
            className="icon-button"
            aria-label="Discard voice note"
            onClick={() => setAudio(null)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ) : (
        <form className="composer-row" onSubmit={sendText}>
          <label className="icon-button attach" title="Attach a project image">
            <ImagePlus size={21} />
            <span className="sr-only">Attach an image</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files[0]) fileMessage(e.target.files[0], 'IMAGE');
                e.target.value = '';
              }}
            />
          </label>
          <label className="sr-only" htmlFor="message-text">
            Your message
          </label>
          <input
            id="message-text"
            value={text}
            maxLength={2000}
            required
            onChange={(e) => setText(e.target.value)}
            placeholder="A question, a detail, a quick hello…"
          />
          <button
            className="icon-button"
            type="button"
            onClick={start}
            disabled={busy}
            aria-label="Record a voice note"
          >
            <Mic size={21} />
          </button>
          <button
            className="send-button"
            type="submit"
            disabled={!text.trim() || busy || action.isPending}
            aria-label="Send message"
          >
            <Send size={19} />
          </button>
        </form>
      )}
      <div className="composer-foot">
        <span>
          {busy
            ? 'Uploading and sending…'
            : 'Text, photos or a voice note. Your project, in your words.'}
        </span>
        <label className="text-button attach small">
          Attach audio
          <input
            type="file"
            accept="audio/wav,audio/ogg,audio/webm"
            disabled={busy || recording}
            onChange={(e) => {
              if (e.target.files[0]) setAudio(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}
