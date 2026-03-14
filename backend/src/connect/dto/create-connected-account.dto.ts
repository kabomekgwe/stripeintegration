export interface CreateConnectedAccountDto {
  email: string;
  country: string;
  businessType?: 'individual' | 'company';
  individual?: {
    firstName: string;
    lastName: string;
    dob: { day: number; month: number; year: number };
    address: {
      line1: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
  company?: {
    name: string;
    taxId?: string;
    address: {
      line1: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
}
