import { KitItem } from '../types';

export const KIT_ITEMS: KitItem[] = [
  { id: 'k1', name: 'BP Monitor', category: 'Vitals', required: true, checked: true },
  { id: 'k2', name: 'Pulse Oximeter', category: 'Vitals', required: true, checked: true },
  { id: 'k3', name: 'Thermometer', category: 'Vitals', required: true, checked: true },
  { id: 'k4', name: 'Glucometer + strips', category: 'Vitals', required: true, checked: false },
  { id: 'k5', name: 'Sterile gauze pads', category: 'Wound Care', required: true, checked: true },
  { id: 'k6', name: 'Antiseptic solution', category: 'Wound Care', required: true, checked: true },
  { id: 'k7', name: 'Surgical tape', category: 'Wound Care', required: false, checked: false },
  { id: 'k8', name: 'Disposable gloves', category: 'PPE', required: true, checked: true },
  { id: 'k9', name: 'Face masks', category: 'PPE', required: true, checked: true },
  { id: 'k10', name: 'IV cannula set', category: 'IV Therapy', required: false, checked: false },
  { id: 'k11', name: 'Syringes (5cc, 10cc)', category: 'Medication', required: true, checked: true },
  { id: 'k12', name: 'Sharps container', category: 'PPE', required: true, checked: false },
];
