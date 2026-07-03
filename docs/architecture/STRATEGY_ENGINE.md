
## STRATEGY_ENGINE.md


## Wise Content Factory (WCF)

Version: 1.0Status: Core AI EngineOwner: WiseAitechs

## Purpose

The Strategy Engine is the master planner of Wise Content Factory.
It receives the structured Intent Object from the Intent Engine and determines the optimal execution strategy.
The Strategy Engine does not generate content.
It does not call AI models.
It creates the smartest, fastest, and most cost-effective execution plan for the Agent Orchestrator.

## Philosophy

The Intent Engine understands what the user wants.
The Strategy Engine decides how to achieve it.
The Agent Orchestrator executes the plan.
The user should never need to decide:
- Which AI model to use
- Which workflow to choose
- Which provider is cheapest
- Which template fits best
- Which assets already exist
The Strategy Engine makes those decisions automatically.

## Position in Platform

text id="6a2tqm" User     │     ▼ Conversation Engine     │     ▼ Intent Engine     │     ▼ Strategy Engine     │     ▼ Agent Orchestrator
The Strategy Engine sits between understanding and execution.

## Responsibilities

The Strategy Engine must:
- Build execution plans
- Select workflows
- Choose templates
- Estimate complexity
- Estimate cost
- Estimate duration
- Recommend reusable assets
- Recommend knowledge sources
- Determine required agents
- Determine execution order
- Recommend quality targets
- Recommend fallback strategies

## Inputs

The Strategy Engine receives
Intent Object
Conversation Context
Brand Memory
Project Memory
Generation History
Available Assets
Available MCP Resources
Available Providers
Platform Capabilities
Cost Policies
Current System Health

## Primary Goal

Produce the best result at the lowest practical cost while maintaining the requested quality.

## Strategy Pipeline

```text id=“i8tk6l” Intent
↓
Analyze
↓
Plan
↓
Optimize
↓
Estimate
↓
Build Workflow
↓
Send Execution Plan
↓
Agent Orchestrator ```

## Workflow Selection

The engine chooses the most suitable workflow.
Examples
Marketing Campaign
Educational Campaign
Product Launch
Patient Education
Social Media Package
Video Only
Podcast
Blog
Presentation
Website
Research Summary
One request may trigger multiple workflows.

## Campaign Planning

For every request determine
Campaign Goal
Audience
Platform
Brand
Content Type
Tone
Duration
Publishing Priority
Call To Action
Content Sequence
Repurposing Opportunities

## Execution Planning

Determine
Required Engines
Required Agents
Required MCP Servers
Knowledge Sources
Provider Capabilities
Expected Dependencies
Parallel Tasks
Sequential Tasks
Retry Plan
Export Formats

## Content Planning

Automatically determine
Hook
Narrative Style
Story Structure
Visual Style
Animation Style
Music Mood
Voice Style
Editing Style
CTA Position
Brand Consistency

## Template Selection

Automatically choose
Brand Template
Video Template
Caption Template
Carousel Template
Presentation Template
Thumbnail Template
Blog Template
Email Template
If none exists
Generate a new template.

## Asset Reuse

Before creating anything
Search
Existing Images
Existing Videos
Brand Logos
Voice Samples
Music
Animations
Icons
Previous Campaigns
Prompt Library
Generated Assets
Reuse assets whenever appropriate.

## Knowledge Planning

Determine
Should NotebookLM be used?
Should PDFs be analyzed?
Should Website knowledge be used?
Should Previous Campaigns be referenced?
Should Brand Memory be loaded?
Should Trend Analysis run?
The Strategy Engine decides before execution begins.

## Trend Planning

Determine if trend analysis is required.
Examples
Product Launch
Yes
Medical Education
Yes
Company Introduction
Optional
Internal Documentation
No
Trend analysis should run only when it provides measurable value.

## Quality Planning

Determine desired quality level.
Economy
Balanced
Professional
Premium
Enterprise
Quality influences
Execution time
Cost
Provider selection
Media generation depth

## Cost Planning

Estimate
Token usage
Image generation
Video generation
Voice generation
Storage
Execution time
Provider costs
Expected cache savings
Expected compression savings
Present an estimated budget before execution when appropriate.

## Performance Planning

Estimate
Execution Time
Download Size
Memory Usage
GPU Requirements
Network Usage
Cache Benefits
Parallel Execution Opportunities

## Parallel Execution Planning

Determine which tasks may execute simultaneously.
Example
Research
↓
Script
↓
Storyboard
↓
┌──────────────┬─────────────┬──────────────┐
Voice
Images
Music
└──────────────┴─────────────┴──────────────┘
↓
Video Editing
↓
Export
The Strategy Engine should maximize safe parallel execution.

## Failure Planning

Prepare fallback strategies.
If
NotebookLM unavailable
↓
Use local documents
If
Primary provider unavailable
↓
Use Provider Router
If
Video model unavailable
↓
Use image sequence animation
Every workflow should include recovery paths.

## Resource Optimization

Optimize
CPU
GPU
Memory
Bandwidth
Token Usage
Storage
AI Credits
Local Models
Free Providers
Premium Providers
Avoid unnecessary resource consumption.

## Multi-Brand Planning

Support
Wise Homeopathy
WiseAitechs
PillFill
Future brands
Each strategy should load the correct
Brand Kit
Voice
Colors
Fonts
Templates
Assets
Marketing Style
CTA

## Multi-Project Planning

Recognize
Existing Project
Existing Campaign
Related Assets
Project Dependencies
Project Memory
Campaign History
Avoid duplicate work.

## Output Planning

Determine final deliverables.
Examples
Instagram Reel
Facebook Reel
YouTube Short
Blog
Carousel
Podcast
Poster
Thumbnail
Presentation
Email
Newsletter
Marketing Package
Do not generate unnecessary outputs.

## Learning System

Continuously improve planning.
Learn
Preferred workflows
Successful campaigns
Best-performing templates
Cost-efficient providers
Execution time
Editing frequency
Asset reuse patterns
Planning quality should improve with experience.

## Integration with AI Infrastructure

The Strategy Engine requests capabilities.
It never selects providers directly.
Examples
Need
High-quality text generation
Need
Fast image generation
Need
Low-cost voice generation
The AI Infrastructure fulfills these capabilities.

## Execution Plan Object

The output of the Strategy Engine is a structured Execution Plan.
Example
Campaign
Product Launch
Brand
PillFill
Goal
Increase Awareness
Audience
Pharmacists
Workflow
Marketing Workflow
Required Agents
Research
Script
Storyboard
Image
Voice
Video
Caption
QA
Publishing
Estimated Cost
Very Low
Estimated Duration
5 Minutes
Fallback Workflow
Educational Campaign
Required MCP
NotebookLM
GitHub
Filesystem
Execution Priority
High
Parallel Tasks
Enabled
Quality Level
Professional
Export Formats
Video
Carousel
Caption
Thumbnail
The Agent Orchestrator receives this object.

## Design Principles

Plan before executing.
Reuse before generating.
Optimize before spending.
Parallelize before waiting.
Predict before reacting.
Simplify before expanding.
Every decision should reduce cost, reduce effort, and improve output quality.

## Performance Targets

Planning Time
<1 second
Workflow Accuracy
95%
Cost Prediction Accuracy
90%
Parallel Execution Efficiency
Maximum safe utilization
Clarification Requests
Near zero

## Definition of Done

The Strategy Engine is complete when it can
Understand the Intent Object.
Create an optimal execution strategy.
Estimate cost and time.
Choose workflows.
Reuse existing assets.
Plan agent execution.
Build fallback strategies.
Optimize resources.
Generate a complete Execution Plan.
Pass the plan to the Agent Orchestrator.

## Final Statement

The Strategy Engine is the Chief Operating Officer of Wise Content Factory.
It transforms user intent into an intelligent execution strategy.
Its purpose is to ensure that every campaign, every video, every image, and every piece of content is created using the smartest possible plan before any AI work begins.
A well-designed strategy should make the rest of the platform faster, cheaper, more reliable, and easier to scale.
