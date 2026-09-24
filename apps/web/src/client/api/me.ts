import { useQuery } from '@tanstack/react-query';
import { api } from './client';

/** Signed-in user, or null for guests (one request; see GET /api/me?optional=1). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.meOptional, staleTime: 30_000 });
}
