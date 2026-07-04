'use strict';

const nodemailer = require('nodemailer');

const createTrialMailer = config => {
  if (!config.trialEnabled) return null;

  if (!config.trialSmtpUrl || !config.trialEmailFrom
      || !config.trialBaseUrl || !config.trialIpHashSecret) {
    throw new Error('Trial delivery configuration is incomplete');
  }

  const transport = nodemailer.createTransport(config.trialSmtpUrl);

  return {
    async sendVerification({ email, organizationName, verificationUrl }) {
      await transport.sendMail({
        from: config.trialEmailFrom,
        to: email,
        subject: 'Подтвердите 30-дневный LeavePilot Trial',
        text: [
          `Здравствуйте! Для организации «${organizationName}» запрошена пробная лицензия LeavePilot.`,
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
