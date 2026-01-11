import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  DepositDto,
  WithdrawDto,
  LockFundsDto,
  SettleFundsDto,
  Roles,
  AccountType,
  CurrentUser,
  type CurrentUserPayload,
} from '@app/common';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);
  constructor(private readonly walletService: WalletService) {}

  @Post('deposit')
  @UseGuards(JwtAuthGuard)
  async deposit(
    @Body() data: DepositDto & { userId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: deposit user=${user._id} amount=${data.amount}`,
    );
    return this.walletService.deposit(data.userId, data.amount);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  async withdraw(
    @Body() data: WithdrawDto & { userId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: withdraw user=${user._id} amount=${data.amount}`,
    );
    return this.walletService.withdraw(data.userId, data.amount);
  }

  @Get('balance/:userId')
  @UseGuards(JwtAuthGuard)
  async getBalance(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: getBalance user=${user._id} target=${userId}`,
    );
    return this.walletService.getBalance(userId);
  }

  @Get('transactions/:userId')
  @UseGuards(JwtAuthGuard)
  async getTransactions(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: getTransactions user=${user._id} target=${userId}`,
    );
    return this.walletService.getTransactions(userId);
  }

  @Get('escrows/:userId')
  @UseGuards(JwtAuthGuard)
  async getEscrows(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: getEscrows user=${user._id} target=${userId}`,
    );
    return this.walletService.getEscrows(userId);
  }

  @Get('transaction/:id')
  @UseGuards(JwtAuthGuard)
  async getTransaction(@Param('id') id: string) {
    this.logger.log(`Hit endpoint: getTransaction id=${id}`);
    return this.walletService.getTransactionById(id);
  }

  @Get('escrow/:id')
  @UseGuards(JwtAuthGuard)
  async getEscrow(@Param('id') id: string) {
    this.logger.log(`Hit endpoint: getEscrow id=${id}`);
    return this.walletService.getEscrowById(id);
  }

  @Post('lock')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async lockFunds(
    @Body() data: LockFundsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: lockFunds admin=${user._id} target=${data.userId} amount=${data.amount}`,
    );
    const matchId = data.matchId || data.gameId;
    await this.walletService.lockFunds(data.userId, data.amount, matchId);
    return { status: 'success', matchId, userId: data.userId };
  }

  @Post('settle')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async settleFunds(
    @Body() data: SettleFundsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: settleFunds admin=${user._id} winner=${data.winnerId} matchId=${data.matchId}`,
    );
    await this.walletService.releaseFunds(
      data.winnerId,
      data.totalPool,
      data.matchId,
    );
    return { status: 'success' };
  }

  @Post('revert')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async revertGame(
    @Body() data: { gameId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: revertGame admin=${user._id} gameId=${data.gameId}`,
    );
    return this.walletService.revertGame(data.gameId);
  }

  @Get('health')
  async healthCheck() {
    this.logger.log(`Hit endpoint: WalletController.healthCheck`);
    return { status: 'ok', service: 'wallet-module' };
  }
}
