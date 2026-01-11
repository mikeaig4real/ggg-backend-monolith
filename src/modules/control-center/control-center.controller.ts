import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Patch as PatchMethod,
} from '@nestjs/common';
import { ControlCenterService } from './control-center.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { AccountType, Roles } from '@app/common';

@Controller('admin/control-center')
@UseGuards(JwtAuthGuard)
@Roles(AccountType.ADMIN)
export class ControlCenterController {
  constructor(private readonly controlCenterService: ControlCenterService) {}

  @Get(':domain')
  async getDomainConfig(@Param('domain') domain: string) {
    return this.controlCenterService.getDomainConfig(domain);
  }

  @Patch(':domain/defaults')
  async setDefaultProvider(
    @Param('domain') domain: string,
    @Body() body: { provider: string },
  ) {
    return this.controlCenterService.setDefaultProvider(domain, body.provider);
  }

  @Patch(':domain/toggle')
  async toggleProvider(
    @Param('domain') domain: string,
    @Body() body: { provider: string; enabled: boolean },
  ) {
    return this.controlCenterService.toggleProvider(
      domain,
      body.provider,
      body.enabled,
    );
  }
}
