export interface Driver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
  team_colour: string;
  headshot_url: string;
  country_code: string;
}

export interface VoiceIntelligenceMessage {
  event_id: string;
  timestamp: string;
  elapsed: number | null;
  driver_number: number;
  lap: number | null;
  corner: string | null;
  phase: string | null;
  progress: number | null;
  recording_url: string;
  audio: {
    recording_url: string;
    audio_url: string;
    local_cached: boolean;
  };
  transcript: string | null;
  transcription_status: string;
  voice: {
    emotion: string | null;
    scores: Record<string, number>;
    voice_state: string;
    vocal_arousal: number | null;
    status: string;
    model: string;
    provider: string;
  };
  performance: {
    speed: number | null;
    entry_speed_delta: number | null;
    diagnosis: string | null;
    estimated_time_delta: number | null;
    confidence: number | null;
  };
  race_context: {
    position?: number | null;
    battle_active?: boolean;
    is_defending?: boolean;
    gap_ahead?: number | null;
    gap_behind?: number | null;
    [key: string]: unknown;
  };
  communication: {
    state: "MONITORING" | "ATTENTION" | "RADIO_NOW";
    should_speak: boolean;
    priority: string | null;
    reason: string | null;
    cooldown_remaining: number;
  } | null;
  ai_interpretation: {
    message: string;
    advice: string;
    status: string;
  } | null;
}

export interface VoiceIntelligenceData {
  session_key: number;
  driver_number: number;
  models: {
    asr: { provider: string; model: string };
    emotion: { provider: string; model: string };
  };
  messages: VoiceIntelligenceMessage[];
}

export async function fetchGrid(): Promise<Driver[]> {
  const response = await fetch('/api/grid');
  if (!response.ok) {
    throw new Error('Failed to fetch grid data');
  }
  const data = await response.json();
  return data.drivers;
}

export interface ReplaySample {
  elapsed: number;
  x: number;
  y: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  drs: number;
}

export interface ReplayData {
  session_key: number;
  driver_number: number;
  lap_number: number;
  lap_duration: number;
  samples: ReplaySample[];
}

export async function fetchReplay(sessionKey: number, driverNumber: number, lap: number = 2): Promise<ReplayData> {
  const response = await fetch(`/api/replay/${sessionKey}/${driverNumber}?lap=${lap}`);
  if (!response.ok) {
    throw new Error('Failed to fetch replay data');
  }
  return response.json();
}

export interface LiveAnalysisSample {
  elapsed: number;
  lap_number: number;
  progress: number;
  target: { x: number; y: number; speed: number; gear: number; brake: number; throttle: number };
  benchmark: { speed: number; gear: number; brake: number; throttle: number };
  current_corner: {
    name: string;
    phase: string;
  };
  comparison: {
    entry_speed_delta: number;
    minimum_speed_delta: number;
    exit_speed_delta: number;
    braking_delta: number;
    throttle_delay: number;
  };
  others?: Record<string, { x: number, y: number }>;
  analysis: {
    diagnosis: string;
    severity: string;
    estimated_time_delta: number | null;
    confidence: number;
    message: string;
    advice: string;
  };
  race_context?: {
    position: number | null;
    driver_behind: number | null;
    gap_behind: number | null;
    battle_active: boolean;
    is_defending: boolean;
    position_event: string;
  };
  communication: {
    state: "MONITORING" | "ATTENTION" | "RADIO_NOW";
    should_speak: boolean;
    priority: string | null;
    reason: string | null;
    cooldown_remaining: number;
  };
}

export interface LiveAnalysisData {
  session_key: number;
  target_driver: number;
  benchmark_driver: number;
  lap_number: number;
  samples: LiveAnalysisSample[];
}

export async function fetchLiveAnalysis(sessionKey: number, driverNumber: number): Promise<LiveAnalysisData> {
  const res = await fetch(`/api/live-analysis/${sessionKey}/${driverNumber}`);
  if (!res.ok) throw new Error("Failed to fetch live analysis");
  return res.json();
}

export interface CornerComparison {
  corner: string;
  target: {
    entry_speed: number | null;
    braking_progress: number | null;
    minimum_speed: number | null;
    exit_speed: number | null;
    throttle_progress: number | null;
    traversal_time: number | null;
  };
  benchmark: {
    entry_speed: number | null;
    braking_progress: number | null;
    minimum_speed: number | null;
    exit_speed: number | null;
    throttle_progress: number | null;
    traversal_time: number | null;
  };
  delta: {
    entry_speed: number | null;
    minimum_speed: number | null;
    exit_speed: number | null;
    braking: number | null;
    throttle_delay: number | null;
    traversal_time: number | null;
  };
  diagnosis: string;
  estimated_time_delta: number | null;
  confidence: number;
}

export interface LapCoaching {
  message: string;
  advice: string;
  status: string;
}

export interface LapComparison {
  session_key: number;
  lap: number;
  target_driver: number;
  benchmark_driver: number;
  target_lap_time: number | null;
  benchmark_lap_time: number | null;
  lap_delta: number | null;
  corners: CornerComparison[];
  top_losses: Array<{ corner: string; time_loss: number; diagnosis: string; confidence: number }>;
  benchmark_strengths: string[];
  coaching: LapCoaching;
}

export interface RecentLapComparisons {
  session_key: number;
  target_driver: number;
  benchmark_driver: number;
  laps: LapComparison[];
  trend: string | null;
}

export async function fetchDefaultBenchmark(sessionKey: number, targetDriver: number): Promise<{ session_key: number; target_driver: number; benchmark_driver: number }> {
  const res = await fetch(`/api/comparison/${sessionKey}/${targetDriver}/default`);
  if (!res.ok) throw new Error('Failed to select a benchmark driver');
  return res.json();
}

export async function fetchLapComparison(sessionKey: number, targetDriver: number, benchmarkDriver: number, lap: number): Promise<LapComparison> {
  const res = await fetch(`/api/comparison/${sessionKey}/${targetDriver}/${benchmarkDriver}/lap/${lap}`);
  if (!res.ok) throw new Error('Failed to load lap comparison');
  return res.json();
}

export async function fetchRecentComparisons(sessionKey: number, targetDriver: number, benchmarkDriver: number, throughLap: number | null, laps = 3): Promise<RecentLapComparisons> {
  const query = new URLSearchParams({ laps: String(laps) });
  if (throughLap !== null) query.set('through_lap', String(throughLap));
  const res = await fetch(`/api/comparison/${sessionKey}/${targetDriver}/${benchmarkDriver}/recent?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load recent lap comparisons');
  return res.json();
}

export interface CompletedComparisonLaps {
  session_key: number;
  target_driver: number;
  benchmark_driver: number;
  through_lap: number | null;
  laps: number[];
}

export async function fetchCompletedComparisonLaps(sessionKey: number, targetDriver: number, benchmarkDriver: number, throughLap: number | null): Promise<CompletedComparisonLaps> {
  const query = throughLap === null ? '' : `?through_lap=${throughLap}`;
  const res = await fetch(`/api/comparison/${sessionKey}/${targetDriver}/${benchmarkDriver}/laps${query}`);
  if (!res.ok) throw new Error('Failed to load completed comparison laps');
  return res.json();
}

export async function fetchVoiceIntelligence(sessionKey: number, driverNumber: number): Promise<VoiceIntelligenceData> {
  const res = await fetch(`/api/voice/${sessionKey}/${driverNumber}`);
  if (!res.ok) throw new Error("Failed to fetch voice intelligence");
  return res.json();
}

export interface RaceTimelineEvent {
  event_id: string;
  kind: 'TELEMETRY' | 'RADIO' | 'RACE_CONTEXT' | 'COMMUNICATION' | 'CO_DRIVER';
  elapsed: number;
  timecode: string;
  timestamp: string | null;
  lap: number | null;
  corner: string | null;
  phase: string | null;
  progress: number | null;
  title: string;
  summary: string;
  performance: {
    entry_speed_delta?: number | null;
    minimum_speed_delta?: number | null;
    exit_speed_delta?: number | null;
    diagnosis?: string | null;
    estimated_time_delta?: number | null;
    confidence?: number | null;
  };
  race_context: Record<string, unknown>;
  communication: {
    state?: string;
    should_speak?: boolean;
    reason?: string | null;
  } | null;
  radio: {
    transcript: string | null;
    voice_state: string | null;
    emotion: string | null;
  } | null;
  details?: {
    observation?: string | null;
    advice?: string | null;
  };
  links: {
    live?: string;
    voice?: string;
  };
}

export interface RaceTimelineData {
  session_key: number;
  driver_number: number;
  events: RaceTimelineEvent[];
}

export async function fetchRaceTimeline(sessionKey: number, driverNumber: number): Promise<RaceTimelineData> {
  const res = await fetch(`/api/race-timeline/${sessionKey}/${driverNumber}`);
  if (!res.ok) throw new Error('Failed to fetch race timeline');
  return res.json();
}

export interface CornerLapData {
  lap: number;
  entry_speed: number;
  brake_progress: number | null;
  minimum_speed: number;
  exit_speed: number;
  estimated_time_delta: number;
  diagnosis: string;
}

export interface CornerTrendData {
  entry_speed: string | null;
  minimum_speed: string | null;
  exit_speed: string | null;
  time_loss: string | null;
}

export interface CornerHistoryData {
  session_key: number;
  driver_number: number;
  corner: string;
  trend: CornerTrendData;
  summary?: string;
  laps: CornerLapData[];
  error?: string;
}

export async function fetchCornerHistory(sessionKey: number, driverNumber: number, corner: string): Promise<CornerHistoryData> {
  const res = await fetch(`/api/corner-history/${sessionKey}/${driverNumber}/${corner}`);
  if (!res.ok) throw new Error("Failed to fetch corner history");
  return res.json();
}
