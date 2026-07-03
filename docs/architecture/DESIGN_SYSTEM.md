
## DESIGN_SYSTEM.md


## Wise Content Factory (WCF)

Version: 1.0Status: Design System SpecificationOwner: WiseAitechs

## Purpose

The Design System defines the visual language, interaction principles, accessibility standards, and user experience of Wise Content Factory.
Every screen, component, animation, and workflow must follow this document.
The application should feel like a premium desktop application rather than a traditional business dashboard.

## Design Philosophy

The interface should disappear.
Users should focus on creating ideas, not learning software.
Every interaction should reduce cognitive load.
Every action should feel intentional.
Every animation should communicate.
Every screen should encourage creativity.

## Design Inspiration

The platform should combine the simplicity and polish of
- Notion
- Arc Browser
- Linear
- Apple Human Interface Guidelines
- Raycast
- Figma
- Cursor
- ChatGPT
Avoid copying any single product. Instead, adopt their usability principles.

## Brand Personality

Wise Content Factory should feel
Professional
Minimal
Modern
Elegant
Creative
Trustworthy
Calm
Fast
Premium
Intelligent
Never cluttered.
Never overwhelming.

## Core Design Principles

- Content first
- Minimal distractions
- One primary action per screen
- Progressive disclosure
- Consistent spacing
- Consistent typography
- Motion with purpose
- Accessible by default
- Keyboard-first
- Touch-friendly where appropriate

## Visual Identity

The visual identity should extend the WiseAitechs brand into a professional software platform.
Characteristics
Minimal
Clean
Technology focused
Elegant
Premium
Future ready
No excessive gradients.
No unnecessary decoration.
No skeuomorphic elements.

## Color System


### Primary

Wise Blue
#244A9B
Primary brand color.
Used for
Primary buttons
Links
Active navigation
Highlights
Charts
Progress

### Secondary

Wise Red
#D7264E
Used for
Warnings
Important actions
Notifications
Attention

### Accent

Wise Teal
#018080
Used for
Success
Medical workflows
Interactive indicators
AI status

### Neutral

Dark Navy
#132A5C
Slate Gray
#6B7280
Light Gray
#E5E7EB
Background
#F8FAFC
Surface
#FFFFFF

### Semantic Colors

Success
#16A34A
Warning
#F59E0B
Danger
#DC2626
Info
#2563EB
Disabled
#94A3B8
Always maintain sufficient contrast for accessibility.

## Typography

Primary Font
Inter
Secondary Font
Sora
Fallback
System UI Fonts
Typography hierarchy
Display
Heading 1
Heading 2
Heading 3
Title
Subtitle
Body
Caption
Label
Code
Maintain a consistent type scale throughout the application.

## Spacing System

Base Unit
8 px
Scale
4
8
12
16
24
32
40
48
64
96
All layouts should follow the spacing scale.

## Border Radius

Small
8 px
Medium
12 px
Large
16 px
Cards
20 px
Dialogs
24 px
Avoid sharp corners.

## Shadows

Use subtle elevation.
Three levels only
Low
Medium
High
Avoid excessive shadow effects.

## Icons

Preferred
Lucide Icons
Fallback
Material Symbols
Icons should remain simple, outlined, and consistent.

## Buttons

Primary
Solid Wise Blue
Secondary
Outlined
Ghost
Minimal
Danger
Red
Icon Button
Circular
Loading Button
Progress indicator
Buttons should have
Hover
Focus
Pressed
Disabled
Loading
states.

## Inputs

Support
Text
Search
Voice
Upload
Drag & Drop
URL
Prompt Input
Every input should support
Validation
Autocomplete
Keyboard shortcuts
Paste
Undo
Redo

## Cards

Cards are the primary content container.
Should contain
Title
Description
Actions
Status
Optional Preview
Optional Progress
Cards should never feel crowded.

## Navigation

Primary Navigation
Left Sidebar
Secondary Navigation
Top Bar
Context Actions
Right Panel
Quick Actions
Command Palette
Users should reach every feature within three interactions.

## Dashboard

The dashboard should immediately answer
What projects are active?
What is generating?
What recently finished?
What failed?
What should I work on next?
Avoid unnecessary metrics.
Prioritize actionable information.

## Workspace

The workspace is the primary creation environment.
Panels
Conversation
Project Context
Assets
Knowledge
Timeline
Preview
Inspector
Properties
Panels should be dockable and resizable.

## Timeline

Support
Drag
Drop
Zoom
Snap
Markers
Layers
Audio
Video
Subtitles
Timeline should remain optional for users who prefer one-click generation.

## Prompt Editor

The prompt editor is the heart of the application.
Support
Rich text
Voice
Images
PDFs
Links
NotebookLM references
Drag & Drop
Suggestions
Templates
History
Autocomplete
The prompt editor should feel like an intelligent workspace rather than a simple text box.

## AI Status

Display
Thinking
Researching
Writing
Generating Images
Rendering Video
Optimizing
Uploading
Completed
Users should always know what the system is doing.

## Progress Indicators

Every long-running operation should display
Progress
Current Stage
Estimated Time
Current AI Provider
Current Cost
Retry Status
Never leave users wondering.

## Animations

Animations should communicate state.
Support
Fade
Slide
Scale
Progress
Loading
Transitions
Expansion
Collapse
Success
Failure
Animations should remain under 250 milliseconds unless indicating progress.

## Accessibility

Support
Keyboard Navigation
Screen Readers
High Contrast
Reduced Motion
Scalable Fonts
Focus Indicators
Accessible Color Contrast
Accessibility is a core requirement.

## Keyboard Experience

Essential shortcuts
New Project
Quick Search
Command Palette
Generate
Undo
Redo
Save
Open
Switch Project
Toggle Sidebar
The application should feel fast for power users.

## Responsive Layout

Primary
Desktop
Future
Tablet
Large Displays
Foldables
Web
Mobile Companion
The layout should adapt gracefully.

## Notifications

Notifications should be
Informative
Brief
Actionable
Non-intrusive
Examples
Generation Complete
Retry Required
Provider Switched
Export Finished
Knowledge Updated

## Empty States

Every empty page should guide the user.
Examples
Create your first project.
Upload your first PDF.
Connect NotebookLM.
Start your first campaign.
Empty states should educate.

## Error Design

Errors should explain
What happened
Why it happened
How to fix it
Never expose technical stack traces to end users.

## Brand Integration

Each Brand Kit automatically updates
Logo
Colors
Typography
Voice
Templates
Animations
CTA
Watermark
Without changing the platform interface.

## Component Library

Core Components
Buttons
Inputs
Cards
Dialogs
Tables
Lists
Tabs
Badges
Tags
Avatars
Progress Bars
Breadcrumbs
Notifications
Timeline
Media Viewer
Knowledge Viewer
Prompt Editor
Command Palette
Every component must be reusable.

## Motion Principles

Motion should
Guide attention
Confirm actions
Show progress
Reduce confusion
Motion should never exist purely for decoration.

## Performance

The UI should
Launch quickly
Scroll smoothly
Avoid layout shifts
Lazy-load heavy content
Keep animations at 60 FPS where possible
Maintain responsiveness during AI generation.

## Future Readiness

Prepare for
Multi-monitor layouts
Collaborative editing
Live cursors
Team workspaces
Plugin panels
Marketplace
Voice-first interaction
Touch support
AR/VR workspaces

## Definition of Done

The Design System is complete when
Every screen feels consistent.
Every component is reusable.
Every interaction is intuitive.
The interface reduces cognitive load.
Accessibility is built in.
Brand identity remains consistent.
The application feels premium.
Users can focus on creating rather than learning the interface.

## Final Statement

The Wise Content Factory Design System is not simply a collection of colors and components.
It defines the personality of the platform.
Every visual decision should reinforce trust, creativity, simplicity, and professionalism.
The software should feel like a premium AI creative studio that is powerful enough for professionals, yet simple enough for someone with no technical background to use confidently from the first day.
