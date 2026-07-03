
## SECURITY_ARCHITECTURE.md


## Wise Content Factory (WCF)

Version: 1.0Status: Master Security ArchitectureOwner: WiseAitechs

## Purpose

This document defines the security architecture for Wise Content Factory.
Security is not a separate feature.
Security is part of every Engine, every Agent, every Provider, every MCP connection, every API request, and every user interaction.
Every implementation must follow this document.
If another document conflicts with this specification, this document takes precedence for all security-related decisions.

## Security Philosophy

The safest API key is the one that never reaches the browser.
The safest workflow is the one that never trusts the client.
The safest architecture is one that assumes every external request can be malicious.
Security should be invisible to users while remaining extremely strict internally.

## Security Goals

The platform must provide
- Secure Authentication
- Secure Authorization
- Secure API Gateway
- Secret Isolation
- Data Encryption
- Request Validation
- Session Management
- Audit Logging
- Rate Limiting
- Attack Detection
- Secure File Handling
- Secure MCP Communication
- Secure AI Provider Communication

## Core Security Principles

Never trust the browser.
Never expose API keys.
Never expose provider secrets.
Never expose OAuth tokens.
Never expose internal endpoints.
Never trust user input.
Always validate requests.
Always validate uploaded files.
Always log security events.
Always encrypt sensitive data.

## Security Architecture

Browser                        │                HTTPS Only                        │──────────────────────────────────────────             GitHub Pages        (Frontend Only)──────────────────────────────────────────                        │          Authenticated Request                        │──────────────────────────────────────────     Google Apps Script Gateway──────────────────────────────────────────AuthenticationAuthorizationSession ValidationRequest ValidationRate LimitingAudit LoggingSecret ManagerProvider GatewayMCP GatewayConfiguration Manager──────────────────────────────────────────                        │                 OmniRoute                        │──────────────────────────────────────────ClaudeGeminiOpenAI CompatibleDeepSeekNotebookLM MCPFuture Providers──────────────────────────────────────────
The browser never communicates directly with AI providers.

## Apps Script Security Gateway

Google Apps Script is mandatory.
Responsibilities
Authentication
Session Management
JWT Verification (or equivalent session token strategy)
Secret Storage
Provider Proxy
MCP Proxy
Request Signing
Rate Limiting
Request Logging
Audit Logging
Configuration
Provider Routing
The gateway is the only component allowed to use provider credentials.

## API Keys

Store
Claude
Gemini
OpenAI
OpenRouter
NotebookLM
HyperFrames
Google
GitHub
All secrets
inside Google Apps Script Properties or another secure backend mechanism appropriate for the deployment.
Never expose them.
Never commit them.
Never return them.
Never log them.
Never send them to the browser.

## Secret Management

Support
Environment Configuration
Apps Script Script Properties
Encrypted Configuration
Key Rotation
Key Revocation
Secret Validation
Secret Health Check
All secrets should be replaceable without modifying application code.

## Authentication

Support
Email Login
Google Login
Password Authentication
Future SSO
Enterprise Login
Future MFA
Authentication must occur only through the backend.

## Authorization

Support
Owner
Administrator
Content Creator
Viewer
Guest
Future Enterprise Roles
Permissions should be capability-based.

## Session Management

Every session should include
Unique Session ID
User ID
Device Information
Creation Time
Expiration
Last Activity
Permission Scope
Sessions should expire automatically.
Inactive sessions should be revoked.

## Request Validation

Every request must validate
Authentication
Authorization
CSRF protection where applicable
Request Signature
Timestamp
Payload Structure
Rate Limit
Project Ownership
Brand Ownership
Malformed requests should never reach business logic.

## Rate Limiting

Protect
Login
Generation
Uploads
Downloads
Publishing
NotebookLM
MCP
AI Providers
Rate limits should be configurable.

## Encryption

Encrypt
Secrets
Session Tokens
Sensitive Local Storage
Configuration
Backups
Cached Credentials
Project Exports when configured
Use modern, well-maintained cryptographic libraries rather than custom encryption.

## File Security

Validate
File Type
File Size
Content Type
Extension
Corruption
Duplicate Uploads
Reject executable content unless explicitly supported.
Scan uploaded files before processing where practical.

## AI Security

Never send unnecessary information to providers.
Remove
Secrets
Passwords
Internal Configuration
Authentication Tokens
Sensitive Metadata
Only send information required for the requested task.

## MCP Security

Every MCP server must
Authenticate
Declare Permissions
Declare Capabilities
Support Revocation
Support Logging
Support Version Validation
Unknown MCP servers should not receive privileged access automatically.

## Provider Security

Every provider request should include
Minimal Context
Signed Request
Timeout
Retry Policy
Audit Entry
Provider responses should be validated before use.

## Browser Security

Implement
Content Security Policy
Strict HTTPS
Secure Cookies where applicable
SameSite protections where applicable
Input Sanitization
Output Escaping
Never trust browser-side validation alone.

## Local Storage

Store locally only
Preferences
UI Settings
Theme
Workspace Layout
Cached Non-sensitive Assets
Never store
Provider Keys
Passwords
OAuth Tokens
Sensitive Medical Data
Long-lived Secrets

## Audit Logging

Record
Authentication Events
Generation Requests
Provider Selection
Permission Changes
Configuration Changes
Security Warnings
MCP Connections
Plugin Installations
Errors
Do not log secrets or confidential content unnecessarily.

## Security Monitoring

Monitor
Repeated Login Failures
Rate Limit Violations
Unexpected Provider Errors
Unknown MCP Servers
Configuration Changes
Permission Escalation Attempts
Large Uploads
Suspicious Activity
Generate security alerts for abnormal patterns.

## Backup Security

Encrypt backups.
Protect export files.
Support secure restoration.
Allow backup verification.
Support key rotation after restore.

## Privacy

Users own their content.
The platform should minimize unnecessary data retention.
Allow users to export and delete their own project data.
Provide clear controls for stored knowledge and generated assets.

## Medical Data Considerations

If medical or patient-related information is processed:
Avoid sending unnecessary identifying information to external AI providers.
Allow users to review content before submission.
Provide configurable retention policies.
Support audit trails for sensitive operations.
The architecture should be flexible enough to support applicable privacy regulations if deployed in regulated environments.

## Secure Development Rules

Never hard-code credentials.
Never bypass the Apps Script Gateway.
Never expose internal APIs publicly without authentication.
Never disable validation for convenience.
Never trust client-side data.
Prefer secure defaults.

## Security Testing

Include
Authentication Tests
Authorization Tests
Permission Tests
Rate Limit Tests
Input Validation Tests
File Upload Tests
Session Tests
Provider Gateway Tests
MCP Permission Tests
Regression Security Tests
Security testing should be part of every release.

## Disaster Recovery

Support
Secret Rotation
Session Revocation
Emergency Provider Disable
Rollback
Configuration Restore
Backup Recovery
Graceful Failover
The platform should continue operating safely whenever possible.

## Future Security

Prepare for
Hardware Security Keys
Passkeys
Enterprise Identity Providers
Zero Trust Architecture
Hardware-backed Secret Storage
Confidential Computing
Enterprise Audit Systems
Regional Compliance Requirements
Future security enhancements should not require architectural redesign.

## Definition of Done

The security architecture is complete when
API keys never reach the frontend.
All AI requests pass through the Apps Script Secure Gateway.
Authentication and authorization are centralized.
Secrets are isolated from the client.
Sessions are secure.
Requests are validated.
Uploads are validated.
Providers receive only necessary information.
Audit logs exist.
Rate limiting works.
Security testing is automated.
The platform remains secure without sacrificing usability.

## Final Statement

Security is a foundation of Wise Content Factory, not an optional feature.
Every Engine, every Agent, every MCP connection, every AI Provider, and every user interaction must inherit its security from this architecture.
The browser should remain lightweight and untrusted.
The Google Apps Script Secure Gateway should serve as the trusted security boundary for AI requests, credential management, authentication, and policy enforcement.
The result should be a platform that is affordable to operate, simple for non-programmers to use, and designed with security as a core architectural principle rather than an afterthought.
