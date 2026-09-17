import { completedWorkoutFixtures } from '../supabase/functions/_shared/concept2/fixtures/index.ts';
import { mapCompletedWorkoutToConcept2 } from '../supabase/functions/_shared/concept2/publication.ts';

const name = process.argv[2];
if (!Object.hasOwn(completedWorkoutFixtures, name ?? '')) {
  process.stderr.write(`Choose one named fixture: ${Object.keys(completedWorkoutFixtures).join(', ')}\n`);
  process.exitCode = 1;
} else {
  const workout = completedWorkoutFixtures[name];
  const payload = mapCompletedWorkoutToConcept2(workout, {
    timezone: workout.timezone, weightClass: 'H', privacy: 'private',
  });
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
