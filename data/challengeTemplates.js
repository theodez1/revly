/**
 * Templates de défis prédéfinis
 * Ces templates peuvent être lancés par les admins de groupes
 * Tous les défis sont des classements libres (sans objectif fixe)
 */

export const CHALLENGE_TEMPLATES = [
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
    id: 'speed-leaderboard',
    name: 'Roi de la vitesse',
    description: 'Qui atteindra la vitesse maximale la plus élevée ?',
    type: 'speed',
    targetValue: null,
    category: 'competition',
    icon: 'flash-outline',
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
];

/**
 * Grouper les templates par catégorie
 */
export const getTemplatesByCategory = () => {
  const grouped = {};
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
export const getTemplateById = (id) => {
  return CHALLENGE_TEMPLATES.find(t => t.id === id);
};
