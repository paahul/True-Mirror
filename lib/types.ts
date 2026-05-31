export interface DailySteps {
  date: string
  count: number
}

export interface DailySleep {
  date: string
  hours_asleep: number
  hours_in_bed?: number
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

export interface Workout {
  date: string
  type: string
  duration_minutes: number
  calories?: number
  distance_km?: number
}

export interface HealthPayload {
  period_days?: number
  steps?: {
    daily?: DailySteps[]
    average: number
    total: number
  }
  sleep?: {
    daily?: DailySleep[]
    average_hours_asleep: number
    average_hours_in_bed?: number
  }
  heart_rate?: {
    resting_average: number
    daily_resting?: DailyHeartRate[]
  }
  hrv_ms?: {
    average: number
    daily?: DailyHRV[]
  }
  vo2_max_ml_kg_min?: number
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
  token?: string
  save_history?: boolean
  health: HealthPayload
}

export interface AnalyzeResponse {
  token: string
  analysis: string
  report_id: string | null
  created_at: string
}
