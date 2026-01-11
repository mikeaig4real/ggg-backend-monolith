import { GameStateDto } from '../dto/game-state.dto';

export interface GameConfig {
  betAmount: number;
  [key: string]: any;
}

export interface MoveDto {
  userId: string;
  action: string;
  payload?: any;
}

export interface WinnerResult {
  winnerId: string;
  payout: number;
  metadata?: any;
}

export interface GameEngineInterface {
  startGame(config: GameConfig, state?: GameStateDto): GameStateDto;
  processMove(currentState: GameStateDto, move: MoveDto): GameStateDto;
  checkWinner(currentState: GameStateDto): WinnerResult | null;
}
