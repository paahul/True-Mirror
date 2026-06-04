export type UserMode = 'curious' | 'active' | 'performance'

export interface HealthScores {
  sleep: number | null
  recovery: number | null
  strain: number | null
  stress: 'low' | 'moderate' | 'high' | null
}

// One metric's change between the two most recent COMPLETED days.
export interface DayDelta {
  key: string
  label: string
  value: number    // latest completed day's value
  prior: number    // the day before it
  delta: number    // value − prior
  unit: string     // e.g. ' ms', 'h', ' bpm'
  decimals: number
  favorable: 'good' | 'bad' | 'neutral'  // is the move in a healthy direction?
}

export interface DayOverDay {
  latestDate: string
  priorDate: string
  lead: string         // deterministic one-line narrative headline
  deltas: DayDelta[]   // most significant first
}

// A live value for one metric, attached next to a narrative bullet that Claude
// tagged with that metric's key (see the [[metric]] tags in the prompt).
export interface MetricChip {
  label: string
  value: string                          // formatted, e.g. "58 bpm", "67/100"
  delta?: string                         // optional day-over-day, e.g. "↓14"
  favorable?: 'good' | 'bad' | 'neutral' // colours the delta
}

export type MetricSnapshot = Record<string, MetricChip>

export interface DailySteps {
  date: string
  count: number
}

export interface DailySleep {
  date: string
  hours_asleep: number
  hours_in_bed?: number
  deep_minutes?: number
  rem_minutes?: number
  awake_minutes?: number
}

export interface DailyHeartRate {
  date: string
  bpm: number
}

export interface DailyHRV {
  date: string
  ms: number
}

export interface DailyEnergy {
  date: string
  kcal: number
}

export interface DailyExercise {
  date: string
  minutes: number
}

export interface DailyRespiratoryRate {
  date: string
  breaths_per_min: number
}

export interface DailySpO2 {
  date: string
  pct: number
}

export interface Workout {
  date: string
  type: string
  duration_minutes: number
  calories?: number
  distance_km?: number
  avg_hr_bpm?: number
  max_hr_bpm?: number
}

export interface HealthPayload {
  period_days?: number
  age_years?: number
  steps?: {
    daily?: DailySteps[]
    average: number
    total: number
  }
  sleep?: {
    daily?: DailySleep[]
    average_hours_asleep: number
    average_hours_in_bed?: number
    avg_deep_minutes?: number
    avg_rem_minutes?: number
    avg_awake_minutes?: number
  }
  heart_rate?: {
    resting_average: number
    daily_resting?: DailyHeartRate[]
  }
  hrv_ms?: {
    average: number        // 30-day baseline
    recent?: number        // recent (e.g. last 7 days) average — drives Recovery/Stress without a daily array
    daily?: DailyHRV[]
  }
  vo2_max_ml_kg_min?: number
  respiratory_rate?: {
    avg_breaths_per_min: number
    daily?: DailyRespiratoryRate[]
  }
  spo2_percent?: {
    average: number
    daily?: DailySpO2[]
  }
  active_energy?: {
    daily?: DailyEnergy[]
    average: number
  }
  exercise_minutes?: {
    daily?: DailyExercise[]
    average: number
  }
  workouts?: Workout[]
  stand_hours?: {
    daily_average: number
  }
  weight_kg?: {
    latest: number
    change_30d: number
  }
}

export interface AnalyzeRequest {
  save_history?: boolean
  // Either a fully-formed nested payload (back-compat / tests)…
  health?: HealthPayload
  // …or a flat bag of metrics from the Shortcut, normalized server-side.
  metrics?: Record<string, unknown>
}

export interface AnalyzeResponse {
  token: string
  analysis: string
  report_id: string | null
  share_url: string | null
  created_at: string
}

export interface RegisterRequest {
  name: string
  email?: string
  invite_code?: string
  mode?: UserMode
  timezone?: string
  charge_reminder?: boolean
  charge_reminder_at?: string  // "HH:MM" local time
  wear_reminder?: boolean
  wear_reminder_at?: string    // "HH:MM" local time
}

export interface RegisterResponse {
  token: string
}

export interface HistoryReport {
  id: string
  created_at: string
  analysis: string
  scores: HealthScores
  day_over_day: DayOverDay | null
  metrics: MetricSnapshot
}

export interface HistoryResponse {
  user: {
    name: string
    mode: UserMode
    opt_in: boolean
  }
  reports: HistoryReport[]
}

export interface UpdateUserRequest {
  mode?: UserMode
  opt_in?: boolean
}
