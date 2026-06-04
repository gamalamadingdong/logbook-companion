# Logbook Companion

**Logbook Companion** is a comprehensive rowing analytics and training platform designed to bridge the gap between planned workouts and actual performance data.

## 🎯 Core Concepts

The platform is built around a few key ideas that make it different from a standard logbook:

### 1. Workouts as Data
We treat workouts as structured data, not just text.
- **Templates**: "Blueprints" for a workout (e.g., "8x500m") that live in your library.
- **Logs**: The actual result data synced from Concept2.
- **Canonical Matching**: The system automatically links your performed **Logs** back to your **Templates**, enabling powerful historical analytics for specific workout types.

👉 **[Read more about Core Concepts](src/docs/CORE_CONCEPTS.md)**

### 2. RWN (Rowers Workout Notation)
We use a standardized shorthand called **RWN** to describe workouts.
- Example: `8x500m/2:00r`
- Example: `30:00@r20`

This notation allows us to universally identify workouts across different platforms.

👉 **[Read the RWN Specification](rwn/RWN_spec.md)**

### 3. Advanced Analytics & Comparison
We provide tools to go beyond simple logbook summaries:
- **Zone Analysis**: Global filters for UT2, AT, TR zones based on your baseline watts.
- **Weekly Volume**: Visual trend lines of your total volume and zone distribution.
- **Comparison**: Head-to-head overlay of any two workouts with support for Watts, Pace, Rate, and HR metrics.

### 4. Live Sessions & Connectivity (Experimental)
> **⚠️ Note:** Live Sessions and Group Workouts are currently under active development and considered experimental. Use with caution.

Powered by **[erg-link](../erg-link/README.md)**, the Live Sessions feature connects your browser directly to your Concept2 PM5 monitor via Bluetooth.
- **Program**: Send your structured workout directly to the PM5.
- **Race**: Host synchronized sessions where you control the "Set" and "Go" for connected machines.
- **Monitor**: View real-time data streaming from the flywheel.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Concept2 Logbook OAuth app for sync flows
- A Concept2 PM5 Monitor only if you are testing Live Sessions

### Installation

```bash
npm install
```

Create a local `.env` from `.env.example` and set the Supabase and Concept2 values:

```bash
cp .env.example .env
```

Required variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CONCEPT2_CLIENT_ID=your-concept2-client-id
VITE_CONCEPT2_CLIENT_SECRET=your-concept2-client-secret
```

For local maintenance scripts that need to bypass RLS, add `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard. Do not expose that key in browser code or public deployments.

### Development

```bash
npm run dev
```

## 📚 Documentation

### User Guides

New to Logbook Companion? Start here:

1. **[Getting Started](docs/user-guide/GETTING_STARTED.md)** - Why Logbook Companion? Your first workout and the complete workflow
2. **[RWN Guide](docs/user-guide/RWN_GUIDE.md)** - Master the workout notation syntax with examples
3. **[Templates Guide](docs/user-guide/TEMPLATES.md)** - Unlock automatic analytics and performance tracking
4. **[Workout Workflow](docs/user-guide/WORKOUT_WORKFLOW.md)** - Complete guide from planning to analysis
5. **[Quick Reference](docs/user-guide/RWN_QUICK_REFERENCE.md)** - Printable RWN cheat sheet

### Technical Documentation

For developers and advanced users:

- **[RWN Specification](rwn/RWN_spec.md)** - Formal specification of Rowers Workout Notation
- **[Template Matching Guide](docs/template-matching-guide.md)** - How automatic template matching works
- **[erg-link](../erg-link/README.md)** - Bluetooth connectivity library for PM5

## License

MIT License
