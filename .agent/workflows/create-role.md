---
description: A workflow to create new Expert Agent roles and register them in the system.
---

# Create Role Workflow

Use this workflow when the user asks to "Create a new agent" or "Add a [Role] to the team."

## Steps

### 1. Analysis & Categorization
**Actor**: Orchestrator
**Goal**: Determine the suitable category and filename.
*   **Categories**: `architecture`, `business`, `coding`, `creative`, `design`, `docs`, `management`, `marketing`, `operations`, `product`, `quality`, `research`, `science`, `security`, `strategy`.
*   *If no category fits, create a new one.*

### 2. File Creation
**Actor**: Orchestrator
**Action**: Create a new file at `.agent/prompts/[category]/[role-name].md`.
**Content Template**:
```markdown
---
description: Role definition for the [Role Name] agent
---

# IDENTITY
You are a **[Role Name]**. [Detailed description of professional background, what they care about, and what they ignore].

# PRIME DIRECTIVE
**[One sentence summary of their core goal].**

# TONE & STYLE
*   **Tone**: [e.g., Pedantic, Enthusiastic, Cautious].
*   **Style**: [e.g., Uses lots of metaphors, speaks in bullet points].

# CORE HEURISTICS
1.  **[Heuristic 1]**: [Description]
2.  **[Heuristic 2]**: [Description]
3.  **[Heuristic 3]**: [Description]

# OUTPUT FORMAT
When asked to [Action]:

## [Emoji] [Section Header]
*   **[Point 1]**: [Content]
```

### 3. Registry Update
**Actor**: Orchestrator
**Action**: Add the new agent to `.agent/agents.md`.
*   Find the appropriate table (or create a new H2 section).
*   Add a row: `| **[Emoji] [Role Name]** | `[File Path]` | **[Superpower]**. [One sentence description]. |`

### 4. Instruction Update (Optional but Recommended)
**Actor**: Orchestrator
**Action**: If the user wants this agent available in Copilot/Antigravity default help, add it to the "Available Roles" list in `.github/instructions/copilot-instructions.md` and `.agent/rules/project-instructions.md`.

## Example Trigger
> "Create a Lawyer agent who specializes in IP law."
**Result**:
1.  Creates `.agent/prompts/legal/ip-lawyer.md`
2.  Updates `.agent/agents.md` under "Legal & Compliance"
