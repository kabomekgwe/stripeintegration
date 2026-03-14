export interface CreatePromoCodeDto {
  code: string;
  name: string;
  description?: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: 'forever' | 'once' | 'repeating';
  durationInMonths?: number;
  maxRedemptions?: number;
  redeemBy?: Date;
  appliesToProducts?: string[];
}
