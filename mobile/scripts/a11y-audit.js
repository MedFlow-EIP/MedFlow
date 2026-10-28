#!/usr/bin/env node
/**
 * Audit d'accessibilité outillé (WCAG 2.1 AA) de l'app mobile.
 *
 *   node scripts/a11y-audit.js > ../docs/audit-accessibilite-outille.md
 *
 * Même script en novembre et en décembre : les deux rapports se comparent.
 * 1. Contrastes des couleurs du thème (clair, sombre, contraste élevé).
 * 2. Analyse du code (compilateur TypeScript) : boutons sans nom pour le
 *    lecteur d'écran, champs sans libellé, images sans description, textes trop petits.
 * Ce que l'outil ne voit pas (navigation au lecteur d'écran, taille des
 * zones tactiles à l'écran, information portée par la couleur seule) se
 * vérifie à la main : voir la fin du rapport.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');

// ---------- 1. Contrastes ----------

function loadThemes() {
  const source = fs.readFileSync(path.join(ROOT, 'theme/colors.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
  const { lightColors, darkColors, withHighContrast } = mod.exports;
  return {
    Clair: lightColors,
    Sombre: darkColors,
    'Clair, contraste élevé': withHighContrast(lightColors, false),
    'Sombre, contraste élevé': withHighContrast(darkColors, true),
  };
}

function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [premier plan, fond, usage, seuil] : 4,5 pour du texte, 3 pour une icône ou un élément graphique.
const PAIRS = [
  ['textPrimary', 'background', 'Texte principal', 4.5],
  ['textPrimary', 'surface', 'Texte principal sur carte', 4.5],
  ['textSecondary', 'background', 'Texte secondaire', 4.5],
  ['textSecondary', 'surface', 'Texte secondaire sur carte', 4.5],
  ['textSecondary', 'surfaceAlt', 'Texte secondaire sur fond gris', 4.5],
  ['primaryText', 'surface', 'Lien, bouton secondaire', 4.5],
  ['primaryText', 'tintPrimary', 'Puce bleue (flashcards, examen)', 4.5],
  ['onAction', 'action', 'Texte des boutons principaux', 4.5],
  ['successText', 'tintSuccess', 'Message de réussite', 4.5],
  ['warningText', 'tintWarning', 'Avertissement, cartes difficiles', 4.5],
  ['warningText', 'surface', 'Compteur IA presque épuisé', 4.5],
  ['dangerText', 'tintDanger', "Message d'erreur", 4.5],
  ['muted', 'surface', 'Icône discrète', 3],
  ['danger', 'surface', 'Icône de suppression', 3],
  ['primary', 'border', 'Barre de progression sur sa piste', 3],
  ['textSecondary', 'surface', 'Icône des onglets inactifs', 3],
];

function contrastReport(themes) {
  const rows = [];
  for (const [theme, c] of Object.entries(themes)) {
    for (const [fg, bg, usage, min] of PAIRS) {
      const r = ratio(c[fg], c[bg]);
      rows.push({ theme, fg, bg, usage, min, r, ok: r >= min });
    }
  }
  return rows;
}

// ---------- 2. Analyse du code ----------

const TOUCHABLES = new Set(['TouchableOpacity', 'Pressable', 'TouchableHighlight', 'TouchableWithoutFeedback']);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : listFiles(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

function tagName(node) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  return opening.tagName.getText();
}

function attrs(node) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const out = {};
  for (const a of opening.attributes.properties) {
    if (ts.isJsxAttribute(a)) out[a.name.getText()] = a.initializer ? a.initializer.getText() : 'true';
  }
  return out;
}

/**
 * Le bouton contient-il un texte lisible (que le lecteur d'écran annonce) ?
 * 'oui', 'non', ou 'inconnu' quand son contenu vient d'une variable.
 */
function hasText(node) {
  let found = false;
  let opaque = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isJsxText(n) && n.getText().trim()) found = true;
    else if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && tagName(n) === 'Text') found = true;
    else if (ts.isJsxExpression(n) && n.expression && ts.isIdentifier(n.expression)) opaque = true;
    else n.forEachChild(visit);
  };
  if (ts.isJsxElement(node)) node.children.forEach(visit);
  return found ? 'oui' : opaque ? 'inconnu' : 'non';
}

function scanCode() {
  const findings = { button: [], buttonToCheck: [], input: [], image: [], font: [] };
  for (const file of listFiles(path.join(ROOT, 'components')).concat([path.join(ROOT, 'App.tsx')])) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const where = (n) => `${path.relative(ROOT, file).replace(/\\/g, '/')}:${source.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visit = (n) => {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
        const name = tagName(n);
        const a = attrs(n);
        const labelled = 'accessibilityLabel' in a || a.accessible === '{false}';
        if (TOUCHABLES.has(name) && !labelled) {
          const text = hasText(n);
          if (text === 'non') findings.button.push(where(n));
          else if (text === 'inconnu') findings.buttonToCheck.push(where(n));
        }
        if (name === 'TextInput' && !('accessibilityLabel' in a)) findings.input.push(where(n));
        if ((name === 'Image' || name === 'ExpoImage') && !labelled && !('accessibilityElementsHidden' in a)) {
          findings.image.push(where(n));
        }
      }
      if (ts.isPropertyAssignment(n) && n.name.getText() === 'fontSize' && ts.isNumericLiteral(n.initializer)) {
        const size = Number(n.initializer.text);
        if (size < 12) findings.font.push(`${where(n)} (${size})`);
      }
      n.forEachChild(visit);
    };
    visit(source);
  }
  return findings;
}

// ---------- Rapport ----------

function list(items) {
  return items.length ? items.map((i) => `- \`${i}\``).join('\n') : '- Aucune.';
}

const date = new Date().toISOString().slice(0, 10);
const contrasts = contrastReport(loadThemes());
const failing = contrasts.filter((c) => !c.ok);
const code = scanCode();

const out = [];
out.push(`# MedFlow : audit d'accessibilité outillé (WCAG 2.1 AA)`);
out.push('');
out.push(`Généré le ${date} par \`mobile/scripts/a11y-audit.js\` (à relancer à l'identique pour la mesure de décembre).`);
out.push('');
out.push('## Résumé');
out.push('');
out.push('| Contrôle | Critère WCAG | Non-conformités | Sévérité |');
out.push('| --- | --- | --- | --- |');
out.push(`| Bouton sans nom pour le lecteur d'écran | 4.1.2 Nom, rôle, valeur | ${code.button.length} | Haute |`);
out.push(`| Contraste insuffisant | 1.4.3 / 1.4.11 Contraste | ${failing.length} sur ${contrasts.length} paires | Haute si texte, moyenne si icône |`);
out.push(`| Champ de saisie sans libellé | 3.3.2 Étiquettes | ${code.input.length} | Moyenne |`);
out.push(`| Image sans description ni marquée décorative | 1.1.1 Contenu non textuel | ${code.image.length} | Moyenne |`);
out.push(`| Texte de moins de 12 px | 1.4.4 Redimensionnement (lisibilité) | ${code.font.length} | Basse |`);
out.push('');
out.push('## 1. Contrastes des couleurs');
out.push('');
out.push('Seuils : 4,5:1 pour du texte, 3:1 pour une icône ou un élément graphique.');
out.push('');
out.push('| Thème | Usage | Couleurs | Rapport | Seuil | Résultat |');
out.push('| --- | --- | --- | --- | --- | --- |');
for (const c of contrasts) {
  out.push(`| ${c.theme} | ${c.usage} | \`${c.fg}\` sur \`${c.bg}\` | ${c.r.toFixed(2)}:1 | ${c.min}:1 | ${c.ok ? 'Conforme' : '**Non conforme**'} |`);
}
out.push('');
out.push("## 2. Boutons sans nom pour le lecteur d'écran (sévérité haute)");
out.push('');
out.push("Bouton tactile sans `accessibilityLabel` ni texte visible : TalkBack annonce seulement « bouton ».");
out.push('');
out.push(list(code.button));
out.push('');
out.push("À vérifier à la main (le contenu du bouton vient d'une variable, l'outil ne voit pas s'il contient un texte) :");
out.push('');
out.push(list(code.buttonToCheck));
out.push('');
out.push('## 3. Champs de saisie sans libellé (sévérité moyenne)');
out.push('');
out.push("Un texte d'exemple (`placeholder`) disparaît à la saisie et ne remplace pas un libellé.");
out.push('');
out.push(list(code.input));
out.push('');
out.push('## 4. Images sans description (sévérité moyenne)');
out.push('');
out.push("À décrire (`accessibilityLabel`) ou à marquer décorative (`accessible={false}`).");
out.push('');
out.push(list(code.image));
out.push('');
out.push('## 5. Textes de moins de 12 px (sévérité basse)');
out.push('');
out.push(list(code.font));
out.push('');
out.push("## Ce que l'outil ne vérifie pas (test manuel)");
out.push('');
out.push("- **Parcours complet au lecteur d'écran** : la tâche 2 du protocole (révision du jour) faite avec TalkBack activé, sans regarder l'écran. C'est le « test sous contrainte » demandé par la track.");
out.push("- **Daltonisme** : la même tâche avec un filtre de daltonisme (Paramètres Android > Accessibilité > Correction des couleurs). Vérifier qu'aucune information n'est donnée par la couleur seule (bonne / mauvaise réponse, barres de la semaine, compteur IA).");
out.push('- **Zones tactiles** : au moins 44 × 44 points pour chaque bouton, en particulier les icônes seules (retour, supprimer, fermer).');
out.push('- **Taille du texte système au maximum** : aucun texte coupé ni superposé.');
out.push('');
process.stdout.write(out.join('\n') + '\n');
