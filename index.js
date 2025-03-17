require('dotenv').config();
const Imap = require('imap');
const nodemailer = require('nodemailer');
const fs = require('fs');
const https = require('https');
const http = require('http');
const url = require('url');
const path = require('path');
const { PluginManager } = require('./plugins/manager');
const EmailService = require('./src/services/email');
const MonitoringService = require('./src/services/monitoring');
const { RATE_LIMITS, BASE_PROMPT } = require('./src/config/constants');
const { log } = require('./src/utils/logger');
const aiService = require('./services/ai');
const express = require('express');

// Watch .env file for changes
const envPath = path.join(__dirname, '.env');
let previousEnvConfig = {};

// Load initial environment configuration
function loadEnvConfig() {
  const config = {};
  Object.keys(process.env)
    .filter(key => key.startsWith('MAILAI_') && !key.startsWith('MAILAI_STATS_'))
    .forEach(key => {
      config[key] = process.env[key];
    });
  return config;
}

// Add this function to handle .env file watching
function setupEnvWatcher() {
  return fs.watch(envPath, (eventType, filename) => {
    if (eventType === 'change') {
      // Reload environment
      require('dotenv').config();
      
      // Get new configuration
      const newConfig = loadEnvConfig();
      
      // Compare configurations (ignoring stats)
      const hasSignificantChanges = Object.keys(newConfig).some(key => {
        return newConfig[key] !== previousEnvConfig[key];
      }) || Object.keys(previousEnvConfig).some(key => {
        return !newConfig[key] && previousEnvConfig[key];
      });
      
      if (hasSignificantChanges) {
        log('config', '🔄 Environment configuration changed, restarting application...');
        process.on('exit', () => {
          require('child_process').spawn(process.argv[0], process.argv.slice(1), {
            cwd: process.cwd(),
            detached: true,
            stdio: 'inherit'
          });
        });
        process.exit();
      } else {
        log('debug', 'Environment file changed but no significant configuration updates detected');
        // Update previous config to match new one
        previousEnvConfig = newConfig;
      }
    }
  });
}

// Initialize previous config
previousEnvConfig = loadEnvConfig();

// Set up the initial watcher
const envWatcher = setupEnvWatcher();

// Then modify the updateEnvStats function to use the watcher function
async function updateEnvStats() {
  try {
    // Temporarily stop watching the .env file
    fs.unwatchFile(envPath);
    
    // Read the current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update the stats values including quotas
    const statsToUpdate = {
      MAILAI_STATS_PROCESSED: mailai.emailStats.processed,
      MAILAI_STATS_SKIPPED: mailai.emailStats.skipped,
      MAILAI_STATS_ANSWERED: mailai.emailStats.answered,
      MAILAI_STATS_BCC: mailai.emailStats.bccCopied,
      MAILAI_LAST_RESET: emailStats.lastReset,
      MAILAI_DAILY_COUNT: emailStats.dailyCount,
      MAILAI_SENDER_HISTORY: JSON.stringify(Array.from(emailStats.senderHistory.entries()))
    };
    
    // Update each stat in the .env content
    Object.entries(statsToUpdate).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });
    
    // Write the updated content back to the .env file
    fs.writeFileSync(envPath, envContent);
    
    if (process.env.MAILAI_DEBUG_MODE === 'true') {
      log('debug', 'Updated statistics and quotas in .env file');
    }
    
    // Resume watching the file with the same watcher function
    setupEnvWatcher();
  } catch (error) {
    log('error', `Failed to update stats in .env: ${error.message}`);
  }
}

class MailAI {
  constructor() {
    this.processedMessageIds = new Set();
    this.emailStats = {
        processed: 0,
        skipped: 0,
        answered: 0,
        bccCopied: 0
    };
  }
}

  async function startMailAI() {
    await loadPlugins();
    await startMonitoring(config.monitor_port || 3000);
    await startEmailProcessing();
  }

  // Add this function to mark messages with the custom flag
  function markWithCustomFlag(imap, uid) {
    return new Promise((resolve, reject) => {
      imap.addFlags(uid, '$Mailai', (err) => {
        if (err) {
          log('error', `Failed to mark message ${uid} with custom flag: ${err.message}`);
          reject(err);
        } else {
          log('info', `Marked message ${uid} with custom flag`);
          resolve();
        }
      });
    });
  }
  
  // Then modify the processEmail method to use this
  async function processEmail(message, messageId) {
    try {
      if (shouldProcessEmail(message)) {
        await askAI(message);
        mailai.processedMessageIds.add(messageId);
        
        mailai.emailStats.processed++;
        mailai.emailStats.answered++;
        // ToDo: what when multiple Bccs?
        if (config.bcc) {
          mailai.emailStats.bccCopied++;
        }
        
        const senderEmail = emailData.parsed.from;
        emailStats.senderHistory.set(senderEmail, Date.now());
        emailStats.dailyCount++;
        
        // If using custom flag strategy, mark the message
        if (PROCESS_STRATEGY === EMAIL_PROCESS_STRATEGIES.CUSTOM_FLAG || 
            PROCESS_STRATEGY === EMAIL_PROCESS_STRATEGIES.STEALTH) {
          try {
            await markWithCustomFlag(persona.imap, messageId);
          } catch (flagError) {
            log('warning', `Could not set custom flag: ${flagError.message}`);
          }
        }
        
        await updateEnvStats();
      } else {
        mailai.emailStats.skipped++;
        await updateEnvStats();
      }
    } catch (error) {
      log('error', `Failed to process email: ${error.message}`);
      await gracefulShutdown(error);
    }
  }

  function startEmailProcessing() {
    // For each persona, create and handle IMAP connection
    personas.forEach(persona => {
      const imap = createImapConnection(persona.email);
      
      // Store the imap connection with the persona for later use
      persona.imap = imap;
      
      imap.once('ready', () => {
        log('info', `IMAP connection ready for ${persona.email}`);
        openInbox(imap, (err, box) => {
          if (err) {
            log('error', `Failed to open inbox for ${persona.email}: ${err.message}`);
            return;
          }
          
          log('info', `Inbox opened for ${persona.email}, listening for new emails`);
          
          // Process existing unread emails first
          processNewEmails(imap, persona);
          
          // Set up email processing for new emails
          imap.on('mail', (numNewMsgs) => {
            log('info', `Received ${numNewMsgs} new message(s) for ${persona.email}`);
            processNewEmails(imap, persona);
          });
        });
      });
  
      imap.once('error', err => {
        log('error', `IMAP error for ${persona.email}: ${err.message}`);
        // Attempt to reconnect after a delay
        setTimeout(() => {
          log('info', `Attempting to reconnect IMAP for ${persona.email}`);
          imap.connect();
        }, 30000); // 30 second delay before reconnect
      });
  
      imap.once('end', () => {
        log('info', `IMAP connection ended for ${persona.email}`);
        // Attempt to reconnect after a delay
        setTimeout(() => {
          log('info', `Attempting to reconnect IMAP for ${persona.email}`);
          imap.connect();
        }, 30000); // 30 second delay before reconnect
      });
  
      imap.connect();
    });
  }

  async function processNewEmails(imap, persona) {
    try {
      const messages = await fetchNewEmails(imap);
      for (const message of messages) {
        if (!mailai.processedMessageIds.has(message.id)) {
          await processEmail(message);
        }
      }
    } catch (error) {
      log('error', `Failed to process new emails: ${error.message}`);
      // Stop execution in debug mode
      if (process.env.NODE_ENV !== 'production' || process.env.MAILAI_DEBUG_MODE === 'true') {
        log('error', 'Stopping process due to email processing error in debug mode');
        await gracefulShutdown(error);
      }
    }
  }

// Add this near the top with other constants
var EMAIL_PROCESS_STRATEGIES = {
  UNSEEN: 'unseen',
  CUSTOM_FLAG: 'custom_flag',
  BOTH: 'both',
  STEALTH: 'stealth'
};

// Get the strategy from environment or default to 'unseen'
const PROCESS_STRATEGY = process.env.MAILAI_PROCESS_STRATEGY?.toLowerCase() || EMAIL_PROCESS_STRATEGIES.UNSEEN;

// Function to get search criteria based on strategy
function getSearchCriteria() {
  switch (PROCESS_STRATEGY) {
    case EMAIL_PROCESS_STRATEGIES.UNSEEN:
      return ['UNSEEN'];
    case EMAIL_PROCESS_STRATEGIES.CUSTOM_FLAG:
      return ['ALL'];
    case EMAIL_PROCESS_STRATEGIES.BOTH:
      return ['UNSEEN'];
    case EMAIL_PROCESS_STRATEGIES.STEALTH:
      return ['ALL'];
    default:
      return ['UNSEEN'];
  }
}

// Function to determine if messages should be marked as seen
function shouldMarkSeen() {
  return PROCESS_STRATEGY !== EMAIL_PROCESS_STRATEGIES.STEALTH;
}

// Then modify the fetchNewEmails method
// Modify the fetchNewEmails method to filter based on headers
function fetchNewEmails(imap) {
  return new Promise((resolve, reject) => {
    const searchCriteria = getSearchCriteria();
    log('info', `Searching for emails with criteria: ${JSON.stringify(searchCriteria)}`);
    
    imap.search(searchCriteria, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      if (!results || !results.length) {
        log('info', 'No matching messages found');
        resolve([]);
        return;
      }

      // Respect quotas, as defined in .env
      const max = parseInt(process.env.MAILAI_MAX_EMAILS_PER_BATCH, 10);
      if (results.length > max) {
        results = results.slice(0, max);
      }

      log('info', `Found ${results.length} matching messages`);
      const messages = [];
      const fetch = imap.fetch(results, {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE CC KEYWORD)', 'TEXT'],
        markSeen: shouldMarkSeen()
      });
  
      fetch.on('message', (msg, seqno) => {
        const message = {
          id: seqno,
          emailData: {
            from: '',
            subject: '',
            date: '',
            cc: [],
            body: '',
            keyword: ''
          }
        };

        msg.on('body', (stream, info) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          stream.on('end', () => {
            if (info.which === 'TEXT') {
              message.emailData.body = buffer;
            } else {
              const header = Imap.parseHeader(buffer);
              message.emailData.from = header.from ? header.from[0] : '';
              message.emailData.subject = header.subject ? header.subject[0] : '';
              message.emailData.date = header.date ? header.date[0] : '';
              message.emailData.cc = header.cc || [];
              message.emailData.keyword = header.keyword || '';
              
              // Log detailed message information
              log('info', `Message #${seqno}: From: ${message.emailData.from}, Subject: "${message.emailData.subject}", Date: ${message.emailData.date}, Keyword: ${message.emailData.keyword}`);
            }
          });
        });

        msg.once('end', () => {
          messages.push(message);
        });
      });

      fetch.once('error', (err) => {
        reject(err);
      });

      fetch.once('end', () => {
        // Filter messages to exclude those with the custom flag
        const filteredMessages = messages.filter(message => {
          // Implement logic to check for the custom flag in message headers
          return !message.emailData.keyword.includes('$Mailai');
        });
        resolve(filteredMessages);
      });
    });
  });
}

// Remove the standalone IIFE that was causing the error
const mailai = new MailAI();
mailai.start().catch(err => {
  log('error', `Failed to start MailAI: ${err.message}`);
  process.exit(1);
});

// Log initial configuration
log('config', `Hello! MAILAI_EMAIL_USER is set to: ${process.env.MAILAI_EMAIL_USER}`);
log('config', `Great! MAILAI_EMAIL_USERS are: ${process.env.MAILAI_EMAIL_USERS}`);
log('config', `BCC emails set to: ${process.env.MAILAI_BCC_EMAILS}`);
log('config', `prompt: ${process.env.MAILAI_PROMPT}`);


class Persona {
  constructor(email, password, prompt) {
    this.mail = { user: email, password: password};
    this.prompt = prompt;
  }
}

// Create personas from environment variables
const personas = emailUsers.map((email, index) => {
  return new Persona(
    email.trim(),
    process.env.MAILAI_PROMPT
  );
});

// Replace the existing imap configuration with a function to create IMAP connections
function createImapConnection(email) {
  // Validate required environment variables with specific messages
  const requiredConfigs = {
    MAILAI_EMAIL_PASSWORD: 'email password',
    MAILAI_EMAIL_HOST: 'IMAP host',
    MAILAI_EMAIL_PORT: 'IMAP port'
  };

  const missingConfigs = Object.entries(requiredConfigs)
    .filter(([key]) => !process.env[key])
    .map(([_, desc]) => desc);

  if (missingConfigs.length > 0) {
    throw new Error(
      `Missing required IMAP configuration:\n` +
      `- Missing ${missingConfigs.join(', ')}\n` +
      `Please check your .env file and ensure all required values are set.`
    );
  }

  // Clean up password by removing spaces
  const cleanPassword = process.env.MAILAI_EMAIL_PASSWORD.replace(/\s+/g, '');
  
  if (cleanPassword.length < 8) {
    log('warning', `Password for ${email} seems too short. Make sure you're using the correct password in MAILAI_EMAIL_PASSWORD.`);
  }
  
  if (email.includes('gmail.com')) {
    if (cleanPassword.length === 16) {
      log('info', `Detected correct Gmail App Password format for ${email}`);
    } else {
      log('warning', `Gmail account ${email} detected but password length is not 16 characters (current: ${cleanPassword.length}). Check if your app password is correct.`);
    }
  }

  return new Imap({
    user: email,
    password: cleanPassword,  // Use cleaned password
    host: process.env.MAILAI_EMAIL_HOST,
    port: process.env.MAILAI_EMAIL_PORT,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 3000,
    connTimeout: 10000,
    debug: process.env.NODE_ENV === 'development' ? console.log : null
  });
}

function openInbox(imap, cb) {
  imap.openBox('INBOX', true, cb);
}



// Log rate limit configuration
log('config', `Rate limits configured:
  - Max emails per batch: ${RATE_LIMITS.MAX_EMAILS_PER_BATCH}
  - Max daily emails: ${RATE_LIMITS.MAX_DAILY_EMAILS}
  - Cooldown period: ${RATE_LIMITS.COOLDOWN_PERIOD}ms`);

// Add this before the pluginManager initialization
// After the initial requires, modify the emailStats initialization
// Fix the emailStats initialization to properly handle the sender history
const emailStats = {
  dailyCount: parseInt(process.env.MAILAI_DAILY_COUNT || '0'),
  lastReset: parseInt(process.env.MAILAI_LAST_RESET || new Date().setHours(0, 0, 0, 0)),
  senderHistory: new Map(
    process.env.MAILAI_SENDER_HISTORY ? 
    // Add a try-catch to handle potential JSON parsing errors
    (() => {
      try {
        const parsed = JSON.parse(process.env.MAILAI_SENDER_HISTORY);
        // Check if it's an array of arrays (proper format for Map constructor)
        if (Array.isArray(parsed) && parsed.every(item => Array.isArray(item))) {
          return parsed.map(([email, time]) => [email, parseInt(time)]);
        } else {
          log('warning', 'MAILAI_SENDER_HISTORY is not in the expected format, resetting sender history');
          return [];
        }
      } catch (e) {
        log('warning', `Error parsing MAILAI_SENDER_HISTORY: ${e.message}, resetting sender history`);
        return [];
      }
    })() : 
    []
  )
};

// Modify the updateEnvStats function to include quota information
async function updateEnvStats() {
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update the stats values including quotas
    const statsToUpdate = {
      MAILAI_STATS_PROCESSED: mailai.emailStats.processed,
      MAILAI_STATS_SKIPPED: mailai.emailStats.skipped,
      MAILAI_STATS_ANSWERED: mailai.emailStats.answered,
      MAILAI_STATS_BCC: mailai.emailStats.bccCopied,
      MAILAI_LAST_RESET: emailStats.lastReset,
      MAILAI_DAILY_COUNT: emailStats.dailyCount,
      MAILAI_SENDER_HISTORY: JSON.stringify(Array.from(emailStats.senderHistory.entries()))
    };
    
    // Update each stat in the .env content
    Object.entries(statsToUpdate).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });
    
    // Write the updated content back to the .env file
    fs.writeFileSync(envPath, envContent);
    
    if (process.env.MAILAI_DEBUG_MODE === 'true') {
      log('debug', 'Updated statistics and quotas in .env file');
    }
  } catch (error) {
    log('error', `Failed to update stats in .env: ${error.message}`);
  }
}

// In the shouldProcessEmail function, update the daily counter persistence
function shouldProcessEmail(emailData) {
  const isDebug = process.env.MAILAI_DEBUG_MODE === 'true';
  
  // Reset daily counter if it's a new day
  const today = new Date().setHours(0, 0, 0, 0);
  if (today > emailStats.lastReset) {
    emailStats.dailyCount = 0;
    emailStats.lastReset = today;
    // Update the env file when resetting counters
    updateEnvStats();
  }
  
  // Check daily limit
  if (emailStats.dailyCount >= RATE_LIMITS.MAX_DAILY_EMAILS) {
    log('warning', `Daily email limit (${RATE_LIMITS.MAX_DAILY_EMAILS}) reached. Skipping until tomorrow.`);
    return false;
  }

  // Check sender cooldown
  const senderEmail = emailData.from.address || emailData.from;
  const lastResponse = emailStats.senderHistory.get(senderEmail);
  const now = Date.now();
  
  if (lastResponse && (now - lastResponse) < RATE_LIMITS.COOLDOWN_PERIOD) {
    log('info', `Skipping email "${emailData.subject}" - Cooldown period active for sender ${senderEmail}`);
    return false;
  }

  // Check if any of our managed emails are in the CC field
  if (emailData.cc) {
    const ccEmails = Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc];
    const isAnyEmailInCC = emailUsers.some(email => 
      ccEmails.some(cc => cc.includes(email.trim()))
    );

    if (isAnyEmailInCC) {
      log('info', `Skipping email "${emailData.subject}" because one of our managed emails is in CC - This prevents auto-response loops`);
      return false;
    }
  }

  // In debug mode, log but still process if explicitly enabled
  if (isDebug) {
    log('info', `Processing email "${emailData.subject}" from ${senderEmail} - Debug mode is active`);
  }
  
  return true;
}

async function loadPrompt(prompt) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(prompt);
    if (parsedUrl.protocol === 'file:' || !parsedUrl.protocol) {
      fs.readFile(resolveLocalPath(prompt), 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    } else if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      protocol.get(prompt, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    } else {
      reject(new Error('Invalid pre-prompt URL'));
    }
  });
}

function resolveLocalPath(urlString) {
  const parsedUrl = url.parse(urlString);
  if (parsedUrl.protocol === 'file:' || !parsedUrl.protocol) {
    return path.join(__dirname, parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : urlString);
  }
  return urlString;
}

// Add this utility function near the top with other utility functions
function createEmailData(question, recipient, persona) {
  return { question, recipient, persona };
}

// In the askAI function
async function askAI(message) {
  try {
    log('email', `Processing email from ${message.parsed.from} using ${message.persona.ai.id}`);
    // ToDo: move prompt loading to ai provider creation
    const promptCustom = fs.readFileSync(resolveLocalPath(persona.prompt), 'utf8');
    const mergedPrompt = `${BASE_PROMPT}\n${promptCustom}`;
    const messages = [
      { role: 'system', content: mergedPrompt },
      { role: 'user', content: `${question} (as ${persona.email})` },
    ];
    
    await aiService.handle(message, messages );
    
    if (!message.response) {
      log('error', "No response received from AI service $(aiService.id) for email from ${message.parsed.from}");
      throw new Error('No response received from AI service');
    }
    
    log('ai', `Got response from AI service`);
    const emailSubject = "Re: " + message.parsed.subject;
    
    await sendEmail(recipient.address, emailSubject, processedResponse, persona.email);
  } catch (error) {
    log('error', error.message);
    await mailai.pluginManager.executeHook('onError', error, { question, recipient, persona });
    
    // Always throw the error to be handled by the caller
    throw error;
  }
}

async function sendEmail(emailData, to, subject, text, from) {
  // Ensure text is a string
  const emailContent = typeof text === 'object' ? JSON.stringify(emailData, (function() {
  const seen = new WeakSet();
  return function(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      
      if (value instanceof Date) return value.toISOString();
      if (value.constructor && ['Timeout', 'TimersList', 'Socket', 'Server'].includes(value.constructor.name)) {
        return `[${value.constructor.name}]`;
      }
    }
    return value;
  };
})()) : String(text);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: from,
      pass: process.env.MAILAI_EMAIL_PASSWORD
    }
  });

  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    text: emailContent,
    bcc: process.env.MAILAI_BCC_EMAILS ? process.env.MAILAI_BCC_EMAILS.split(',').map(email => email.trim()) : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    // Always stop on errors in development/debug mode
    if (process.env.NODE_ENV !== 'production' || process.env.MAILAI_DEBUG_MODE === 'true') {
      log('error', 'Stopping process due to email sending error in development mode');
      await gracefulShutdown(error);
    }
    // In production, rethrow the error to be handled by the caller
    throw error;
  }
}

// Add at the top level, after the initial requires
// Improve the gracefulShutdown function with better error tracing
async function gracefulShutdown(error = null) {
  try {
    // Save stats before exit
    await updateEnvStats();
    if (error) {
      log('error', `Shutting down due to error: ${error.message}`);
      // Add stack trace for better debugging
      log('debug', `Error stack trace: ${error.stack}`);
    } else {
      log('info', 'Gracefully shutting down');
    }
  } catch (saveError) {
    log('error', `Failed to save stats during shutdown: ${saveError.message}`);
    log('debug', `Shutdown error stack trace: ${saveError.stack}`);
  } finally {
    process.exit(error ? 1 : 0);
  }
}

// Add process-wide error handlers at the top level
process.on('uncaughtException', async (error) => {
  log('error', `Uncaught Exception: ${error.message}`);
  await gracefulShutdown(error);
});

process.on('unhandledRejection', async (reason, promise) => {
  log('error', `Unhandled Rejection at: ${promise}, reason: ${reason}`);
  await gracefulShutdown(new Error(String(reason)));
});

process.on('SIGINT', async () => {
  log('info', 'Received SIGINT signal');
  await gracefulShutdown();
});
