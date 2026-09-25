export type AvailabilityKind = "pickup" | "delivery" | "both";

export type AvailabilitySlotView = {
  id: string;
  dateIso: string;
  dateKey: string;
  kind: AvailabilityKind;
  label: string;
  start: string;
  end: string;
  capacity: number;
  booked: number;
  active: boolean;
};
