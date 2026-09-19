export interface TrainingDistanceFields {
    distance_meters?: number | null;
    rest_distance_meters?: number | null;
}

const measuredMeters = (value: number | null | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/** Total meters physically covered, including measured recovery distance. */
export const getTotalTrainingDistanceMeters = (workout: TrainingDistanceFields): number =>
    measuredMeters(workout.distance_meters) + measuredMeters(workout.rest_distance_meters);
