# Asset sources

All app imagery/fonts are served locally; normal pages do not call an external font or stock-image service.

The homepage hero uses `public/images/skilllink-professional-hero.webp`, an optimized version of the original transparent PNG alongside it. Generated using the built-in imagegen tool after the user's request to follow the orange handyman reference. It is illustrative campaign imagery, not an actual registered professional or a customer testimonial. At the user's request, the recruitment section now uses their supplied `public/images/workers.jpg` photograph instead of repeating the hero. The shared brand uses the existing `public/favicon.svg` as its logo mark, as clarified by the user. The previous stock photographs remain available as assets and automated-test attachments.

Generation prompt: "Create an original photorealistic commercial website hero asset, transparent background PNG. A friendly adult Gambian Black male skilled handyman in his early thirties, smiling naturally looking toward camera, wearing a clean navy blue work shirt, warm tan/orange canvas bib overalls, yellow safety helmet, leather utility belt with a few tools, holding a small cordless drill safely down at waist level. Three-quarter length portrait from helmet through upper thighs, whole helmet and both elbows completely inside frame with generous transparent margins around silhouette. Straight-on editorial studio photography, realistic hands and tools, warm flattering daylight, premium approachable services marketplace campaign. Isolated subject only with genuine alpha transparency: no scenery, no ground plane, no circle, no backdrop, no lettering, no brand, no numbers or badges. This is illustrative stock-style campaign imagery, not a registered professional profile."

| Asset | Source | Use |
|---|---|---|
| `public/images/skilllink-professional-hero.webp` | Original built-in imagegen output; full prompt above | Homepage hero cutout; original PNG preserved alongside it |
| `public/images/workers.jpg` | User-supplied project asset | Recruitment section team photograph |
| `public/images/professional-at-work.jpg` | [Unsplash source image](https://images.unsplash.com/photo-1621905251189-08b45d6a269e) | Previous hero artwork; isolated browser-test attachment |
| `public/images/team-at-work.jpg` | [Unsplash source image](https://images.unsplash.com/photo-1504307651254-35680f356dfd) | Previous recruitment artwork; isolated browser-test attachment |
| `public/fonts/manrope-latin.woff2` | [Google Fonts Manrope](https://fonts.google.com/specimen/Manrope) | Variable Manrope Latin, weights 400–800 |
| `public/fonts/OFL.txt` | [Manrope OFL source](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt) | Included font license |
| `public/favicon.svg`, SkillLink wordmark | Authored for this frontend | Original simple brand mark |
| Lucide SVG icons | `lucide-react` package | Consistent interface icons under its ISC license |

Stock photographs are illustrative, not representations of registered SkillLink professionals or evidence of completed platform work. They are used under the [Unsplash license](https://unsplash.com/license); avoid implying endorsement. Actual profile, portfolio and message images come from authorized backend media. No screenshots, logos or photographs were copied from the handyman reference design.
