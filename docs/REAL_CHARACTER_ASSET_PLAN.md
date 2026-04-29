# Real Character Asset Plan

The current procedural GLBs are fallback placeholders. Real art should enter the
game through `public/characters` so the runtime can swap them without another
code edit.

## Runtime Slots

- `public/characters/hero.glb` or `public/characters/hero/scene.gltf`
- `public/characters/enemy-01.glb` or `public/characters/enemy-01/scene.gltf`
- `public/characters/enemy-02.glb` or `public/characters/enemy-02/scene.gltf`
- `public/characters/enemy-03.glb` or `public/characters/enemy-03/scene.gltf`

## Required Action Set

- `Idle`
- `Walk`
- `Run`
- `Jump`
- `Attack_Light`
- `Attack_Heavy`
- `Skill_1`
- `Skill_2`
- `Skill_3`
- `Hit`
- `Death`

The runtime also recognizes common Mixamo-style words such as `punch`, `slash`,
`kick`, `dash`, `spin`, `hit`, and `death`.

## Practical Source Paths

1. **Best manual quality:** Buy or download licensed humanoid GLBs from
   Sketchfab, ArtStation Marketplace, KitBash3D, CGTrader, or Fab. Install with
   `npm run asset:install -- hero /path/to/model.glb`.
2. **Fast rig and animation:** Upload a humanoid mesh to Mixamo, download one
   GLB/FBX per action, merge/retarget in Blender, then install the final GLB.
3. **Fast avatar prototype:** Generate a Ready Player Me avatar and fetch it
   with `npm run asset:rpm -- hero <avatar-id>`. This usually still needs
   retargeted combat animations.
4. **AI 3D experiment:** Run Meshy with the prompts in
   `scripts/real-character-prompts.json`, then inspect with
   `npm run asset:report -- public/characters/hero.glb`.
5. **Tripo or other generators:** Export/download a GLB from the service, then
   install with `npm run asset:fetch -- hero <direct-glb-url>` or
   `npm run asset:install -- hero /path/to/export.glb`.

## Character Direction

Avoid exact celebrity likenesses. Use the broader 1990s Hong Kong street-gang
cinema language: orange rain jacket hero, red floral shirt brawler, purple
leather knife fighter, white-suit boss.
