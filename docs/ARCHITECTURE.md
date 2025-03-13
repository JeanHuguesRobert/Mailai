# MailAI Architecture Overview

## Core Components

### Email Processing Workflow
- Entrypoint: src/index.js (main processing loop)
- Key Functions:
  - processInbox() - Main email processing controller
  - analyzeEmailContent() - Natural language processing

### Configuration Management
- Location: src/config/index.js
- Key Elements:
  - config object - Central configuration settings
  - getImapDate() - Date formatting for IMAP queries
  - validateDateRange() - Configuration validation

### Error Handling System
- Error Classes: src/errors/*.js
- Recovery Mechanisms:
  - retryQueue system
  - error logging in src/utils/logger.js

### AI Integration Layer
- Service Adapters: src/ai/*.js
- Core Integration Points:
  - generateResponse() - AI response generation
  - sentimentAnalysis() - Email tone detection

## Maintenance Guidelines
1. This document must be updated:
   - During major architectural changes
   - When adding new subsystem components
   - When modifying core workflow logic
2. Keep function/file references accurate
3. Maintain high-level overview while tracking implementation details

## Cross-Cutting Concerns
- Security: Encryption handling in src/security/*.js
- Performance: Caching mechanisms in src/cache/*.js
- Monitoring: src/monitoring/performanceTracker.js
