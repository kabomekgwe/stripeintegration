import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExchangeRateService } from './exchange-rate.service';

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  stripeCode: string;
  minAmount: number; // in cents
  maxAmount: number; // in cents
  supportedPaymentMethods: string[];
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly exchangeRates: Map<string, number> = new Map();
  private lastRateUpdate: Date | null = null;
  private isInitialized = false;

  // All currencies supported by Stripe FX Quotes API (170+ currencies)
  // Source: https://docs.stripe.com/payouts/cross-border-payouts/supported-currencies
  private readonly currencies: Map<string, CurrencyConfig> = new Map([
    // A currencies
    ['aed', { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', stripeCode: 'aed', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['afn', { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', stripeCode: 'afn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['all', { code: 'ALL', name: 'Albanian Lek', symbol: 'L', stripeCode: 'all', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['amd', { code: 'AMD', name: 'Armenian Dram', symbol: '֏', stripeCode: 'amd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ang', { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', stripeCode: 'ang', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['aoa', { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', stripeCode: 'aoa', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ars', { code: 'ARS', name: 'Argentine Peso', symbol: '$', stripeCode: 'ars', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['aud', { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', stripeCode: 'aud', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['awg', { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', stripeCode: 'awg', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['azn', { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', stripeCode: 'azn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // B currencies
    ['bam', { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', stripeCode: 'bam', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bbd', { code: 'BBD', name: 'Barbadian Dollar', symbol: '$', stripeCode: 'bbd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bdt', { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', stripeCode: 'bdt', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bgn', { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', stripeCode: 'bgn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bhd', { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', stripeCode: 'bhd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bif', { code: 'BIF', name: 'Burundian Franc', symbol: 'Fr', stripeCode: 'bif', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bmd', { code: 'BMD', name: 'Bermudian Dollar', symbol: '$', stripeCode: 'bmd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bnd', { code: 'BND', name: 'Brunei Dollar', symbol: '$', stripeCode: 'bnd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bob', { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.', stripeCode: 'bob', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['brl', { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', stripeCode: 'brl', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['bsd', { code: 'BSD', name: 'Bahamian Dollar', symbol: '$', stripeCode: 'bsd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['btn', { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.', stripeCode: 'btn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bwp', { code: 'BWP', name: 'Botswana Pula', symbol: 'P', stripeCode: 'bwp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['byn', { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', stripeCode: 'byn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['bzd', { code: 'BZD', name: 'Belize Dollar', symbol: '$', stripeCode: 'bzd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // C currencies
    ['cad', { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', stripeCode: 'cad', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['cdf', { code: 'CDF', name: 'Congolese Franc', symbol: 'Fr', stripeCode: 'cdf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['chf', { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', stripeCode: 'chf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['clp', { code: 'CLP', name: 'Chilean Peso', symbol: '$', stripeCode: 'clp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['cny', { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', stripeCode: 'cny', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['cop', { code: 'COP', name: 'Colombian Peso', symbol: '$', stripeCode: 'cop', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['crc', { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', stripeCode: 'crc', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['cup', { code: 'CUP', name: 'Cuban Peso', symbol: '$', stripeCode: 'cup', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['cve', { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', stripeCode: 'cve', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['czk', { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', stripeCode: 'czk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // D currencies
    ['dkk', { code: 'DKK', name: 'Danish Krone', symbol: 'kr', stripeCode: 'dkk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['djf', { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fr', stripeCode: 'djf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['dop', { code: 'DOP', name: 'Dominican Peso', symbol: '$', stripeCode: 'dop', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['dzd', { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', stripeCode: 'dzd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // E currencies
    ['egp', { code: 'EGP', name: 'Egyptian Pound', symbol: '£', stripeCode: 'egp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ern', { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', stripeCode: 'ern', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['etb', { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', stripeCode: 'etb', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['eur', { code: 'EUR', name: 'Euro', symbol: '€', stripeCode: 'eur', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'sepa_debit', 'link'] }],
    // F currencies
    ['fjd', { code: 'FJD', name: 'Fijian Dollar', symbol: '$', stripeCode: 'fjd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['fkp', { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£', stripeCode: 'fkp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // G currencies
    ['gbp', { code: 'GBP', name: 'British Pound', symbol: '£', stripeCode: 'gbp', minAmount: 30, maxAmount: 99999999, supportedPaymentMethods: ['card', 'bacs_debit', 'link'] }],
    ['gel', { code: 'GEL', name: 'Georgian Lari', symbol: '₾', stripeCode: 'gel', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ghs', { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', stripeCode: 'ghs', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['gip', { code: 'GIP', name: 'Gibraltar Pound', symbol: '£', stripeCode: 'gip', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['gmd', { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', stripeCode: 'gmd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['gnf', { code: 'GNF', name: 'Guinean Franc', symbol: 'Fr', stripeCode: 'gnf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['gtq', { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', stripeCode: 'gtq', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['gyd', { code: 'GYD', name: 'Guyanese Dollar', symbol: '$', stripeCode: 'gyd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // H currencies
    ['hkd', { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$', stripeCode: 'hkd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['hnl', { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', stripeCode: 'hnl', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['hrk', { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', stripeCode: 'hrk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['htg', { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', stripeCode: 'htg', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['huf', { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', stripeCode: 'huf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // I currencies
    ['idr', { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', stripeCode: 'idr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ils', { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', stripeCode: 'ils', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['inr', { code: 'INR', name: 'Indian Rupee', symbol: '₹', stripeCode: 'inr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['iqd', { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د', stripeCode: 'iqd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['irr', { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', stripeCode: 'irr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['isk', { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', stripeCode: 'isk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // J currencies
    ['jmd', { code: 'JMD', name: 'Jamaican Dollar', symbol: '$', stripeCode: 'jmd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['jod', { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', stripeCode: 'jod', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['jpy', { code: 'JPY', name: 'Japanese Yen', symbol: '¥', stripeCode: 'jpy', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    // K currencies
    ['kes', { code: 'KES', name: 'Kenyan Shilling', symbol: 'Sh', stripeCode: 'kes', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['kgs', { code: 'KGS', name: 'Kyrgystani Som', symbol: 'с', stripeCode: 'kgs', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['khr', { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', stripeCode: 'khr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['kmf', { code: 'KMF', name: 'Comorian Franc', symbol: 'Fr', stripeCode: 'kmf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['kpw', { code: 'KPW', name: 'North Korean Won', symbol: '₩', stripeCode: 'kpw', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['krw', { code: 'KRW', name: 'South Korean Won', symbol: '₩', stripeCode: 'krw', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['kwd', { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', stripeCode: 'kwd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['kyd', { code: 'KYD', name: 'Cayman Islands Dollar', symbol: '$', stripeCode: 'kyd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['kzt', { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', stripeCode: 'kzt', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // L currencies
    ['lak', { code: 'LAK', name: 'Laotian Kip', symbol: '₭', stripeCode: 'lak', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['lbp', { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', stripeCode: 'lbp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['lkr', { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', stripeCode: 'lkr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['lrd', { code: 'LRD', name: 'Liberian Dollar', symbol: '$', stripeCode: 'lrd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['lsl', { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', stripeCode: 'lsl', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['lyd', { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د', stripeCode: 'lyd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // M currencies
    ['mad', { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', stripeCode: 'mad', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mdl', { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', stripeCode: 'mdl', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mga', { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', stripeCode: 'mga', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mkd', { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', stripeCode: 'mkd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mmk', { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', stripeCode: 'mmk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mnt', { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', stripeCode: 'mnt', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mop', { code: 'MOP', name: 'Macanese Pataca', symbol: 'P', stripeCode: 'mop', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mru', { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', stripeCode: 'mru', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mur', { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', stripeCode: 'mur', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mvr', { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: '.ރ', stripeCode: 'mvr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mwk', { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', stripeCode: 'mwk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['mxn', { code: 'MXN', name: 'Mexican Peso', symbol: '$', stripeCode: 'mxn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['myr', { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', stripeCode: 'myr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['mzn', { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', stripeCode: 'mzn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // N currencies
    ['nad', { code: 'NAD', name: 'Namibian Dollar', symbol: '$', stripeCode: 'nad', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ngn', { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', stripeCode: 'ngn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['nio', { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', stripeCode: 'nio', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['nok', { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', stripeCode: 'nok', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['npr', { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', stripeCode: 'npr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['nzd', { code: 'NZD', name: 'New Zealand Dollar', symbol: '$', stripeCode: 'nzd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    // O currencies
    ['omr', { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', stripeCode: 'omr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // P currencies
    ['pab', { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', stripeCode: 'pab', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['pen', { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', stripeCode: 'pen', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['pgk', { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', stripeCode: 'pgk', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['php', { code: 'PHP', name: 'Philippine Peso', symbol: '₱', stripeCode: 'php', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['pkr', { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', stripeCode: 'pkr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['pln', { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', stripeCode: 'pln', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['pyg', { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', stripeCode: 'pyg', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // Q currencies
    ['qar', { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', stripeCode: 'qar', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // R currencies
    ['ron', { code: 'RON', name: 'Romanian Leu', symbol: 'lei', stripeCode: 'ron', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['rsd', { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин.', stripeCode: 'rsd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['rub', { code: 'RUB', name: 'Russian Ruble', symbol: '₽', stripeCode: 'rub', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['rwf', { code: 'RWF', name: 'Rwandan Franc', symbol: 'Fr', stripeCode: 'rwf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // S currencies
    ['sar', { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', stripeCode: 'sar', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['sbd', { code: 'SBD', name: 'Solomon Islands Dollar', symbol: '$', stripeCode: 'sbd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['scr', { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', stripeCode: 'scr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['sdg', { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س.', stripeCode: 'sdg', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['sek', { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', stripeCode: 'sek', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['sgd', { code: 'SGD', name: 'Singapore Dollar', symbol: '$', stripeCode: 'sgd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['shp', { code: 'SHP', name: 'Saint Helena Pound', symbol: '£', stripeCode: 'shp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['sle', { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le', stripeCode: 'sle', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['sll', { code: 'SLL', name: 'Sierra Leonean Leone (Old)', symbol: 'Le', stripeCode: 'sll', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['sos', { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', stripeCode: 'sos', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['srd', { code: 'SRD', name: 'Surinamese Dollar', symbol: '$', stripeCode: 'srd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ssp', { code: 'SSP', name: 'South Sudanese Pound', symbol: '£', stripeCode: 'ssp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['stn', { code: 'STN', name: 'São Tomé and Príncipe Dobra', symbol: 'Db', stripeCode: 'stn', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['syp', { code: 'SYP', name: 'Syrian Pound', symbol: '£', stripeCode: 'syp', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['szl', { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'L', stripeCode: 'szl', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // T currencies
    ['thb', { code: 'THB', name: 'Thai Baht', symbol: '฿', stripeCode: 'thb', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['tjs', { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM', stripeCode: 'tjs', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['tmt', { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'm', stripeCode: 'tmt', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['tnd', { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', stripeCode: 'tnd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['top', { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', stripeCode: 'top', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['try', { code: 'TRY', name: 'Turkish Lira', symbol: '₺', stripeCode: 'try', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['ttd', { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: '$', stripeCode: 'ttd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['twd', { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', stripeCode: 'twd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'link'] }],
    ['tzs', { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'Sh', stripeCode: 'tzs', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // U currencies
    ['uah', { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', stripeCode: 'uah', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['ugx', { code: 'UGX', name: 'Ugandan Shilling', symbol: 'Sh', stripeCode: 'ugx', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['usd', { code: 'USD', name: 'US Dollar', symbol: '$', stripeCode: 'usd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card', 'us_bank_account', 'link'] }],
    ['uyu', { code: 'UYU', name: 'Uruguayan Peso', symbol: '$', stripeCode: 'uyu', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['uzs', { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', stripeCode: 'uzs', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // V currencies
    ['ves', { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.', stripeCode: 'ves', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['vnd', { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', stripeCode: 'vnd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['vuv', { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'Vt', stripeCode: 'vuv', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // W currencies
    ['wst', { code: 'WST', name: 'Samoan Tala', symbol: 'T', stripeCode: 'wst', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // X currencies
    ['xaf', { code: 'XAF', name: 'Central African CFA Franc', symbol: 'Fr', stripeCode: 'xaf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['xcd', { code: 'XCD', name: 'East Caribbean Dollar', symbol: '$', stripeCode: 'xcd', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['xdr', { code: 'XDR', name: 'Special Drawing Rights', symbol: 'SDR', stripeCode: 'xdr', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['xof', { code: 'XOF', name: 'West African CFA Franc', symbol: 'Fr', stripeCode: 'xof', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['xpf', { code: 'XPF', name: 'CFP Franc', symbol: 'Fr', stripeCode: 'xpf', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // Y currencies
    ['yer', { code: 'YER', name: 'Yemeni Rial', symbol: '﷼', stripeCode: 'yer', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    // Z currencies
    ['zar', { code: 'ZAR', name: 'South African Rand', symbol: 'R', stripeCode: 'zar', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['zmw', { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', stripeCode: 'zmw', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
    ['zwl', { code: 'ZWL', name: 'Zimbabwean Dollar', symbol: '$', stripeCode: 'zwl', minAmount: 50, maxAmount: 99999999, supportedPaymentMethods: ['card'] }],
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async onModuleInit() {
    await this.initializeExchangeRates();
    this.isInitialized = true;
  }

  private async initializeExchangeRates(): Promise<void> {
    this.logger.log('Initializing exchange rates...');
    
    // Try to get cached rates first
    const cachedRates = await this.exchangeRateService.getCachedRates();

    if (cachedRates) {
      this.exchangeRates.clear();
      for (const [code, rate] of Object.entries(cachedRates)) {
        this.exchangeRates.set(code.toLowerCase(), rate);
      }
      this.lastRateUpdate = new Date();
      this.logger.log('Loaded exchange rates from cache');
      return;
    }

    // Fetch fresh rates from Stripe
    const success = await this.exchangeRateService.refreshRates();

    if (success) {
      const freshRates = await this.exchangeRateService.getCachedRates();
      if (freshRates) {
        this.exchangeRates.clear();
        for (const [code, rate] of Object.entries(freshRates)) {
          this.exchangeRates.set(code.toLowerCase(), rate);
        }
        this.lastRateUpdate = new Date();
      }
    } else {
      // Fallback to static rates for major currencies
      this.logger.warn('Using fallback exchange rates');
      const fallbackRates: Record<string, number> = {
        usd: 1.0, eur: 0.85, gbp: 0.73, cad: 1.25, aud: 1.35,
        jpy: 110.0, chf: 0.92, sek: 8.5, nok: 8.8, dkk: 6.3,
        pln: 3.9, czk: 21.5, huf: 295, ron: 4.1, bgn: 1.65,
        nzd: 1.45, sgd: 1.35, hkd: 7.8, krw: 1180, inr: 74,
        brl: 5.2, mxn: 20, zar: 14.5, rub: 73, cny: 6.45,
        thb: 33, idr: 14300, myr: 4.15, php: 50, twd: 28,
        vnd: 23000, aed: 3.67, sar: 3.75, try: 8.5, egp: 15.7,
        // Add more as needed
      };
      for (const [code, rate] of Object.entries(fallbackRates)) {
        this.exchangeRates.set(code, rate);
      }
      this.lastRateUpdate = new Date();
    }
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): CurrencyConfig[] {
    return Array.from(this.currencies.values());
  }

  /**
   * Get currency configuration
   */
  getCurrency(code: string): CurrencyConfig | undefined {
    return this.currencies.get(code.toLowerCase());
  }

  /**
   * Check if currency is supported
   */
  isSupported(code: string): boolean {
    return this.currencies.has(code.toLowerCase());
  }

  /**
   * Validate amount for currency
   */
  validateAmount(amount: number, currencyCode: string): { valid: boolean; error?: string } {
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      return { valid: false, error: `Currency ${currencyCode} is not supported` };
    }

    if (amount < currency.minAmount) {
      return { 
        valid: false, 
        error: `Amount must be at least ${currency.symbol}${(currency.minAmount / 100).toFixed(2)} ${currency.code}` 
      };
    }

    if (amount > currency.maxAmount) {
      return { 
        valid: false, 
        error: `Amount cannot exceed ${currency.symbol}${(currency.maxAmount / 100).toFixed(2)} ${currency.code}` 
      };
    }

    return { valid: true };
  }

  /**
   * Ensure exchange rates are loaded before converting
   */
  private async ensureRatesLoaded(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Rates not initialized yet, waiting...');
      // Wait up to 5 seconds for initialization
      for (let i = 0; i < 50; i++) {
        if (this.isInitialized) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // If still no rates, try to initialize again
    if (this.exchangeRates.size === 0) {
      this.logger.warn('No rates available, attempting to fetch...');
      await this.initializeExchangeRates();
    }
  }

  /**
   * Convert amount between currencies
   */
  async convert(amount: number, from: string, to: string): Promise<number> {
    await this.ensureRatesLoaded();
    if (from.toLowerCase() === to.toLowerCase()) {
      return amount;
    }

    const fromRate = this.exchangeRates.get(from.toLowerCase());
    const toRate = this.exchangeRates.get(to.toLowerCase());

    if (!fromRate || !toRate) {
      throw new Error(`Exchange rate not available for ${from} or ${to}`);
    }

    // Convert to USD first, then to target currency
    const amountInUSD = amount / fromRate;
    const convertedAmount = amountInUSD * toRate;

    // Round based on currency (JPY has no decimals)
    if (to.toLowerCase() === 'jpy') {
      return Math.round(convertedAmount);
    }

    return Math.round(convertedAmount);
  }

  /**
   * Get exchange rate
   */
  async getExchangeRate(from: string, to: string): Promise<number> {
    await this.ensureRatesLoaded();
    if (from.toLowerCase() === to.toLowerCase()) {
      return 1;
    }

    const fromRate = this.exchangeRates.get(from.toLowerCase());
    const toRate = this.exchangeRates.get(to.toLowerCase());

    if (!fromRate || !toRate) {
      throw new Error(`Exchange rate not available`);
    }

    return toRate / fromRate;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currencyCode: string): string {
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      return `${amount} ${currencyCode.toUpperCase()}`;
    }

    // JPY has no decimal places
    if (currencyCode.toLowerCase() === 'jpy') {
      return `${currency.symbol}${amount} ${currency.code}`;
    }

    return `${currency.symbol}${(amount / 100).toFixed(2)} ${currency.code}`;
  }

  /**
   * Get supported payment methods for currency
   */
  getSupportedPaymentMethods(currencyCode: string): string[] {
    const currency = this.getCurrency(currencyCode);
    return currency?.supportedPaymentMethods || ['card'];
  }

  /**
   * Get default currency
   */
  getDefaultCurrency(): string {
    return this.configService.get<string>('DEFAULT_CURRENCY') || 'usd';
  }

  /**
   * Get currency from country code (ISO 3166-1 alpha-2)
   * Maps all countries to their official currencies
   */
  getCurrencyFromCountry(countryCode: string): string {
    const countryToCurrency: Record<string, string> = {
      // A countries
      AF: 'afn', AL: 'all', DZ: 'dzd', AS: 'usd', AD: 'eur', AO: 'aoa',
      AI: 'xcd', AQ: 'usd', AG: 'xcd', AR: 'ars', AM: 'amd', AW: 'awg',
      AU: 'aud', AT: 'eur', AZ: 'azn',
      // B countries
      BS: 'bsd', BH: 'bhd', BD: 'bdt', BB: 'bbd', BY: 'byn', BE: 'eur',
      BZ: 'bzd', BJ: 'xof', BM: 'bmd', BT: 'btn', BO: 'bob', BA: 'bam',
      BW: 'bwp', BV: 'nok', BR: 'brl', IO: 'usd', BN: 'bnd', BG: 'bgn',
      BF: 'xof', BI: 'bif',
      // C countries
      CV: 'cve', KH: 'khr', CM: 'xaf', CA: 'cad', KY: 'kyd', CF: 'xaf',
      TD: 'xaf', CL: 'clp', CN: 'cny', CX: 'aud', CC: 'aud', CO: 'cop',
      KM: 'kmf', CG: 'xaf', CD: 'cdf', CK: 'nzd', CR: 'crc', CI: 'xof',
      HR: 'eur', CU: 'cup', CY: 'eur', CZ: 'czk',
      // D countries
      DK: 'dkk', DJ: 'djf', DM: 'xcd', DO: 'dop',
      // E countries
      EC: 'usd', EG: 'egp', SV: 'usd', GQ: 'xaf', ER: 'ern', EE: 'eur',
      ET: 'etb',
      // F countries
      FK: 'fkp', FO: 'dkk', FJ: 'fjd', FI: 'eur', FR: 'eur', GF: 'eur',
      PF: 'xpf', TF: 'eur',
      // G countries
      GA: 'xaf', GM: 'gmd', GE: 'gel', DE: 'eur', GH: 'ghs', GI: 'gip',
      GR: 'eur', GL: 'dkk', GD: 'xcd', GP: 'eur', GU: 'usd', GT: 'gtq',
      GG: 'gbp', GN: 'gnf', GW: 'xof', GY: 'gyd',
      // H countries
      HT: 'htg', HM: 'aud', VA: 'eur', HN: 'hnl', HK: 'hkd', HU: 'huf',
      // I countries
      IS: 'isk', IN: 'inr', ID: 'idr', IR: 'irr', IQ: 'iqd', IE: 'eur',
      IM: 'gbp', IL: 'ils', IT: 'eur',
      // J countries
      JM: 'jmd', JP: 'jpy', JE: 'gbp', JO: 'jod',
      // K countries
      KZ: 'kzt', KE: 'kes', KI: 'aud', KP: 'kpw', KR: 'krw', KW: 'kwd',
      KG: 'kgs',
      // L countries
      LA: 'lak', LV: 'eur', LB: 'lbp', LS: 'lsl', LR: 'lrd', LY: 'lyd',
      LI: 'chf', LT: 'eur', LU: 'eur',
      // M countries
      MO: 'mop', MG: 'mga', MW: 'mwk', MY: 'myr', MV: 'mvr', ML: 'xof',
      MT: 'eur', MH: 'usd', MQ: 'eur', MR: 'mru', MU: 'mur', YT: 'eur',
      MX: 'mxn', FM: 'usd', MD: 'mdl', MC: 'eur', MN: 'mnt', ME: 'eur',
      MS: 'xcd', MA: 'mad', MZ: 'mzn', MM: 'mmk',
      // N countries
      NA: 'nad', NR: 'aud', NP: 'npr', NL: 'eur', NC: 'xpf', NZ: 'nzd',
      NI: 'nio', NE: 'xof', NG: 'ngn', NU: 'nzd', NF: 'aud', MK: 'mkd',
      MP: 'usd', NO: 'nok',
      // O countries
      OM: 'omr',
      // P countries
      PK: 'pkr', PW: 'usd', PS: 'ils', PA: 'pab', PG: 'pgk', PY: 'pyg',
      PE: 'pen', PH: 'php', PN: 'nzd', PL: 'pln', PT: 'eur', PR: 'usd',
      // Q countries
      QA: 'qar',
      // R countries
      RE: 'eur', RO: 'ron', RU: 'rub', RW: 'rwf',
      // S countries
      BL: 'eur', SH: 'shp', KN: 'xcd', LC: 'xcd', MF: 'eur', PM: 'eur',
      VC: 'xcd', WS: 'wst', SM: 'eur', ST: 'stn', SA: 'sar', SN: 'xof',
      RS: 'rsd', SC: 'scr', SL: 'sle', SG: 'sgd', SX: 'ang', SK: 'eur',
      SI: 'eur', SB: 'sbd', SO: 'sos', ZA: 'zar', GS: 'gbp', SS: 'ssp',
      ES: 'eur', LK: 'lkr', SD: 'sdg', SR: 'srd', SJ: 'nok', SE: 'sek',
      CH: 'chf', SY: 'syp',
      // T countries
      TW: 'twd', TJ: 'tjs', TZ: 'tzs', TH: 'thb', TL: 'usd', TG: 'xof',
      TK: 'nzd', TO: 'top', TT: 'ttd', TN: 'tnd', TR: 'try', TM: 'tmt',
      TC: 'usd', TV: 'aud',
      // U countries
      UG: 'ugx', UA: 'uah', AE: 'aed', GB: 'gbp', US: 'usd', UM: 'usd',
      UY: 'uyu', UZ: 'uzs',
      // V countries
      VU: 'vuv', VE: 'ves', VN: 'vnd', VG: 'usd', VI: 'usd',
      // W countries
      WF: 'xpf', EH: 'mad',
      // Y countries
      YE: 'yer',
      // Z countries
      ZM: 'zmw', ZW: 'zwl',
    };

    return countryToCurrency[countryCode.toUpperCase()] || 'usd';
  }

  /**
   * Suggest currency based on user country
   */
  suggestCurrencyForUser(countryCode?: string): { currency: string; source: string } {
    if (!countryCode) {
      return { currency: 'usd', source: 'default' };
    }

    const currency = this.getCurrencyFromCountry(countryCode);
    const isSupported = this.isSupported(currency);
    
    if (isSupported) {
      return { currency, source: 'country' };
    }
    
    // If currency not supported, fallback to USD
    return { currency: 'usd', source: 'default' };
  }

  /**
   * Get last rate update time
   */
  getLastRateUpdate(): Date | null {
    return this.lastRateUpdate;
  }
}
