
## AGENT_ORCHESTRATOR.md


## Wise Content Factory (WCF)

Version: 1.0Status: Core AI EngineOwner: WiseAitechs

## Purpose

The Agent Orchestrator is the central execution intelligence of Wise Content Factory.
It is responsible for coordinating every AI Agent in the platform.
The Agent Orchestrator does not generate content.
It does not perform research.
It does not edit videos.
Instead, it behaves like an experienced project manager that knows exactly which specialists should work, in what order, at what time, and at what cost.
Every execution inside Wise Content Factory flows through the Agent Orchestrator.

## Philosophy

Think like a Creative Director.
Think like a Film Producer.
Think like a Chief Operating Officer.
The Agent Orchestrator never performs specialist work.
It delegates.
It coordinates.
It validates.
It optimizes.
It completes projects.

## Position in Platform

text id="hws5e1" Conversation Engine         │         ▼ Intent Engine         │         ▼ Strategy Engine         │         ▼ Agent Orchestrator         │         ▼ AI Infrastructure         │         ▼ AI Providers
The Agent Orchestrator is the bridge between planning and execution.

## Primary Responsibilities

The Agent Orchestrator must
- Execute the Strategy Plan
- Schedule AI Agents
- Manage dependencies
- Execute parallel tasks
- Retry failures
- Validate outputs
- Optimize execution order
- Monitor progress
- Resume interrupted jobs
- Deliver completed projects

## Execution Philosophy

Every request becomes a Project.
Every Project becomes one or more Workflows.
Every Workflow becomes Tasks.
Every Task is assigned to an AI Agent.
No AI Agent should operate independently.
All work must be coordinated by the Agent Orchestrator.

## Execution Pipeline

```text id=“tcbegk” Execution Plan
↓
Task Planning
↓
Agent Assignment
↓
Parallel Scheduling
↓
Execution
↓
Quality Review
↓
Recovery
↓
Export ```

## Agent Registry

Every AI Agent registers itself automatically.
Each registration includes
Agent Name
Capabilities
Input Types
Output Types
Dependencies
Execution Cost
Average Duration
Priority
Health Status
Supported Providers
Supported Languages
Version
The Orchestrator discovers agents dynamically.
New agents should require no code changes.

## Core Agents

Planning
Research Agent
Trend Agent
Knowledge Agent
Brand Agent
Creative
Script Agent
Storyboard Agent
Prompt Agent
Thumbnail Agent
Music Agent
Avatar Agent
Voice Agent
Production
Image Agent
Animation Agent
Video Agent
Caption Agent
Editing Agent
Publishing
SEO Agent
Metadata Agent
Publishing Agent
Analytics Agent
Quality
Fact Check Agent
Grammar Agent
Brand Review Agent
QA Agent
Future agents should automatically integrate into the registry.

## Dynamic Agent Selection

Never execute unnecessary agents.
Example
User
Generate hashtags.
Run
SEO Agent
Brand Agent
Metadata Agent
Done.
User
Create an educational Reel.
Run
Research
↓
Script
↓
Storyboard
↓
Voice
↓
Images
↓
Video
↓
Captions
↓
QA
↓
Publishing
Only required agents should execute.

## Parallel Execution

Whenever possible
Execute independent agents simultaneously.
Example
Storyboard Complete
↓
Run Together
Voice Agent
Image Agent
Music Agent
Thumbnail Agent
Caption Agent
↓
Video Agent
↓
QA
↓
Export
The Orchestrator should maximize safe parallel execution.

## Dependency Graph

Every task declares
Depends On
Produces
Consumes
Priority
Timeout
Retry Policy
This allows intelligent scheduling.
Example
Script
↓
Storyboard
↓
Video
Voice
Images
Music
↓
Editor
↓
QA

## Workflow Types

Support
Marketing Campaign
Medical Education
Product Launch
Patient Awareness
Blog Package
Podcast
Presentation
Course
Website
Social Campaign
Internal Documentation
Each workflow contains predefined execution graphs.

## Agent Communication

Agents never communicate directly.
All communication passes through the Agent Orchestrator.
Example
Script Agent
↓
Agent Orchestrator
↓
Storyboard Agent
This prevents tight coupling.

## Task Queue

Every task enters the execution queue.
Task States
Waiting
Scheduled
Running
Paused
Retrying
Completed
Failed
Cancelled
Recovered
The queue should support prioritization.

## Retry Strategy

If an agent fails
Retry automatically.
If retry fails
Select alternative provider.
If provider fails
Select compatible fallback agent if available.
If all recovery attempts fail
Continue remaining tasks.
Generate a detailed report.
Never terminate the entire project because one task failed.

## Cost Management

Monitor
Estimated Cost
Actual Cost
Token Usage
Provider Usage
Cache Savings
Compression Savings
Local Processing Savings
Display real-time cost during execution.

## Resource Scheduling

Monitor
CPU
GPU
RAM
Network
Storage
Provider Quotas
Avoid resource contention.
Prioritize user responsiveness.

## Memory Integration

Before assigning work
Search
Global Memory
↓
Brand Memory
↓
Project Memory
↓
Conversation Memory
↓
Generation Cache
If reusable work exists
Reuse it.
Avoid duplicate AI generation.

## Quality Gates

Every major stage must pass validation.
Examples
Script
Grammar
Brand Voice
Medical Accuracy (when applicable)
Storyboard
Scene Timing
Visual Flow
Video
Resolution
Aspect Ratio
Subtitle Sync
Brand Elements
No asset should move to the next stage without passing its quality gate.

## Human Approval Mode

Support optional approval checkpoints.
Examples
Approve Script
Approve Storyboard
Approve Thumbnail
Approve Final Video
Default mode should remain fully automated.

## Progress Tracking

Display
Current Stage
Completed Tasks
Running Tasks
Pending Tasks
Estimated Time Remaining
Current AI Provider
Current Cost
Overall Progress
The user should always understand what the system is doing.

## Learning System

Track
Successful workflows
Successful agents
Provider performance
Execution times
User edits
Failures
Retries
Cost efficiency
Future execution plans should improve continuously.

## Integration with AI Infrastructure

The Agent Orchestrator never calls AI models directly.
Every AI request passes through
AI Infrastructure
↓
OmniRoute
↓
Provider Router
↓
AI Provider
This keeps execution independent of vendors.

## Execution Object

The Agent Orchestrator produces a live execution state.
Example
Workflow
Marketing Campaign
Current Stage
Video Generation
Completed
Research
Script
Storyboard
Voice
Running
Video
Pending
QA
Publishing
Estimated Remaining
2 Minutes
Progress
82%
Status
Healthy

## Failure Recovery

Support
Checkpoint Recovery
Workflow Resume
Crash Recovery
Provider Recovery
Network Recovery
Session Recovery
Completed work should never be regenerated unnecessarily.

## Scalability

Support
Thousands of Tasks
Hundreds of Agents
Unlimited Providers
Unlimited MCP Servers
Unlimited Brands
Unlimited Projects
without architectural changes.

## Design Principles

Delegate.
Coordinate.
Observe.
Recover.
Optimize.
Never duplicate work.
Never block independent tasks.
Always prioritize completion over perfection.

## Performance Goals

Workflow Scheduling
<100 ms
Task Dispatch
<50 ms
Agent Discovery
Automatic
Recovery Time
<5 seconds where possible
Parallel Efficiency
Maximum safe utilization

## Definition of Done

The Agent Orchestrator is complete when it can
Execute any workflow.
Assign tasks dynamically.
Discover new agents automatically.
Manage dependencies.
Schedule parallel execution.
Recover from failures.
Track progress.
Reuse previous work.
Coordinate AI Infrastructure.
Complete projects reliably.

## Future Vision

The Agent Orchestrator should evolve into an autonomous AI Production Manager capable of coordinating hundreds of specialized AI agents across multiple brands, projects, and content formats.
Future capabilities should include
- Multi-project scheduling
- Team collaboration
- Distributed AI workers
- Cloud execution pools
- Autonomous campaign planning
- AI-to-AI collaboration
- Self-optimizing workflows
- Marketplace agents

## Final Statement

The Agent Orchestrator is the operational brain of Wise Content Factory.
If the Strategy Engine decides what should happen, the Agent Orchestrator decides when, where, and by whom it happens.
Every piece of content produced by Wise Content Factory should exist because the Agent Orchestrator intelligently coordinated the right agents, at the right time, using the right resources, with the lowest practical cost and the highest achievable quality.
