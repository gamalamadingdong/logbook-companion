# AI-Assisted Development Template

> **Context-driven development with persistent memory.** A structured instruction system that helps AI assistants (like GitHub Copilot) maintain context across sessions and guide high-quality implementation.

## 🎯 What is this?

An **AI-assisted development framework** that provides structure, patterns, and persistent context to maximize the effectiveness of AI coding assistants.

**What you get:**
- 🧠 **Working Memory Pattern** - File-based persistent context across AI sessions
- 📋 **Structured Instructions** - Clear guidance for AI assistants on architecture and patterns
- 🎯 **"Plan & Act" Workflow** - Prevent AI drift by planning before implementation
- 👥 **Four Interaction Modes** - Builder (concise/verbose), Domain Expert, Conversational
- 🔄 **Mode Switching** - Seamlessly switch modes as you learn and grow comfortable
- 🎓 **Simplicity Priority** - Non-builder modes use simple, maintainable tech stacks
- 🔒 **Behavioral Enforcement** - Mandatory checks ensure AI follows working memory discipline
- 📚 **Decision Tracking** - ADRs (Architectural Decision Records) document the "why"
- 🧹 **Context Hygiene** - Maintain long-term project memory without chat bloat
- 👥 **16-Agent Virtual Team** - A full roster of experts (DevOps, Legal, specific domains)
- 👑 **Smart Orchestration** - Automatic delegation for complex tasks
- 🛠️ **Generic Utilities** - Mobile build scripts and development tools

**What you build:**
- Your project's specific context and requirements
- Your architectural patterns and coding standards
- Your business logic and domain models
- Your AI assistant's "personality" and approach

**Philosophy:** AI assistants are stateless and forget context between sessions. This template solves that problem with structured prompt engineering and file-based memory.

## 🧠 Core Concept: The Working Memory

AI assistants (like GitHub Copilot) are **stateless** - they reset their memory with every new chat session. For long-term projects, this creates a critical problem:

❌ **Without Working Memory:**
- AI asks the same questions repeatedly
- Forgets architectural decisions
- Loses context on what's been implemented
- Drifts from original vision over time

✅ **With Working Memory:**
- AI reads project context at session start
- Maintains consistent architectural patterns
- Tracks decisions and implementations
- Stays aligned with project goals

### How It Works

The Working Memory is a set of **markdown files** that serve as the AI's "external hard drive":

```
working-memory/
├── projectBrief.md          # Core mission, non-negotiables
├── productContext.md        # User problems, business model
├── activeContext.md         # Current state (updated frequently)
├── systemPatterns.md        # Architecture patterns, code standards
├── techContext.md           # Stack versions, configuration
├── decisionLog.md           # ADRs - "why" we made choices
├── implementationLog.md     # What's built, what worked/failed
│
└── Optional (add as needed):
    ├── businessAnalysis.md  # Market, competition, revenue (for commercial projects)
    └── experimentLog.md     # ML experiments, model training (for data science projects)
```

**Workflow:**
1. **Session Start**: AI reads `activeContext.md` to understand current state
2. **Before Changes**: AI cross-references `systemPatterns.md` for consistency
3. **After Work**: AI updates `activeContext.md` with new state
4. **Milestone Reached**: AI updates `implementationLog.md` with progress

6. **Milestone Reached**: AI updates `implementationLog.md` with progress

## 👥 The 16-Agent Virtual Team

This template includes a pre-built roster of **16 Expert Agents**.
The **Orchestrator** (your default contact) automatically delegates work to the right expert.

| Role | Focus | "Superpower" |
| :--- | :--- | :--- |
| **👑 Orchestrator** | Management | Delegation & Synthesis |
| **💼 Business Manager** | Strategy | ROI & Risk Analysis |
| **📣 Marketing Lead** | Growth | Positioning & Messaging |
| **📈 Market Analyst** | Research | Trends & Competitors |
| **📦 Product Manager** | User | Requirements & Value |
| **🏛️ System Architect** | Engineering | Structure & Scalability |
| **🛠️ Senior Engineer** | Coding | Performance & Best Practices |
| **🚀 DevOps Engineer** | Operations | CI/CD & Infrastructure |
| **🛡️ QA Specialist** | Quality | Testing & Bugs |
| **🏴‍☠️ Red Team** | Security | Exploits & Vulnerabilities |
| **🎨 UI/UX Designer** | Design | Visuals & Accessibility |
| **🎭 Art Director** | Creative | Brand & Vibe |
| **📝 Tech Writer** | Docs | Clarity & Onboarding |
| **🎓 Scholar** | Academia | SOTA Research & Citations |
| **🧪 Scientist** | Science | First Principles & Hypotheses |
| **🧮 Quant Researcher** | Math | Models & Statistics |

### 🤖 Self-Replication
Need a Lawyer? A Game Designer? Just ask:
> "Create a Lawyer agent."

The system will **write the new agent for you** and add it to the team.

## 📋 Structured Instructions

Located in `.github/instructions/copilot-instructions.md`, this file provides:

- **Four Interaction Modes**: Builder (standard/verbose), Domain Expert, Conversational
- **Mode Switching**: Change modes as you learn and grow
- **Technology Selection**: Simple stacks for non-software engineers
- **Role Definition**: What the AI should act as (expert engineer, etc.)
- **Methodology**: "Plan & Act" workflow to prevent drift
- **Behavioral Enforcement**: Mandatory checks and verification protocols
- **Code Standards**: Data-first design, type safety, keep it simple stupid (KISS)
- **Anti-Patterns**: What to never do
- **Project-Specific Context**: Your unique requirements

### Choosing Your Interaction Mode

**Builder Mode (Default):**
- **For**: Software developers, engineers
- **Behavior**: Code-first, concise technical explanations, fast iteration
- **Tech Stack**: Best-fit technologies (scalable, performant, modern)
- **Activate**: Default, or say "Use builder mode"

**Builder Mode - Verbose:**
- **For**: Software engineers who want more discussion with their code
- **Behavior**: Code-first BUT with in-depth explanations of design decisions, trade-offs, alternatives
- **Tech Stack**: Best-fit technologies
- **Activate**: Say "Use verbose builder mode" or "I want more explanation"

**Domain Expert Mode:**
- **For**: Scientists, electrical engineers, chemical engineers, data analysts
- **Behavior**: Teach software concepts with domain analogies, implement WITH educational annotations
- **Domain Expertise**: UNLIMITED depth in your field (chemistry, physics, etc.)
- **Software Stack**: SIMPLE and maintainable (Python + Flask, SQLite, vanilla JS)
- **Focus**: "I'll handle software complexity so you can focus on your domain problem"
- **Activate**: Say "Use domain expert mode" or "I'm a [field] engineer building a tool"

**Conversational Mode:**
- **For**: Product managers, designers, business users, learners
- **Behavior**: Explain-first, plain language, ask clarifying questions
- **Tech Stack**: Simple, easy to understand
- **Focus**: Understanding and decision-making, code happens in background
- **Activate**: Say "Use conversational mode" or "Explain this to me"

### Mode Switching

**You can switch at any time:**
- "Switch to builder mode" → Faster iteration, less explanation
- "Switch to verbose builder mode" → More technical discussion with code
- "Switch to conversational mode" → More explanation, business focus
- "Switch to domain expert mode" → Technical depth with software guidance

**Common Workflow**:
1. Start in Domain Expert mode (learn the patterns)
2. Switch to Builder mode once comfortable (faster implementation)
3. Switch to Verbose Builder when you need to understand trade-offs
4. Switch back to Conversational mode when explaining to stakeholders

### Example Interactions

**Builder Mode:**
```
User: "Add user authentication"
AI: [Reads working memory] → [Proposes technical plan] → [Implements code]
```

**Builder Mode - Verbose:**
```
User: "Add caching to this endpoint"
AI: "Adding Redis caching because:
     - Read-heavy endpoint (80/20 ratio from metrics)
     - Redis TTL handles invalidation automatically
     Alternatives: In-memory (doesn't scale), CDN (overkill)
     Trade-off: Redis dependency vs 10x performance
     [Implements Redis caching]"
```

**Domain Expert Mode:**
```
User: "I need to model chemical reactions with temperature"
AI: "I'll build a reaction modeling system:
     - Reaction equations → stored like lab notebook entries (SQLite)
     - Temperature calculations → run like batch experiments (Python)
     - Results → real-time graphs (simple web charts)
     
     Using Python (you can modify equations) and basic web interface.
     Runs on your laptop - no cloud complexity.
     
     What kinetics? (Rate laws? Arrhenius? Equilibrium?)"
     
[NOTE: AI discusses chemistry at EXPERT depth. Simplicity = software stack only.]
```

**Conversational Mode:**
```
User: "Add user authentication"
AI: "Let me explain authentication options:
     1. Email/password (simple, users manage credentials)
     2. Social login (Google, Apple - easier for users)
     3. Magic links (no password needed)
     
     What's most important: ease of use, security, or privacy?"
```

### The "Plan & Act" Workflow

Prevents "agentic drift" where AI creates working code that diverges from intent:

1. **Analyze Request**: Understand business context and requirements
2. **Read Working Memory**: Check current state in `activeContext.md`
3. **Formulate Plan**: Output step-by-step implementation plan
4. **Get Confirmation**: Wait for approval before coding
5. **Execute**: Implement according to approved plan
6. **Document**: Update Working Memory files

## 🚀 Quick Start

### 1. Clone This Template

```bash
# Clone to your new project
git clone <this-repo-url> my-project
cd my-project

# Remove git history (start fresh)
rm -rf .git
git init
git add .
git commit -m "Initial commit from AI-assisted template"
```

git commit -m "Initial commit from AI-assisted template"
```

### 1B. ...Or Add to an Existing Project
If you already have a codebase, just copy these three folders into your root:
1.  `.agent/` (The "Brain" - Roles & Prompts)
2.  `working-memory/` (The "Memory" - Context files)
3.  `.github/instructions/` (The "Interface" - Copilot setup)

Then, run the **Initialization Prompt** in `START_HERE.md`. It is designed to read your *existing* code and populate the memory files for you.

### 2. Customize Working Memory

Update the template files in `working-memory/` with your project's context:

**Required Updates:**
- `projectBrief.md` - Define your mission and non-negotiables
- `productContext.md` - Describe user problems and business model
- `activeContext.md` - Set initial implementation state
- `systemPatterns.md` - Define your architecture patterns
- `techContext.md` - Specify your tech stack and versions

**Optional (fill as you go):**
- `decisionLog.md` - Will populate as you make architectural decisions
- `implementationLog.md` - Will populate as you build features

### 3. Configure AI Assistant Instructions

Edit `.github/instructions/copilot-instructions.md`:

```markdown
## Critical Technical Components
backend: [your backend choice]
frontend: [your frontend choice]
mobile: [your mobile choice, if applicable]
[... customize for your stack ...]

## Project Overview
[Replace with your specific project description]
```

### 4. Start Development with AI

Open your project in VS Code with GitHub Copilot and say:

> "Read the Working Memory files and help me set up [your project type]. Let's start by reviewing the project brief and creating an implementation plan."

The AI will:
- ✅ Read `working-memory/activeContext.md` to understand current state
- ✅ Review your project requirements
- ✅ Propose an implementation plan
- ✅ Wait for your approval before coding
- ✅ Update Working Memory files as work progresses

### 5. Choose Your Interaction Mode

**First time? Start with the right mode:**

**If you're a software developer:**
```
> "Use builder mode" (fast, concise implementation)
> "Use verbose builder mode" (detailed explanations of decisions)
```

**If you're a scientist/engineer from another field:**
```
> "Use domain expert mode - I'm a [chemical/electrical/data] engineer"
```

**If you're non-technical (PM, designer, business user):**
```
> "Use conversational mode"
```

**Switch anytime:**
```
> "Switch to [mode] mode"
```

**Ask for mode help:**
```
> "What interaction modes are available?"
> "Explain the difference between builder and domain expert mode"
```

## 📖 Using This Template

### For Any Project Type

This template is **framework-agnostic**. Examples of what you can build:

- **Web Applications**: React, Vue, Angular, Svelte, etc.
- **Mobile Apps**: React Native, Flutter, Capacitor, native iOS/Android
- **Backend Services**: Node.js, Python, Go, Rust, etc.
- **Full-Stack SaaS**: Any combination of frontend + backend
- **CLI Tools**: Command-line applications
- **APIs**: REST, GraphQL, gRPC
- **Desktop Apps**: Electron, Tauri, etc.
- **ML/Data Science**: Model training, data pipelines, research projects
- **Commercial Products**: Includes businessAnalysis.md for market/revenue planning

### Example: Starting a SaaS Project

1. **Update `projectBrief.md`:**
   ```markdown
   ## Core Mission
   Build a B2B project management tool for design agencies...
   
   ## Non-Negotiable Requirements
   - Real-time collaboration
   - Mobile-responsive
   - SOC 2 compliant
   ```

2. **Update `techContext.md`:**
   ```markdown
   ## Core Technology Stack
   - Frontend: React 18 + TypeScript + Vite
   - Backend: Supabase (PostgreSQL + Auth)
   - Hosting: Vercel
   ```

3. **Start AI Session:**
   > "I need to set up the database schema for a project management tool. Based on the Working Memory, help me design tables for projects, tasks, and team members with proper relationships."

### Example: Starting a Mobile App

1. **Update `projectBrief.md`:**
   ```markdown
   ## Core Mission
   Build a fitness tracking app for personal trainers...
   
   ## Non-Negotiable Requirements
   - iOS and Android support
   - Offline-capable
   - Sync across devices
   ```

2. **Update `techContext.md`:**
   ```markdown
   ## Core Technology Stack
   - Mobile: React Native + TypeScript
   - Backend: Firebase
   - Platform: iOS 15+, Android 10+
   ```

3. **Start AI Session:**
   > "Based on the Working Memory, help me set up the React Native project structure with offline-first architecture for a fitness tracking app."

## 🛠️ What's Included

### Core Template Files
```
.github/
  instructions/
    copilot-instructions.md     # AI assistant configuration (customize for your project)

working-memory/
  projectBrief.md               # Template - define your mission
  productContext.md             # Template - define user problems
  activeContext.md              # Template - track current state
  systemPatterns.md             # Template - define patterns
  techContext.md                # Template - define tech stack
  decisionLog.md                # Template - track decisions (ADRs)
  implementationLog.md          # Template - track progress
  
  Optional (add based on project type):
  businessAnalysis.md           # Template - market, competition, revenue
  experimentLog.md              # Template - ML experiments, training runs

scripts/
  increment-ios-build.js        # Utility: Auto-increment iOS build number
  increment-android-build.js    # Utility: Auto-increment Android versionCode
  README.md                     # Utility documentation
```

### Generic Utilities

**Mobile Build Automation** (if building iOS/Android apps):

```bash
# Increment iOS build number (required for App Store submissions)
node scripts/increment-ios-build.js

# Increment Android versionCode (required for Play Store submissions)
node scripts/increment-android-build.js
```

These scripts automatically update build numbers in your Xcode and Android Studio projects.

## 🎯 Design Philosophy

### Why This Approach Works

**Traditional Development:**
```
Developer → Code → Test → Deploy
(All context in developer's head)
```

**AI-Assisted Development Without Memory:**
```
Developer → Prompt AI → Code → Forget Context → Repeat
(Context lost between sessions)
```

**AI-Assisted Development With Working Memory:**
```
Developer → Update Working Memory → Prompt AI → AI Reads Context →
Code with Consistency → Update Working Memory → Maintain Context
(Persistent context across sessions)
```

### Key Principles

1. **Context is King**: AI needs explicit context to make good decisions
2. **File-Based Memory**: Use files, not chat history, for persistence
3. **Plan Before Act**: Always plan and get approval before implementation
4. **Data-First Design**: Define data structures before writing logic
5. **Document Decisions**: Track the "why" not just the "what"
6. **YAGNI**: Reject complexity, build only what's needed now
7. **Simplicity**: Prefer simple, direct solutions over clever abstraction

## 📚 Best Practices

### Starting a New Feature

```markdown
1. Open new Copilot chat
2. Say: "Read working-memory/activeContext.md and help me implement [feature]"
3. AI reads context and proposes plan
4. Review and approve plan
5. AI implements according to plan
6. AI updates activeContext.md with new state
```

### Making Architectural Decisions

```markdown
1. Discuss options with AI
2. Document decision in working-memory/decisionLog.md as ADR
3. Include: Context, Decision, Rationale, Consequences, Alternatives
4. Update systemPatterns.md with new pattern (if applicable)
```

### Context Getting Bloated

```markdown
If chat context becomes too large:
1. Save important decisions to decisionLog.md
2. Update activeContext.md with current state
3. Start fresh chat
4. Say: "Read working-memory files and continue from where we left off"
```

### Session-to-Session Workflow

```markdown
**End of Session:**
1. Update activeContext.md with:
   - What was completed
   - What's next
   - Any blockers
2. If milestone reached, update implementationLog.md

**Start of Session:**
1. Say: "Read working-memory/activeContext.md and summarize current state"
2. AI reads and provides context
3. Continue working with full context restored
```

## 🔧 Customization Guide

### For Your Specific Project

1. **Fill Out Working Memory Templates**: Replace placeholders with your actual project details
2. **Customize copilot-instructions.md**: Add project-specific patterns and anti-patterns
3. **Add Project Files**: Create your actual codebase structure
4. **Update This README**: Replace generic descriptions with your project specifics

### Adapting for Different Team Sizes

**Solo Developer:**
- Keep all Working Memory files simple and personal
- Focus on tracking your own thought process

**Small Team (2-5):**
- Use Working Memory as shared team context
- Require all team members to update activeContext.md
- Review decisionLog.md together during standups

**Larger Team:**
- Assign Working Memory ownership/maintenance
- Create team-specific systemPatterns.md sections
- Use implementationLog.md for sprint retrospectives

## 🎓 Learning More

### Understanding ADRs (Architectural Decision Records)

See `working-memory/decisionLog.md` for template and examples. Key elements:

- **Context**: What situation led to this decision?
- **Decision**: What did we decide?
- **Rationale**: Why this choice? (most important!)
- **Consequences**: What are the trade-offs?
- **Alternatives**: What else did we consider?

### Working Memory File Purposes

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `projectBrief.md` | Core mission, non-negotiables | Rarely (only major pivots) |
| `productContext.md` | User problems, business model | Quarterly or when strategy changes |
| `activeContext.md` | Current work, next steps | **Every session** |
| `systemPatterns.md` | Architecture patterns | When new patterns emerge |
| `techContext.md` | Stack, versions, config | When tech changes |
| `decisionLog.md` | ADRs | When architectural decisions made |
| `implementationLog.md` | Feature history | When milestones reached |
| `businessAnalysis.md` (optional) | Market, competition, revenue | Quarterly or when market changes |
| `experimentLog.md` (optional) | ML experiments, training runs | After each experiment/training run |

## 🤝 Contributing

This is a template meant to be forked and customized. If you develop useful patterns:

1. Document them in your own `systemPatterns.md`
2. Share learnings about what works/doesn't work
3. Consider contributing generic utilities back to this repo

## 📝 License

MIT License - Use freely for any project

## 🙏 Credits

Working Memory pattern inspired by ["Persistent Context Architecture" for AI assistants](https://example.com).

Built to solve the stateless nature of LLMs in long-term software projects.

---

**Ready to start?**

1. Clone this template
2. Customize `working-memory/` files for your project
3. Update `.github/instructions/copilot-instructions.md`
4. Start your first AI-assisted session!

**Last Updated:** December 15, 2025
