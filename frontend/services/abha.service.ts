import { api } from '../lib/api';

export interface AbhaRecordOut {
  id: string;
  patient_id: string;
  record_type: string;
  source: string | null;
  title: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  issued_date: string | null;
  document_url: string | null;
  summary: string | null;
  created_at: string;
}

export const abhaService = {
  listForPatient: (patientId: string) =>
    api.get<AbhaRecordOut[]>(`/abha-records/patient/${patientId}`),
  create: (payload: {
    patient_id: string;
    record_type: string;
    source?: string;
    title?: string;
    doctor_name?: string;
    hospital_name?: string;
    issued_date?: string;
    document_url?: string;
    summary?: string;
  }) => api.post<AbhaRecordOut>('/abha-records', payload),
};
