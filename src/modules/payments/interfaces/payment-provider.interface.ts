import {
  InitializeDepositDto,
  PaymentInitializationResponse,
  PaymentVerificationResponse,
} from '../dto/initialize-deposit.dto';
import {
  CreateTransferRecipientDto,
  InitiateTransferDto,
  TransferRecipientResponse,
  TransferResponse,
} from '../dto/transfer.dto';
import { CreatePlanDto, PlanResponse } from '../dto/create-plan.dto';

export interface IPaymentProvider {
  /**
   * Returns the provider name (e.g., 'stripe', 'paystack')
   */
  getName(): string;

  /**
   * Initializes a payment (deposit) and returns the authorization URL for the user.
   */
  initializePayment(
    dto: InitializeDepositDto,
  ): Promise<PaymentInitializationResponse>;

  /**
   * Verifies a payment transaction using its reference.
   */
  verifyPayment(reference: string): Promise<PaymentVerificationResponse>;

  /**
   * Creates a recipient for fund transfers.
   */
  createTransferRecipient(
    dto: CreateTransferRecipientDto,
  ): Promise<TransferRecipientResponse>;

  /**
   * Initiates a transfer to a recipient.
   */
  initiateTransfer(dto: InitiateTransferDto): Promise<TransferResponse>;

  /**
   * Creates a subscription plan.
   */
  createPlan(dto: CreatePlanDto): Promise<PlanResponse>;

  /**
   * Verifies the webhook signature.
   * @param signature The signature header value
   * @param payload The raw body payload
   * @param secret The webhook secret
   */
  verifyWebhookSignature(
    signature: string,
    payload: any,
    secret: string,
  ): boolean;

  /**
   * Handles a webhook event from the provider.
   * @param event The event payload
   */
  handleWebhookEvent(event: any): Promise<void>;
}
