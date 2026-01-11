import { enrichTemplate } from '@app/common/helpers';
import { baseTemplate } from '../base.template';

export function enrichMfaCodeTemplate(data: { code: string }) {
  const content = `
      <p>Hello,</p>
      <p>You requested a verification code for Multi-Factor Authentication.</p>
      <p>Please use the following code to complete the setup:</p>
      <div style="text-align: center; padding: 20px;">
        <h1 style="letter-spacing: 5px; font-size: 32px; background: #eee; display: inline-block; padding: 10px 20px; border-radius: 8px;">{{code}}</h1>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, your account security may be compromised. Please change your password immediately.</p>
    `;

  const html = baseTemplate('Your Verification Code', content);
  return enrichTemplate(html, data);
}
