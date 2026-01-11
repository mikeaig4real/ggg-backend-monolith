import {
  GameEngineInterface,
  GameConfig,
  MoveDto,
  WinnerResult,
  GameStateDto,
} from '@app/common/game-shared';
import { Logger } from '@nestjs/common';

export class DiceEngine implements GameEngineInterface {
  private logger = new Logger(DiceEngine.name);

  private generateTargetNumber(state?: GameStateDto): number {
    this.logger.log(
      `[DiceEngine] Generating Target Number: ${JSON.stringify(state)}`,
    );
    // Generate number between 2 and 12
    return Math.floor(Math.random() * 11) + 2;
  }

  startGame(config: GameConfig, state?: GameStateDto): GameStateDto {
    this.logger.log(`[DiceEngine] Starting Game: ${JSON.stringify(state)}`);

    let currentTurnIndex = 0;
    if (state?.turn && state.players) {
      const idx = state.players.findIndex((p) => p.userId === state.turn);
      if (idx !== -1) currentTurnIndex = idx;
    }

    return {
      ...state,
      metadata: {
        ...(state?.metadata || {}),
        dice: {}, // userId -> number
        currentTurnIndex,
        // targetNumber: this.generateTargetNumber(state), // Use config now
      },
    } as any;
  }

  processMove(currentState: GameStateDto, move: MoveDto): GameStateDto {
    this.logger.log(`[DiceEngine] Processing Move: ${JSON.stringify(move)}`);
    const { userId, action } = move;

    if (!currentState.metadata.dice) {
      currentState.metadata.dice = {};
    }

    const players = currentState.players;
    const turnIndex = currentState.metadata.currentTurnIndex || 0;
    const expectedPlayer = players[turnIndex];

    this.logger.log(
      `[DiceEngine] Validating Turn: ${JSON.stringify(expectedPlayer)}`,
    );
    if (expectedPlayer.userId.toString() !== userId.toString()) {
      this.logger.log(
        `[DiceEngine] Not Your Turn: ${JSON.stringify(expectedPlayer)}`,
      );
      throw new Error('Not your turn');
    }

    this.logger.log(`[DiceEngine] Validating Action: ${action}`);
    if (action === 'roll') {
      this.logger.log('[DiceEngine] Rolling Dice');

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;

      // Store sum
      this.logger.log(
        `[DiceEngine] Rolling Dice: ${JSON.stringify({ d1, d2, total })}`,
      );
      currentState.metadata.dice[userId] = total;

      const nextTurnIndex = (turnIndex + 1) % players.length;
      currentState.metadata.currentTurnIndex = nextTurnIndex;
      currentState.turn = players[nextTurnIndex].userId;

      this.logger.log(
        `[DiceEngine] Passed Turn to: ${currentState.turn} (Index: ${nextTurnIndex})`,
      );
    }

    this.logger.log(
      `[DiceEngine] Returning State: ${JSON.stringify(currentState)}`,
    );
    return currentState;
  }

  checkWinner(currentState: GameStateDto): WinnerResult | null {
    this.logger.log(
      `[DiceEngine] Checking Winner: ${JSON.stringify(currentState)}`,
    );
    const dice = currentState.metadata.dice;
    const players = currentState.players;

    const target =
      currentState.metadata.targetNumber ??
      currentState.metadata.config?.targetNumber;
    this.logger.log(`[DiceEngine] Value of target: ${target}`);

    if (Object.keys(dice).length < players.length) {
      this.logger.log(
        `[DiceEngine] Not all players rolled yet. Dice count: ${Object.keys(dice).length}, Players: ${players.length}`,
      );
      return null;
    }

    // Determine winner based on Target Number

    const winners = players.filter((p) => dice[p.userId] === target);
    this.logger.log(
      `[DiceEngine] Winners determined: ${JSON.stringify(winners)}`,
    );

    let winnerId = '';
    let tie = false;

    if (winners.length === 1) {
      winnerId = winners[0].userId;
    } else if (winners.length > 1) {
      tie = true;
    }

    if (tie) {
      this.logger.log(
        `[DiceEngine] Tie or No Winner. Returning null to allow Gateway to handle reset.`,
      );

      return null;
    }

    const totalPool = currentState.metadata.config.betAmount * players.length;
    this.logger.log(
      `[DiceEngine] Winner found: ${winnerId}, Payout: ${totalPool}`,
    );

    return {
      winnerId,
      payout: totalPool,
      metadata: { finalRolls: dice },
    };
  }

  resetRound(currentState: GameStateDto): GameStateDto {
    this.logger.log(
      `[DiceEngine] Resetting Round: ${JSON.stringify(currentState)}`,
    );
    currentState.metadata.dice = {};
    currentState.metadata.currentTurnIndex = 0;
    return currentState;
  }
}
