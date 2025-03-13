/*  config.js
 *    Process .env configuration
 */


const { pluginManager } = require('../plugins/manager');

// Collect AI config for a persona
function getAIConfig(persona) {
  const prefix = `MAILAI_${persona}_`;
  const config = {};
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix)) {
      const attribute = key.slice(prefix.length).toLowerCase();
      config[attribute] = value;
    }
  }

  if (!config.provider) {
    throw new Error(`Missing provider for persona: ${persona}`);
  }

  // Validate provider
  const enabledProviders = pluginManager.plugins.map(p => p.provider);
  if (!enabledProviders.includes(config.provider)) {
    throw new Error(`Invalid provider '${config.provider}' for persona: ${persona}. Available providers: ${enabledProviders.join(', ')}`);
  }

  // Validate temperature
  if (config.temperature) {
    const temp = parseFloat(config.temperature);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      throw new Error(`Invalid temperature value '${config.temperature}' for ${persona}`);
    }
    config.temperature = temp;
  }

  // Validate maxTokens
  if (config.maxTokens) {
    const tokens = parseInt(config.maxTokens);
    if (isNaN(tokens) || tokens <= 0) {
      throw new Error(`Invalid maxTokens value '${config.maxTokens}' for ${persona}`);
    }
    config.maxTokens = tokens;
  }

  // Validate API key if required
  if (config.apiKey && typeof config.apiKey !== 'string') {
    throw new Error(`Invalid API key format for ${persona}`);
  }

  // Validate model name
  if (config.model && typeof config.model !== 'string') {
    throw new Error(`Invalid model format for ${persona}`);
  }

  return config;
}

// Build object based on some of the environnment variables
//  MAILAI_MAX_EMAILS_PER_DAY=10
//  MAILAI_MAX_EMAIL_PER_BATCH=50
//  MAILAI_MIN_DAYS=0
//  MAILAI_MAX_DAYS=30
//  MAILAI_BATCH_SIZE=10
//  MAILAI_COOLDOWN_PERIOD=5
//  MAILAI_PORT=8080
//  MAILAI_MODE=debug
// Plus per persona variables
//  MAILAI_<PERSONA_NAME>_EMAIL_USER=
//  MAILAI_<PERSONA_NAME>_EMAIL_PASSWORD=
//  MAILAI_<PERSONA_NAME>_EMAIL_HOST=
//  MAILAI_<PERSONA_NAME>_EMAIL_PORT=
//  MAILAI_<PERSONA_NAME>_PROMPT=
//  MAILAI_<PERSONA_NAME>_PROVIDER=
// Plus per AI provider per persona
//  MAILAI_<PERSONA_NAME>_<AI_PROVIDER>_API_KEY=
//  MAILAI_<PERSONA_NAME>_<AI_PROVIDER>_MODEL=
//  MAILAI_<PERSONA_NAME>_<AI_PROVIDER>_TEMPERATURE=
//  MAILAI_<PERSONA_NAME>_<AI_PROVIDER>_MAX_TOKENS=
//  and any other AI provider specific parameters
function parse_config(){
    
    const config = {
        port: parseInt(process.env.MAILAI_PORT) || 8080,
        mode: process.env.MAILAI_MODE || 'debug',
        batch_size: parseInt(process.env.MAILAI_BATCH_SIZE) || 10,
        max_emails_per_batch: parseInt(process.env.MAILAI_MAX_EMAILS_PER_BATCH) || 50,
        cooldown_period: parseInt(process.env.MAILAI_COOLDOWN_PERIOD) || 5,
        max_emails_per_day: parseInt(process.env.MAILAI_MAX_EMAILS_PER_DAY) || 10,
        min_days: parseInt(process.env.MAILAI_MIN_DAYS) || 0,
        max_days: parseInt(process.env.MAILAI_MAX_DAYS) || 7,
        personas: {}
    }
  
    if (config.min_days < 0 || config.max_days < 0) {
        throw new Error('MAILAI_MIN/MAX_DAYS must be positive integers');
    }
    if (config.min_days > config.max_days) {
        throw new Error('MAILAI_MIN_DAYS cannot exceed MAILAI_MAX_DAYS');
    }
  
    const personas = {};
    const prefix = 'MAILAI_PERSONA_';
    
    for (const [key, value] of Object.entries(process.env)) {

        if (key.startsWith(prefix)) {
            const [personaName, param] = key.replace(prefix, '').split('_');
            if (!personas[personaName]) {
              personas[personaName] = { id: personaName, name: value };
            }
            if( param ){
              personas[personaName][param.toLowerCase()] = value;
            }
        }
    }
      
    // Validate personas
    for (const [name, config] of Object.entries(personas)) {
        const required = ['email_user', 'email_password', 'email_host', 'email_port', 'prompt', 'ai', 'strategy', 'marking_strategy'];
        required.forEach(param => {
            if (!config[param]) {
              throw new Error(`Missing ${param} for persona ${name}`);
            }
            if (param === 'marking' && !['seen', 'flag'].includes(config[param])) {
                throw new Error(`Invalid MARKING '${config[param]}' for persona ${name}. Valid values: seen or flag`);
            }
        });
        // Collect potential other per persona variables based on name
        const persona_config = {};
        for( const [var_name, value] of Object.entries(process.env)) {
            if (var_name.startsWith(`MAILAI_${name}_`)) {
            const var_name = var_name.replace(`MAILAI_${name}_`, '');
            persona_config[var_name] = value;
            }
        }

        // Get AI provider of personna
        persona_config.ai = getAIConfig( name );

        // Add to config in personas sub object
        personas[name].config = persona_config;
    }
  
    config.personas = personas;

    const BASE_PROMPT = `You are an AI email assistant handling multiple personas. Your role is to:
    1. Identify the appropriate persona based on email content
    2. Maintain consistent voice per persona
    3. Handle persona-specific authentication
    4. Route responses through correct AI provider`;
    
    config['base_prompt'] = BASE_PROMPT;
    return config;
  }

  module.exports = parse_config;
