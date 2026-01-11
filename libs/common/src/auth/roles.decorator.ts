import { SetMetadata } from '@nestjs/common';
import { AccountType, AdminPermissions } from '../enums';

export const Roles = (...roles: AccountType[]) => SetMetadata('role', roles);
export const Permissions = (...permissions: AdminPermissions[]) =>
  SetMetadata('permission', permissions);
