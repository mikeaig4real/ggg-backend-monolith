import { PartialType } from '@nestjs/swagger';
import { CreateFundingPackageDto } from './create-funding-package.dto';

export class UpdateFundingPackageDto extends PartialType(
  CreateFundingPackageDto,
) {}
