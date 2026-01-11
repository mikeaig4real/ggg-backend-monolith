export interface WebhookEvent {
  event: string; // e.g., 'charge.success', 'transfer.success'
  data: any;
}
