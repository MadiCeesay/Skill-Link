import { Hammer, PlugZap, Droplets, Paintbrush, Brush, Scissors, Wrench, BrickWall, WashingMachine, Monitor, Car, Utensils, Flower2 } from 'lucide-react';
// Presentation only: the catalog still supplies every actual service and ID.
// Matching is semantic, so sorting/filtering never changes a service's tools.
const rules = [
  [/carpent|woodwork|joiner|furniture/, 'carpentry', Hammer],
  [/electric|wiring|solar/, 'electrical', PlugZap],
  [/plumb|drain|pipe|water/, 'plumbing', Droplets],
  [/paint|decorat/, 'painting', Paintbrush],
  [/mason|brick|construc|tiling|tile|plaster/, 'masonry', BrickWall],
  [/clean|housekeep/, 'cleaning', Brush],
  [/tailor|sew|cloth|dress/, 'tailoring', Scissors],
  [/appliance|washing machine|refrigerat/, 'appliance', WashingMachine],
  [/computer|laptop|technolog|it support/, 'technology', Monitor],
  [/vehicle|mechanic|car repair|auto repair/, 'automotive', Car],
  [/cater|cook/, 'catering', Utensils],
  [/garden|landscap/, 'gardening', Flower2],
];
export function servicePresentation(service) {
  const text = [service?.name, service?.slug].filter(Boolean).join(' ').toLowerCase();
  const rule = rules.find(([pattern]) => pattern.test(text));
  return rule ? { key: rule[1], Icon: rule[2] } : { key: 'general', Icon: Wrench };
}
