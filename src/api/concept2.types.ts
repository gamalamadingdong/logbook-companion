export interface C2Profile {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    weight: number;
    dob: string;
}

export interface C2Result {
    id: number;
    user_id: number;
    date: string; // "2013-06-21 00:00:00"
    distance: number; // meters
    type: string; // "rower", "skierg", etc
    time: number; // deciseconds (1/10th second)
    time_formatted: string; // "4:13:55.0"
    stroke_rate?: number;
    watts?: number;
    calories_total?: number;
    workout_type: string; // "JustRow", "FixedDistance", etc
    weight_class: string; // "H", "L"
    verified: boolean;
    ranked: boolean;
    rest_distance?: number; // Optional, present in raw data
}

export interface C2Split {
    distance: number;
    time: number;
    stroke_rate: number;
    watts?: number;
    calories_total?: number;
    heart_rate?: {
        average?: number;
        ending?: number;
        min?: number;
        max?: number;
    }
}

// Intervals often have similar structure but might have extra fields
export interface C2Interval extends C2Split {
    type: string; // e.g. "time", "distance"
    rest_time?: number;
    wattminutes_total?: number;
}

export interface C2Stroke {
    t: number;   // Time (deciseconds usually, e.g. 10 = 1.0s)
    d: number;   // Distance (meters)
    p: number;   // Power (watts) or Pace (seconds/500m) - usually Watts in this context
    spm: number; // Strokes Per Minute
    hr: number;  // Heart Rate
    watts?: number; // Explicit watts derived or present
}

export interface C2ResultDetail extends C2Result {
    stroke_data: boolean;
    rest_distance?: number;
    rest_time?: number;
    calories_total?: number;
    drag_factor?: number;
    stroke_count?: number;
    stroke_rate?: number;
    heart_rate?: {
        min: number;
        average: number;
        max: number;
        ending: number;
    };
    workout?: {
        targets?: {
            pace?: number;
        };
        splits?: C2Split[];
        intervals?: C2Interval[]; // Added intervals based on user data
    };
    strokes?: C2Stroke[]; // Helper prop attached manually
    workout_name?: string; // Canonical name from DB
    manual_rwn?: string; // Manual override for structural definition
    is_benchmark?: boolean; // User flagged as Test/Benchmark
    template_id?: string | null; // Link to workout_templates table
}

export interface C2Pagination {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
}

export interface C2Response<T> {
    data: T;
    meta?: {
        pagination: C2Pagination;
    };
}
