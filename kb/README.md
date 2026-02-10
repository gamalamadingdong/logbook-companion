# Knowledge Base for AI Rowing Coach

This directory contains all the training knowledge that will be uploaded to the Azure OpenAI vector store and used by the AI coach to answer questions.

## Directory Structure

```
kb/
├── training-plans/     # Training programs and periodization
├── technique/          # Rowing form and drills
├── physiology/         # Training zones, HR, lactate threshold
└── injury-prevention/  # Injury prevention and recovery
```

## Supported File Types

- **PDF** (`.pdf`) - Best for existing documents, research papers
- **Markdown** (`.md`) - Best for formatted text with structure
- **JSON** (`.json`) - Best for structured data (use descriptive keys)
- **Text** (`.txt`) - Plain text content
- **Word** (`.docx`) - Microsoft Word documents

## What to Include

### Training Plans (`training-plans/`)
- Pete Plan
- Wolverine Plan
- Beginner rowing programs
- Race preparation plans
- Periodization guides
- Volume/intensity progression schedules

### Technique (`technique/`)
- Rowing stroke fundamentals
- Common technical errors
- Drill library and progressions
- Technique videos transcripts
- Form checkpoints
- Power application guides

### Physiology (`physiology/`)
- Training zones (UT2, UT1, AT, TR, AN)
- Heart rate zone definitions
- Lactate threshold explanations
- VO2 max training
- Energy systems
- Adaptation timelines

### Injury Prevention (`injury-prevention/`)
- Common rowing injuries
- Prevention strategies
- Mobility exercises
- Recovery protocols
- When to rest vs push
- Rehab progressions

## File Naming Conventions

Use descriptive, lowercase names with hyphens:
- ✅ `pete-plan-beginner.pdf`
- ✅ `training-zones-explained.md`
- ✅ `common-technique-errors.json`
- ❌ `File1.pdf`
- ❌ `doc (2).txt`

## Tips for JSON Files

If you're creating JSON knowledge files, make them descriptive:

```json
{
  "topic": "Training Zones",
  "description": "Heart rate and pace zones for rowing training",
  "zones": [
    {
      "name": "UT2 (Utilization 2)",
      "purpose": "Aerobic base building",
      "heart_rate": "65-75% max HR",
      "perceived_effort": "Conversational pace",
      "split_guidance": "2k PR + 18-22 seconds"
    }
  ]
}
```

## Markdown Template

For creating markdown files, use clear headings:

```markdown
# Training Zone Guide

## UT2 (Utilization 2)

**Purpose:** Aerobic base building

**Heart Rate:** 65-75% of max HR

**Feel:** Conversational pace, can talk in full sentences

**Pace:** 2k PR + 18-22 seconds

**Volume:** 60-80% of weekly meters
```

## Upload Process

Once you've added files here, run:

```bash
npx tsx scripts/setup-knowledge-base.ts
```

This will:
1. Scan all files in `kb/` directory
2. Upload them to Azure OpenAI
3. Create a vector store
4. Output the vector store ID for your `.env.local`

## Limits

- **Files:** Up to 10,000 files per vector store
- **File Size:** Max 512 MB per file
- **Tokens:** Max 5M tokens per file
- **Cost:** ~$0.10 per GB per month (very affordable)

## Next Steps

1. Add your knowledge files to the appropriate directories
2. Run the upload script (when ready)
3. Create the assistant with the vector store
4. Start using the AI coach!
