import { api } from '../lib/api';

export interface ConsumerProfileOut {
  id: string;
  user_id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export interface PatientCreatePayload {
  full_name: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';

  relationship_to_consumer: string;

  medical_conditions?: string[];

  current_medications?: {
    name: string;
  }[];

  allergies?: string[];

  blood_group?: string;
  abha_id?: string;
}

export interface PatientOut extends PatientCreatePayload {
  id: string;
  consumer_id: string;
  created_at: string;
}

export interface FamilyMemberCreatePayload {
  full_name: string;
  relationship: string;

  phone_e164: string;

  can_receive_updates?: boolean;

  can_book?: boolean;
}

export interface FamilyMemberOut extends FamilyMemberCreatePayload {
  id: string;
  consumer_id: string;
  created_at: string;
}

export const usersService = {
  me: () => api.get<ConsumerProfileOut>('/consumers/me'),
  updateMe: (patch: Partial<ConsumerProfileOut>) =>
    api.put<ConsumerProfileOut>('/consumers/me', patch),
  listPatients: () => api.get<PatientOut[]>('/patients'),
	createPatient: (p: any) =>
  api.post<PatientOut>('/patients', {
    ...p,

    relationship_to_consumer:
      p.relationship_to_consumer || p.relationship,

    medical_conditions:
      typeof p.medical_history === 'string'
        ? p.medical_history
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : p.medical_conditions || [],

    current_medications:
      typeof p.current_medications === 'string'
        ? p.current_medications
            .split(',')
            .map((s: string) => ({
              name: s.trim(),
            }))
            .filter((m: any) => m.name)
        : p.current_medications || [],

    allergies:
      typeof p.allergies === 'string'
        ? p.allergies
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : p.allergies || [],
  }),
  getPatient: (id: string) => api.get<PatientOut>(`/patients/${id}`),
  updatePatient: (id: string, p: any) =>
  api.put<PatientOut>(`/patients/${id}`, {
    ...p,

    relationship_to_consumer:
      p.relationship_to_consumer || p.relationship,

    medical_conditions:
      typeof p.medical_history === 'string'
        ? p.medical_history
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : p.medical_conditions || [],

    current_medications:
      typeof p.current_medications === 'string'
        ? p.current_medications
            .split(',')
            .map((s: string) => ({
              name: s.trim(),
            }))
            .filter((m: any) => m.name)
        : p.current_medications || [],

    allergies:
      typeof p.allergies === 'string'
        ? p.allergies
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : p.allergies || [],
  }),
  listFamilyMembers: () => api.get<FamilyMemberOut[]>('/family-members'),
  createFamilyMember: (m: FamilyMemberCreatePayload) =>
    api.post<FamilyMemberOut>('/family-members', m),
  deleteFamilyMember: (id: string) => api.delete(`/family-members/${id}`),
};
