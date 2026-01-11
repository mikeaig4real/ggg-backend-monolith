import { enrichTemplate } from '@app/common/helpers';
import { baseTemplate } from '../base.template';

export enum TransactionUpdateType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  LOCKED = 'LOCKED',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
}

export function enrichTransactionUpdateTemplate(data: {
  username: string;
  type: TransactionUpdateType;
  amount: number;
  currency: string;
  referenceId: string;
  date: string;
  transactionUrl: string;
}) {
  const titles = {
    [TransactionUpdateType.DEPOSIT]: 'Deposit Successful',
    [TransactionUpdateType.WITHDRAW]: 'Withdrawal Successful',
    [TransactionUpdateType.LOCKED]: 'Funds Locked',
    [TransactionUpdateType.RELEASED]: 'Funds Released',
    [TransactionUpdateType.REFUNDED]: 'Transaction Refunded',
  };

  const descriptions = {
    [TransactionUpdateType.DEPOSIT]:
      'Your deposit has been successfully processed.',
    [TransactionUpdateType.WITHDRAW]:
      'Your withdrawal has been successfully processed.',
    [TransactionUpdateType.LOCKED]:
      'Funds have been locked for an active game/escrow.',
    [TransactionUpdateType.RELEASED]:
      'Funds have been released to your wallet.',
    [TransactionUpdateType.REFUNDED]:
      'A transaction has been refunded to your wallet.',
  };

  const title = titles[data.type] || 'Wallet Update';
  const description =
    descriptions[data.type] || 'There has been an update to your wallet.';

  const formattedAmount = `${data.currency} ${data.amount}`;

  const content = `
    <p>Hi {{username}},</p>
    <p>${description}</p>
    <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${formattedAmount}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Reference ID:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">{{referenceId}}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">{{date}}</td>
      </tr>
    </table>
    <p>For more details, please view the transaction details.</p>
    <p style="text-align: center;">
      <a href="{{transactionUrl}}" class="button">View Details</a>
    </p>
  `;

  const html = baseTemplate(title, content);
  return enrichTemplate(html, data);
}
