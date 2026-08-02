import type { ReportCategory } from '@/types/database.types';

export interface ReportInput {
  category: ReportCategory;
  detail: string;
  /** 신고 대상 (매칭 상세에서 신고하면 자동으로 채워집니다) */
  target_user_id?: string | null;
  target_team_id?: string | null;
}
