## INTENT_ENGINE.md

## Wise Content Factory (WCF)

Version: 1.0 Status: Core AI Engine Owner: WiseAitechs

> **Note on provenance:** This document did not exist in the original architecture set even though it was named in
> the mandatory reading order (CLAUDE.md, BUILD_DIRECTIVE.md) and referenced as a distinct pipeline stage in
> STRATEGY_ENGINE.md, AGENT_ORCHESTRATOR.md, MCP_ARCHITECTURE.md, and OMNIROUTE_INTEGRATION.md. It was
> written during Phase 2 implementation to close that gap, following the placement four independent documents
> already agreed on. See the Architecture Review Report (Contradiction #2) for the reasoning.

## Purpose

The Intent Engine converts the Conversation Engine's understanding of the user into a single, structured, unambiguous
**Intent Object** that the Strategy Engine can plan against. Its responsibility is not to understand the user in general —
that is the Conversation Engine's job — its responsibility is to resolve exactly *what the user wants done*, in a form a
machine can plan and cost.

## Philosophy

A conversation is fuzzy. A plan cannot be. The Intent Engine is the narrow waist between free-form human language and
deterministic execution planning. Every ambiguity that reaches the Strategy Engine unresolved becomes wasted work,
wrong output, or an unnecessary clarification question — so the Intent Engine's job is to resolve everything it safely
can, and flag only what it cannot.

## Position in Platform

```
User
  |
  v
Conversation Engine  (understands the user, builds Conversation Context)
  |
  v
Intent Engine  (resolves Conversation Context into a structured Intent Object)
  |
  v
Strategy Engine  (plans an Execution Plan from the Intent Object)
  |
  v
Agent Orchestrator
```

The Intent Engine is the entry point of the **Decision Layer** in ARCHITECTURE.md's six-layer model
(Conversation → Decision → Execution → Infrastructure → Provider → Output). It consumes the Conversation Engine's
output and produces the Strategy Engine's input; it never talks to Agents, Providers, or MCP servers directly, and it
never generates content.

## Responsibilities

- Classify the primary action requested (e.g. Create Campaign, Create Single Asset, Explain/Educate, Repurpose
  Existing Content, Answer a Question).
- Extract concrete parameters already present in the conversation: brand, project, platform(s), output type(s),
  audience, tone, deadline/urgency, reference assets, knowledge sources.
- Resolve implicit parameters using Conversation Context, Brand Memory, and Project Memory before ever asking the
  user — an unresolved parameter is only a real gap if no memory or default can fill it.
- Assign a confidence score per resolved field.
- Detect multi-intent requests (e.g. "make a video and a blog post") and split them into ordered, related Intent
  Objects rather than forcing a single flattened one.
- Detect out-of-scope or unsupported requests early and return a clear reason instead of forwarding a plan that can
  never succeed.

## Intent Object (informal schema)

```
Intent Object
  id
  primaryAction        (create_campaign | create_asset | explain | repurpose | answer_question)
  brandId
  projectId
  goal
  audience
  outputTypes[]         (video, image, blog, carousel, email, ...)
  platforms[]
  knowledgeSources[]
  constraints            (budget, deadline, qualityLevel)
  confidence             (0-1 per field, overall)
  missingRequiredFields[]
  relatedIntents[]       (for split multi-intent requests)
```

A concrete, versioned schema for this object lives in `packages/core/src/schemas/intent.js` and is the single source
of truth — this document describes intent, the code defines the contract.

## Clarification Rules

- If overall confidence is high: pass the Intent Object straight to the Strategy Engine.
- If confidence is medium on a non-critical field: proceed using the best inferred value and record it as an
  assumption in the Intent Object rather than blocking.
- If a *required* field cannot be resolved from conversation, memory, or a sane default: populate
  `missingRequiredFields` and let the Conversation Engine ask the smallest possible clarification — never more than
  one question per unresolved field, and never re-ask for information already available in memory.

## Development Rules

- The Intent Engine never generates content.
- The Intent Engine never selects AI providers or MCP servers — capability requests, if any (e.g. a lightweight
  classification call), go through AI Infrastructure like every other component.
- The Intent Engine never talks to Agents directly.
- The Intent Engine must be deterministic given the same Conversation Context, Brand Memory, and Project Memory —
  no hidden state.
- Splitting a multi-intent request must never silently drop a requested output.

## Definition of Done

The Intent Engine is complete when it can: classify the primary action for every example in `EXAMPLES.md`; resolve
brand/project/platform/output-type from context without re-asking known information; produce a valid Intent Object
matching the schema in `packages/core`; correctly flag only genuinely missing required fields; and split compound
requests into ordered related Intent Objects without loss.

## Final Statement

The Intent Engine exists so that everything downstream of it — Strategy, Orchestration, Agents, Providers — can be
strict, typed, and predictable, even though everything upstream of it is loose, human, and ambiguous. It is the point
where a wish becomes a plan.
