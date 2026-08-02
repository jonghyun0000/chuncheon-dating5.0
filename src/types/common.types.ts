export type AsyncResult<T> = { data: T; error: null } | { data: null; error: string };

export type FilterSchool = '전체' | '강원대' | '한림대' | '성심대' | '춘교대';

export type FilterTeamSize = '전체' | 1 | 2 | 3 | 4;
