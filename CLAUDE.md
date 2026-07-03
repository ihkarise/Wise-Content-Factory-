
## CLAUDE.md


## Wise Content Factory (WCF)

Version: 1.0Status: Master Development RulesOwner: WiseAitechs

## Purpose

This is the master development guide for Wise Content Factory.
Every AI coding agent, Claude instance, Fable, or developer contributing to this repository must follow these rules.
These instructions take precedence over implementation preferences unless explicitly overridden by repository maintainers.
The objective is to produce a production-quality platform, not a prototype.

## Mission

Build the world’s most affordable AI-powered Content Operating System.
The software must enable a non-programmer to create professional marketing campaigns from a single prompt.
Every design decision should reduce:
- Time
- Cost
- Complexity
- Manual effort
while increasing
- Quality
- Reliability
- Automation
- Maintainability

## Product Philosophy

The project is not
- A chatbot
- A video generator
- A prompt library
- A collection of AI tools
The project is
An AI Content Operating System.
Every feature should support this vision.

## Development Philosophy

Always build production software.
Never build demos.
Never build proof-of-concepts.
Never build mock implementations.
Every feature should be capable of remaining in production.

## Primary Principles

Every implementation should prioritize
- Simplicity
- Maintainability
- Reliability
- Performance
- Low operating cost
- Security
- Modularity
- Extensibility

## Before Writing Code

Always understand, in this order (all located under `docs/architecture/` unless noted):
PRODUCT.md
↓
ARCHITECTURE.md
↓
PLATFORM_ARCHITECTURE.md
↓
SECURITY_ARCHITECTURE.md *(governs all security decisions; takes precedence over any conflicting document)*
↓
AI_INFRASTRUCTURE.md
↓
CONVERSATION_ENGINE.md
↓
INTENT_ENGINE.md
↓
STRATEGY_ENGINE.md
↓
AGENT_ORCHESTRATOR.md
↓
MCP_ARCHITECTURE.md
↓
OMNIROUTE_INTEGRATION.md
↓
KNOWLEDGE_ENGINE.md
↓
CONTENT_FACTORY.md
↓
DESIGN_SYSTEM.md
↓
BUILD_DIRECTIVE.md
↓
EXAMPLES.md
Never implement features without understanding the architecture.

> Documentation history: an earlier version of this repository omitted `SECURITY_ARCHITECTURE.md` from the
> reading order and was missing `INTENT_ENGINE.md` entirely, despite both being referenced elsewhere. Both gaps
> were closed during Phase 2 implementation — see `docs/architecture/INTENT_ENGINE.md`'s provenance note and the
> Architecture Review Report for details.

## Development Rules

Never introduce unnecessary complexity.
Never duplicate business logic.
Never hard-code provider-specific behavior.
Never hard-code MCP servers.
Never tightly couple modules.
Always prefer reusable abstractions.
Always write code that is easy to replace.

## Folder Responsibilities

Each folder should own one responsibility.
Example
Core
Business Logic
Engines
Decision Systems
Agents
Execution Workers
Providers
External AI Providers
MCP
External Tool Integration
UI
User Interface
Memory
Knowledge Storage
Branding
Brand Assets
Templates
Reusable Templates
Tests
Testing
Scripts
Automation
No folder should contain unrelated functionality.

## Architecture Rules

Every feature must fit into one of these layers
Conversation
↓
Decision
↓
Execution
↓
Infrastructure
↓
Provider
↓
Output
Do not bypass layers.
Do not create shortcuts.

## Engine Rules

Engines
Think.
Plan.
Coordinate.
Optimize.
Engines do not generate content.

## Agent Rules

Agents
Generate.
Transform.
Validate.
Export.
Agents never coordinate other agents.
Agents never select AI providers.
Agents never manage workflows.

## Infrastructure Rules

Infrastructure
Routes AI requests.
Optimizes costs.
Caches results.
Retries failures.
Monitors providers.
Handles MCP.
Infrastructure should never contain business logic.

## Provider Rules

Every provider must implement the same interface.
Language Models
Vision Models
Image Models
Video Models
Voice Models
Knowledge Models
No business logic should depend on provider APIs.

## AI Request Rules

Every AI request must follow
Agent
↓
AI Infrastructure
↓
OmniRoute
↓
Provider
↓
Validation
↓
Cache
↓
Response
Direct provider calls are prohibited.

## MCP Rules

Every external integration should use MCP when available.
Do not create custom integrations if an appropriate MCP server already exists.
Treat MCP as the default integration mechanism.

## Cost Rules

Cost optimization is a required feature.
Priority
Cache
↓
Local Models
↓
Browser Capabilities
↓
Free Providers
↓
Low-cost Providers
↓
Premium Providers
Every expensive request should have a clear justification.

## Performance Rules

Parallelize independent tasks.
Reuse previous work.
Cache expensive operations.
Avoid duplicate AI requests.
Lazy-load heavy modules.
Never block the UI.

## Memory Rules

Memory exists at
Global
Brand
Project
Conversation
Generation Cache
Never duplicate stored knowledge.
Always reuse existing memory.

## Plugin Rules

Everything should support plugins.
Providers
Agents
Templates
MCP Servers
Exporters
Languages
Workflows
Plugins should require zero changes to the platform core.

## Coding Standards

Write readable code.
Prefer descriptive names.
Avoid deeply nested logic.
Use interfaces.
Prefer composition.
Separate business logic from UI.
Separate business logic from infrastructure.
Every public component should be documented.

## Error Handling

Every failure must
Explain itself.
Recover automatically whenever possible.
Provide actionable guidance.
Never expose internal implementation details to users.
Never lose user work.

## Logging

Log
Warnings
Errors
Retries
Provider Selection
Workflow Events
Performance Metrics
Never log
Secrets
API Keys
Private Documents
Sensitive User Data

## Security

Encrypt credentials.
Validate inputs.
Validate outputs.
Store secrets securely.
Protect user data.
Never hard-code secrets.
Never expose credentials.

## Testing

Every important feature should be
Unit Tested
Integration Tested
Workflow Tested
Regression Tested
Do not merge code that breaks existing functionality.

## Documentation

Every major feature must include
Purpose
Architecture
Configuration
Examples
Failure Modes
Future Extension Notes
Code should never become the only documentation.

## User Experience Rules

Users should not need AI knowledge.
Users should not configure models.
Users should not manage tokens.
Users should not understand prompt engineering.
The software should make intelligent decisions automatically.

## Design Rules

Follow DESIGN_SYSTEM.md.
Never invent new UI styles.
Reuse components.
Maintain visual consistency.
Support dark mode.
Support keyboard navigation.
Maintain accessibility.

## Scalability

Design for
Unlimited Brands
Unlimited Projects
Unlimited Templates
Unlimited Campaigns
Unlimited Providers
Unlimited MCP Servers
Unlimited Assets
Unlimited Plugins
Never design around current limitations.

## Future Compatibility

Expect
New AI Models
New MCP Servers
New Media Types
New Workflows
Enterprise Features
Cloud Features
Collaboration
Marketplace
Autonomous AI
Code should remain extensible.

## Definition of Done

A task is complete only when
It follows the architecture.
It follows the design system.
It minimizes operating cost.
It supports future extension.
It includes documentation.
It includes error handling.
It includes testing where appropriate.
It introduces no unnecessary complexity.
It improves the overall platform.

## AI Coding Expectations

When implementing features
Think like
A CTO
A Software Architect
A Product Designer
A DevOps Engineer
A Performance Engineer
A Security Engineer
A UX Designer
Do not optimize only for making code compile.
Optimize for creating software that remains maintainable for years.

## Final Directive

Every contribution should move Wise Content Factory closer to becoming the world’s most intelligent, affordable, and extensible AI Content Operating System.
If there are multiple valid implementation choices, prefer the one that is:
- Simpler
- More modular
- More maintainable
- Lower cost
- Easier for non-programmers
- Easier to extend
- Better aligned with the overall architecture
When in doubt, prioritize long-term platform quality over short-term implementation speed.
