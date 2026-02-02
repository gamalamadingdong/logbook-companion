
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const templates = [
    {
        name: '2k Power Intervals',
        description: 'Classic interval session to build 2k speed. 8x500m w/ 2:00 rest.',
        workout_type: 'interval',
        training_zone: 'TR',
        pacing_guidance: '2k-2',
        difficulty_level: 'hard',
        tags: ['2k', 'intervals', 'speed'],
        status: 'active'
    },
    {
        name: 'Steady State 10k',
        description: 'Aerobic base building. Consistency is key.',
        workout_type: 'distance',
        training_zone: 'UT2',
        pacing_guidance: '2k+18',
        difficulty_level: 'medium',
        tags: ['base', 'endurance'],
        status: 'active'
    },
    {
        name: 'Pyramid Intervals',
        description: '1k-750-500-250-500-750-1k',
        workout_type: 'interval',
        training_zone: 'AT',
        pacing_guidance: '2k+6',
        difficulty_level: 'hard',
        tags: ['threshold', 'pyramid'],
        status: 'active'
    },
    {
        name: 'Recovery 30min',
        description: 'Active recovery to flush lactate and promote blood flow.',
        workout_type: 'time',
        training_zone: 'UT2',
        pacing_guidance: '2k+25',
        difficulty_level: 'easy',
        tags: ['recovery'],
        status: 'active'
    }
];

async function seed() {
    console.log('Seeding workout_templates...');

    // Check if empty
    const { data: existing } = await supabase.from('workout_templates').select('id').limit(1);

    if (existing && existing.length > 0) {
        console.log('Templates already exist. Skipping seed.');
        return;
    }

    const { error } = await supabase.from('workout_templates').insert(templates);

    if (error) {
        console.error('Error seeding templates:', error);
    } else {
        console.log('Successfully seeded workout templates!');
    }
}

seed();
