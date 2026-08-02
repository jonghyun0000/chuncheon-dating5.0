import type { School } from '@/types/database.types';

export interface ReviewInput {
  nickname: string;
  school: School;
  rating: number;
  content: string;
}
