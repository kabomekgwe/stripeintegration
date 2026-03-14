export interface CreateTransferDto {
  amount: number;
  currency: string;
  destinationAccountId: string;
  description?: string;
}
