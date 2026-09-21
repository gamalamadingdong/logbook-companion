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

### 4. Direct PM5 Connectivity (Beta)
Logbook Companion can translate RWN and program a nearby Concept2 PM5 directly over Bluetooth—without creating a coach session or sending the programming request through a server.

- **Connect locally**: Discover and connect to a PM5 from the protected **Connect PM5** page.
- **Program from RWN**: Send fixed-distance, fixed-time, fixed-interval, and supported variable workouts through the shared [`@readyall/erglink`](https://www.npmjs.com/package/@readyall/erglink) CSAFE implementation.
- **Preserve intent**: Device translation reports `exact`, `prompt_only`, or `unsupported`; prompt-only guidance requires confirmation and unsupported workouts are not sent.
- **Verify acknowledgement**: The app waits for and parses the PM5 response instead of treating a Bluetooth write as success.
- **Monitor live data**: View elapsed time, distance, pace, and stroke rate while connected.

The protocol and browser harness have been exercised on a real PM5, including a 2,000 m workout and the first work/rest transitions of a variable speed pyramid. LC's Android debug build and iOS simulator build pass in GitHub Actions. Physical Android/iOS installation, installed-app authentication/deep links, and PM5 testing from the LC-built app remain the final feature-validation gates.

Coach/boathouse live sessions and synchronized racing remain separate experimental workflows; they are not required for direct athlete programming.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A Concept2 Logbook OAuth app for sync flows
- A Concept2 PM5 only if you are testing direct Bluetooth programming or live sessions

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

### Mobile development

The repository includes Capacitor Android and iOS projects:

```bash
npm run mobile:sync
```

Pull requests that change mobile code run web tests plus an unsigned Android debug build and iOS simulator build. Local Android compilation requires Java 11 or newer (Java 21 is used in CI); local iOS compilation requires macOS, Xcode, and CocoaPods. Signing, store delivery, and OTA updates are separate release concerns.

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
- **[PM5 programming boundary](docs/concept2-mobile/pm5-programming-boundary.md)** - RWN translation, Bluetooth delivery, acknowledgements, and hardware evidence
- **[PM5 capture, validity, and Concept2 boundary](docs/concept2-mobile/capture-storage-audit.md)** - Completed capture evidence, API validation, verification, and ranking eligibility
- **[Mobile delivery status](docs/concept2-mobile/mobile-delivery.md)** - Capacitor builds, installed-device gates, signing, and OTA roadmap
- **[`@readyall/erglink`](https://www.npmjs.com/package/@readyall/erglink)** - Shared monitor-driver, PM5 protocol, programming, and capture package

## License

MIT License
