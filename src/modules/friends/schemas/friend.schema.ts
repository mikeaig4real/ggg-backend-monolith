import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FriendDocument = Friend & Document;

@Schema({ collection: 'friends', timestamps: true })
export class Friend {
  @Prop({ required: true, index: true })
  ownerId: string; // The user who "owns" this record

  @Prop({ required: true, index: true })
  friendId: string; // The other person in the relationship

  @Prop({ required: true, enum: ['following', 'follower'] })
  type: 'following' | 'follower';

  @Prop({ default: 1 })
  followRound: number; // 1 = Single direction, 2 = Mutual

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const FriendSchema = SchemaFactory.createForClass(Friend);
// Compound index to ensure uniqueness of relationship per user
FriendSchema.index({ ownerId: 1, friendId: 1 }, { unique: true });
