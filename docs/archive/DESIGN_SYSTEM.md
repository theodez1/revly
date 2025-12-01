# Design System

## Typography

Notre système typographique utilise deux familles de polices :
- **Poppins** : Pour les titres et éléments percutants
- **Inter** : Pour le corps de texte et interface

### Utilisation

```javascript
import { Typography } from '../constants/Typography';

const styles = StyleSheet.create({
  title: {
    ...Typography.h1,
    color: '#111827',
  },
  bodyText: {
    ...Typography.body,
    color: '#6B7280',
  },
});
```

### Hiérarchie

| Style | Police | Taille | Usage |
|-------|--------|--------|-------|
| `h1` | Poppins ExtraBold | 28px | Titres de pages principales |
| `h2` | Poppins Bold | 22px | Sections importantes |
| `h3` | Inter Bold | 18px | Sous-sections |
| `h4` | Inter SemiBold | 16px | Petits titres |
| `body` | Inter Regular | 16px | Texte standard |
| `bodyBold` | Inter SemiBold | 16px | Labels, emphase |
| `bodySmall` | Inter Regular | 14px | Texte secondaire |
| `bodySmallBold` | Inter SemiBold | 14px | Labels secondaires |
| `caption` | Inter Regular | 12px | Métadonnées |
| `captionBold` | Inter SemiBold | 12px | Métadonnées emphase |
| `button` | Inter Bold | 16px | Boutons principaux |
| `buttonSmall` | Inter SemiBold | 14px | Boutons secondaires |
| `stat` | Poppins Bold | 24px | Statistiques |
| `statLarge` | Poppins ExtraBold | 32px | Grandes stats |

## Couleurs

```javascript
import { Colors } from '../constants/Colors';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
  },
  title: {
    color: Colors.textPrimary,
  },
  button: {
    backgroundColor: Colors.primary,
  },
});
```

### Palette

- **Primary**: `#3B82F6` (Bleu)
- **Success**: `#10B981` (Vert)
- **Warning**: `#F59E0B` (Orange)
- **Error**: `#EF4444` (Rouge)

### Texte
- **textPrimary**: `#111827` (Noir principal)
- **textSecondary**: `#6B7280` (Gris moyen)
- **textTertiary**: `#9CA3AF` (Gris clair)

## Bonnes pratiques

1. ✅ **Toujours utiliser les constantes** plutôt que des valeurs en dur
2. ✅ **Spread operator** pour combiner styles : `...Typography.h1`
3. ✅ **Couleurs sémantiques** pour la cohérence
4. ❌ **Éviter** `fontWeight` et `fontSize` manuels
5. ❌ **Éviter** les couleurs en hexadécimal direct
