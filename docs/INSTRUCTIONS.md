# Development Guidelines

## Module System
All JavaScript modules must use ESM syntax:
- Use `import` for imports
- Use `export` for exports

## Configuration
- Store environment variables in .env file
- Use src/config.js as central configuration
- Validate all environment variables on startup
- Follow MAILAI_{persona}_* pattern for persona-specific variables