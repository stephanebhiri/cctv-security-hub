# CCTV Security Hub - CSS Design System

## 📁 Architecture CSS Modulaire

Cette architecture CSS professionnelle remplace l'ancien système désordonné par un design system moderne et maintenable.

```
src/styles/
├── core/                    # Système de base
│   ├── variables.css       # Design tokens centralisés
│   ├── reset.css          # Reset CSS moderne
│   └── typography.css     # Système typographique
├── components/             # Composants réutilisables
│   ├── buttons.css        # Système de boutons
│   ├── forms.css          # Composants de formulaires
│   ├── modals.css         # Modals et overlays
│   └── layouts.css        # Grilles et layouts
├── pages/                 # Styles spécifiques aux pages
│   ├── cctv.css          # Interface CCTV
│   ├── timeline.css      # Page timeline
│   └── history.css       # Page historique
└── index.css             # Point d'entrée principal
```

## 🎨 Design Tokens

### Palette de couleurs professionnelle
```css
/* Couleurs principales */
--color-primary: #111827     /* Noir profond */
--color-secondary: #374151   /* Gris foncé */
--color-accent: #6b46c1      /* Plum subtil */
--color-surface: #ffffff     /* Blanc pur */
--color-background: #f8fafc  /* Gris clair */

/* Couleurs de statut */
--color-success: #059669
--color-warning: #d97706
--color-error: #dc2626
```

### Espacement cohérent
```css
--space-1: 4px    /* 0.25rem */
--space-2: 8px    /* 0.5rem */
--space-3: 12px   /* 0.75rem */
--space-4: 16px   /* 1rem */
--space-5: 20px   /* 1.25rem */
--space-6: 24px   /* 1.5rem */
--space-8: 32px   /* 2rem */
```

### Typographie système
```css
--font-family-primary: 'Inter', sans-serif
--font-family-mono: 'JetBrains Mono', monospace

--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-base: 1rem
--font-size-lg: 1.125rem
--font-size-xl: 1.25rem
```

## 🧩 Composants CSS

### Système de boutons
```css
/* Usage basique */
<button class="btn btn--primary btn--base">Primaire</button>
<button class="btn btn--secondary btn--sm">Secondaire</button>
<button class="btn btn--ghost btn--lg">Ghost</button>

/* Spécialisés CCTV */
<button class="btn btn--nav">Navigation</button>
<button class="btn btn--control">Contrôle</button>
<button class="btn btn--sync">Sync</button>
```

### Formulaires
```css
/* Groupe de champ */
<div class="form-group">
  <label class="form-label">Label</label>
  <input class="form-input" type="text" />
</div>

/* Layouts de formulaire */
<form class="form">
  <div class="form-row">
    <!-- Champs en ligne -->
  </div>
</form>
```

### Layouts
```css
/* Container responsive */
<div class="container container--xl">

/* Système de grille */
<div class="grid grid-cols-3 gap-4">
  <div class="col-span-2">Contenu</div>
  <div>Sidebar</div>
</div>

/* Flexbox utilities */
<div class="flex items-center justify-between gap-4">
```

## 📱 CCTV Spécifique

### Fenêtre CCTV
```css
.cctv-window {
  /* Layout grid fixe */
  grid-template-rows: 60px 1fr 80px;
  grid-template-areas: 
    "header"
    "cameras" 
    "controls";
}
```

### Grille caméras
```css
.cctv-camera-grid {
  /* 3x2 par défaut, responsive */
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}
```

## 🎯 Tokens CCTV

```css
/* Dimensions CCTV */
--cctv-header-height: 60px
--cctv-controls-height: 80px
--cctv-camera-aspect-ratio: 16 / 9

/* Timeline */
--timeline-track-height: 40px
--timeline-segment-height: 36px
--timeline-graduation-height: 60px
```

## 📐 Responsive Design

```css
/* Breakpoints */
--breakpoint-sm: 640px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px

/* Caméras responsive */
/* Desktop: 3x2 */
/* Tablet: 2x3 */
/* Mobile: 1x6 */
```

## ⚡ Performance

- **CSS Bundle**: 10.89 kB (compressed)
- **Design tokens**: Variables CSS natives
- **Pas de runtime**: Vanilla CSS uniquement
- **Tree-shaking**: Classes inutilisées supprimées
- **Critical CSS**: Styles core en priorité

## 🔧 Usage

### Import principal
```tsx
// Dans src/index.tsx
import './styles/index.css';
```

### Classes utilitaires
```html
<!-- Espacement -->
<div class="p-4 mb-6 gap-3">

<!-- Couleurs -->
<span class="text-primary bg-surface">

<!-- Layout -->
<div class="flex items-center justify-between">
```

## 🚀 Avantages

✅ **Cohérence**: Design tokens unifiés  
✅ **Maintenabilité**: Architecture modulaire  
✅ **Performance**: CSS optimisé  
✅ **Scalabilité**: Système extensible  
✅ **Responsive**: Mobile-first  
✅ **Accessibilité**: Focus et contrastes  
✅ **Developer Experience**: Classes prédictibles  

## 🔄 Migration

L'ancienne architecture CSS a été complètement remplacée:

- ❌ `App.css` → ✅ Design system modulaire
- ❌ `surveillance.css` → ✅ `pages/cctv.css`
- ❌ `timeline.css` → ✅ `pages/timeline.css`
- ❌ `history.css` → ✅ `pages/history.css`
- ❌ Duplication → ✅ Variables centralisées
- ❌ Conflits → ✅ Namespacing cohérent

## 🎨 Design Philosophy

**"Carré, Nickel, Pro"**

- Pas de gradients violets
- Palette noir/blanc/gris
- Touches plum subtiles uniquement
- Corners carrés (4px max)
- Pas d'animations bouncy
- Design system corporate

---

*Architecture CSS conçue pour un environnement de production critique CCTV*