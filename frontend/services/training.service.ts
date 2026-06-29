import { api } from '../lib/api';

export interface TrainingModuleListItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  video_url: string | null;
  is_mandatory: boolean;
  completed: boolean;
  passed: boolean | null;
  certificate_url: string | null;
}

export interface TrainingModuleDetail {
  id: string;
  code: string;
  title: string;
  description: string | null;
  content_url: string | null;
  video_url: string | null;
  duration_minutes: number;
  assessment: Array<{ question: string; options: string[] }>;
  pass_percent: number;
}

export interface AssessmentSubmitResult {
  score: number;
  passed: boolean;
  certificate_url: string | null;
  attempts: number;
}

export const trainingService = {
  list: () => api.get<TrainingModuleListItem[]>('/training/modules'),
  get: (id: string) => api.get<TrainingModuleDetail>(`/training/modules/${id}`),
  // Backend signature: answers: List[int] as request body
  submitAssessment: (id: string, answers: number[]) =>
    api.post<AssessmentSubmitResult>(`/training/modules/${id}/assessment/submit`, answers),
};
