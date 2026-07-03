## KNOWLEDGE_ENGINE.md

## Wise Content Factory (WCF)

Version: 1.0 Status: Core AI Engine Owner: WiseAitechs

## Summary

The Knowledge Engine is the intelligence layer responsible for collecting, organizing, validating, indexing, and
serving knowledge throughout Wise Content Factory. Its responsibility is not to generate content. Its responsibility is to
ensure every AI-generated output is grounded in trusted, relevant, and up-to-date knowledge.

## Technical Skills

- Collect knowledge
- Normalize knowledge
- Validate knowledge
- Organize knowledge
- Index knowledge
- Cache knowledge
- Search knowledge
- Summarize knowledge
- Ground AI responses
- Prevent hallucinations
- Reuse existing knowledge
- Semantic Search
- Keyword Search
- Hybrid Search
- Entity Search
- Relationship Search
- Time-based Search
- Project Search
- Brand Search
- Similarity Search
- NotebookLM MCP
- Filesystem MCP
- GitHub MCP
- Browser MCP
- Google Drive MCP
- OmniRoute
- Access Control
- Encryption
- Permission Levels
- Audit Logging
- Lazy-load large documents
- Parallel document processing
- Incremental indexing
- Background synchronization

## Purpose

The Knowledge Engine is the intelligence layer responsible for collecting, organizing, validating, indexing, and
serving knowledge throughout Wise Content Factory. Every AI Agent should consume knowledge through the
Knowledge Engine instead of accessing documents directly.

## Philosophy

Knowledge should exist once. Everyone should reuse it. The Knowledge Engine transforms scattered information into
structured intelligence. Knowledge is a reusable asset.

## Core Objectives

Accurate; Searchable; Reusable; Traceable; Versioned; Cached; Secure; Provider Independent.

## Knowledge Sources

Initially supports: NotebookLM MCP, PDF, DOCX, Markdown, Plain Text, Website URLs, Google Docs, Google
Sheets, PowerPoint, Research Papers, Medical Journals, Blog Articles, YouTube Transcripts, Images, Audio Notes,
Videos, GitHub Repositories, Local Files, Project Documents, Brand Documentation.

## Position in Platform

```
Conversation Engine
        |
        v
Intent Engine
        |
        v
Strategy Engine  <-- queries Knowledge Engine for grounding context
        |
        v
Agent Orchestrator  <-- Research Agent / Knowledge Agent request retrieval
        |
        v
AI Infrastructure
        |
        v
Knowledge Engine
        |
        v
NotebookLM MCP / Filesystem MCP / GitHub MCP / Google Drive MCP / Browser MCP
```

The Knowledge Engine sits inside the Infrastructure layer, alongside the AI Infrastructure and MCP Manager. Agents
never query knowledge sources directly — they request knowledge through the Knowledge Engine, which in turn uses
MCP servers (or local indexes) to fulfill the request. This keeps knowledge retrieval provider-independent and
auditable, consistent with the platform-wide "no layer bypass" rule defined in ARCHITECTURE.md.

## Development Rules

- The Knowledge Engine never generates content.
- The Knowledge Engine never selects AI providers directly — it requests capabilities through AI Infrastructure like
  every other component.
- Agents never access documents directly; they always go through the Knowledge Engine.
- NotebookLM is optional. Generation should never block because NotebookLM is unavailable — fall back to local
  Filesystem/GitHub/Google Drive knowledge sources or proceed without grounding and flag the output as ungrounded.
- Every retrieval result should be cached and versioned so repeated questions never re-trigger expensive processing.

## Definition of Done

Every document can be imported. Every source becomes structured knowledge. Knowledge is searchable and reusable.
AI responses are grounded. NotebookLM is optional. Knowledge is cached and versioned. Knowledge improves over
time. Agents consume knowledge through one consistent interface.

## Final Statement

The Knowledge Engine is the institutional memory of Wise Content Factory. It transforms documents into intelligence,
information into reusable assets, and isolated files into connected knowledge. The quality of Wise Content Factory
depends on the quality, organization, and accessibility of managed knowledge.
