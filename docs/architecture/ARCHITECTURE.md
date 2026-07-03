
## ARCHITECTURE.md


## Wise Content Factory (WCF)

Version: 1.0Status: Master Architecture SpecificationOwner: WiseAitechs

## Purpose

This document defines the official architecture of Wise Content Factory.
Every subsystem, AI agent, engine, module, provider, plugin, and feature must follow the principles defined in this document.
This is the highest-level technical specification for the platform.
If any future document conflicts with this specification, this document takes precedence.

## Product Philosophy

Wise Content Factory is not a video generator.
It is an AI Content Operating System.
The platform is designed to think, plan, create, optimize, and publish content using a coordinated team of AI systems rather than a single AI model.
Every part of the application should be modular, replaceable, and independently testable.

## Core Architectural Principles

The architecture must always prioritize:
- Simplicity
- Reliability
- Low operating cost
- High performance
- Modularity
- Extensibility
- Maintainability
- AI provider independence
- Fault tolerance
- Security
- Scalability
Every architectural decision should support these principles.

## High-Level Architecture

User │ ▼Conversation Layer │ ▼Decision Layer │ ▼Execution Layer │ ▼Infrastructure Layer │ ▼Provider Layer │ ▼Output Layer
Every layer has one responsibility.
No layer should bypass another layer.

## Layer 1 — Conversation Layer

Purpose
Understand the user.
Components
- Conversation Engine
- Intent Engine
- Context Engine
- Memory Engine
Responsibilities
Understand requests.
Understand history.
Understand brands.
Understand projects.
Understand objectives.
Produce structured intent.

## Layer 2 — Decision Layer

Purpose
Plan the work.
Components
- Strategy Engine
- Project Planner
- Campaign Planner
- Trend Intelligence Engine
Responsibilities
Choose workflow.
Estimate cost.
Estimate quality.
Choose providers.
Choose templates.
Determine required outputs.
Produce an execution plan.

## Layer 3 — Execution Layer

Purpose
Coordinate specialized AI workers.
Components
- Agent Orchestrator
- Workflow Engine
- Job Queue
- Quality Controller
Responsibilities
Schedule agents.
Run tasks.
Parallelize work.
Retry failures.
Validate outputs.
Resume interrupted jobs.
Manage dependencies.

## Layer 4 — Infrastructure Layer

Purpose
Provide shared platform services.
Components
- OmniRoute Integration
- MCP Manager
- Provider Router
- Cache Engine
- Cost Optimizer
- Provider Health Monitor
- Retry Manager
- Token Optimization
- Configuration Manager
- Security Manager
Responsibilities
AI routing.
Token optimization.
Caching.
Provider failover.
Cost reduction.
Secrets management.
Configuration.
Monitoring.
Infrastructure services must remain independent from business logic.

## Layer 5 — Provider Layer

Purpose
Connect external AI systems.
Examples
Language Models
Claude
Gemini
GPT
DeepSeek
OpenRouter
Local LLMs
Knowledge Providers
NotebookLM MCP
PDF
Google Docs
Website
Markdown
Media Providers
HyperFrames
Higgsfield
Google Veo
FLUX
SDXL
Imagen
Voice Providers
Browser TTS
Google
Microsoft
ElevenLabs
Local voice models
Providers must always be replaceable.
No business logic should depend on one provider.

## Layer 6 — Output Layer

Purpose
Generate finished assets.
Outputs
Videos
Images
Carousels
Podcasts
Blog posts
Newsletters
Emails
Presentations
Flashcards
Quizzes
Web pages
Marketing campaigns
Future output types should be added without modifying previous layers.

## Core Design Rules

Every component must have one responsibility.
Every module communicates through interfaces.
No circular dependencies.
No shared mutable state.
No duplicated logic.
Prefer composition over inheritance.
Prefer interfaces over implementations.

## Engine Hierarchy


### User Intelligence

Conversation Engine
Intent Engine
Context Engine
Memory Engine

### Planning Intelligence

Strategy Engine
Project Planner
Campaign Planner
Trend Intelligence Engine

### Execution Intelligence

Agent Orchestrator
Workflow Engine
Job Queue
Quality Controller

### Infrastructure Intelligence

OmniRoute
Provider Router
Cache Engine
Retry Manager
Cost Optimizer
Provider Health Monitor
MCP Manager
Configuration Manager
Security Manager

## Agent Architecture

Agents perform work.
Engines make decisions.
Infrastructure provides services.
Providers execute AI requests.
This separation must never be violated.
Example Agents
Research
Script
Storyboard
Prompt
Image
Video
Avatar
Voice
Music
SEO
Publishing
Analytics
QA
Brand
Future agents must register dynamically.
The Orchestrator should automatically discover available agents.

## AI Request Flow

Every AI request follows the same path.
User Request
↓
Conversation Layer
↓
Decision Layer
↓
Agent Orchestrator
↓
Infrastructure Layer
↓
OmniRoute
↓
AI Provider
↓
Response
↓
Quality Validation
↓
Output
No agent should call an AI provider directly.
All requests must pass through the Infrastructure Layer.

## Memory Architecture

Memory exists at four levels.
Global Memory
Stores application preferences.
Brand Memory
Stores brand identity.
Project Memory
Stores project assets and history.
Generation Cache
Stores reusable AI responses.
Memory should minimize duplicate work and reduce operating cost.

## Data Flow

Input
↓
Intent
↓
Strategy
↓
Workflow
↓
Agent Tasks
↓
AI Providers
↓
Validation
↓
Export
↓
Project Archive
Every step should be resumable.

## Failure Recovery

The system must tolerate failure.
If an agent fails:
Retry.
If retry fails:
Choose another provider.
If provider fails:
Continue remaining tasks.
If output cannot be recovered:
Report only the failed component.
Never discard completed work.

## Cost Optimization

Cost reduction is a platform capability.
Priority order
- Cache
- Local models
- Browser capabilities
- Free providers
- Open-source providers
- Low-cost APIs
- Premium APIs
Every request should include:
Estimated cost
Estimated duration
Selected provider
Fallback provider
Reason for selection

## Plugin Architecture

Everything should support plugins.
Examples
New AI providers
New MCP servers
New languages
New templates
New avatars
New editors
New exporters
New publishing platforms
Plugins should require no modification of the platform core.

## Security

Never hard-code credentials.
Encrypt sensitive configuration.
Validate external input.
Protect user data.
Keep secrets outside source control.
Support secure local-first operation.

## Performance

Lazy-load heavy modules.
Parallelize independent tasks.
Cache expensive operations.
Reuse generated assets.
Avoid duplicate AI requests.
Optimize startup time.

## Scalability

The architecture should support:
Unlimited brands
Unlimited projects
Unlimited templates
Unlimited agents
Unlimited providers
Unlimited MCP servers
Unlimited output formats
without redesigning the platform.

## Future Readiness

The architecture should be prepared for:
Autonomous AI workflows
Multi-user collaboration
Team workspaces
Cloud synchronization
Enterprise deployment
Marketplace extensions
Fine-tuned private models
Additional MCP ecosystems
Self-learning optimization
Advanced analytics

## Definition of Done

A feature is complete only when it:
Works reliably.
Follows this architecture.
Uses shared platform services.
Minimizes operating cost.
Supports future extension.
Includes error handling.
Includes documentation.
Maintains modularity.
Does not introduce unnecessary complexity.

## Architecture Statement

Wise Content Factory should behave like an intelligent operating system rather than a collection of AI tools.
Every subsystem should have a single responsibility.
Every decision should prioritize simplicity, affordability, maintainability, and long-term extensibility.
The architecture should enable the platform to evolve for years without requiring major redesigns.
