
## CONVERSATION_ENGINE.md


## Wise Content Factory


### Conversation Engine

Version: 1.0
Status: Core AI Engine

## Purpose

The Conversation Engine is the front door of Wise Content Factory.
Every user request must pass through the Conversation Engine before entering the rest of the AI system.
Its responsibility is not content generation.
Its responsibility is understanding the user.
It should behave like an experienced creative director, marketing strategist, and project manager that knows the user, remembers previous work, understands business goals, and asks only the minimum questions required.

## Philosophy

Users should never need to learn software.
The software should learn the user.
The Conversation Engine should reduce typing, reduce repeated explanations, and eliminate unnecessary decisions.
Every conversation should become easier than the previous one.

## Primary Responsibilities

The Conversation Engine should:
Understand natural language.
Understand incomplete requests.
Understand business context.
Understand ongoing projects.
Understand previous conversations.
Understand current goals.
Understand brand identity.
Understand uploaded files.
Understand connected MCP tools.
Understand available assets.
Understand project history.
Then pass structured information to the Intent Engine.

## Responsibilities


### Understand User Intent

Examples
“Create a PillFill advertisement.”
“Explain migraine.”
“Turn this PDF into a Reel.”
“Make a campaign.”
The engine should understand what the user actually wants rather than relying on keywords.

### Understand Business Context

Automatically identify
Current Brand
Current Project
Current Campaign
Target Audience
Current Platform
Current Objective
Users should not repeatedly specify these values.

### Understand Memory

Load
Global Memory
↓
Brand Memory
↓
Project Memory
↓
Conversation Memory
↓
Generation Memory
If sufficient information already exists, avoid asking repetitive questions.

### Understand Uploaded Assets

Automatically detect
PDFs
Images
Logos
Voice Samples
Videos
Research Papers
PowerPoint Files
Brand Assets
Website Links
NotebookLM Sources
The user should never have to manually classify uploaded files.

### Understand Connected Services

Discover available services automatically.
Examples
NotebookLM MCP
Google Drive MCP
GitHub MCP
Canva MCP
Figma MCP
Browser MCP
Filesystem MCP
Cloud Storage
The engine should know what resources are available before asking the user.

## Conversation Goals

The engine should minimize interaction.
The best conversation is the shortest conversation.
The system should ask only when necessary.

## Clarification Rules

Never ask unnecessary questions.
If confidence is high
Proceed automatically.
If confidence is medium
Offer one recommendation.
If confidence is low
Ask only the smallest number of questions required.
Example
User
“Create a video.”
Instead of asking ten questions
Ask
Which brand?
Everything else should be inferred.

## Smart Defaults

Automatically infer
Platform
Duration
Brand
Style
Voice
Avatar
Color Theme
CTA
Music
Aspect Ratio
Language
Whenever confidence is high.

## Personalization

Learn over time.
Examples
Preferred video duration
Preferred voice
Preferred avatar
Preferred AI providers
Preferred writing style
Preferred platforms
Preferred CTA style
Preferred thumbnails
Preferred export formats
Future conversations should improve automatically.

## Conversation Memory

Remember only useful information.
Examples
Current campaign
Current project
Brand preferences
Content goals
Recent outputs
Never remember temporary information unnecessarily.

## Context Building

Before passing work to the Intent Engine
Build a complete context package.
Example
Brand
Project
Goal
Audience
Platform
Duration
Style
Knowledge Sources
Available Assets
Brand Memory
Previous Campaigns
Connected MCP Resources
User Preferences
Estimated Complexity
This becomes the input for downstream engines.

## Context Window Optimization

Long conversations consume AI context.
The Conversation Engine should periodically summarize completed discussion into structured memory.
Old messages should become concise summaries instead of remaining as full transcripts.
Important decisions should never be lost.

## Intelligent Suggestions

When appropriate
Recommend
Better hooks
Trending topics
Related campaigns
Existing assets
Previous successful projects
Reusable templates
The engine should help the user without becoming intrusive.

## Multi-Brand Awareness

The engine should understand multiple businesses simultaneously.
Initially
Wise Homeopathy
WiseAitechs
PillFill
Each brand maintains independent
Memory
Templates
Assets
Voice
Colors
Marketing style
Campaign history
Switching brands should happen automatically whenever possible.

## Session Awareness

Track
Current session
Open project
Current task
Completed work
Pending work
Failed jobs
Current AI providers
Current generation queue
Users should always be able to resume where they left off.

## AI Infrastructure Awareness

The Conversation Engine should understand the capabilities of the underlying platform.
Know
Available AI models
Available MCP servers
Available plugins
Available providers
Provider health
Estimated cost
Estimated generation time
Use this knowledge when planning conversations.

## Communication Style

Professional
Friendly
Concise
Helpful
Never overwhelming.
Avoid technical jargon unless requested.
Speak like an experienced creative director.

## Error Handling

If information is missing
Attempt inference.
If inference is impossible
Ask the smallest possible clarification.
If providers fail
Offer alternatives.
Never expose internal errors to the user.

## Output

The Conversation Engine never generates content.
It produces a structured Conversation Context object.
Example
Conversation Context
↓
Brand
Project
Intent
Audience
Goal
Assets
Knowledge
Memory
Preferences
Constraints
Complexity
↓
Intent Engine

## Success Metrics

The engine succeeds when
Users rarely repeat information.
Users rarely answer more than one clarification question.
Brand switching feels automatic.
Project continuity is maintained.
Conversations become shorter over time.
The system appears to “know” the user without becoming intrusive.

## Definition of Done

The Conversation Engine is complete when it can:
Understand natural language.
Understand business context.
Understand project context.
Understand uploaded knowledge.
Understand connected MCP resources.
Load relevant memory.
Minimize unnecessary questions.
Produce a complete Conversation Context.
Hand structured information to the Intent Engine.

## Final Statement

The Conversation Engine should make Wise Content Factory feel less like software and more like an experienced creative partner.
Its purpose is not conversation.
Its purpose is understanding.
Every subsequent engine depends on the quality of the context it provides.
