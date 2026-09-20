export type RankableResource = {
  score: number;
  factors: { compatibilityScore: number };
  distanceKm: number;
  resourceType: string;
  resourceId: { toString(): string };
};

export function rankResources<T extends RankableResource>(resources: T[]): T[] {
  return [...resources].sort((a, b) =>
    b.score - a.score ||
    b.factors.compatibilityScore - a.factors.compatibilityScore ||
    a.distanceKm - b.distanceKm ||
    a.resourceType.localeCompare(b.resourceType) ||
    a.resourceId.toString().localeCompare(b.resourceId.toString())
  );
}
