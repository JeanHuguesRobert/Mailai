require('dotenv').config();
const Imap = require('imap');
const nodemailer = require('nodemailer');
const fs = require('fs');
const https = require('https');
const http = require('http');
const url = require('url');
const path = require('path');
const { PluginManager } = require('./plugins/manager');
const { log } = require('./server');

// Log initial configuration
log('config', `Hello! MAILAI_EMAIL_USER is set to: ${process.env.MAILAI_EMAIL_USER}`);
log('config', `Great! MAILAI_EMAIL_USERS are: ${process.env.MAILAI_EMAIL_USERS}`);
log('config', `BCC emails set to: ${process.env.MAILAI_BCC_EMAILS}`);
log('config', `prompt: ${process.env.MAILAI_PROMPT}`);


const BASE_PROMPT = `You are an AI email management assistant, similar to a well-trained email auto-responder system. Your role is to:

1. UNDERSTAND THE CONTEXT:
   - Check if the email requires a response or is informational only
   - Identify the key points and urgency level
   - Consider the sender's role and relationship

2. RESPONSE STYLE:
   - Write in a natural, conversational tone while maintaining professionalism
   - Keep responses concise (2-3 paragraphs maximum)
   - Use bullet points for multiple items
   - Mirror the formality level of the incoming message

3. STANDARD PRACTICES:
   - Acknowledge receipt of complex requests
   - Set clear expectations for follow-ups
   - Provide relevant next steps when needed
   - Use appropriate greetings based on time of day

4. CRITICAL RULES:
   - Never commit to deadlines without explicit instruction
   - Don't share confidential or personal information
   - Be transparent about being an AI assistant
   - Defer complex decisions to human review
   - Don't engage in legal, medical, or financial advice

5. FORMAT:
   - Use proper email structure (greeting, body, closing)
   - Include appropriate signature as specified
   - Maintain consistent formatting`;

class Persona {
  constructor(email, prompt) {
    this.email = email;
    this.prompt = prompt;
  }
}

// Handle both MAILAI_EMAIL_USER and MAILAI_EMAIL_USERS
const mainEmail = process.env.MAILAI_EMAIL_USER;
const emailUsers = process.env.MAILAI_EMAIL_USERS
? process.env.MAILAI_EMAIL_USERS.split(',') : [];

// If MAILAI_EMAIL_USER is present, add it as the first user
if (mainEmail) {
  emailUsers.unshift(mainEmail);
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
  return new Imap({
    user: email,
    password: process.env.MAILAI_EMAIL_PASSWORD,
    host: process.env.MAILAI_EMAIL_HOST,
    port: process.env.MAILAI_EMAIL_PORT,
    tls: true,
  });
}

function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

function shouldProcessEmail(emailData) {
  // Check if the agent is in the CC field
  if (emailData.cc && emailData.cc.includes(process.env.MAILAI_EMAIL_USER)) {
    console.log(`Skipping email (agent in CC): ${emailData.subject}`);
    return false;
  }
  // While in early debugging, don't process yet
  return false;
  // return true;
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

const pluginManager = new PluginManager();
pluginManager.loadPlugins();

async function askAI(question, recipient, persona) {
  try {
    log('email', `Processing email from ${recipient.address} using ${persona.email}`);
    const emailData = { question, recipient, persona };
    const processedData = await pluginManager.executeHook('beforeProcessEmail', emailData);
    
    const promptCustom = fs.readFileSync(resolveLocalPath(persona.prompt), 'utf8');
    const mergedPrompt = `${BASE_PROMPT}\n${promptCustom}`;
    const messages = [
      { role: 'system', content: mergedPrompt },
      { role: 'user', content: `${question} (as ${persona.email})` },
    ];
    
    const response = await aiService.getCompletion(messages, {
      model: process.env.MAILAI_AI_MODEL
    });
    
    log('ai', `Got response from AI service`);
    const processedResponse = await pluginManager.executeHook('afterProcessEmail', emailData, response);
    const emailSubject = `Re: ${question}`;
    
    await sendEmail(recipient.address, emailSubject, processedResponse, persona.email);
  } catch (error) {
    log('error', error.message);
    await pluginManager.executeHook('onError', error, { question, recipient, persona });
    console.error('AI service error:', error);
  }
}

async function sendEmail(to, subject, text, from) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: from,
      pass: process.env.MAILAI_EMAIL_PASSWORD,
    },
  });

  const bccEmails = process.env.MAILAI_BCC_EMAILS.split(',').map(email => email.trim());

  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    text: text,
    bcc: bccEmails, // Add BCC from environment variable
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

// Main execution
personas.forEach(persona => {
  const imap = createImapConnection(persona.email);
  
  imap.once('ready', function() {
    openInbox(function(err, box) {
      if (err) throw err;
      const searchCriteria = process.env.MAILAI_EMAIL_LABEL 
        ? ['UNSEEN', ['LABEL', process.env.MAILAI_EMAIL_LABEL]]
        : ['UNSEEN'];
      
      imap.search(searchCriteria, function (err, results) {
        if (err) throw err;
        if (results.length === 0) {
          console.log('No new emails.');
          imap.end();
          return;
        }
        const f = imap.fetch(results, { 
          bodies: ['HEADER.FIELDS (FROM TO CC SUBJECT)', 'TEXT'],
          struct: true 
        });
  
        f.on('message', function (msg, seqno) {
          let emailData = {};
  
          msg.on('body', function (stream, info) {
            let buffer = '';
            stream.on('data', function (chunk) {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', function () {
              if (info.which.includes('HEADER')) {
                const parsed = Imap.parseHeader(buffer);
                emailData.from = parsed.from[0];
                emailData.to = parsed.to ? parsed.to[0] : '';
                emailData.cc = parsed.cc ? parsed.cc[0] : '';
                emailData.subject = parsed.subject ? parsed.subject[0] : '';
              } else {
                emailData.body = buffer;
              }
            });
          });
  
          msg.once('end', function () {
            // Ne pas répondre si l'agent est en copie
            if (emailData.cc && emailData.cc.includes(process.env.MAILAI_EMAIL_USER)) {
              console.log(`Skipping email (agent in CC): ${emailData.subject}`);
              return;
            }
            if (shouldProcessEmail(emailData)) {
              askAI(emailData.subject, emailData.from, persona); // Pass the persona to the prompt
            } else {
              console.log(`Skipping email: ${emailData.subject}`);
            }
          });
        });
        f.once('error', function (err) {
          console.log('Fetch error: ' + err);
        });
        f.once('end', function () {
          console.log('All emails retrieved!');
          imap.end();
        });
      });
    });
  });

  imap.once('error', function (err) {
    if (err.code === 'ENOTFOUND') {
        log('error', `IMAP configuration error: Unable to find the server ${err.hostname}. Please check your MAILAI_EMAIL_HOST setting in the .env file.`);
    } else {
        log('error', err.message);
    }
    console.log(err);
  });

  imap.once('end', function () {
    console.log('Connexion IMAP fermée');
  });

  imap.connect();
});

// Start both the email processor and monitoring server
require('./server');
