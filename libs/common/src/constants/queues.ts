export const MATCHMAKING_QUEUE = 'matchmaking';
export const WALLET_CREATION_QUEUE = 'wallet_creation_queue';
export const SCHEMA_MIGRATION_QUEUE = 'schema_migration';
export const USER_QUEUE = 'user';
export const WALLET_QUEUE = 'wallet';
export const GAME_QUEUE = 'game';
export const MATCH_TIMEOUT_QUEUE = 'match_timeout';
export const WALLET_MAINTENANCE_QUEUE = 'wallet_maintenance_queue';
export const NOTIFICATION_QUEUE = 'notification_queue';
export const NOTIFICATION_EMAIL_QUEUE = 'notification_email_queue';
export const NOTIFICATION_PUSH_QUEUE = 'notification_push_queue';
export const NOTIFICATION_SMS_QUEUE = 'notification_sms_queue';
export const NOTIFICATION_WHATSAPP_QUEUE = 'notification_whatsapp_queue';
export const NOTIFICATION_SLACK_QUEUE = 'notification_slack_queue';
export const NOTIFICATION_IN_APP_QUEUE = 'notification_in_app_queue';
export const PAYMENTS_WEBHOOK_QUEUE = 'payments_webhook';
export const WALLET_OPERATIONS_QUEUE = 'wallet_operations';
export const ACCOUNT_DELETION_QUEUE = 'account_deletion_queue';
export const CRON_CLEANUP_QUEUE = 'cron-cleanup';
export const CONTROL_CENTER_QUEUE = 'control_center_queue';

export const WALLET_JOB_NAMES = {
  CREATE_WALLET: 'create_wallet',
  REVERT_STALE_GAMES: 'revert_stale_games',
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  LOCK_FUNDS: 'lock_funds',
  RELEASE_FUNDS: 'release_funds',
  REVERT_GAME: 'revert_game',
} as const;

export interface DepositJobPayload {
  userId: string;
  amount: number;
  source?: string;
}

export interface WithdrawJobPayload {
  userId: string;
  amount: number;
}

export interface LockFundsJobPayload {
  userId: string;
  amount: number;
  gameId: string;
  shouldSkipWallet?: boolean;
  source?: string;
}

export interface ReleaseFundsJobPayload {
  winnerUserId: string;
  amount: number;
  gameId: string;
  source?: string;
}

export interface RevertGameJobPayload {
  gameId: string;
}

export type WalletJobData =
  | DepositJobPayload
  | WithdrawJobPayload
  | LockFundsJobPayload
  | ReleaseFundsJobPayload
  | RevertGameJobPayload;
