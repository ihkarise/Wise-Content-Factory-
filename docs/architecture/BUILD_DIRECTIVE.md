
## BUILD_DIRECTIVE.md


## Wise Content Factory (WCF)


### MASTER BUILD DIRECTIVE

Version: 1.0
Status: Mandatory
Priority: Highest

## Read This First

Before generating or modifying any code, read and understand every architecture document in this repository.
At a minimum, process these documents in order:
- PRODUCT.md
- ARCHITECTURE.md
- PLATFORM_ARCHITECTURE.md
- SECURITY_ARCHITECTURE.md (governs all security decisions; takes precedence over any conflicting document)
- AI_INFRASTRUCTURE.md
- CONVERSATION_ENGINE.md
- INTENT_ENGINE.md
- STRATEGY_ENGINE.md
- AGENT_ORCHESTRATOR.md
- MCP_ARCHITECTURE.md
- OMNIROUTE_INTEGRATION.md
- KNOWLEDGE_ENGINE.md
- CONTENT_FACTORY.md
- DESIGN_SYSTEM.md
- CLAUDE.md
- EXAMPLES.md
These documents define the official platform specification.
Do not ignore them.
Do not partially implement them.

## Mission

Build Wise Content Factory.
A production-ready AI Content Operating System.
Not a prototype.
Not a demo.
Not an MVP shortcut.
Build a software platform that can continue growing for years.

## Your Role

Act as
Chief Software Architect
↓
Chief AI Architect
↓
Senior Product Engineer
↓
Senior UI/UX Designer
↓
DevOps Engineer
↓
Performance Engineer
↓
Security Engineer
↓
QA Engineer
↓
Technical Writer
Think holistically.
Do not optimize for writing code quickly.
Optimize for building software correctly.

## Build Philosophy

Every decision should reduce
Time
Cost
Complexity
Maintenance
Manual Work
Every decision should improve
Quality
Reliability
Automation
Scalability
Maintainability
Extensibility
User Experience

## User Philosophy

The target user is not a programmer.
The software should require little or no coding knowledge.
Every workflow should be self-explanatory.
If automation is possible, prefer automation over manual configuration.

## Platform Philosophy

Wise Content Factory is
NOT
a chatbot.
NOT
a video editor.
NOT
a prompt collection.
NOT
an automation script.
It IS
An AI Content Operating System.
Every feature must support this vision.

## Build Everything

Generate the complete repository.
Including
Application
Backend
Frontend
Documentation
Tests
Installer
Configuration
Brand System
Templates
AI Infrastructure
Examples
Developer Documentation
Deployment Documentation
GitHub Workflows
CI/CD
Do not leave TODOs or placeholder implementations unless explicitly documented as future work.

## Autonomous Development

Operate autonomously.
Do not stop after each milestone.
Continue implementing until the platform is complete.
Only ask questions if a decision cannot be inferred safely from the existing documentation.
If assumptions are required:
Choose the most maintainable.
Choose the lowest-cost.
Choose the most future-proof.
Document assumptions.
Continue building.

## GitHub Repository

Produce a clean GitHub-ready repository.
Include
README
CHANGELOG
LICENSE placeholder
CONTRIBUTING
Developer Guide
Architecture Docs
Deployment Guide
Troubleshooting Guide
Version History
GitHub Actions
Issue Templates
Pull Request Template
Project Structure
Everything should be ready for long-term development.

## Git Workflow

Follow professional Git practices.
Logical commits.
Clear folder organization.
Meaningful names.
No generated clutter.
No duplicate files.
No abandoned experiments.

## Frontend

Target
GitHub Pages
Modern Desktop UI
Responsive
Fast
Minimal
Dark Mode
Accessible
Keyboard Friendly
The frontend must never expose provider secrets.

## Backend

Create a secure backend using Google Apps Script.
This backend is mandatory.
Its responsibilities include
Authentication
Session Management
Secure API Gateway
Request Validation
Rate Limiting
Audit Logging
Configuration
Proxy Requests
Provider Access
Token Management
Secret Management
The backend should expose only the APIs required by the frontend.
No provider credentials should ever be accessible from browser code.

## Security Gateway

The Apps Script backend acts as the platform’s secure gateway.
Architecture
Frontend
↓
Authentication
↓
Apps Script Secure Gateway
↓
OmniRoute
↓
AI Providers
The browser should never communicate directly with external AI providers when secrets are required.
All provider communication must occur through the secure backend.

## Secret Management

Store
API Keys
OAuth Tokens
Provider Credentials
Configuration Secrets
Only inside the backend.
Never embed secrets into
JavaScript
HTML
CSS
GitHub Repository
Client Storage
Never expose secrets through logs or network responses.

## AI Infrastructure

Implement
OmniRoute
Provider Router
Cache
Retry System
Token Optimizer
Cost Optimizer
MCP Manager
Health Monitor
Configuration Manager
Everything should follow AI_INFRASTRUCTURE.md.

## MCP

Implement dynamic MCP support.
Automatically discover available MCP servers.
Register capabilities.
Avoid hard-coded integrations.
Support future MCP servers without architecture changes.

## NotebookLM

NotebookLM should be the preferred knowledge source when connected.
If unavailable
Automatically fall back to
Project Knowledge
Uploaded Documents
Website Knowledge
Local Knowledge
Never block generation because NotebookLM is unavailable.

## AI Provider Independence

Never tightly couple business logic to any provider.
Support
Claude
Gemini
OpenAI-compatible providers
DeepSeek
Local models
Future providers
All provider access must occur through the infrastructure layer.

## Cost Optimization

This is a core feature.
Always prefer
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
Show estimated cost whenever practical.
Avoid unnecessary AI requests.
Reuse previous work.

## Memory

Implement
Global Memory
Brand Memory
Project Memory
Conversation Memory
Generation Cache
Memory should improve the platform continuously.

## Knowledge

Implement
Knowledge Engine
NotebookLM
Knowledge Cache
Knowledge Graph
Document Parsing
Grounded Generation
Source Traceability

## Content

Generate
Video
Image
Audio
Presentation
Carousel
Blog
Podcast
Poster
Email
Landing Page
Website Copy
Marketing Campaign
The user should think in ideas.
The platform should think in outputs.

## User Experience

Minimize
Clicks
Typing
Configuration
Confusion
Maximize
Automation
Discoverability
Consistency
Accessibility
Responsiveness
Confidence

## Error Recovery

Automatically recover
Network Failures
Provider Failures
Timeouts
Partial Workflow Failures
Session Interruptions
Never lose completed work.

## Quality

Every output should pass
Grammar Review
Brand Review
Visual Review
Technical Review
Platform Validation
QA
before export.

## Testing

Generate
Unit Tests
Integration Tests
Workflow Tests
Architecture Validation
Smoke Tests
Future changes should be testable.

## Documentation

Document every major subsystem.
Never rely on code alone.
Every public module should explain
Purpose
Responsibilities
Configuration
Examples
Failure Modes
Extension Points

## Performance

Startup should be fast.
UI should remain responsive.
Heavy tasks should run in background workers.
Reuse cached work.
Avoid unnecessary rendering.
Optimize memory usage.

## Future Compatibility

Design for
Unlimited Brands
Unlimited Projects
Unlimited Templates
Unlimited AI Providers
Unlimited MCP Servers
Unlimited Plugins
Unlimited Workflows
Unlimited Languages
without requiring architectural redesign.

## Definition of Success

The project is complete when a user can type
“Promote PillFill this week.”
and the platform automatically
Loads Brand Memory
Retrieves Knowledge
Builds Strategy
Generates Scripts
Creates Storyboards
Generates Images
Generates Video
Generates Voice
Creates Captions
Creates Thumbnails
Creates Blog
Creates Carousel
Creates Email Campaign
Runs Quality Assurance
Packages Assets
Exports Everything
while maintaining
Low Cost
High Quality
Professional Design
Reliable Execution
Minimal User Interaction

## Final Directive

Do not build isolated features.
Build a cohesive platform.
Think before implementing.
Plan before coding.
Prefer architecture over shortcuts.
Prefer maintainability over cleverness.
Prefer modularity over duplication.
Prefer automation over manual work.
Prefer low operating cost over unnecessary complexity.
Every decision should move Wise Content Factory closer to becoming a world-class AI Content Operating System that enables a non-programmer to create enterprise-quality marketing campaigns from a single idea.
