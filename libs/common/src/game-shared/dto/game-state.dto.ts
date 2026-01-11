export class GameStateDto {
  matchId: string;
  gameType?: string;
  status: 'LOADING' | 'BETTING' | 'PLAYING' | 'SETTLED';
  players: { userId: string; isBot: boolean; username?: string }[];
  turn?: string; // userId whose turn it is
  round: number;
  maxRounds: number;
  pot: number;
  roundHistory: {
    round: number;
    winnerId?: string;
    bets: { userId: string; amount: number }[];
    metadata?: any;
  }[];
  metadata: any; // Game-specific state (e.g., dice result, board position)
  winner?: {
    winnerId: string;
    payout: number;
    metadata?: any;
  };
  updatedAt: number;
}
