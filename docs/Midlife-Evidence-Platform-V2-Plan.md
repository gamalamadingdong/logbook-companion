# Midlife Evidence Platform — Product Vision, Specification, and Development Plan

## Background

The Midlife Health project began as a conversational health and performance advisor for two people, with separate personal profiles and a curated set of high-quality project sources.

The first version is intentionally simple:

- maintain separate personal health/performance profiles
- use a curated source library for durable background knowledge
- search current external sources when questions are changing, controversial, or inadequately covered
- distinguish established science from emerging, preliminary, speculative, and expert-interpreted ideas
- personalize answers locally rather than sending full personal profiles into external research systems

That V1 is useful because it creates a good conversational experience without requiring a large research platform.

However, a static source library has an obvious limitation: science changes.

New studies appear, guidelines are updated, long-term follow-up data changes the interpretation of earlier trials, promising interventions fail to replicate, previously speculative ideas gain stronger human evidence, and new questions emerge that were never represented in the original source collection.

The long-term opportunity is therefore not to keep uploading more PDFs manually.

It is to build a reusable evidence system that continuously maintains a current, structured, searchable body of evidence relevant to midlife health, physical performance, recovery, nutrition, prevention, aging, appearance, and quality of life.

This project is that system.

---

# North Star

Build a continuously refreshed **evidence-and-interpretation platform** that helps answer:

> What does the best available evidence currently suggest, how confident should we be, what is changing, and what should we investigate next?

The platform should intentionally support the full spectrum of evidence:

- established consensus
- strong but evolving science
- preliminary human evidence
- speculative/frontier ideas
- expert interpretation and idea discovery

The goal is **not** to create a repository that only reflects conventional consensus.

The goal is also **not** to create a biohacking feed that gives equal weight to every interesting mechanism.

Instead, the platform should allow broad exploration while preserving clear distinctions in evidence strength, relevance, uncertainty, and provenance.

The ultimate experience should allow ChatGPT to combine three independent sources of context:

1. **Personal profile**
   - the relevant person’s health, goals, preferences, labs, training context, medications, etc.

2. **Personal longitudinal data**
   - for example, training history from Logbook Companion

3. **Current external evidence**
   - retrieved from the Midlife Evidence Platform

Conceptually:

```text
                  Personal Profile
                        │
                        │
Logbook Companion ── ChatGPT ── Midlife Evidence Platform
 training history        │          current evidence
                         │
                         ▼
               Personalized reasoning
```

Each system should remain independent.

The Evidence Platform should not need access to private health profiles.

Logbook Companion should not need access to medical literature.

ChatGPT becomes the orchestration and reasoning layer that applies generic evidence to the appropriate personal context.

---

# Product Principles

## 1. Research Generically, Personalize Locally

The evidence repository is shared and profile-agnostic.

It should contain research, guidelines, expert material, claims, evidence assessments, and topic summaries.

It should **not** contain the personal medical profiles of P001, P002, or future users.

Personalization happens after generic evidence has been retrieved.

---

## 2. Source Type Is Not Evidence Strength

A source can be valuable without being primary evidence.

Valid repository content includes:

- randomized trials
- cohort studies
- systematic reviews
- meta-analyses
- guidelines
- consensus statements
- preprints
- mechanistic research
- animal research
- podcasts
- YouTube transcripts
- newsletters
- blog posts
- expert interviews
- coaching/scientific synthesis
- governing-body material

These should not be flattened into one category.

A podcast transcript may be excellent for interpretation or discovery while still being weaker evidence than the trial being discussed.

The system should distinguish:

```text
SOURCE TYPE
what is this?

from

EVIDENCE ROLE
how should this source be used?
```

For example:

```text
source_type: podcast_transcript
evidence_role: expert_interpretation
```

or:

```text
source_type: randomized_controlled_trial
evidence_role: primary_evidence
```

---

## 3. Preserve Provenance

Every important assertion in the system should be traceable.

The intended path is:

```text
topic summary
   ↓
claim
   ↓
evidence assessment
   ↓
source document
   ↓
original passage / citation / timestamp
```

Generated summaries must never become unattributed facts.

---

## 4. Do Not Treat Uploaded or Pinned Sources as Automatically Correct

The existing Midlife Health V1 source library should seed the repository, but it should not become privileged truth.

Pinned sources mean:

> This is important and should remain visible.

They do not mean:

> This automatically outweighs newer or stronger evidence.

---

## 5. Separate Document Strength From Topic-Level Confidence

A single excellent RCT may be strong evidence.

That does not necessarily mean scientific consensus exists.

Likewise, several weak observational studies do not become strong evidence merely because there are many of them.

The platform should separately represent:

- what kind of evidence a document provides
- how strong the broader body of evidence is for a claim or topic

---

# Scope

The repository should eventually cover the major domains of the Midlife Health project.

## Performance and Training

- rowing
- endurance performance
- VO2max
- threshold
- aerobic development
- intervals
- periodization
- training-intensity distribution
- strength
- hypertrophy
- power
- concurrent training
- running
- masters athletes
- performance testing
- fatigue
- recovery
- injury prevention

## Nutrition

- protein
- carbohydrates
- energy availability
- body composition
- weight loss
- hydration
- electrolytes
- nutrient timing
- dietary patterns

## Supplements

- creatine
- omega-3
- collagen
- vitamin D
- calcium
- magnesium
- caffeine
- beta-alanine
- multivitamins
- botanicals
- emerging longevity supplements

## Cardiometabolic Health

- blood pressure
- LDL-C
- ApoB
- Lp(a)
- triglycerides
- glucose
- HbA1c
- insulin resistance
- cardiovascular prevention
- metabolic health
- exercise and cardiovascular disease

## Weight Management

- obesity
- body composition
- lean-mass preservation
- GLP-1 medications
- weight-loss maintenance
- medication discontinuation
- long-term metabolic outcomes

## Sleep and Recovery

- sleep duration
- athlete sleep
- insomnia
- fatigue
- circadian health
- sauna
- heat exposure
- cold exposure
- massage
- mobility and recovery modalities

## Healthy Aging

- healthspan
- performance span
- sarcopenia
- VO2max decline
- strength/power preservation
- bone health
- cognition
- dementia risk
- frailty prevention
- mobility
- functional aging

## Women’s Midlife Health

- perimenopause
- menopause
- estrogen
- menopausal hormone therapy
- bone health
- cardiovascular risk
- female athlete physiology
- body composition
- sexual health
- reproductive/gynecologic health

## Men’s Midlife Health

- testosterone
- erectile function
- sexual health
- prostate health
- body composition
- androgen-related treatments

## Appearance

- skin aging
- photoaging
- retinoids
- hair loss
- minoxidil
- finasteride
- collagen
- dermatologic procedures
- emerging appearance interventions

The taxonomy should remain extensible rather than trying to define every future topic in advance.

---

# Evidence Model

The project should use five high-level evidence states.

## Established / Consensus

Examples:

- current evidence-based clinical guidelines
- mature replicated findings
- strong consistent meta-analyses
- multiple high-quality trials
- well-established physiology

## Strong but Evolving

Examples:

- high-quality newer RCTs
- credible systematic reviews where important uncertainty remains
- good sports-science evidence
- newer treatments with meaningful human evidence but limited long-term follow-up

## Preliminary / Hypothesis-Generating

Examples:

- pilot trials
- small RCTs
- observational studies
- biomarker studies
- early sport-specific studies

## Speculative / Frontier

Examples:

- animal research
- cell studies
- mechanistic hypotheses
- early preprints
- first-in-human work
- experimental longevity approaches

## Expert Interpretation / Idea Discovery

Examples:

- researcher podcasts
- specialist interviews
- newsletters
- blog posts
- coaching synthesis
- expert reviews for a lay/professional audience

Expert sources can be extremely valuable, but their role is often to identify ideas, synthesize evidence, or interpret practical relevance.

---

# Technology Direction

The platform should reuse the infrastructure patterns already familiar from Logbook Companion.

## Frontend

Preferred starting point:

- React
- TypeScript
- Vite
- Tailwind
- hosted on Vercel

There is no strong reason to introduce Next.js solely for this project.

## Data Layer

Use Supabase for:

- Postgres
- authentication
- storage
- full-text search
- pgvector
- row-level security
- database migrations
- job state
- optional Edge Function workers

## Scheduling

Use Vercel Cron as a lightweight scheduler/orchestrator.

Conceptually:

```text
Vercel Cron
    ↓
authenticated cron route
    ↓
determine which feeds are due
    ↓
enqueue jobs in Supabase
    ↓
workers process jobs asynchronously
```

Cron requests should remain short.

They should schedule work rather than perform an entire research crawl synchronously.

---

# Core Data Model

The exact schema can evolve, but the following concepts should exist early.

## Source Providers

Represents the origin of data.

Examples:

- PubMed
- PubMed Central
- Europe PMC
- Crossref
- ACSM
- AHA
- NIH ODS
- professional societies
- YouTube channels
- podcasts
- newsletters
- blogs

Suggested fields:

```text
id
name
source_type
authority_category
base_url
retrieval_adapter
enabled
default_poll_frequency
last_checked_at
last_success_at
metadata
```

---

## Discovery Feeds

Represents a query or feed being monitored.

Examples:

```text
PubMed:
creatine AND cognition AND aging

Europe PMC:
rowing AND endurance AND training

RSS:
selected expert newsletter
```

Suggested fields:

```text
id
provider_id
name
query_or_feed
topic_ids
enabled
priority
cadence
last_cursor
last_checked_at
last_success_at
next_run_at
metadata
```

---

## Documents

Canonical record for one paper, guideline, article, transcript, newsletter issue, etc.

Suggested fields:

```text
id

title
authors
publication_date
publication_year
journal_or_channel
publisher_or_creator

doi
pmid
pmcid
trial_registration

document_type
peer_review_status

canonical_url
pdf_url

open_access
license
full_text_status

abstract
full_text

source_provider_id

discovered_at
retrieved_at
last_verified_at

status
```

Possible statuses:

```text
candidate
processing
ready
excluded
superseded
retracted
error
```

---

## Document Identifiers

Used for deduplication and cross-source matching.

```text
document_id
identifier_type
identifier_value
provider
```

Examples:

```text
DOI
PMID
PMCID
URL
YouTube ID
episode URL
content hash
```

---

## Topics

Use explicit taxonomy in addition to semantic search.

```text
id
slug
name
description
parent_topic_id
active
```

Documents map many-to-many to topics.

---

## Evidence Assessments

Store model interpretation separately from original source data.

Suggested fields:

```text
id
document_id

assessment_version
model
prompt_version

study_design
evidence_role

sample_size

population_summary
sex
age_range
training_status
health_status

intervention
dose
frequency
duration
comparator

primary_outcomes
secondary_outcomes

key_findings
effect_sizes
absolute_effects
relative_effects

clinical_significance
performance_significance

limitations
funding
conflicts_of_interest
risk_of_bias_notes

assessment_confidence
created_at
```

---

# Evidence Dimensions

Avoid one universal score such as:

```text
Study quality: 84 / 100
```

Instead represent separate dimensions:

```text
methodological_strength
risk_of_bias
precision
sample_size_strength
replication
directness
population_relevance
outcome_relevance
recency
```

This matters particularly in sports science.

A small study of trained masters rowers may be limited statistically but highly relevant to a rowing-performance question.

A huge trial in sedentary adults may be methodologically excellent but poorly matched to that athlete population.

---

# Studies vs Publications

Eventually distinguish studies from papers.

One clinical trial can generate:

- primary outcomes paper
- secondary analysis
- subgroup analysis
- long-term follow-up
- safety paper

Without this distinction, the repository could mistakenly interpret five papers as five independent bodies of evidence.

Suggested future tables:

```text
studies
document_studies
```

This does not need to be fully solved in the first implementation, but the architecture should allow it.

---

# Claims

Longer term, decompose evidence into normalized claims.

Example:

```text
Creatine supplementation improves strength when combined with resistance training.
```

Suggested tables:

```text
claims

claim_evidence
```

`claim_evidence` should record:

```text
claim_id
document_id

relationship:
  supports
  contradicts
  mixed
  neutral

population_context
source_location
source_excerpt
assessment_id
```

Claims become the bridge between individual papers and topic-level synthesis.

---

# Transcript / Newsletter / Blog Processing

Secondary and expert sources should be processed differently from primary research.

Desired flow:

```text
podcast / YouTube / newsletter / blog
        ↓
identify speaker or author
        ↓
extract major claims
        ↓
identify research cited
        ↓
resolve DOI / PMID / source where possible
        ↓
store interpretation separately
        ↓
link claims to underlying research
```

For transcripts, preserve timestamps.

For newsletters/blog posts, preserve section or heading location.

Example:

```text
Podcast:
01:17:22–01:21:05

Claim:
Creatine may preserve cognition during sleep deprivation.

References:
PMID...
DOI...
```

This allows ChatGPT to distinguish:

> Andy Galpin said X

from:

> The underlying controlled trial demonstrated Y.

---

# Deduplication

Prioritize identifiers:

1. DOI
2. PMID
3. PMCID
4. trial registration
5. canonical URL / platform ID
6. normalized title + author + year
7. content hash

Do not delete alternate identifiers.

Map them to one canonical document.

---

# Open Access

Unlike V1, V2 should **not restrict discovery to freely available PDFs**.

Important evidence still matters even if the repository can legally retain only metadata and an abstract.

The system should:

- discover all relevant evidence
- store full text where legally permitted
- retain open-access status and license metadata
- never circumvent paywalls

Prefer sources such as Europe PMC or PMC when legal full text is available.

---

# Ingestion Pipeline

Each new candidate moves through stages.

## Discover

Retrieve newly indexed or newly published items from configured feeds.

## Normalize

Convert provider-specific metadata into the canonical document format.

## Deduplicate

Resolve the candidate against existing repository records.

## Acquire

Collect:

- metadata
- abstract
- identifiers
- legitimate full text where available
- transcript/article text where permitted

## Relevance Filter

Estimate whether the source belongs in the Midlife evidence universe.

Favor reasonable recall rather than excessively aggressive filtering.

## Analyze

Use structured model extraction.

## Classify

Determine:

- document type
- evidence role
- population
- intervention
- outcomes
- limitations

## Tag

Assign explicit topics.

## Embed

Generate semantic representations.

## Publish

Move successful items into:

```text
status = ready
```

Only ready documents appear in normal retrieval.

---

# Job Architecture

Use asynchronous, idempotent jobs.

Suggested concepts:

```text
ingestion_runs
ingestion_jobs
```

Job types may include:

```text
discover
resolve_identifiers
fetch_metadata
fetch_content
deduplicate
extract
classify
tag_topics
generate_embedding
detect_relationships
reassess_topic
```

Job states:

```text
pending
running
complete
failed
retry
dead_letter
```

Store:

- attempt count
- error
- timing
- model/provider usage
- source provider
- run ID

A failed item should not stop the entire ingestion run.

---

# Search Architecture

Use three retrieval signals together.

## Structured Search

Examples:

```text
topic = creatine
population = trained adults
publication_year >= 2024
study_design = randomized_trial
```

## Keyword Search

Important for exact terminology:

```text
ApoB
semaglutide
UT2
finasteride
```

## Semantic Search

Useful for natural-language queries:

```text
Does strength training help preserve bone density in middle-aged women?
```

Use Supabase full-text search + pgvector, with hybrid ranking such as reciprocal rank fusion.

---

# Search Modes

Expose search intent explicitly.

## Best Evidence

Prefer stronger designs and authoritative synthesis.

## Latest

Prioritize recent publications while maintaining relevance.

## Frontier

Surface newer, preliminary, mechanistic, and preprint evidence while clearly labeling uncertainty.

## Balanced

Return representative evidence across evidence layers.

## Controversy

Deliberately retrieve important competing findings.

---

# Topic-Level Intelligence

A later-stage feature should maintain historical topic assessments.

Suggested record:

```text
topic_id

summary
evidence_state
confidence

established_findings
evolving_findings
preliminary_findings
frontier_questions

major_disagreements
important_gaps

last_evidence_scan_at
last_material_change_at

assessment_model
assessment_version
created_at
```

Never overwrite history.

This should eventually allow:

> What did we believe about collagen supplementation six months ago, and what changed?

---

# Material Change Detection

A major long-term differentiator is detecting changes in evidence rather than merely counting new papers.

Bad output:

```text
17 new GLP-1 papers this month.
```

Better output:

```text
New 4-year follow-up data strengthens confidence
that semaglutide-associated weight loss can remain
sustained during continued treatment.

Evidence state:
Strong but evolving → stronger

Material change:
Yes
```

This capability should come only after ingestion and retrieval quality are trustworthy.

---

# Contradiction and Relationship Detection

Support relationships such as:

```text
supports
contradicts
extends
replicates
fails_to_replicate
supersedes
updates
corrects
retracts
secondary_analysis_of
```

The system should expose disagreement rather than silently average conclusions.

This is particularly important for:

- supplements
- nutrition
- longevity interventions
- hormone therapy
- body composition
- recovery modalities
- conflicting meta-analyses

---

# Human Review

Not every paper needs manual review.

Create a review queue for potentially important events:

```text
new guideline
retraction
high-impact trial
potential material change
major contradiction
uncertain classification
uncertain duplicate
processing failure
```

Possible actions:

```text
approve
dismiss
edit
pin
exclude
reprocess
```

---

# Curation

Allow curated status:

```text
pinned
landmark
important
reviewed
excluded
```

The existing V1 Midlife sources should be imported and tagged:

```text
origin = midlife_v1
curation_status = pinned
```

---

# Admin Application

The UI should initially be a research-management console, not a consumer health product.

## Dashboard

Show:

- documents discovered
- documents processed
- ingestion failures
- repository size
- topics scanned
- important new documents
- new guidelines
- retractions
- potential material changes

## Research Inbox

Review newly surfaced high-value content.

## Topics

Show:

- current summary
- last scan
- strongest sources
- newest sources
- evidence by layer
- disagreements
- recent changes

## Documents

Show:

- citation
- abstract/full text
- source type
- evidence assessment
- topics
- claims
- relationships
- provenance

## Search

Expose the same retrieval capabilities that ChatGPT will eventually use.

## Sources

Manage:

- providers
- monitored queries
- channels
- newsletters
- feeds
- poll frequency

## Jobs

Show:

- pending
- running
- completed
- failed
- retried

---

# Authentication and Security

Initial product can be a private household/admin application.

Use Supabase Auth and RLS.

Roles can initially be simple:

```text
admin
reader
```

Keep service credentials server-side.

The evidence repository contains relatively little personal data, but authentication still protects configuration and private imported content.

---

# Model Architecture

Avoid coupling the system to one model provider.

Define interfaces such as:

```text
EvidenceExtractor
EvidenceAssessor
TopicClassifier
RelationshipDetector
EmbeddingProvider
SynthesisProvider
```

Each generated record should capture:

```text
provider
model
prompt_version
schema_version
timestamp
input_document_version
```

This allows later experimentation with:

- OpenAI models
- other hosted providers
- local models
- DGX-based processing

without redesigning the data layer.

---

# Cost Strategy

Prefer to perform expensive analysis once during ingestion.

Reuse structured outputs during retrieval.

Typical split:

## Cheaper processing

- initial relevance
- topic tagging
- dedup support
- embeddings

## More capable reasoning

- evidence extraction
- difficult classification
- contradiction analysis
- material change analysis
- topic synthesis

Cache the results.

---

# Freshness

Freshness must be explicit.

Every research result should expose information such as:

```text
publication_date
retrieved_at
last_verified_at
topic_last_scanned_at
```

The system should not imply that something represents "the latest evidence" when that topic has not been scanned recently.

---

# Initial Data Sources

## Primary Scientific Discovery

Start with:

- PubMed
- PubMed Central
- Europe PMC
- Crossref

These should provide the core discovery and metadata layer.

## Later Scientific Sources

Potential additions:

- ClinicalTrials.gov
- medRxiv
- bioRxiv
- arXiv where relevant
- selected journal feeds
- retraction/correction feeds

## Guidelines and Professional Sources

Examples:

- ACSM
- AHA / ACC
- USPSTF
- NIH Office of Dietary Supplements
- AASM
- AUA
- Endocrine Society
- Menopause Society
- ACOG
- AAD
- World Rowing

## Expert and Interpretive Sources

Examples:

- Andy Galpin
- Stephen Seiler
- Rhonda Patrick
- Peter Attia
- Andrew Huberman
- selected specialist clinicians/researchers
- selected high-quality newsletters/blogs

These should be explicitly marked as interpretation or idea-discovery sources.

---

# ChatGPT Integration — Evidence Platform

ChatGPT access should be considered a first-class future requirement, even though it is not required for the earliest repository milestones.

Architect the internal API so an MCP layer can remain thin.

Start read-only.

Potential tools:

## search_evidence

Inputs:

```text
query
topics
search mode
date range
population filters
evidence type
limit
```

## get_document

Returns:

- source metadata
- structured evidence assessment
- relevant source passages
- provenance

## get_topic_state

Returns:

- current summary
- confidence
- established findings
- evolving findings
- preliminary findings
- frontier questions
- disagreements
- last scan

## get_recent_changes

Example:

```text
topic = GLP-1
since = 90 days
```

## get_claim_evidence

Returns supporting and conflicting sources for a normalized claim.

The plugin/app should not require access to P001 or P002 profile data.

---

# ChatGPT Integration — Logbook Companion

A separate ChatGPT integration for Logbook Companion is likely worth building earlier.

It is a smaller problem and provides immediate value.

Purpose:

Allow ChatGPT to directly investigate longitudinal training history.

Questions might include:

> Compare the eight weeks before my strongest 2K period with my last eight weeks.

> Has my steady-state pace improved at a similar heart rate?

> How has my weekly rowing volume changed over the last six months?

> Am I doing more threshold work now than before?

> What patterns preceded my best performance tests?

Potential read-only tools:

## get_training_summary

```text
start_date
end_date
sport
```

## search_workouts

Filters might include:

```text
date range
workout type
training zone
distance
duration
pace/power
heart rate
stroke rate
```

## get_workout

Detailed session retrieval.

## get_benchmark_history

Examples:

```text
2K
5K
6K
30R20
threshold
running 5K
strength benchmarks
```

## get_performance_trend

Examples:

```text
weekly volume
steady-state watts at HR
interval performance
training-intensity distribution
```

## compare_training_periods

This may be one of the highest-value tools.

For example:

```text
Period A:
8 weeks preceding best performance

Period B:
most recent 8 weeks
```

The integration should remain read-only initially.

---

# Long-Term Combined Experience

The eventual experience could be:

```text
User:
Why does my 2K performance seem worse now than it did earlier this year?

ChatGPT
   │
   ├── Logbook Companion
   │      retrieves actual training history
   │
   ├── Midlife Evidence Platform
   │      retrieves research on detraining,
   │      intensity distribution,
   │      concurrent training, recovery, etc.
   │
   └── Local personal profile
          supplies age, goals, health context

                    ↓

           personalized interpretation
```

This is the long-term architecture.

The systems remain loosely coupled.

---

# Quality Evaluation

Create a small benchmark set of research questions.

Examples:

- Does creatine improve cognition in middle-aged adults?
- What happens to weight after GLP-1 discontinuation?
- Does concurrent endurance work impair strength development?
- How should trained rowers distribute intensity?
- Does collagen improve skin appearance?
- What does the evidence say about finasteride versus minoxidil?
- What exercise best protects bone health?
- How does menopause hormone therapy affect cardiovascular risk?
- Does omega-3 supplementation improve hard cardiovascular outcomes?
- How does endurance performance change in masters athletes?

For each benchmark:

- manually identify several high-value sources
- test whether retrieval finds them
- test whether evidence type and population are classified correctly

---

# Safety and Reliability Requirements

Hard rules:

1. No generated factual claim without source provenance.
2. Never invent citations, DOIs, PMIDs, or page references.
3. Retracted research is excluded from Best Evidence mode by default.
4. Superseded guidelines are clearly labeled.
5. Abstract-only evidence is clearly marked.
6. Expert interpretation remains visibly separate from primary evidence.
7. LLM assessments remain distinct from original source content.
8. Conflicting evidence remains discoverable.
9. Never circumvent paywalls.
10. The repository does not autonomously make personalized medical recommendations.

---

# Loose Development Phases

The phases below describe direction rather than rigid project gates.

## Phase 0 — Foundation

Create the new repository and application skeleton.

Build:

- React / TypeScript / Vite app
- Vercel deployment
- Supabase project
- Auth
- migration structure
- basic source/topic/document schema
- basic admin shell

Goal:

A deployable application with a stable data foundation.

---

## Phase 1 — Useful Manual Repository

Before automation, make the repository useful.

Build:

- manual URL import
- DOI import
- PMID/PMCID import
- PDF import
- transcript/article import
- basic document page
- topic tagging
- source metadata
- keyword search
- curation flags

Import the current Midlife V1 source library.

Goal:

The app becomes a better organized replacement for a static source folder.

---

## Phase 2 — Scientific Discovery

Add:

- PubMed adapter
- Europe PMC adapter
- Crossref enrichment
- configurable discovery feeds
- ingestion runs/jobs
- deduplication
- scheduled cron orchestration

Goal:

Relevant new scientific literature begins appearing automatically.

---

## Phase 3 — Structured AI Processing

Add:

- structured evidence extraction
- document/evidence role classification
- population extraction
- intervention/outcome extraction
- limitation/funding extraction
- automatic topic tagging
- provenance
- review queue

Goal:

New sources become useful structured evidence records rather than merely citations.

---

## Phase 4 — Intelligent Retrieval

Add:

- pgvector
- embeddings
- full-text search
- hybrid ranking
- structured filters
- Best Evidence / Latest / Frontier / Balanced / Controversy modes

Goal:

The repository becomes meaningfully queryable by humans and AI.

---

## Phase 5 — Broader Source Types

Add:

- newsletters
- blogs
- expert podcasts
- YouTube transcripts
- specialist interviews
- professional-society updates

Add claim extraction and reference resolution from these sources.

Goal:

The repository becomes an evidence-and-interpretation system rather than only a scientific-paper database.

---

## Phase 6 — Topic Intelligence

Add:

- normalized claims
- claim-to-document relationships
- contradiction detection
- document relationships
- topic assessments
- historical topic state
- material-change detection
- retraction/supersession awareness

Goal:

The system can answer:

> What changed, and did it meaningfully alter our understanding?

---

## Phase 7 — ChatGPT Evidence Integration

Expose the repository through a read-only MCP-backed ChatGPT app/plugin.

Add tools such as:

- search_evidence
- get_document
- get_topic_state
- get_recent_changes
- get_claim_evidence

Goal:

Midlife Health conversations can query the research repository directly.

---

# Parallel Track — Logbook Companion ChatGPT Integration

This can happen earlier and independently of the Evidence Platform.

Suggested progression:

1. Define read-only research APIs in Logbook Companion.
2. Add useful aggregate/trend queries.
3. Implement MCP interface.
4. Authenticate securely.
5. Connect to ChatGPT.
6. Test longitudinal training questions.
7. Expand only where actual use reveals missing capabilities.

This serves two purposes:

- immediate personal value
- practical learning about how ChatGPT interacts with structured domain tools

That experience should inform the design of the Evidence Platform's later ChatGPT integration.

---

# Suggested Initial Research Feeds

Keep the first automated topic universe relatively small.

Example starting set:

- rowing training
- masters endurance performance
- concurrent strength/endurance training
- resistance training
- protein and athletic performance
- creatine
- sleep and athletes
- body composition
- GLP-1 treatment
- cardiovascular prevention
- bone health
- menopause/perimenopause
- menopausal hormone therapy
- skin aging
- hair loss
- omega-3
- healthy aging

Expand only after evaluating relevance and noise.

---

# Success Criteria

The platform is working when:

- useful research arrives automatically
- duplicate records are uncommon
- every important result traces to an original source
- strong and weak evidence remain clearly distinguishable
- frontier ideas remain discoverable without being presented as consensus
- expert interpretation can be linked back to underlying science
- contradictory evidence is visible
- repository freshness is measurable
- important changes are surfaced rather than buried in a feed
- the system requires limited manual maintenance
- personal health profiles remain outside the evidence repository
- ChatGPT can eventually retrieve evidence directly and apply it to the appropriate isolated profile
- Logbook Companion can independently provide longitudinal training data to ChatGPT

The north star is not the largest possible repository.

The north star is a **trustworthy, current, traceable evidence layer that makes Midlife Health conversations materially smarter over time.**
