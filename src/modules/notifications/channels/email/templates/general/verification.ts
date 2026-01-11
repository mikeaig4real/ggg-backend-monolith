import { enrichTemplate } from '@app/common/helpers';
import { baseTemplate } from '../base.template';

export function enrichVerificationTemplate(data: {
  username: string;
  code: string;
}) {
  const content = `
      <p>Hi {{username}},</p>
      <p>Welcome to ggg!</p>
      <p>Please use the following code to verify your email address:</p>
      <div style="text-align: center; padding: 20px;">
        <h1 style="letter-spacing: 5px; font-size: 32px; background: #eee; display: inline-block; padding: 10px 20px; border-radius: 8px;">{{code}}</h1>
      </div>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

  const html = baseTemplate('Verify Your Email', content);
  return enrichTemplate(html, data);
}
