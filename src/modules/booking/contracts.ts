export type BookingLanguage = "id" | "en";
export type DisplayCurrency = "IDR" | "USD" | "AUD";
export type ReservationSource = "ONLINE" | "ADMIN_MANUAL";

export interface RoomSelection {
  roomTypeId: string;
  ratePlanCode?: string;
  adults: number;
  children: number;
  infants: number;
  extraBedQuantity: number;
}

export interface SearchRequest {
  checkInDate: string;
  checkoutDate: string;
  rooms: number;
  adults: number;
  children: number;
  infants: number;
}

export interface QuoteRequest {
  checkInDate: string;
  checkoutDate: string;
  ratePlanCode: string;
  language: BookingLanguage;
  displayCurrency: DisplayCurrency;
  rooms: RoomSelection[];
}

export interface BookerInput {
  name: string;
  email: string;
  phone?: string | null;
}

export interface CreateReservationRequest {
  quoteId: string;
  source: ReservationSource;
  booker: BookerInput;
  internalNotes?: string | null;
  paymentMode?:
    | "FULL"
    | "FIXED_DEPOSIT"
    | "PERCENTAGE_DEPOSIT"
    | "PAY_AT_CHECKIN"
    | "PAY_AT_CHECKOUT";
  depositValue?: number | null;
  acknowledgedPolicyVersionIds: string[];
}

export interface StaffSessionLike {
  user: { id: string };
}
