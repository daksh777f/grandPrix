/**
 * Tyre Degradation Intelligence (TDI) - Typed API Client.
 *
 * Implements endpoints from Phase 6:
 * - GET /api/tyre/{session_key}/{driver_number}
 * - GET /api/tyre/counterfactual/{session_key}/{driver_number}
 * - GET /api/tyre/validation/{session_key}/{driver_number}
 * - GET /api/tyre/strategy/{session_key}/{driver_number}?lap={lap}
 */

export interface StintMeta {
  compound: string;
  baseline_wear_rate: number;
  fitted_base_pace: number;
  representative_lap_count?: number;
}

export interface TyreLapRecord {
  lap_number: number;
  stint_number: number;
  compound: string;
  tyre_age: number;
  is_representative: boolean;
  observed_lap_time: number;
  base_pace: number;
  fuel_effect: number;
  track_evolution_effect: number;
  tyre_wear_effect: number;
  residual_noise: number;
  wear_rate_estimate: number;
  wear_rate_90pct_interval: [number, number];
  cumulative_wear_estimate: number;
  confidence: 'HIGH_CONFIDENCE' | 'LOW_CONFIDENCE' | 'INSUFFICIENT_EVIDENCE';
  confidence_score?: number;
  cliff_probability: number;
  cliff_detected: boolean;
  cliff_onset_lap: number | null;
  tyre_health_pct: number;
}

export interface TyreIntelligenceData {
  session_key: number;
  driver_number: number;
  stints: Record<string, StintMeta>;
  records: TyreLapRecord[];
  lap_lookup: Record<number, TyreLapRecord>;
}

export interface CounterfactualLapCard {
  lap_number: number;
  stint_number: number;
  tyre_age: number;
  observed: number;
  components: {
    base_pace: number;
    fuel_effect: number;
    track_evolution_effect: number;
    tyre_wear_effect: number;
    residual: number;
  };
  counterfactual_text: string;
  counterfactual_value: number;
  time_saved_on_fresh: number;
  tag: string;
  tag_description: string;
}

export interface TyreCounterfactualData {
  session_key: number;
  driver_number: number;
  showcase_count: number;
  interesting_laps: CounterfactualLapCard[];
  all_representative_laps: CounterfactualLapCard[];
}

export interface StintValidationScorecard {
  stint_number: number;
  compound: string;
  validation_mode: string;
  total_representative_laps: number;
  train_laps_count: number;
  holdout_laps_count: number;
  holdout_split_lap: number;
  predicted_wear_rate: number;
  predicted_wear_rate_interval: [number, number];
  actual_wear_rate: number;
  wear_rate_error_abs: number;
  wear_rate_error_pct: number;
  predicted_cliff_lap: number | null;
  actual_cliff_lap: number | null;
  cliff_lap_error: number | null;
  model_accuracy_score: number;
  confidence_at_split: string;
  accuracy_formula_explanation: string;
}

export interface TyreValidationData {
  session_key: number;
  driver_number: number;
  validation_mode: string;
  description: string;
  overall_accuracy_score: number;
  stints: StintValidationScorecard[];
  interesting_laps: CounterfactualLapCard[];
  total_representative_laps: number;
}

export interface StrategyScenario {
  name: 'Conservative' | 'Nominal' | 'Aggressive';
  pit_lap: number;
  laps_on_current_tyres: number;
  laps_on_new_tyres: number;
  new_compound: string;
  predicted_race_time_remaining: number;
  predicted_time_range_90pct: [number, number];
  predicted_total_time_delta: number;
  predicted_delta_range_90pct: [number, number];
  risk_label: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  cliff_exposure_laps: number;
}

export interface TyreStrategyData {
  session_key: number;
  driver_number: number;
  current_lap: number;
  current_stint: number;
  current_compound: string;
  current_tyre_age: number;
  current_wear_rate: number;
  wear_rate_90pct_interval: [number, number];
  cliff_probability: number;
  predicted_cliff_lap: number;
  strategy_confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence_notes: string;
  pit_stop_loss_constant_sec: number;
  scenarios: StrategyScenario[];
}

/**
 * Fetch complete per-lap latent tyre state, decomposition, and cliff probability stream.
 */
export async function fetchTyreIntelligence(
  sessionKey: number,
  driverNumber: number
): Promise<TyreIntelligenceData> {
  const response = await fetch(`/api/tyre/${sessionKey}/${driverNumber}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch tyre intelligence (${response.status})`);
  }
  return response.json();
}

/**
 * Fetch 3-5 auto-selected showcase laps and all representative counterfactual cards.
 */
export async function fetchTyreCounterfactual(
  sessionKey: number,
  driverNumber: number
): Promise<TyreCounterfactualData> {
  const response = await fetch(`/api/tyre/counterfactual/${sessionKey}/${driverNumber}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch counterfactual data (${response.status})`);
  }
  return response.json();
}

/**
 * Fetch the post-race holdout validation scorecard.
 */
export async function fetchTyreValidation(
  sessionKey: number,
  driverNumber: number
): Promise<TyreValidationData> {
  const response = await fetch(`/api/tyre/validation/${sessionKey}/${driverNumber}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch validation scorecard (${response.status})`);
  }
  return response.json();
}

/**
 * Fetch the 3-scenario pit strategy simulator.
 */
export async function fetchTyreStrategy(
  sessionKey: number,
  driverNumber: number,
  lap: number = 38
): Promise<TyreStrategyData> {
  const response = await fetch(`/api/tyre/strategy/${sessionKey}/${driverNumber}?lap=${lap}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch tyre strategy (${response.status})`);
  }
  return response.json();
}
