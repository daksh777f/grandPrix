import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, Clock, Mic, Pause, Play, Radio, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchVoiceIntelligence, type VoiceIntelligenceData, type VoiceIntelligenceMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import WarpText from '@/components/ui/WarpText';

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function displayValue(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined ? '--' : `${value}${suffix}`;
}

function statusClass(status: string) {
  if (status === 'READY') return 'text-accent-teal border-accent-teal/30 bg-accent-teal/10';
  if (status === 'FAILED') return 'text-brand-red border-brand-red/30 bg-brand-red/10';
  return 'text-ink-muted border-white/10 bg-white/5';
}

function findRequestedMessage(messages: VoiceIntelligenceMessage[], params: URLSearchParams) {
  const eventId = params.get('event_id');
  if (eventId) {
    const byId = messages.find((message) => message.event_id === eventId);
    if (byId) return byId;
  }

  const requestedLap = Number(params.get('lap'));
  const requestedProgress = Number(params.get('progress'));
  const requestedCorner = params.get('corner');
  const requestedTimestamp = params.get('timestamp');
  const candidates = messages.filter((message) => {
    if (Number.isFinite(requestedLap) && message.lap !== requestedLap) return false;
    if (requestedCorner && message.corner !== requestedCorner) return false;
    return true;
  });
  if (!candidates.length) return messages[0] || null;

  if (requestedTimestamp) {
    const requestedTime = Date.parse(requestedTimestamp);
    const timestampMatch = candidates.reduce((closest, message) => {
      const distance = Math.abs(Date.parse(message.timestamp) - requestedTime);
      const closestDistance = Math.abs(Date.parse(closest.timestamp) - requestedTime);
      return distance < closestDistance ? message : closest;
    });
    if (Math.abs(Date.parse(timestampMatch.timestamp) - requestedTime) <= 5000) return timestampMatch;
  }

  if (Number.isFinite(requestedProgress)) {
    return candidates.reduce((closest, message) => {
      const distance = Math.abs((message.progress ?? 0) - requestedProgress);
      const closestDistance = Math.abs((closest.progress ?? 0) - requestedProgress);
      return distance < closestDistance ? message : closest;
    });
  }
  return candidates[0];
}

function liveContextHref(sessionKey: number, message: VoiceIntelligenceMessage) {
  const params = new URLSearchParams({
    session: String(sessionKey),
    driver: String(message.driver_number),
    event_id: message.event_id,
    timestamp: message.timestamp,
  });
  if (message.lap !== null) params.set('lap', String(message.lap));
  if (message.corner) params.set('corner', message.corner);
  if (message.progress !== null) params.set('progress', message.progress.toFixed(6));
  if (message.elapsed !== null) params.set('elapsed', message.elapsed.toFixed(3));
  return `/live?${params.toString()}`;
}

function VoiceSignal({ message }: { message: VoiceIntelligenceMessage }) {
  const voiceState = message.voice.voice_state.replace(/_/g, ' ');
  const emotion = message.voice.emotion ? message.voice.emotion.toUpperCase() : 'UNAVAILABLE';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-white/10 bg-[#111316] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">VOICE STATE</span>
          <Activity className="w-4 h-4 text-accent-amber" />
        </div>
        <div className="font-display text-2xl font-bold uppercase text-ink">{voiceState}</div>
        <div className="font-mono text-[10px] text-ink-muted uppercase tracking-widest mt-2">
          Vocal arousal {message.voice.vocal_arousal === null ? '--' : message.voice.vocal_arousal.toFixed(2)}
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#111316] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">EMOTION LABEL</span>
          <Volume2 className="w-4 h-4 text-chrome" />
        </div>
        <div className="font-display text-2xl font-bold uppercase text-ink">{emotion}</div>
        <div className={cn('inline-flex mt-2 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest', statusClass(message.voice.status))}>
          {message.voice.status}
        </div>
      </div>
    </div>
  );
}

function AudioControl({ message }: { message: VoiceIntelligenceMessage }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    audio.load();
  }, [message.event_id]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Audio playback failed', error);
      setIsPlaying(false);
    }
  };

  const audioAvailable = Boolean(message.audio.audio_url);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!audioAvailable}
          aria-label={isPlaying ? 'Pause transmission' : 'Play transmission'}
          className="w-11 h-11 rounded-full bg-ink text-asphalt flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-transform shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={Math.min(currentTime, duration || 0)}
            disabled={!audioAvailable || !duration}
            onChange={(event) => {
              const nextTime = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
            }}
            className="w-full accent-brand-red disabled:opacity-30"
            aria-label="Transmission timeline"
          />
          <div className="flex justify-between font-mono text-[10px] text-ink-muted mt-1">
            <span>{Math.floor(currentTime)}s</span>
            <span>{duration ? `${Math.floor(duration)}s` : audioAvailable ? '—' : 'AUDIO UNAVAILABLE'}</span>
          </div>
        </div>
        <Radio className={cn('w-4 h-4 shrink-0', audioAvailable ? 'text-brand-red' : 'text-chrome/30')} />
      </div>
      <audio
        ref={audioRef}
        src={message.audio.audio_url}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}

function TimelineItem({ message, selected, onSelect }: { message: VoiceIntelligenceMessage; selected: boolean; onSelect: () => void }) {
  const transcript = message.transcript || 'TRANSCRIPT UNAVAILABLE';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden',
        selected ? 'bg-brand-red/10 border-brand-red/50 shadow-[0_0_20px_rgba(225,6,0,0.1)]' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]',
      )}
    >
      <div className="flex justify-between items-start gap-4 mb-3 font-mono text-[10px] tracking-wider">
        <span className={selected ? 'text-brand-red font-bold' : 'text-ink-muted'}>{formatTimestamp(message.timestamp)}</span>
        <span className="text-ink-muted text-right uppercase">
          {message.lap ? `L${message.lap}` : 'L--'} · {message.corner || 'NO CORNER'}
        </span>
      </div>
      <div className={cn('font-display text-lg font-medium leading-snug', !message.transcript && 'text-ink-muted italic text-sm')}>
        {message.transcript ? `"${transcript}"` : transcript}
      </div>
      <div className="flex items-center gap-2 mt-4 font-mono text-[9px] text-ink-muted uppercase tracking-widest">
        <span>{message.voice.emotion ? message.voice.emotion : 'VOICE UNAVAILABLE'}</span>
        <span className="text-chrome/30">·</span>
        <span>{message.transcription_status}</span>
      </div>
    </button>
  );
}

function ContextGrid({ message }: { message: VoiceIntelligenceMessage }) {
  const race = message.race_context || {};
  const battleLabel = race.is_defending ? 'DEFENDING' : race.battle_active ? 'BATTLE ACTIVE' : 'CLEAR AIR';
  const gap = race.is_defending ? race.gap_behind : race.gap_ahead;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">CAR CONTEXT</div>
        <div className="font-display text-2xl uppercase mb-1">{message.corner || 'NO CORNER'}</div>
        <div className="font-mono text-sm text-ink-muted uppercase">{message.phase || 'PHASE UNAVAILABLE'} · {message.lap ? `LAP ${message.lap}` : 'LAP UNKNOWN'}</div>
      </div>
      <div>
        <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">PERFORMANCE</div>
        <div className="space-y-2 font-mono text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">SPEED</span><span>{displayValue(message.performance.speed, ' km/h')}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">ENTRY DELTA</span><span>{displayValue(message.performance.entry_speed_delta, ' km/h')}</span></div>
          <div className="flex justify-between text-brand-red"><span>DIAGNOSIS</span><span>{message.performance.diagnosis || '--'}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">TIME COST</span><span>{displayValue(message.performance.estimated_time_delta, 's')}</span></div>
        </div>
      </div>
      <div>
        <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">RACE CONTEXT</div>
        <div className="font-display text-2xl uppercase mb-1">{race.position ? `P${race.position}` : 'POSITION UNKNOWN'}</div>
        <div className="font-mono text-sm text-ink-muted uppercase">{battleLabel}{gap === null || gap === undefined ? '' : ` · ${gap}s`}</div>
      </div>
      <div>
        <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">COMMUNICATION GATE</div>
        <div className="font-display text-2xl uppercase mb-1">{message.communication?.state?.replace('_', ' ') || 'UNAVAILABLE'}</div>
        <div className="font-mono text-sm text-ink-muted uppercase">{message.communication?.should_speak ? 'WOULD SPEAK' : 'ARCHIVE SIGNAL ONLY'}</div>
      </div>
    </div>
  );
}

export function VoicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<VoiceIntelligenceData | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<VoiceIntelligenceMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionParam = searchParams.get('session');
    const driverParam = searchParams.get('driver');
    const sessionKey = sessionParam ? Number(sessionParam) : 9165;
    const driverNumber = driverParam ? Number(driverParam) : 1;

    async function loadData() {
      try {
        const response = await fetchVoiceIntelligence(sessionKey, driverNumber);
        setData(response);
        setSelectedMsg(findRequestedMessage(response.messages, searchParams) || null);
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load voice intelligence.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [searchParams]);

  if (loading) {
    return <div className="min-h-screen bg-asphalt flex items-center justify-center pt-20"><div className="text-brand-red animate-pulse font-mono tracking-widest uppercase">Loading Voice Intelligence...</div></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-asphalt flex items-center justify-center pt-20 px-6">
        <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-6 font-mono text-xs uppercase tracking-widest text-brand-red">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-asphalt pt-28 pb-20 px-6 font-body text-white selection:bg-brand-red/30">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <h1 className="font-display text-4xl md:text-6xl font-black uppercase tracking-tight mb-4 text-ink flex flex-col">
                <WarpText text="VOICE INTELLIGENCE" />
              </h1>
              <div className="flex flex-wrap items-center gap-5 font-mono text-xs uppercase tracking-widest text-ink-muted">
                <span>SINGAPORE GP · RACE · 2023</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-white font-bold">VER</span>
                <span className="text-brand-red flex items-center gap-2"><Activity className="w-4 h-4" /> RADIO ARCHIVE</span>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              <span>ASR · WHISPER · HUGGING FACE</span>
              <span>VOICE CLASSIFIER · WAV2VEC2 · HUGGING FACE</span>
              <span className="text-chrome/40">Signals, not psychological diagnosis</span>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-10">
          <aside className="w-full lg:w-1/3 flex flex-col gap-4 max-h-[800px] overflow-y-auto pr-2">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">
              <span>Radio timeline</span>
              <span>{data?.messages.length || 0} transmissions</span>
            </div>
            {data?.messages.map((message) => (
              <TimelineItem key={message.event_id} message={message} selected={selectedMsg?.event_id === message.event_id} onSelect={() => setSelectedMsg(message)} />
            ))}
            {!data?.messages.length && <div className="border border-white/10 rounded-xl p-6 font-mono text-xs text-ink-muted uppercase">No radio events available.</div>}
          </aside>

          <main className="w-full lg:w-2/3">
            <AnimatePresence mode="wait">
              {selectedMsg && (
                <motion.div key={selectedMsg.event_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }} className="bg-[#0f1115] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-red to-transparent opacity-60" />
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-8 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                    <span className="text-brand-red">{selectedMsg.lap ? `L${selectedMsg.lap}` : 'L--'} · {selectedMsg.corner || 'NO CORNER'} · {selectedMsg.phase || 'PHASE UNKNOWN'}</span>
                    <span>{formatTimestamp(selectedMsg.timestamp)}</span>
                  </div>

                  <div className="mb-8">
                    <div className="font-mono text-xs text-brand-red tracking-widest uppercase mb-4 flex items-center gap-2"><Mic className="w-4 h-4" /> DRIVER RADIO</div>
                    <div className={cn('font-display text-3xl md:text-5xl font-medium leading-tight', selectedMsg.transcript ? 'text-white' : 'text-ink-muted italic')}>
                      {selectedMsg.transcript ? `"${selectedMsg.transcript}"` : 'Transcript unavailable'}
                    </div>
                  </div>

                  <div className="mb-8"><AudioControl message={selectedMsg} /></div>
                  <div className="flex justify-end mb-8">
                    <button
                      type="button"
                      onClick={() => navigate(liveContextHref(data?.session_key || 9165, selectedMsg))}
                      className="inline-flex items-center gap-2 border border-chrome/20 text-chrome/70 hover:text-ink hover:border-chrome/50 px-3 py-2 rounded font-mono text-[10px] uppercase tracking-widest transition-colors"
                    >
                      View live context <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="mb-8"><VoiceSignal message={selectedMsg} /></div>
                  <div className="mb-10"><ContextGrid message={selectedMsg} /></div>

                  {selectedMsg.ai_interpretation && (
                    <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-6 relative overflow-hidden">
                      <div className="font-mono text-[10px] text-brand-red tracking-widest uppercase mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> AI CO-DRIVER INTERPRETATION · {selectedMsg.ai_interpretation.status}</div>
                      <div className="space-y-4 font-body">
                        <div><span className="block text-xs font-bold text-white/50 uppercase mb-1">Observation</span><p className="text-white text-lg">"{selectedMsg.ai_interpretation.message}"</p></div>
                        <div><span className="block text-xs font-bold text-white/50 uppercase mb-1">Action</span><p className="text-white text-lg">"{selectedMsg.ai_interpretation.advice}"</p></div>
                      </div>
                    </div>
                  )}
                  {!selectedMsg.ai_interpretation && <div className="border border-white/10 rounded-xl p-5 text-ink-muted font-mono text-xs uppercase tracking-widest">Interpretation unavailable without a transcript.</div>}
                </motion.div>
              )}
            </AnimatePresence>
            {!selectedMsg && !data?.messages.length && <div className="min-h-[400px] flex items-center justify-center border border-white/10 rounded-2xl text-ink-muted font-mono text-xs uppercase tracking-widest"><Clock className="w-4 h-4 mr-2" /> Waiting for radio archive</div>}
          </main>
        </div>
      </div>
    </div>
  );
}
