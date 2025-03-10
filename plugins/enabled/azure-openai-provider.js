const { MailAIPlugin } = require('../base');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

class AzureOpenAIProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.client = new OpenAIClient(
      process.env.MAILAI_AZURE_ENDPOINT,
      new AzureKeyCredential(process.env.MAILAI_AZURE_API_KEY)
    );
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'azure') return emailData;

    const result = await this.client.getChatCompletions(
      process.env.MAILAI_AZURE_DEPLOYMENT,
      [{ role: 'user', content: emailData.question }]
    );

    emailData.aiResponse = result.choices[0].message.content;
    return emailData;
  }
}

module.exports = AzureOpenAIProviderPlugin;
