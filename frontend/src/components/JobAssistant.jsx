import { useEffect, useRef, useState } from 'react';
import { Sparkles, Mic, Square, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useApi, useAction } from '../api/hooks';
import { upload } from '../api/client';
import { recordedVoice } from '../utils/voice';
import { money } from '../utils/format';
import { Button, ErrorNotice, Field, FileUpload } from './ui';

const URGENCY = { LOW: 'Not urgent', NORMAL: 'Normal', URGENT: 'Urgent' };

// Records one short voice note in a format the server accepts (Opus in Ogg or WebM).
function useVoiceNote() {
  const [file, setFile] = useState(null),
    [recording, setRecording] = useState(false),
    [error, setError] = useState(null),
    recorder = useRef(null),
    stream = useRef(null),
    chunks = useRef([]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  async function start() {
    setError(null);
    try {
      const mime = window.MediaRecorder && ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
      if (!navigator.mediaDevices?.getUserMedia || !mime) throw Error('This browser cannot record audio. You can type instead.');
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream.current, { mimeType: mime, audioBitsPerSecond: 48000 });
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        try { setFile(await recordedVoice(chunks.current, r.mimeType)); } catch (e) { setError(e); }
      };
      r.start();
      setRecording(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(Error(e.name === 'NotAllowedError' ? 'Microphone permission was not granted. You can type instead.' : e.message));
    }
  }
  return { file, recording, error, start, stop: () => recorder.current?.stop(), clear: () => setFile(null) };
}

/**
 * "Describe it in your own words" helper shown at the top of Post request.
 * Calls onApply(draft, photoIds) when the customer chooses to use the suggestion.
 * Hidden completely when the server has no AI key configured.
 */
export function JobAssistant({ onApply }) {
  const status = useApi('/assistant/status'),
    action = useAction(),
    voice = useVoiceNote(),
    [text, setText] = useState(''),
    [photos, setPhotos] = useState([]),
    [photosBusy, setPhotosBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [draft, setDraft] = useState(null),
    [previewUrl, setPreviewUrl] = useState(null);
  useEffect(() => {
    if (!voice.file) return setPreviewUrl(null);
    const url = URL.createObjectURL(voice.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [voice.file]);

  if (!status.data?.jobDraft) return null;

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (text.trim()) body.text = text.trim();
      if (photos.length) body.photos = photos;
      if (voice.file) body.voice = (await upload(voice.file, 'VOICE_NOTE')).id;
      const data = await action.mutateAsync({ path: '/assistant/job-draft', method: 'POST', body });
      setDraft(data.draft);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const canAsk = (text.trim().length >= 3 || photos.length || voice.file) && !busy && !photosBusy && !voice.recording;
  const price = draft?.priceRange;

  return (
    <section className="assistant-card" aria-labelledby="assistant-title">
      <header className="row">
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <h3 id="assistant-title">Not sure how to describe it?</h3>
          <p className="muted small">Type a few words, add a photo or record a voice note in any language. SkillLink will write it up for you to check.</p>
        </div>
      </header>

      <div className="stack">
          <Field label="What is the problem?" as="textarea" rows={3} maxLength={1500} value={text}
            onChange={(e) => setText(e.target.value)} placeholder="e.g. water coming from the ceiling when it rains" />
          <FileUpload purpose="JOB_ATTACHMENT" label="Add up to 3 photos" multiple max={3} preview
            onChange={setPhotos} onBusyChange={setPhotosBusy} />
          <div className="row wrap">
            {voice.recording ? (
              <Button variant="outline" type="button" onClick={voice.stop}><Square size={16} /> Stop recording</Button>
            ) : voice.file ? (
              <>
                <audio controls src={previewUrl || undefined} />
                <button type="button" className="icon-button" aria-label="Remove voice note" onClick={voice.clear}><Trash2 size={18} /></button>
              </>
            ) : (
              <Button variant="outline" type="button" onClick={voice.start}><Mic size={16} /> Record a voice note</Button>
            )}
          </div>
          {voice.error && <ErrorNotice error={voice.error} />}
          {error && <ErrorNotice error={error} />}
          <Button type="button" onClick={ask} disabled={!canAsk}>
            <Sparkles size={16} /> {busy ? 'Writing your request…' : 'Write it for me'}
          </Button>
          {busy && <p className="muted small" role="status">Reading your description and checking SkillLink prices. This usually takes a few seconds.</p>}
          <p className="muted small">Don’t include phone numbers or names. Your words and photos are sent to an AI service to write the draft.</p>
      </div>
      {draft && (
        <div className="stack assistant-result" aria-live="polite">
          <p className="assistant-label">AI suggestion · check it before posting</p>
          {draft.transcript && <p className="small"><strong>We heard{draft.detectedLanguage ? ' (' + draft.detectedLanguage + ')' : ''}:</strong> {draft.transcript}</p>}
          <h4>{draft.title}</h4>
          <p>{draft.description}</p>
          <dl className="assistant-facts">
            <div><dt>Service</dt><dd>{draft.service?.name || 'Please choose one'}</dd></div>
            <div><dt>Urgency</dt><dd>{URGENCY[draft.urgency]}</dd></div>
            <div>
              <dt>Typical price</dt>
              <dd>
                {price ? money(price.minBututs) + ' – ' + money(price.maxBututs) : 'Ask for offers'}
                {price && <span className="muted small"> {price.source === 'SKILLLINK_BOOKINGS' ? '· based on ' + price.sampleSize + ' SkillLink jobs' : '· rough AI estimate'}</span>}
              </dd>
            </div>
          </dl>
          {draft.safetyNote && <p className="assistant-warning"><AlertTriangle size={16} aria-hidden="true" /> {draft.safetyNote}</p>}
          {draft.followUpQuestions.length > 0 && (
            <div>
              <p className="small"><strong>Add these details if you know them:</strong></p>
              <ul className="small">{draft.followUpQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
          {draft.confidence < 0.5 && <p className="muted small">The assistant was not very sure. Please read it carefully.</p>}
          <div className="row wrap">
            <Button type="button" onClick={() => onApply(draft, photos)}>Use this</Button>
            <Button type="button" variant="outline" onClick={ask} disabled={!canAsk}><RefreshCw size={16} /> Try again</Button>
          </div>
        </div>
      )}
    </section>
  );
}
