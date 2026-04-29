# Runtime Character Slots

Drop real character assets here to replace the in-repo procedural placeholders.

Runtime lookup order:

- `hero.glb` or `hero/scene.gltf`
- `enemy-01.glb` or `enemy-01/scene.gltf`
- `enemy-02.glb` or `enemy-02/scene.gltf`
- `enemy-03.glb` or `enemy-03/scene.gltf`

Recommended embedded clip names:

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

The game also recognizes common Mixamo-style names such as `walk`, `run`,
`punch`, `slash`, `kick`, `jump`, `hit`, and `death`, but the canonical names
above keep the combat system predictable.

Keep third-party license and attribution notes beside the asset as
`<slot>.source.json`.
