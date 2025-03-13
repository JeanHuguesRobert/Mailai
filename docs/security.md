# MailAI Security Guidelines

This document outlines security best practices and guidelines for MailAI, focusing on configuration security, credential management, and safe handling of unavailable states.

## Table of Contents
- [Configuration Security](#configuration-security)
- [Credential Management](#credential-management)
- [Provider Security](#provider-security)
- [Email Security](#email-security)
- [Monitoring and Alerts](#monitoring-and-alerts)

## Configuration Security

### Environment Variables
- Store sensitive data only in environment variables
- Never commit `.env` files to version control
- Use separate `.env` files for different environments

### Naming Conventions
```bash
# Core settings: UPPERCASE
MAILAI_MODE=production
MAILAI_LOG=info

# Provider names: lowercase
MAILAI_MyPersona_ai=openai
MAILAI_MyPersona_ai=unavailable

# Persona IDs: preserve case
MAILAI_MyPersona_email_user=user@example.com
MAILAI_WorkAccount_email_password=app_password
```

### File Permissions
```bash
# Recommended permissions for configuration files
.env                 600 (rw-------)
.env.example         644 (rw-r--r--)
config.js            644 (rw-r--r--)
```

## Credential Management

### Email Credentials
- Always use app-specific passwords
- Never store plain email passwords
- Rotate passwords regularly

Example configuration:
```bash
# Good: Using app-specific password
MAILAI_MyPersona_email_password=abcd efgh ijkl mnop

# Bad: Using account password
MAILAI_MyPersona_email_password=MyActualPassword123!
```

### API Keys
- Use environment variables for API keys
- Implement key rotation policies
- Set appropriate access scopes

```bash
# Separate keys per persona
MAILAI_Work_api_key=sk_work_...
MAILAI_Personal_api_key=sk_personal_...
```

### Unavailable Mode Security
- Validate custom messages
- Sanitize prompts
- Avoid sensitive information in responses

```bash
# Safe unavailable configuration
MAILAI_MyPersona_ai=unavailable
MAILAI_MyPersona_unavailable_message=Service temporarily unavailable
MAILAI_MyPersona_prompt=AI Assistant

# Avoid sensitive info in messages
MAILAI_MyPersona_unavailable_message=Down for maintenance on server xyz  # Bad
MAILAI_MyPersona_prompt=Internal AI system v2.1  # Bad
```

## Provider Security

### Provider Authentication
- Validate API credentials on startup
- Implement token-based authentication
- Use secure connection protocols

### Error Handling
```javascript
async function handleProviderError(error) {
    // Remove sensitive info from error
    const sanitizedError = sanitizeError(error);
    
    // Log safely
    logger.error('Provider error', sanitizedError);
    
    // Set unavailable without exposing details
    await setUnavailable(
        'Service temporarily unavailable',
        'AI Assistant'
    );
}
```

### Rate Limiting
```bash
# Configure rate limits per persona
MAILAI_MyPersona_rate_limit=60
MAILAI_MyPersona_cooldown=1000
```

## Email Security

### IMAP Security
- Use SSL/TLS connections
- Verify certificates
- Set appropriate timeouts

```bash
# Secure IMAP configuration
MAILAI_MyPersona_email_imap=imap.example.com
MAILAI_MyPersona_email_port=993  # SSL/TLS port
```

### Content Security
- Sanitize email content
- Remove sensitive data
- Validate attachments

### Response Security
- Sanitize AI responses
- Remove PII
- Validate formatting

## Monitoring and Alerts

### Health Checks
```bash
# Enable security monitoring
MAILAI_MyPersona_health_check=true
MAILAI_MyPersona_security_alerts=true
```

### Logging
- Use appropriate log levels
- Sanitize logged data
- Implement log rotation

```bash
# Secure logging configuration
MAILAI_LOG=info
MAILAI_LOG_PATH=/secure/path/mailai.log
MAILAI_LOG_ROTATION=true
```

### Alerts
- Configure security alerts
- Monitor authentication attempts
- Track provider status

## Security Checklist

### Configuration
- [ ] Use environment variables for sensitive data
- [ ] Follow case conventions strictly
- [ ] Implement secure file permissions

### Credentials
- [ ] Use app-specific passwords
- [ ] Rotate credentials regularly
- [ ] Secure API key storage

### Providers
- [ ] Validate provider authentication
- [ ] Implement rate limiting
- [ ] Handle errors securely

### Email
- [ ] Use SSL/TLS connections
- [ ] Validate certificates
- [ ] Sanitize content

### Monitoring
- [ ] Enable health checks
- [ ] Configure security alerts
- [ ] Implement secure logging

## Best Practices

1. **Configuration Management**
   - Use environment variables
   - Follow naming conventions
   - Secure file permissions

2. **Credential Security**
   - App-specific passwords
   - Regular rotation
   - Secure storage

3. **Provider Integration**
   - Secure authentication
   - Rate limiting
   - Error handling

4. **Email Processing**
   - Secure connections
   - Content sanitization
   - Response validation

5. **Monitoring**
   - Health checks
   - Security alerts
   - Safe logging

## Emergency Procedures

### Provider Failure
1. Set provider to unavailable mode
2. Use safe default message
3. Log security event
4. Alert administrators

### Security Breach
1. Rotate all credentials
2. Enable maintenance mode
3. Audit security logs
4. Update security measures

### Recovery Steps
1. Validate new credentials
2. Test provider connections
3. Monitor system health
4. Resume operations

## Compliance

### Data Protection
- Follow data protection regulations
- Implement data retention policies
- Secure data transmission

### Audit Trail
- Log security events
- Track configuration changes
- Monitor access patterns

### Regular Reviews
- Security assessments
- Configuration audits
- Credential rotation
