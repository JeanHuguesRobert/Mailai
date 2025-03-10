const { MailAIPlugin } = require('../base');
const { ReplicateClient } = require('replicate');

class LlamaProviderPlugin extends MailAIPlugin {
  constructor(config) {
    super(config);
    this.replicate = new ReplicateClient({
      auth: process.env.MAILAI_LLAMA_API_KEY,
    });
  }

  async beforeProcessEmail(emailData) {
    if (process.env.MAILAI_AI_PROVIDER !== 'llama') return emailData;

    const output = await this.replicate.run(
      "meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
      {
        input: {
          prompt: emailData.question,
          max_new_tokens: 500
        }
      }
    );

    emailData.aiResponse = output.join('');
    return emailData;
  }
}

module.exports = LlamaProviderPlugin;
