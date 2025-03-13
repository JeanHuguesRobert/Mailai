# Mailai - AI Email Assistant

Mailai is a personal automated service that uses artificial intelligence to respond to unread emails. It supports multiple AI providers and offers extensive customization through its plugin system.

## 🚀 Key Features

- Multi-persona email management
- Multiple AI provider support (OpenAI, Mistral, etc.)
- Secure IMAP/SMTP handling
- Plugin system for extensibility
- Real-time monitoring dashboard
- Rate limiting and cooldown periods
- Debug mode for testing
- BCC copying for response monitoring

## 🚀 Deployment Options

### 1. Web-Based
Access Mailai through any web browser:
1. Visit https://JeanHuguesRobert.github.io/mailai
2. Configure your email settings
3. Use directly from the browser

Features:
- No local installation needed
- Works on all devices
- Real-time email monitoring
- PWA support for mobile

### 2. Scheduled Local
Run Mailai on a local machine with scheduled tasks:

#### Windows PC (recommended)
Use Windows Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task
3. Set schedule (e.g., every 15 minutes)
4. Action: Start Program
5. Program: `node`
6. Arguments: `c:\path\to\mailai\index.js`

#### Mac/Linux
Add to crontab:
```bash
 */15 * * * * cd /path/to/mailai && /usr/local/bin/node index.js
```

#### Mobile Phone Options
1. **Termux** (Android):
```bash
 pkg install nodejs
 # Set up cron job similar to Linux
```

2. **Alternative**: Use your home computer and forward mobile emails there

### 3. Local
Run Mailai on a local machine manually:

Best for personal use and testing:
```bash
 git clone https://github.com/JeanHuguesRobert/Mailai
 cd Mailai
 npm install
 node index.js
```


## 📧 Email Configuration Details

### Email Account Setup

#### Gmail
1. Go to Google Account settings > Security
2. Enable 2-Step Verification
3. Create an App Password:
 - Go to Google Account settings > Security > 2-Step Verification > App passwords
 - Select "Mail" and your device
 - Copy the generated 16-character password
4. Use the generated App password in your `.env` file:
```env
 MAILAI_EMAIL_USER=your-email@gmail.com
 MAILAI_EMAIL_PASSWORD=your-16-char-app-password
 MAILAI_EMAIL_HOST=imap.gmail.com
 MAILAI_EMAIL_PORT=993
```

#### Yahoo
1. Go to Account Info > Account Security
2. Generate an App Password
3. Use the generated App password in your `.env` file:
```env
 MAILAI_EMAIL_USER=your-email@yahoo.com
 MAILAI_EMAIL_PASSWORD=your-app-password
 MAILAI_EMAIL_HOST=imap.mail.yahoo.com
 MAILAI_EMAIL_PORT=993
```

#### Outlook
1. Go to Security > More security options
2. Enable Two-step verification
3. Create an App Password
4. Use the generated App password in your `.env` file:
```env
 MAILAI_EMAIL_USER=your-email@outlook.com
 MAILAI_EMAIL_PASSWORD=your-app-password
 MAILAI_EMAIL_HOST=imap-mail.outlook.com
 MAILAI_EMAIL_PORT=993
```

### Gmail Settings
1. Enable IMAP in Gmail:
 - Go to Gmail settings > See all settings > Forwarding and POP/IMAP
 - Enable IMAP
 - Save changes

## 🤖 Supported AI Providers

Mailai supports multiple AI providers through its plugin system.



## 📧 Bcc for Monitoring Multiple Email Addresses

The Bcc (Blind Carbon Copy) option allows you to monitor the AI's email responses by sending a copy of each response to specified email addresses without the primary recipient knowing. This is useful for keeping track of the AI's interactions, especially when the agent is attached to multiple email accounts for different personas.

### Configuration

By configuring the Bcc option, you will receive a copy of each email response sent by the AI agent, allowing you to monitor the interactions and ensure the AI is responding appropriately.

## 🎭 Multi-Persona Configuration

Mailai now supports multiple personas, allowing the AI to respond differently based on different roles or contexts. Configure multiple personas using these environment variables:

```env
 # Base email configuration
 MAILAI_EMAIL_USERS=personal@email.com,work@email.com,public@email.com

 # Persona-specific configurations (0 = first email, 1 = second email, etc.)
 MAILAI_PROMPT_0=file://path/to/personal_prompt.txt

 MAILAI_PROMPT_1=file://path/to/work_prompt.txt

 # ... and so on for each persona
```

Each persona can have its own:
- Prompt for context
- Email monitoring settings

## 🏗️ Technical Architecture

### Core Components

```mermaid
 graph TB
 Email[Email Service] --> Gateway[AI Gateway]
 Gateway --> OpenAI[OpenAI Service]
 Gateway --> Mistral[Mistral Service]
 Gateway --> MCP[MCP Service]
 Gateway --> Plugin[Plugin System]
```

1. **Email Service**
 - IMAP monitoring for incoming emails
 - SMTP for sending responses
 - Multi-persona support

2. **AI Gateway**
 - Abstract interface for AI providers
 - Context management
 - Response formatting

3. **AI Services**
 - OpenAI (GPT-3.5/4)
 - Mistral AI
 - MCP-enabled services

4. **Plugin System**
 - Hook-based architecture
 - Pre/post processing
 - Error handling

### Plugin Development

Create plugins to extend Mailai's functionality:

1. Create a new file in `plugins/enabled/`:
```javascript
 const { MailAIPlugin } = require('../base');

 class MyPlugin extends MailAIPlugin {
 async beforeProcessEmail(emailData) {
 // Modify or enhance email data
 return emailData;
 }

 async afterProcessEmail(emailData, response) {
 // Modify AI response
 return response;
 }

 async beforeSendEmail(emailOptions) {
 // Modify email before sending
 return emailOptions;
 }
 }

 module.exports = MyPlugin;
```

2. Configure plugin (optional):
```env
 MAILAI_PLUGIN_MYPLUGIN={"option1": "value1"}
```

Available hooks:
- `beforeProcessEmail`: Modify email before AI processing
- `afterProcessEmail`: Modify AI response
- `beforeSendEmail`: Modify email options before sending
- `onError`: Handle errors

## 📱 Mobile & Web Access

### Progressive Web App
Access Mailai from any device:
1. Visit `https://your-server/mailai`
2. Click "Add to Home Screen"
3. Run as a native-like app

### Mobile Options

1. **PWA (Recommended)**
 - Works on iOS and Android
 - No installation required
 - Auto-updates

2. **Termux (Android Advanced)**
```bash
 pkg install nodejs
 git clone https://github.com/yourusername/mailai
 cd mailai
 npm install
 node index.js
```

3. **iOS Shortcuts**
 - Create an automation that calls your Mailai web endpoint
 - Schedule periodic checks
 - Receive notifications

### Web Interface

1. **Self-hosted**
 ```bash
 cd web
 python -m http.server 8080
 # Or any static file server
```

2. **Browser Extension**
 - Monitor emails in real-time
 - Respond directly from your browser
 - Configure multiple accounts

## 🖥️ Monitor Configuration

The HTTP monitoring interface can be configured in several ways:

1. **Environment Variable**:
```env
 MAILAI_HTTP_PORT=3000
```

2. **Command Line**:
```bash
 cd Mailai
 node index.js --port=3000
```

3. **Default**: Uses port 3000 if not specified

## 📄 License

MIT © Jean Hugues Noël Robert
