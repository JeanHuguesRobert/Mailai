# Development Guidelines

## Module System
All JavaScript modules must use CommonJS syntax:
- Use `require()` for imports
- Use `module.exports` for exports
- Avoid ES6 module syntax (import/export)

## Configuration
- Store environment variables in .env file
- Use src/config.js as central configuration
- Validate all environment variables on startup
- Follow MAILAI_{persona}_* pattern for persona-specific variables