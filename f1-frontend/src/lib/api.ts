export interface Driver {
  driver_number: number;
  full_name: string;
  team_name: string;
  team_colour: string;
  headshot_url: string;
  country_code: string;
}

export interface RadioIntelligenceMessage {
  timestamp: string;
  driver_number: number;
  audio: {
    recording_url: string;
    local_cached: boolean;
  };
  transcription: {
    status: string; // 'READY', 'PENDING', 'FAILED'
    transcript: string | null;
  };
  track_context: {
    lap: number | null;
    progress: number | null;
    corner: string | null;
    phase: string | null;
  };
  telemetry_context: {
    speed: number | null;
    entry_speed_delta?: number | null;
    estimated_time_delta?: number | null;
    diagnosis?: string | null;
  };
  race_context: {
    position: number | null;
    battle_active: boolean;
    is_defending: boolean;
    gap_ahead: number | null;
    gap_behind: number | null;
  };
  ai_interpretation: {
    message: string;
    advice: string;
    status: string;
  } | null;
  voice_state: {
    state: string; // e.g. "ANALYSIS PENDING"
  };
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

export async function fetchRadioIntelligence(sessionKey: number, driverNumber: number): Promise<{ driver_number: number, messages: RadioIntelligenceMessage[] }> {
  const res = await fetch(`/api/radio/${sessionKey}/${driverNumber}`);
  if (!res.ok) throw new Error("Failed to fetch radio intelligence");
  return res.json();
}
