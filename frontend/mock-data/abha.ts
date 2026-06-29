import { ABHARecord, SupportTicket, TrainingCourse, Certificate } from '../types';

export const ABHA_RECORDS: ABHARecord[] = [
  {
    id: 'a1',
    hospital: 'Apollo Hospitals',
    type: 'Discharge Summary',
    category: 'discharge',
    date: '2026-01-12',
    doctor: 'Dr. R. Mehra',
    summary:
      'Patient admitted for elective right knee replacement. Post-operative recovery uneventful. Discharged on POD-4 in stable condition.',
    fileSize: '1.2 MB',
  },
  {
    id: 'a2',
    hospital: 'Manipal Hospital',
    type: 'CBC + Lipid Profile',
    category: 'lab',
    date: '2025-12-20',
    doctor: 'Dr. S. Kapoor',
    summary:
      'Hb 13.2 g/dL, WBC 7.4k, Platelets 240k. Lipid panel within reference range. LDL slightly elevated at 132 mg/dL.',
    fileSize: '0.4 MB',
  },
  {
    id: 'a3',
    hospital: 'Fortis Hospital',
    type: 'Prescription – Antihypertensives',
    category: 'prescription',
    date: '2025-11-04',
    doctor: 'Dr. A. Nair',
    summary:
      'Telmisartan 40 mg OD, Amlodipine 5 mg OD, Atorvastatin 10 mg HS. Continue x 3 months and review BP.',
    fileSize: '0.2 MB',
  },
  {
    id: 'a4',
    hospital: 'Apollo Hospitals',
    type: 'Chest X-Ray',
    category: 'radiology',
    date: '2025-10-22',
    doctor: 'Dr. P. Bhatia',
    summary:
      'No active lung pathology. Cardiac silhouette within normal limits. No pleural effusion.',
    fileSize: '2.8 MB',
  },
];

export const SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 't1',
    subject: 'Subsidy not applied to last booking',
    category: 'payment',
    description:
      'My BPL subsidy didn’t apply to the wound care booking on Jan 12. Please review and refund the difference.',
    status: 'in_progress',
    createdAt: '2 days ago',
    updates: [
      { time: '2 days ago', message: 'Ticket raised by you', from: 'you' },
      { time: '1 day ago', message: 'Thanks for reaching out – our finance team is verifying your booking.', from: 'support' },
      { time: '5 hr ago', message: 'Subsidy of ₹90 will be credited to your wallet within 24h.', from: 'support' },
    ],
  },
  {
    id: 't2',
    subject: 'Nurse arrived late',
    category: 'nurse',
    description: 'Nurse arrived 25 minutes after the scheduled slot.',
    status: 'resolved',
    createdAt: '1 week ago',
    updates: [
      { time: '1 week ago', message: 'Ticket raised by you', from: 'you' },
      { time: '6 days ago', message: 'We’ve credited a 15% goodwill voucher to your account.', from: 'support' },
    ],
  },
];

export const TRAINING_COURSES: TrainingCourse[] = [
  {
    id: 'c1',
    title: 'Advanced Wound Care',
    category: 'Clinical',
    durationMins: 90,
    modules: 6,
    completed: 6,
    status: 'completed',
    thumbnail:
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'c2',
    title: 'BLS & ACLS Refresher',
    category: 'Emergency',
    durationMins: 120,
    modules: 8,
    completed: 5,
    status: 'in_progress',
    thumbnail:
      'https://images.unsplash.com/photo-1583912267550-4a3a8a8c0a64?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'c3',
    title: 'Geriatric Care Essentials',
    category: 'Specialty',
    durationMins: 75,
    modules: 5,
    completed: 0,
    status: 'not_started',
    thumbnail:
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'c4',
    title: 'Infection Control & PPE',
    category: 'Safety',
    durationMins: 45,
    modules: 4,
    completed: 4,
    status: 'completed',
    thumbnail:
      'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=400&q=80',
  },
];

export const CERTIFICATES: Certificate[] = [
  {
    id: 'cert1',
    title: 'BSc Nursing',
    issuedBy: 'Mumbai University',
    issuedDate: '2018-06-15',
    certNumber: 'MU-BSCN-2018-04521',
    status: 'active',
  },
  {
    id: 'cert2',
    title: 'BLS Provider',
    issuedBy: 'American Heart Association',
    issuedDate: '2025-03-12',
    expiryDate: '2027-03-12',
    certNumber: 'AHA-BLS-2025-78812',
    status: 'active',
  },
  {
    id: 'cert3',
    title: 'Wound Care Specialist',
    issuedBy: 'NurseConnect Academy',
    issuedDate: '2024-09-08',
    expiryDate: '2026-09-08',
    certNumber: 'NC-WCS-2024-1109',
    status: 'expiring',
  },
];
