
## MCP_ARCHITECTURE.md


## Wise Content Factory (WCF)

Version: 1.0Status: Platform Infrastructure SpecificationOwner: WiseAitechs

## Purpose

The Model Context Protocol (MCP) Architecture defines how Wise Content Factory discovers, connects to, manages, and securely uses external AI tools and services.
MCP transforms Wise Content Factory from a standalone application into an extensible AI Operating System capable of integrating with hundreds of external tools without changing the platform core.
Every external capability should be accessed through the MCP Architecture whenever an appropriate MCP server exists.

## Philosophy

The platform should never be limited by built-in features.
Instead, it should dynamically discover new capabilities through MCP.
Installing a new MCP server should automatically extend the platform.
No application code should need modification.
MCP is treated as the “USB-C” standard for AI capabilities.

## Primary Objectives

The MCP Architecture must:
- Discover MCP servers automatically
- Register available tools
- Securely authenticate connections
- Expose tools to AI Agents
- Monitor server health
- Manage permissions
- Handle failures
- Cache capabilities
- Support local and remote MCP servers
- Allow unlimited future integrations

## Position in Platform

text id="m1xk2q" Conversation Engine         │ Intent Engine         │ Strategy Engine         │ Agent Orchestrator         │ ──────────────────────────────────────────────           AI Infrastructure ──────────────────────────────────────────────                 │           MCP Manager                 │ ──────────────────────────────────────────────  Local MCP Servers  Remote MCP Servers  Enterprise MCP Servers ──────────────────────────────────────────────                 │         External Applications
The MCP Manager is the single gateway between Wise Content Factory and all MCP services.

## MCP Manager

The MCP Manager is responsible for:
- Discovering servers
- Registering tools
- Maintaining connections
- Authentication
- Permission control
- Health monitoring
- Capability indexing
- Version compatibility
- Logging
- Metrics
The rest of the application communicates only with the MCP Manager.

## MCP Discovery

At startup the platform should:
Scan configured MCP servers.
Register available servers.
Load available tools.
Read capabilities.
Verify compatibility.
Cache metadata.
Monitor health.
Discovery should also occur whenever new MCP servers are installed or enabled.

## MCP Server Registry

Maintain a live registry containing:
Server Name
Version
Capabilities
Available Tools
Authentication Method
Health Status
Latency
Provider
Permissions
Supported Resources
Last Seen
Status
This registry becomes the source of truth for all MCP integrations.

## Capability Registry

Rather than exposing raw servers, register capabilities.
Examples
Knowledge Retrieval
Document Search
Presentation Creation
Video Generation
Image Editing
Repository Access
File Management
Browser Automation
Calendar Management
Email
Publishing
Diagram Generation
Design
AI Coding
Future capabilities should register automatically.

## Supported MCP Categories


### Knowledge

NotebookLM
Document Search
Knowledge Bases
Research
PDF Processing

### Development

GitHub
GitLab
Filesystem
Terminal
Documentation
Package Managers

### Design

Canva
Figma
Image Editors
Diagram Tools
Presentation Tools

### Productivity

Google Drive
Google Docs
Google Sheets
Calendar
Email
Tasks
Notes

### Media

Video Tools
Image Tools
Voice Tools
Music Tools
Animation Tools

### Browser

Browser Automation
Website Analysis
SEO Analysis
Web Search
Screenshots
Automation

### Future Categories

CRM
ERP
Marketing Platforms
Analytics
Social Media
Cloud Storage
Business Intelligence
Custom Enterprise Systems

## Tool Discovery

Every MCP Tool should register:
Tool Name
Description
Category
Input Schema
Output Schema
Required Permissions
Execution Cost
Estimated Duration
Dependencies
Supported Agents
Supported Workflows

## Authentication

Support:
OAuth
API Keys
Local Authentication
Enterprise Authentication
Session Tokens
Authentication must be centralized inside the MCP Manager.
Agents should never manage credentials.

## Permission System

Permissions should be granted by capability.
Examples
Read Documents
Write Documents
Read Files
Modify Files
Create Images
Publish Content
Execute Browser Actions
Each workflow should request only the minimum required permissions.

## Context Sharing

MCP results should become part of the platform context.
Example
NotebookLM Summary
↓
Conversation Context
↓
Intent Engine
↓
Strategy Engine
↓
Agents
The same information should never be requested repeatedly.

## Tool Selection

The Strategy Engine requests capabilities.
Example
Need
Research Knowledge
↓
MCP Manager
↓
NotebookLM Tool
or
Document Search Tool
or
Website Search Tool
The Strategy Engine never selects a specific server.

## Caching

Cache
Tool Metadata
Capability Registry
Authentication
Knowledge Results
Document Summaries
Repository Metadata
Server Health
Reuse cached information whenever possible.

## Failure Recovery

If one MCP server fails
Retry.
If unavailable
Choose another compatible MCP server.
If none exist
Fallback to local capabilities.
Never fail the entire workflow because one MCP server is unavailable.

## Security

Never expose credentials.
Validate tool input.
Validate tool output.
Log sensitive operations.
Encrypt stored tokens.
Support permission auditing.
Allow users to revoke access at any time.

## Performance

Lazy-load MCP servers.
Load tools on demand.
Reuse persistent connections.
Cache capability metadata.
Execute independent MCP operations in parallel.

## AI Agent Integration

Agents request capabilities.
Example
Research Agent
↓
Request
Knowledge Search
↓
MCP Manager
↓
NotebookLM MCP
↓
Results
↓
Research Agent
Agents never communicate directly with MCP servers.

## MCP Workflow Example

```text id=“p8r7zs” User
↓
Conversation Engine
↓
Intent Engine
↓
Strategy Engine
↓
Agent Orchestrator
↓
Research Agent
↓
MCP Manager
↓
NotebookLM MCP
↓
Knowledge Retrieved
↓
Script Agent
↓
Video Agent
↓
Export ```

## Configuration

Allow users to:
Enable or disable servers
Configure authentication
Set server priority
Configure fallback order
Enable automatic discovery
View server health
Manage permissions
Everything should be configurable from the application.

## Plugin Architecture

Every MCP server behaves like a plugin.
Installing a new server should automatically expose its capabilities.
Removing a server should not affect platform stability.
No application code should require modification.

## Enterprise Readiness

Support:
Private MCP servers
Corporate knowledge bases
Private AI models
Enterprise authentication
Role-based permissions
Audit logging
Compliance requirements
Future enterprise integrations

## Development Rules

Never hard-code MCP servers.
Never hard-code tool names.
Always request capabilities instead of specific servers.
Keep the MCP layer independent from business logic.
All communication must pass through the MCP Manager.

## Definition of Done

The MCP Architecture is complete when:
New MCP servers are discovered automatically.
Capabilities register automatically.
Agents use capabilities instead of server names.
Authentication is centralized.
Permissions are enforced.
Failures recover gracefully.
Caching reduces duplicate work.
The platform remains independent of individual MCP implementations.

## Future Vision

The MCP Architecture should become the universal integration layer of Wise Content Factory.
As the MCP ecosystem grows, the platform should gain new capabilities simply by connecting additional MCP servers, without requiring architectural changes or application updates.
The long-term goal is for Wise Content Factory to function as an AI platform that can seamlessly collaborate with any MCP-compatible service while maintaining a consistent user experience, strong security, and low operational complexity.
