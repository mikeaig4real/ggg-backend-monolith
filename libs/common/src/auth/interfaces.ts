import { Types } from 'mongoose';
import { AccountType } from '../enums';

export interface CurrentUserPayload {
  _id: Types.ObjectId;
  email: string;
  username: string;
  role: AccountType;
  isBot: boolean;
  phoneNumber?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
