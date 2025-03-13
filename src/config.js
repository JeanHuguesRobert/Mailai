/*  config.js
 *    Process .env configuration
 */

import PluginManager from '../plugins/manager.js';
import fs from 'fs';
import PluginManagerath from 'path';

// Collect AI config for a persona
function getAIConfig(persona) {
  console.log( "Getting config for persona", persona);
  const prefix = `MAILAI_${persona}_`;
  const config = {};

  // First check for AI provider selection
  let ai_provider = process.env[`${prefix}ai`];
  
  // If no provider specified, use default
  if (!ai_provider) {
    ai_provider = 'unavailable';
  }

  // Validate provider name is lowercase
  if (ai_provider !== ai_provider.toLowerCase()) {
    throw new Error(`AI provider name '${ai_provider}' must be lowercase in '${prefix}ai'. Example: '${ai_provider.toLowerCase()}'`);
  }

  // Check for optional prompt
  const prompt = process.env[`${prefix}prompt`];
  if (prompt) {
    config.prompt = prompt;
  }else{
    config.prompt = '';
  }

  // If provider is 'unavailable', check for custom message
  if (ai_provider === 'unavailable') {
    const message = process.env[`${prefix}unavailable_message`] || 'Service unavailable';
    config.message = message;
  }

  // Get provider-specific settings
  const providerPrefix = `${prefix}${ai_provider}_`;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(providerPrefix)) {
      const param = key.slice(providerPrefix.length);
      // Validate parameter name is lowercase
      if (param !== param.toLowerCase()) {
        throw new Error(`AI parameter '${param}' must be lowercase in '${key}'. Example: '${key.replace(param, param.toLowerCase())}'`);
      }
      config[param] = value;
    // Else collect persona settings
    }else if( key.startsWith(prefix) ){
      const param = key.slice(prefix.length);
      config[param] = value;
    }
  }

  // Add provider to config
  config.ai = ai_provider;

  return config;
}

function validateMode(mode) {
  const validModes = ['development', 'production', 'testing', 'dry_run'];
  const inputMode = mode?.toLowerCase();
  
  if (!validModes.includes(inputMode)) {
    throw new Error(`Invalid mode '${mode}'. Must be one of: ${validModes.join(', ')}`);
  }
  
  if (mode !== inputMode) {
    throw new Error(`Mode '${mode}' must be lowercase. Use: '${inputMode}'`);
  }
  
  return inputMode;
}

function populateConfig() {
  const config = {
    port: parseInt(process.env.MAILAI_PORT) || 8080,
    mode: validateMode(process.env.MAILAI_MODE || 'development'),
    batch_size: parseInt(process.env.MAILAI_BATCH_SIZE) || 10,
    max_emails_per_batch: parseInt(process.env.MAILAI_MAX_EMAILS_PER_BATCH) || 50,
    cooldown_period: parseInt(process.env.MAILAI_COOLDOWN_PERIOD) || 5,
    max_emails_per_day: parseInt(process.env.MAILAI_MAX_EMAILS_PER_DAY) || 10,
    min_days: parseInt(process.env.MAILAI_MIN_DAYS) || 0,
    max_days: parseInt(process.env.MAILAI_MAX_DAYS) || 7,
    personas: {}
  };

  // Validate core settings
  if (config.min_days < 0 || config.max_days < 0) {
    throw new Error('MAILAI_MIN_DAYS and MAILAI_MAX_DAYS must be positive integers');
  }
  if (config.min_days > config.max_days) {
    throw new Error('MAILAI_MIN_DAYS cannot exceed MAILAI_MAX_DAYS');
  }

  // First pass: Get persona names
  const personas = {};
  let seen = false;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase().startsWith('mailai_persona_')) {
      const personaName = key.split('_')[2];
      personas[personaName] = getAIConfig(personaName);
      personas[personaName].id = personaName;
      seen = true;
    }
  }
  
  config.personas = personas;

  console.log('Loaded personas:', personas);

  console.log( "Loaded config", config);

  // Throw error if no personas found
  if (!seen) {
    throw new Error('No personas found in configuration');
  } 

  return config;
}

export default populateConfig;
