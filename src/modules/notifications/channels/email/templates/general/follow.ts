import { enrichTemplate } from '@app/common/helpers';
import { baseTemplate } from '../base.template';

export function enrichFollowTemplate(data: {
  username: string;
  followerName: string;
  profileUrl: string;
}) {
  const content = `
      <p>Hi {{username}},</p>
      <p>You have a new follower on ggg!</p>
      <p><strong>{{followerName}}</strong> has started following you.</p>
      <p>Check out their profile to see if you want to follow back.</p>
      <p style="text-align: center;">
        <a href="{{profileUrl}}" class="button">View Profile</a>
      </p>
    `;

  const html = baseTemplate('New Follower Alert!', content);
  return enrichTemplate(html, data);
}
