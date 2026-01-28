---
description: A workflow to orchestrate a multi-agent review of a problem or file.
---

# Multi-Perspective Review Workflow

This workflow allows you to leverage the `Orchestrator` and various `Expert Agents` to analyze a problem from multiple angles.

## Steps

### 1. Orchestration Phase
**Actor**: `@workspace /management/orchestrator`
**Instruction**: 
"Analyze the following problem/file. Determine which experts are needed to review it. create a delegation plan."

**Example Prompt**:
> "I need a review of `src/services/PaymentService.ts`. Act as the Orchestrator and tell me who should review this."

### 2. Execution Phase (The Loop)
Based on the Orchestrator's plan, invoke each agent sequentially.

**A. Scholar / Researcher** (@workspace /research/scholar)
> "Act as the Scholar. Analyze this code for theoretical correctness and SOTA alignment."

**B. System Architect** (@workspace /architecture/system-architect)
> "Act as the System Architect. Review the component structure and data flow."

**C. Business Manager** (@workspace /business/business-manager)
> "Act as the Business Manager. What are the ROI and risks here?"

*(Repeat for other assigned agents like Scientist, QA, Product, etc.)*

### 3. Synthesis Phase
**Actor**: `@workspace /management/orchestrator`
**Instruction**:
"Act as the Orchestrator. Read the feedback from the Scholar, Architect, and Business Manager above. Synthesize a final decision and action plan."

## Usage Tips
*   **In Antigravity**: You can manually switch contexts or ask the agent to "Run the multi-perspective review on [File]."
*   **In GitHub Copilot**: You can type `@workspace` followed by the specific prompt file path to "load" that persona, or simply say "Act as the [Role]" if the instructions are indexed.
