/**
 * Templates de défis prédéfinis
 * Ces templates peuvent être lancés par les admins de groupes
 * Tous les défis sont des classements libres (sans objectif fixe)
 */

export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  type: 'distance' | 'speed' | 'count';
  targetValue: number | null;
  category: string;
  icon: string;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'distance-leaderboard',
    name: 'Champion de la distance',
    description: 'Qui parcourra le plus de kilomètres ?',
    type: 'distance',
    targetValue: null,
    category: 'competition',
    icon: 'trophy-outline',
  },
  {
    id: 'count-leaderboard',
    name: 'Maître des trajets',
    description: 'Qui effectuera le plus de trajets ?',
    type: 'count',
    targetValue: null,
    category: 'competition',
    icon: 'list-outline',
  },
  {
    id: 'explorer-leaderboard',
    name: 'Explorateur',
    description: 'Qui parcourra le plus de kilomètres de découverte ?',
    type: 'distance',
    targetValue: null,
    category: 'exploration',
    icon: 'map-outline',
  },
  {
    id: 'consistency-leaderboard',
    name: 'Régularité',
    description: 'Qui sera le plus assidu dans ses sorties ?',
    type: 'count',
    targetValue: null,
    category: 'consistency',
    icon: 'calendar-outline',
  },
];

/**
 * Grouper les templates par catégorie
 */
export const getTemplatesByCategory = (): Record<string, ChallengeTemplate[]> => {
  const grouped: Record<string, ChallengeTemplate[]> = {};
  CHALLENGE_TEMPLATES.forEach(template => {
    const category = template.category || 'custom';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(template);
  });
  return grouped;
};

/**
 * Obtenir un template par ID
 */
export const getTemplateById = (id: string): ChallengeTemplate | undefined => {
  return CHALLENGE_TEMPLATES.find(t => t.id === id);
};

