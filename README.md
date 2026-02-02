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

👉 **[Read the RWN Specification](src/docs/RWN_spec.md)**

### 3. Live Sessions & Connectivity
Powered by **[erg-link](../erg-link/README.md)**, the Live Sessions feature connects your browser directly to your Concept2 PM5 monitor via Bluetooth.
- **Program**: Send your structured workout directly to the PM5.
- **Race**: Host synchronized sessions where you control the "Set" and "Go" for connected machines.
- **Monitor**: View real-time data streaming from the flywheel.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Concept2 PM5 Monitor (for Live Sessions)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

## 📚 Documentation

- **[Core Concepts](src/docs/CORE_CONCEPTS.md)**
- **[RWN Specification](src/docs/RWN_spec.md)**
- **[erg-link](../erg-link/README.md)** (Bluetooth Connectivity)

## License

MIT License
