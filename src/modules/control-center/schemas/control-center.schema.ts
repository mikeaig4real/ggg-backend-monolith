import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ControlCenterDocument = ControlCenter & Document;

@Schema()
export class ProviderState {
  @Prop({ required: true, default: false })
  enabled: boolean;

  @Prop({ required: true, default: false })
  isDefault: boolean;

  @Prop({ required: false })
  lastCheck?: Date;

  @Prop({
    required: true,
    enum: ['active', 'error', 'missing_config'],
    default: 'active',
  })
  status: string;
}

export const ProviderStateSchema = SchemaFactory.createForClass(ProviderState);

@Schema({ timestamps: true, collection: 'conf_control_centers' })
export class ControlCenter {
  @Prop({ required: true, unique: true, index: true })
  domain: string; // e.g. 'notifications', 'payments', 'buckets'

  @Prop({ type: Map, of: ProviderStateSchema })
  providerStates: Map<string, ProviderState>;
}

export const ControlCenterSchema = SchemaFactory.createForClass(ControlCenter);
