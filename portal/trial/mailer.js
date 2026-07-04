'use strict';

const nodemailer = require('nodemailer');

const createTrialMailer = (config, options = {}) => {
  if (!config.trialEnabled) return null;

  if (!config.trialSmtpUrl || !config.trialEmailFrom
      || !config.trialBaseUrl || !config.trialIpHashSecret) {
    throw new Error('Trial delivery configuration is incomplete');
  }

  const transport = options.transport || nodemailer.createTransport(config.trialSmtpUrl);

  return {
    async sendVerification({ email, verificationUrl }) {
      await transport.sendMail({
        from: config.trialEmailFrom,
        to: email,
        subject: 'Подтвердите 30-дневный LeavePilot Trial',
        text: [
          'Здравствуйте! Запрошена пробная лицензия LeavePilot.',
          '',
          'Подтвердите email и получите лицензию:',
          verificationUrl,
          '',
          'Ссылка действует 30 минут. Если вы не запрашивали Trial, проигнорируйте письмо.',
        ].join('\n'),
      });
    },
  };
};

module.exports = { createTrialMailer };
