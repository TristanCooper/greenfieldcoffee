import type { EuOperatorType } from './enums';
import type { BaseEntity, IsoCountryCode, IsoCurrencyCode, TenantScoped } from './common';

export interface Tenant extends BaseEntity {
  name: string;
  countryCode: IsoCountryCode;
  vatNumber: string | null;
  eoriNumber: string | null;
  euOperatorType: EuOperatorType | null;
  euOperatorEoriOrVat: string | null;
  defaultCurrency: IsoCurrencyCode;
}

export interface User extends TenantScoped {
  email: string;
  fullName: string;
  role: 'owner' | 'roaster' | 'sales' | 'auditor';
  status: 'invited' | 'active' | 'disabled';
  lastLoginAt: string | null;
}