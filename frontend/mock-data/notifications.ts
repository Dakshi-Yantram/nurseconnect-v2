import { NotificationItem } from '../types';

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'no1',
    title: 'Nurse en-route',
    body: 'Priya Sharma is on the way for your 10:00 AM visit.',
    time: '10 min ago',
    group: 'Today',
    type: 'booking',
    read: false,
  },
  {
    id: 'no2',
    title: 'Payment successful',
    body: '₹720 paid for wound care visit. Subsidy applied: ₹180.',
    time: '2 hr ago',
    group: 'Today',
    type: 'payment',
    read: false,
  },
  {
    id: 'no3',
    title: 'Visit completed',
    body: 'Care notes for yesterday’s vitals visit are now available.',
    time: 'Yesterday',
    group: 'Yesterday',
    type: 'booking',
    read: true,
  },
  {
    id: 'no4',
    title: 'BPL subsidy approved',
    body: 'You are now eligible for 25% subsidy on all bookings.',
    time: 'Yesterday',
    group: 'Yesterday',
    type: 'alert',
    read: true,
  },
  {
    id: 'no5',
    title: 'Welcome to NurseConnect',
    body: 'Link your ABHA to unlock seamless health records.',
    time: '2 days ago',
    group: 'Earlier',
    type: 'system',
    read: true,
  },
];
