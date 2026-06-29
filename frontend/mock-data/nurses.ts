import { Nurse, Review } from '../types';

export const NURSES: Nurse[] = [
  {
    id: 'n1',
    name: 'Priya Sharma',
    avatar:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
    rating: 4.9,
    reviews: 187,
    experienceYears: 8,
    distanceKm: 1.2,
    hourlyRate: 450,
    gender: 'Female',
    specializations: ['Wound Care', 'Post Surgery', 'Vitals'],
    languages: ['English', 'Hindi', 'Marathi'],
    about:
      'BSc Nursing graduate with 8 years of home-care expertise. Specialized in post-operative recovery and wound management.',
    available: true,
    verified: true,
    certifications: ['BSc Nursing', 'BLS Certified', 'Wound Care Specialist'],
  },
  {
    id: 'n2',
    name: 'Anita D’Souza',
    avatar:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80',
    rating: 4.8,
    reviews: 142,
    experienceYears: 6,
    distanceKm: 2.4,
    hourlyRate: 400,
    gender: 'Female',
    specializations: ['Elderly Care', 'Medication', 'Vitals'],
    languages: ['English', 'Hindi', 'Konkani'],
    about:
      'Compassionate caregiver focused on geriatric wellbeing. Trained in dementia care and medication management.',
    available: true,
    verified: true,
    certifications: ['GNM', 'Geriatric Care Specialist'],
  },
  {
    id: 'n3',
    name: 'Rahul Verma',
    avatar:
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
    rating: 4.7,
    reviews: 98,
    experienceYears: 5,
    distanceKm: 3.8,
    hourlyRate: 380,
    gender: 'Male',
    specializations: ['Post Surgery', 'IV Therapy', 'Vitals'],
    languages: ['English', 'Hindi'],
    about:
      'Male nurse experienced in critical post-surgery care, IV therapy and ICU step-down.',
    available: true,
    verified: true,
    certifications: ['BSc Nursing', 'ACLS Certified'],
  },
  {
    id: 'n4',
    name: 'Meera Iyer',
    avatar:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=400&q=80',
    rating: 4.95,
    reviews: 213,
    experienceYears: 10,
    distanceKm: 0.8,
    hourlyRate: 500,
    gender: 'Female',
    specializations: ['Wound Care', 'Elderly Care', 'Medication'],
    languages: ['English', 'Hindi', 'Tamil'],
    about:
      'Senior home-care nurse with a decade of bedside experience and patient-first approach.',
    available: false,
    verified: true,
    certifications: ['MSc Nursing', 'BLS', 'Palliative Care'],
  },
  {
    id: 'n5',
    name: 'Karthik Menon',
    avatar:
      'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=400&q=80',
    rating: 4.6,
    reviews: 76,
    experienceYears: 4,
    distanceKm: 5.1,
    hourlyRate: 350,
    gender: 'Male',
    specializations: ['Vitals', 'Medication'],
    languages: ['English', 'Malayalam'],
    about:
      'Detail-oriented nurse focused on chronic disease vitals tracking and adherence.',
    available: true,
    verified: true,
    certifications: ['GNM', 'BLS'],
  },
];

export const REVIEWS: Record<string, Review[]> = {
  n1: [
    {
      id: 'r1',
      author: 'Sneha P.',
      rating: 5,
      text: 'Priya took excellent care of my mother post knee surgery. Punctual and patient.',
      date: '2 weeks ago',
    },
    {
      id: 'r2',
      author: 'Vikram J.',
      rating: 5,
      text: 'Wound dressing was very professional. Highly recommend.',
      date: '1 month ago',
    },
    {
      id: 'r3',
      author: 'Rita S.',
      rating: 4,
      text: 'Friendly and skilled. On time every visit.',
      date: '2 months ago',
    },
  ],
  n2: [
    {
      id: 'r4',
      author: 'Aman K.',
      rating: 5,
      text: 'Anita is wonderful with my grandfather. Very gentle.',
      date: '3 weeks ago',
    },
  ],
  n3: [
    {
      id: 'r5',
      author: 'Pooja M.',
      rating: 5,
      text: 'Rahul handled my father’s post-op care with great expertise.',
      date: '1 week ago',
    },
  ],
  n4: [
    {
      id: 'r6',
      author: 'Latha R.',
      rating: 5,
      text: 'Meera is a treasure. We trust her completely.',
      date: '4 days ago',
    },
  ],
  n5: [
    {
      id: 'r7',
      author: 'Suresh B.',
      rating: 4,
      text: 'Good vitals tracking. Always shares timely updates.',
      date: '2 weeks ago',
    },
  ],
};
