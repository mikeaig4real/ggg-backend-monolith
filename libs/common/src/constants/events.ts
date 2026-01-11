export const USER_EVENTS = {
  CREATE_USER: 'create_user',
  VALIDATE_USER: 'validate_user',
  AUTHENTICATE: 'authenticate',
  GET_USER: 'get_user',
  GET_ALL_USERS: 'get_all_users',
  HEALTH_CHECK: 'health_check',
} as const;

export const MATCHMAKING_EVENTS = {
  JOIN_RANDOM: 'match.join_random',
  CREATE_LOBBY: 'match.create_lobby',
  JOIN_LOBBY: 'match.join_lobby',
  JOIN_BOT: 'match.join_bot',
  MATCH_FOUND: 'match.found',
  MATCH_TIMEOUT: 'match.timeout',
  HEALTH_CHECK: 'health_check',
} as const;

export const WALLET_EVENTS = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  GET_BALANCE: 'get_balance',
  GET_TRANSACTIONS: 'get_transactions',
  GET_ESCROWS: 'get_escrows',
  HEALTH_CHECK: 'health_check',
  REVERT_GAME: 'revert_game',

  // Events / EventPattern
  LOCK_FUNDS: 'wallet.lock_funds',
  SETTLE_FUNDS: 'wallet.settle_funds',
  FUNDS_LOCKED: 'funds.locked',
  FUNDS_FAILED: 'funds.failed',
} as const;

export const GAME_EVENTS = {
  CREATE_MATCH: 'create_match',
  CREATE_BOT_GAME: 'create_bot_game',
  MATCH_FOUND: 'match.found',
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  HEARTBEAT: 'heartbeat',
  PLAYER_JOINED: 'player_joined',
  PLACE_BET: 'place_bet',
  BET_PLACED: 'bet_placed',
  ROUND_START: 'round_start',
  LUCKY_NUMBER_DRAWN: 'lucky_number_drawn',
  DICE_ROLLED: 'dice_rolled',
  ROUND_ENDED: 'round_ended',
  GAME_OVER: 'game_over',
  INVALID_MOVE: 'invalid_move',
  IDENTIFY: 'identify',
  IDENTIFIED: 'identified',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  HEALTH_CHECK: 'health_check',
  MATCH_READY: 'match_ready',
  START_GAME: 'start_game',
  STATE_UPDATE: 'state_update',
  GET_GAME_STATE: 'get_game_state',
} as const;

export const NOTIFICATION_EVENTS = {
  NEW_NOTIFICATION: 'notification.new',
  READ_STATE_UPDATE: 'notification.read_state_update',
} as const;
