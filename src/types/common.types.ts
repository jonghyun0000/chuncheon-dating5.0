import type { School } from './database.types';

export type AsyncResult<T> = { data: T; error: null } | { data: null; error: string };

export type FilterSchool = '전체' | School;

export type FilterTeamSize = '전체' | 1 | 2 | 3 | 4;
