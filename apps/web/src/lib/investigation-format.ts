import type { InvestigationStatus, ResponseType } from '@/server/domain/types';

export const STATUS_LABEL: Record<InvestigationStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CONTESTED: 'Contested',
  REVISED: 'Revised',
  WITHDRAWN: 'Withdrawn',
};

export const RESPONSE_TYPE_LABEL: Record<ResponseType, string> = {
  DISPUTES: 'Disputes',
  SUPPORTS: 'Supports',
  CLARIFIES: 'Clarifies',
  ADDS_EVIDENCE: 'Adds evidence',
};

export const investigationHref = (slug: string): string =>
  `/investigations/${slug}`;

export const investigationRevisionsHref = (slug: string): string =>
  `/investigations/${slug}/revisions`;
