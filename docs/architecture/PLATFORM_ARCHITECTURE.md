
## PLATFORM_ARCHITECTURE.md


## Wise Content Factory (WCF)

Version: 1.0Status: Platform Architecture SpecificationOwner: WiseAitechs

## Purpose

This document defines the platform architecture for Wise Content Factory.
While ARCHITECTURE.md explains how the software is organized logically, this document defines how the platform is built, deployed, extended, updated, and operated.
It serves as the blueprint for the entire ecosystem.

## Platform Philosophy

Wise Content Factory is not a single application.
It is an AI Platform.
Everything should be modular.
Everything should be replaceable.
Everything should be discoverable.
Everything should be configurable.
Everything should be upgradeable.
Every feature should be able to evolve independently.

## Platform Goals

The platform should be:
Simple for non-programmers.
Powerful for advanced users.
Low-cost to operate.
Fast.
Reliable.
Cloud-ready.
Local-first.
Plugin-based.
AI-provider independent.
Future-proof.

## High-Level Platform

User                          │                          ▼                 Desktop Application                          │──────────────────────────────────────────────────────────                  Platform Core────────────────────────────────────────────────────────── Conversation Engine Intent Engine Strategy Engine Agent Orchestrator Workflow Engine Job Queue──────────────────────────────────────────────────────────             AI Infrastructure Layer────────────────────────────────────────────────────────── OmniRoute MCP Manager Provider Router Cache Engine Cost Optimizer Retry Manager Configuration Manager Security Manager──────────────────────────────────────────────────────────                 Provider Layer────────────────────────────────────────────────────────── Claude Gemini GPT DeepSeek NotebookLM MCP HyperFrames Veo Higgsfield FLUX Browser TTS Local Models──────────────────────────────────────────────────────────                  Output Layer────────────────────────────────────────────────────────── Video Image Carousel Blog Podcast Website Presentation Marketing Campaign

## Platform Core

The Platform Core is responsible for business logic.
It never communicates directly with AI providers.
It communicates only through the AI Infrastructure Layer.

## AI Infrastructure

The AI Infrastructure Layer is the operating system for AI.
Responsibilities
AI routing
Provider abstraction
Caching
Retries
Compression
Provider health
Cost optimization
Authentication
Secrets
Monitoring
All AI requests pass through this layer.

## OmniRoute Integration

OmniRoute is the default AI gateway.
It provides:
Unified API endpoint
Multi-provider routing
Automatic failover
Token optimization
Compression
Cost-aware routing
Provider health monitoring
MCP support
Future routing strategies
The application should communicate with OmniRoute rather than individual AI providers whenever possible. This keeps the rest of the platform independent of any single model or vendor and allows routing, failover, and token optimization to be centralized.

## MCP Architecture

The platform should treat MCP as a first-class capability.
Supported MCP servers include:
NotebookLM
GitHub
Google Drive
Filesystem
Browser
Canva
Figma
YouTube
Future MCP servers
The MCP Manager should automatically discover and register available servers.
No code modifications should be required to use newly available MCP services.

## Repository Structure

The repository should follow a clean modular structure.
apps/desktop/packages/core/engines/agents/providers/mcp/memory/branding/templates/ui/docs/scripts/assets/tests/examples/plugins/
Every package should have one responsibility.

## Configuration System

Configuration should exist in layers.
Global Configuration
↓
Brand Configuration
↓
Project Configuration
↓
Session Configuration
↓
Temporary Runtime Configuration
Higher layers override lower layers only when necessary.

## Plugin System

The platform must support plugins.
Examples
New AI models
New providers
New MCP servers
New export formats
New templates
New avatars
New languages
New workflows
Plugins should be installable without modifying the platform core.

## Provider Abstraction

The application should never depend on one provider.
Every provider implements the same interface.
Language Providers
Vision Providers
Video Providers
Voice Providers
Knowledge Providers
Image Providers
This allows providers to be replaced without affecting business logic.

## Memory Architecture

Memory exists independently from AI providers.
Levels
Global
Brand
Project
Conversation
Generation Cache
AI Cache
Memory should survive application restarts.

## Brand Architecture

Each brand owns:
Logo
Fonts
Colors
Voice
CTA
Templates
Assets
Campaign history
Prompt history
Preferred providers
Brands must remain isolated from each other.

## Project Architecture

Each project stores:
Knowledge
Assets
Scripts
Videos
Images
Audio
Exports
History
Settings
Memory
Projects should be completely portable.

## Workflow Architecture

Every request becomes
Project
↓
Workflow
↓
Tasks
↓
Jobs
↓
Outputs
Tasks should support parallel execution whenever possible.

## Job Management

Jobs must support
Pause
Resume
Retry
Cancel
Priority
Progress tracking
Dependency tracking
Recovery after crashes

## Asset Management

Central Asset Library
Store
Images
Videos
Logos
Voice Samples
Music
Templates
Animations
Icons
Generated Assets
Assets should be reusable across brands and projects when appropriate.

## Security

Encrypt secrets.
Protect API keys.
Secure local storage.
Validate external inputs.
Support offline operation where practical.
Never expose credentials.

## Update System

The application should support
Automatic updates
Manual updates
Rollback
Version migration
Configuration migration
Plugin updates
Users should not lose projects during updates.

## Deployment

Primary Platform
Windows Desktop
Future
macOS
Linux
Cloud Workspace
Web Dashboard
Mobile Companion

## Cloud Architecture

Cloud execution should remain optional.
Users should be able to choose:
Fully Local
Hybrid
Cloud Assisted
Enterprise Cloud
The platform should not require cloud services for core functionality.

## Performance

Lazy loading
Background workers
Parallel execution
Incremental loading
Streaming responses
Smart caching
Asset deduplication
Efficient memory usage

## Logging

Log
AI requests
Provider decisions
Generation time
Errors
Warnings
Plugin activity
Performance metrics
Sensitive information must never be logged.

## Backup System

Automatic project backups.
Manual snapshots.
Version history.
Brand backup.
Template backup.
Configuration export.
Complete workspace export.

## Recovery

Recover after:
Crash
Power failure
Provider failure
Network interruption
Application restart
Resume incomplete workflows automatically whenever possible.

## Scalability

Support:
Unlimited brands
Unlimited projects
Unlimited templates
Unlimited assets
Unlimited plugins
Unlimited providers
Unlimited MCP servers
Unlimited workflows
without requiring architectural redesign.

## Development Principles

Every module must be:
Independent
Well documented
Testable
Replaceable
Observable
Maintainable
Versioned
Reusable

## Definition of Done

A platform feature is complete when:
It integrates cleanly with the architecture.
It follows the provider abstraction.
It supports future extensions.
It minimizes operating cost.
It includes error recovery.
It is documented.
It is testable.
It does not introduce tight coupling.

## Platform Statement

Wise Content Factory should behave like an operating system for AI-powered content creation.
The platform should hide technical complexity from users while exposing a powerful, modular foundation for future growth.
Every component should be replaceable.
Every workflow should be extensible.
Every AI provider should be optional.
Every project should remain portable.
The platform should continue evolving for years without requiring a fundamental architectural redesign.
