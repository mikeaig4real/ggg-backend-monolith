import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class FundingPackage extends Document {
  @Prop({ required: true, unique: true })
  amount: number;

  @Prop({ required: true })
  label: string; // e.g., "Bronze" or "$50"

  @Prop({ default: true })
  isActive: boolean;
}

export const FundingPackageSchema =
  SchemaFactory.createForClass(FundingPackage);
