import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Activity, AlertTriangle, Play, Pause, Clock } from 'lucide-react';
import { fetchRadioIntelligence, type RadioIntelligenceMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import WarpText from '@/components/ui/WarpText';

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function VoicePage() {
  const [messages, setMessages] = useState<RadioIntelligenceMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<RadioIntelligenceMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchRadioIntelligence(9165, 1);
        setMessages(data.messages);
        if (data.messages.length > 0) {
          setSelectedMsg(data.messages[0]);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load radio intelligence.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Handle Audio playback logic
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      // Ensure we load the new source
      audioRef.current.load();
    }
  }, [selectedMsg]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-asphalt flex items-center justify-center pt-20">
        <div className="text-brand-red animate-pulse font-mono tracking-widest uppercase">Loading Radio Intelligence...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-asphalt flex items-center justify-center text-white font-mono pt-20">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-asphalt pt-28 pb-20 px-6 font-body text-white selection:bg-brand-red/30">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="mb-16 border-b border-white/10 pb-8">
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight mb-4 text-ink flex flex-col">
            <WarpText text="SILENT CO-DRIVER" />
          </h1>
          <div className="flex flex-wrap items-center gap-6 font-mono text-xs uppercase tracking-widest text-ink-muted">
            <span className="flex items-center gap-2">SINGAPORE GP · RACE · 2023</span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-white font-bold">VER</span>
            <span className="text-brand-red flex items-center gap-2"><Activity className="w-4 h-4" /> RADIO INTELLIGENCE</span>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-12">

          {/* Left Column: Timeline */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4 max-h-[800px] overflow-y-auto pr-4">
            {messages.map((msg, i) => (
              <button
                key={i}
                onClick={() => setSelectedMsg(msg)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group",
                  selectedMsg === msg
                    ? "bg-brand-red/10 border-brand-red/50 shadow-[0_0_20px_rgba(225,6,0,0.1)]"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                <div className="flex justify-between items-start mb-2 font-mono text-[10px] tracking-wider">
                  <span className={selectedMsg === msg ? "text-brand-red font-bold" : "text-ink-muted"}>
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  <span className="text-ink-muted text-right">
                    {msg.track_context.lap ? `L${msg.track_context.lap}` : ''} {msg.track_context.corner ? `· ${msg.track_context.corner}` : ''}
                    <br/>
                    VER
                  </span>
                </div>

                <div className="font-display text-lg font-medium leading-snug">
                  {msg.transcription.status === 'READY' && msg.transcription.transcript ? (
                    `"${msg.transcription.transcript}"`
                  ) : msg.transcription.status === 'FAILED' ? (
                    <span className="text-ink-muted italic text-sm">TRANSCRIPTION FAILED</span>
                  ) : (
                    <span className="text-ink-muted italic text-sm flex items-center gap-2">
                      <Clock className="w-3 h-3 animate-spin" /> TRANSCRIPTION PENDING
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right Column: Selected Transmission Details */}
          <div className="w-full lg:w-2/3">
            <AnimatePresence mode="wait">
              {selectedMsg && (
                <motion.div
                  key={selectedMsg.timestamp}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="bg-[#0f1115] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-red to-transparent opacity-50" />

                  {/* Big Transcript */}
                  <div className="mb-10">
                    <div className="font-mono text-xs text-brand-red tracking-widest uppercase mb-4 flex items-center gap-2">
                      <Mic className="w-4 h-4" /> TRANSMISSION
                    </div>
                    <div className="font-display text-3xl md:text-5xl font-medium leading-tight text-white">
                      {selectedMsg.transcription.status === 'READY' && selectedMsg.transcription.transcript ? (
                        `"${selectedMsg.transcription.transcript}"`
                      ) : selectedMsg.transcription.status === 'FAILED' ? (
                        <span className="text-ink-muted italic text-2xl">Transcription Failed</span>
                      ) : (
                        <span className="text-ink-muted italic text-2xl">Transcription Pending...</span>
                      )}
                    </div>
                  </div>

                  {/* Audio Player */}
                  {selectedMsg.audio.recording_url && (
                    <div className="mb-10 bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                      <button
                        onClick={togglePlay}
                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shrink-0"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                      </button>
                      <div className="flex-1">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden relative">
                          <div
                            className="absolute top-0 left-0 h-full bg-brand-red"
                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 font-mono text-[10px] text-ink-muted">
                          <span>{Math.floor(currentTime)}s</span>
                          <span>{duration > 0 ? `${Math.floor(duration)}s` : '...'}</span>
                        </div>
                      </div>
                      <audio
                        ref={audioRef}
                        src={selectedMsg.audio.recording_url}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Grid Context */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

                    {/* Track Context */}
                    <div>
                      <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">
                        Track Context
                      </div>
                      <div className="font-display text-xl uppercase mb-1">
                        {selectedMsg.track_context.corner || 'UNKNOWN CORNER'}
                        {selectedMsg.track_context.phase && <span className="text-brand-red ml-2">· {selectedMsg.track_context.phase}</span>}
                      </div>
                      <div className="font-mono text-sm text-ink-muted">
                        {selectedMsg.track_context.lap ? `LAP ${selectedMsg.track_context.lap}` : 'LAP UNKNOWN'}
                      </div>
                    </div>

                    {/* Performance */}
                    <div>
                      <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">
                        Performance
                      </div>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex justify-between">
                          <span className="text-ink-muted">SPEED</span>
                          <span>{selectedMsg.telemetry_context.speed !== null ? `${selectedMsg.telemetry_context.speed} km/h` : '--'}</span>
                        </div>
                        {selectedMsg.telemetry_context.diagnosis && (
                          <div className="flex justify-between text-brand-red">
                            <span>DIAGNOSIS</span>
                            <span>{selectedMsg.telemetry_context.diagnosis}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Race Context */}
                    <div>
                      <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">
                        Race Context
                      </div>
                      <div className="font-display text-2xl uppercase mb-1">
                        {selectedMsg.race_context.position ? `P${selectedMsg.race_context.position}` : 'UNKNOWN P'}
                      </div>
                      <div className="font-mono text-sm text-ink-muted uppercase">
                        {selectedMsg.race_context.is_defending ? 'DEFENDING' : selectedMsg.race_context.battle_active ? 'ATTACKING' : 'CLEAR AIR'}
                        {selectedMsg.race_context.gap_behind && selectedMsg.race_context.is_defending && ` · ${selectedMsg.race_context.gap_behind}s`}
                        {selectedMsg.race_context.gap_ahead && !selectedMsg.race_context.is_defending && ` · ${selectedMsg.race_context.gap_ahead}s`}
                      </div>
                    </div>

                    {/* Voice State */}
                    <div>
                      <div className="font-mono text-[10px] text-ink-muted tracking-widest uppercase mb-3 border-b border-white/10 pb-2">
                        Voice State
                      </div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full font-mono text-xs text-ink-muted uppercase">
                        <AlertTriangle className="w-3 h-3" />
                        {selectedMsg.voice_state?.state || "ANALYSIS PENDING"}
                      </div>
                    </div>
                  </div>

                  {/* AI Interpretation */}
                  {selectedMsg.ai_interpretation && selectedMsg.ai_interpretation.status === 'READY' && (
                    <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-6 relative overflow-hidden">
                      <div className="font-mono text-[10px] text-brand-red tracking-widest uppercase mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> RACE ENGINEER INTERPRETATION
                      </div>
                      <div className="space-y-4 font-body">
                        <div>
                          <span className="block text-xs font-bold text-white/50 uppercase mb-1">Observation</span>
                          <p className="text-white text-lg">"{selectedMsg.ai_interpretation.message}"</p>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-white/50 uppercase mb-1">Instruction</span>
                          <p className="text-white text-lg">"{selectedMsg.ai_interpretation.advice}"</p>
                        </div>
                      </div>
                    </div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
