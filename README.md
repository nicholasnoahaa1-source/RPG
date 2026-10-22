# Stark Holographic Workstation

Estação 3D para inspecionar e manipular modelos GLB/glTF: Next.js 16 (App Router), React 19, TypeScript strict, Three.js, React Three Fiber, drei, postprocessing, Zustand, Tailwind 4 e Motion.

## Executar

```bash
npm install
npm run dev          # desenvolvimento
npm run typecheck    # tsc --noEmit
npm test             # testes unitários (vitest)
npm run build && npm start
```

O app **não inclui nenhuma armadura**. Para carregar um modelo:

- coloque um GLB em `public/models/armor.glb` (carregado sozinho), ou
- use **ABRIR GLB / GLTF**, ou arraste o arquivo para a janela (aceita `.glb` e `.gltf` autocontido).

Seleção por peça, árvore, Exploded View e propriedades dependem de o arquivo ter peças separadas e nomeadas. Uma malha única só permite orbitar, dar zoom e trocar modos de visualização.

## Controles

| Ação | Atalho |
|---|---|
| Navegar / mover / girar / escalar peça | `Q` `W` `E` `R` |
| Editar vértices da malha selecionada | `T` |
| Visões frontal, traseira, direita, esquerda, topo | `1` a `5` |
| Modos standard, holo, wire, x-ray, engenharia | `Shift` + `1` a `5` |
| Enquadrar seleção / tudo | `F` / `Home` (ou duplo clique na peça) |
| Ocultar, travar, isolar | `H` `L` `I` |
| Exploded View, pausar | `X`, `Espaço` |
| Desfazer, refazer | `Ctrl+Z`, `Ctrl+Shift+Z` |
| Mover câmera | setas, botão direito ou `Shift`+arrastar |

Variável de ambiente `NEXT_PUBLIC_WS_DEBUG=1` expõe `window.__ws` (store e registro do motor) para testes automatizados. Não ative em produção.

## Arquitetura

```
app/                 layout e página (client-only, sem SSR do canvas)
src/store/           estado global (Zustand): UI, câmera, seleção, modos
src/lib/             matemática pura e testável: zoom, histórico, desmontagem, persistência
src/three/           motor: Scene, ModelRoot (carga e registro de peças), CameraRig,
                     ViewModes, Gizmo, Stage, Post, Engineering, registry, actions, session
src/ui/              HUD: TopBar, LeftPanel, RightPanel, BottomBar, Boot, Overlays, Hotkeys
src/test/            testes unitários
```

O estado por frame (transformações, objetos Three) vive em `registry`, fora do React. O store guarda só o que a interface precisa renderizar.

## Zoom de 2000×

O fator é nominal: `distância de enquadramento 1× / distância atual da câmera`, limitado a 2000×. Os planos near e far são recalculados a cada quadro a partir da distância para preservar a precisão do depth buffer. Zoom aproxima a câmera, não cria detalhe: quando um triângulo mediano do modelo passa a ocupar mais de 1/10 da altura da tela (e o zoom é maior que 1,5×), a interface mostra um aviso de que o aumento é digital.

## Estado atual

Implementado e verificado (build, tipos, testes unitários e teste de navegador com um GLB de teste de 5 caixas, ver abaixo):

- carga de GLB/glTF com Draco e Meshopt, progresso e erro; descarte de geometria, material e textura ao trocar de modelo
- rotação 360°, zoom até 2000× (roda, pinça, botões, slider, ponto do cursor), pan (mouse, toque, setas), visões, enquadramento animado e interrompível
- seleção por clique, hover, contorno, gizmos de mover/girar/escalar separados do modo de navegação, edição numérica, travar, ocultar, isolar, desfazer e refazer
- modos standard, holographic, wireframe, x-ray e engineering (caixas delimitadoras e medidas reais)
- Exploded View radial com slider, pausa e reversão
- **Editor de geometria (v1):** mover vértices (seleção por clique, Shift soma, gizmo, vértices na mesma posição se movem juntos, normais recalculadas) e booleanas entre duas malhas (união, subtração, interseção, com `three-bvh-csg`), ambos com desfazer e refazer
- salvar e restaurar sessão (câmera, transformações, visibilidade, travas) no `localStorage`; reset do projeto
- qualidade Low a Ultra com ajuste automático por FPS, loop sob demanda em Low, tratamento de perda de contexto WebGL
- inicialização cinematográfica interrompível, respeito a `prefers-reduced-motion`, navegação por teclado

## Limitações e pendências (não concluído)

- **Sem armadura embutida.** O app é um editor de modelos GLB em geral; o reator ARC só ganha luz própria se o arquivo tiver uma malha com "arc", "reactor" ou "reator" no nome.
- **Editor de geometria:** só mover vértices e booleanas. Extrudar, esculpir, adicionar ou remover vértices e faces **não existem**. Edições de vértices e booleanas valem na sessão (com desfazer) mas **não são salvas** em `localStorage` e **não há exportação** do modelo editado (exportar GLB depende de decisão sua). Limite de 50.000 vértices únicos por malha editada; malhas com skinning, morph targets ou posições quantizadas não são editáveis. Booleanas pedem malhas fechadas para resultado confiável (o painel avisa quando a malha é aberta) e rodam de forma síncrona.
- **Oclusão ambiental**: não implementada. Há sombra de contato e bloom.
- **Instancing, LOD e compressão de textura** não foram aplicados: dependem do modelo real.
- Malhas com skinning aparecem na pose de bind nos modos holographic e x-ray.
- Mobile: layout reorganizado, mas **não testado em dispositivo real**. O teste de navegador usou renderização por software (SwiftShader), então FPS medido não é representativo.
- Exportação, armazenamento remoto, login e colaboração: fora do escopo até você pedir.
- "Grupos mecânicos" na árvore refletem só a hierarquia do arquivo.
