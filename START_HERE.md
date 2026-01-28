# 🚀 Start Here: Initialize Your Project with AI

**Copy and paste this entire file into your AI assistant to get started!**

This prompt will guide you through filling out all the Working Memory files with your project's specific details.

---

## Prompt for Your AI Assistant

```
I just cloned the AI-Assisted Development Template and need help customizing it for my new project.

### First: Choose Your Interaction Mode

Before we begin, I need to choose how we'll work together. Here are my options:

**Builder Mode (Default):**
- For: Software developers who want fast, concise implementation
- Style: Code-first with minimal explanation
- Choose if: I'm comfortable with software engineering

**Builder Mode - Verbose:**
- For: Software developers who want detailed explanations
- Style: Code-first BUT explains design decisions, trade-offs, alternatives
- Choose if: I want to understand the "why" behind technical choices

**Domain Expert Mode:**
- For: Scientists, engineers, data analysts from non-software fields
- Style: Educational implementation with domain analogies
- Tech stack: SIMPLE and maintainable (Python, Flask, SQLite)
- Domain expertise: UNLIMITED depth in my field
- Choose if: I'm technical but not a software engineer

**Conversational Mode:**
- For: Product managers, designers, business users
- Style: Explain-first with plain language
- Choose if: I'm non-technical and want to understand before implementing

**Orchestrator Mode (RECOMMENDED):**
- For: Everyone
- Style: "General Contractor" who delegates to experts
- Choose if: You want the AI to automatically consult the Architect, Security, etc. for you.

**My choice:** [Tell me which mode, or ask "What interaction modes are available?" for more details]

---

IMPORTANT: Before asking me questions, please search through my codebase to discover answers automatically. Look for:
- package.json, requirements.txt, go.mod, Cargo.toml (for tech stack)
- README.md (for project description and goals)
- Existing code files (for architectural patterns)
- Configuration files (for deployment and environment setup)
- Any existing documentation

After searching, provide suggestions based on what you found, then ask me to confirm or correct.

Please help me fill out the Working Memory files by going through each file step by step:

### 1. Project Brief (working-memory/projectBrief.md)

FIRST: Search my codebase for clues about:
- Project name and description (README.md, package.json)
- Any documented requirements or goals
- Technology choices that hint at requirements (e.g., mobile frameworks = mobile requirement)

THEN: Based on what you found, suggest answers and ask me to confirm/correct:
- What is the core mission of my project? (What problem am I solving and for whom?)
- What are my non-negotiable requirements? (Performance, security, platform, integration needs)
- What are my success criteria? (Measurable goals)
- What is this project NOT? (Scope exclusions)
- Who is the target user and what's the priority? (Speed vs Quality vs Cost)

### 2. Product Context (working-memory/productContext.md)

FIRST: Search my codebase for clues about:
- User-facing features or UI components
- Any product documentation or user stories
- API endpoints that reveal user workflows
- Comments describing user problems

THEN: Based on what you found, suggest answers and ask me to confirm/correct:
- What is the primary pain point I'm solving? (In the user's own words)
- What are the secondary pain points?
- What is my business model? (How will this make money, or is it personal/open source?)
- Who are my target users? (Primary and secondary personas)
- What are my user experience goals? (Onboarding flow, core experience)
- Who are my competitors and what's my advantage?
- What are my Year 1 and long-term success metrics?

### 3. Tech Context (working-memory/techContext.md)

FIRST: Search my codebase for:
- package.json, package-lock.json (Node.js dependencies and versions)
- requirements.txt, pyproject.toml (Python dependencies)
- go.mod (Go dependencies)
- Cargo.toml (Rust dependencies)
- Configuration files (.env.example, vercel.json, netlify.toml, etc.)
- Build configuration (vite.config, webpack.config, tsconfig.json)
- Mobile configuration (capacitor.config, app.json for React Native)
- Docker files or deployment scripts

THEN: Based on what you found, provide a complete tech stack summary and ask me to confirm/correct:
- What is my frontend stack? (Framework, language, build tool)
- What is my backend and database? (API type, ORM, hosting)
- Am I building mobile apps? (If yes: React Native, Flutter, Capacitor, or native?)
- What authentication provider am I using?
- Do I need email capabilities? (If yes, which provider?)
- Do I need payments? (If yes, which provider?)
- Where am I hosting? (Vercel, Netlify, AWS, etc.)
- What are my environment variables?
- Any known third-party service limits I should be aware of?

### 4. System Patterns (working-memory/systemPatterns.md)

FIRST: Search my codebase for patterns by examining:
- 3-5 representative source files
- How components/modules are structured
- Error handling approaches
- Database query patterns
- API call patterns
- Testing approach (if tests exist)
- Code organization (feature folders vs layer folders)

THEN: Based on what you found, document the patterns and ask me to confirm/correct:
- Do I have any existing architectural principles? (Mobile-first, API-first, etc.)
- Do I have any established code patterns I want to follow?
- What are my code quality standards? (TypeScript strictness, naming conventions, etc.)
- What should I test, and what should I NOT test?
- Are there any anti-patterns I want to avoid?

If this is a fresh project with no code yet, just tell me we'll fill this out as patterns emerge during development.

### 5. Active Context (working-memory/activeContext.md)

FIRST: Search my codebase to understand current state:
- What files and features already exist?
- What's in TODO comments or FIXME notes?
- Any incomplete features (e.g., functions with "TODO" or empty implementations)?
- Git commit history (if available) to see recent work

THEN: Based on what you found, suggest answers and ask me to confirm/correct:
- What is my current session focus? (What am I working on right now?)
- What have I already completed? (List implemented features)
- What am I currently working on? (In-progress features)
- What's not started yet? (Backlog items, TODO comments)

### 6. Team Expansion (Optional)

If this is a specialized project, ask me to create new agents for you now.
*   "Create a Lawyer agent for our Terms of Service."
*   "Create a Game Designer for our core loop."
*   "Create a Biochemist for our lab data."

### Process

For each section:
1. Search the codebase FIRST - be thorough
2. Present what you discovered with specific file references
3. Provide suggested answers based on your findings
4. Ask me to confirm, correct, or elaborate
5. Write the properly formatted content to the appropriate Working Memory file
6. Move to the next section
7. At the end, give me a summary of what we've documented

**Remember:** Use the interaction mode I selected above throughout this process.

Let's start by searching the codebase for Project Brief information!
```

---

## What This Does

This prompt will:
1. ✅ Walk you through each Working Memory file systematically
2. ✅ Ask targeted questions to extract the right information
3. ✅ Write properly formatted content to each file
4. ✅ Ensure nothing is missed
5. ✅ Give you a complete, customized Working Memory for your project

## After Completion

Once your Working Memory is filled out:
1. Review each file to make sure the AI captured everything correctly
2. Make any manual adjustments needed
3. Verify your interaction mode is appropriate (you can switch anytime with "Switch to [mode] mode")
4. Start your first development session with: `"Read working-memory/activeContext.md and let's start building!"`

## Quick Mode Reference

**To switch modes later:**
- `"Switch to builder mode"` - Fast, concise
- `"Switch to verbose builder mode"` - Detailed explanations
- `"Switch to domain expert mode"` - Educational, simple tech
- `"Switch to conversational mode"` - Business-focused
- `"Switch to orchestrator mode"` - Delegation & Management

**To ask about modes:**
- `"What interaction modes are available?"`
- `"Explain the difference between builder and domain expert mode"`

---

**Ready?** Copy the prompt above and paste it into your AI assistant (Copilot, Cursor, Antigravity, etc.)
