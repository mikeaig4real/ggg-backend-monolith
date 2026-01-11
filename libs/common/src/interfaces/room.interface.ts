export interface Player {
  id: string;
  username: string;
  walletBalance: number;
  email: string;
  isBot: boolean;
}

export interface Room {
  id: string;
  name: string;
  hostId: string | null;
  players: Player[];
  status: 'loading' | 'playing' | 'finished';
  phase?: 'betting' | 'rolling' | 'finished';
  currentRound?: number;
  luckyNumber?: number;
  currentPot?: number;
  roundInfo: {};
  betPlacedHistory: Record<number, { userId: string; amount: number }[]>;
  roundInfoHistory: Record<number, { totalPot: number; best: any }>;
  dice: number[];
  currentTurn: string | null;
  // Add other game state fields as needed
}
