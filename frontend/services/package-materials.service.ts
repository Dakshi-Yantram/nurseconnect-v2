/**
 * Staging feature: grouped care-package catalogue (dropdowns) + the materials
 * checklist the patient confirms twice (booking + payment).
 *
 * Backend: app/api/v1/package_materials.py, behind FEATURE_PACKAGE_MATERIALS.
 * When the flag is off (production today) every endpoint answers 404 — the
 * helpers below turn that into "feature unavailable" so the app falls back to
 * the old flat list and the old booking/payment flow with no error shown.
 */
import { api } from '../lib/api';

export interface GroupedOption {
  id: string;
  package_code: string;
  name: string;
  description: string | null;
  included_scope: string | null;
  scope_boundary: string | null;
  material_option: string | null;
  dropdown_option: string | null;
  dropdown_note: string | null;
  package_price: string | null;
  per_visit_price: string | null;
  material_included: boolean;
  requires_prescription: boolean;
  materials_count: number;
  has_materials: boolean;
}

export interface PackageGroup {
  type: 'dropdown' | 'single';
  heading: string;
  category: string | null;
  options: GroupedOption[];
}

export interface PackageMaterial {
  id: string;
  name: string;
  image_url: string | null;
  quantity: number;
  unit: string | null;
  price: string;
  notes: string | null;
  sort_order: number;
}

export type MaterialStage = 'booking' | 'payment';

export interface BookingMaterials {
  booking_id: string;
  package_id: string | null;
  materials: PackageMaterial[];
  acks: Record<MaterialStage, { items: any[]; at: string | null } | null>;
  ready_for_payment: boolean;
}

const isNotFound = (e: any) => e?.status === 404;

export const packageMaterialsService = {
  /** null => feature off on this backend (use the old flat list). */
  async listGrouped(): Promise<PackageGroup[] | null> {
    try {
      return await api.get<PackageGroup[]>('/care-packages-grouped');
    } catch (e: any) {
      if (isNotFound(e)) return null;
      throw e;
    }
  },

  /** [] => no checklist for this package (or feature off). */
  async listForPackage(packageId: string): Promise<PackageMaterial[]> {
    try {
      return await api.get<PackageMaterial[]>(`/care-packages/${packageId}/materials`);
    } catch (e: any) {
      if (isNotFound(e)) return [];
      throw e;
    }
  },

  /** null => feature off. */
  async getForBooking(bookingId: string): Promise<BookingMaterials | null> {
    try {
      return await api.get<BookingMaterials>(`/bookings/${bookingId}/materials`);
    } catch (e: any) {
      if (isNotFound(e)) return null;
      throw e;
    }
  },

  ack(bookingId: string, stage: MaterialStage, checked: Record<string, boolean>) {
    return api.post(`/bookings/${bookingId}/materials/ack`, {
      stage,
      items: Object.entries(checked).map(([material_id, c]) => ({ material_id, checked: !!c })),
    });
  },
};
