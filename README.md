# DesignLabMoveis 1.310.00 — Fase 10: runtimeModel + moduleRegistry

Esta fase prioriza **estabilidade do wiring**, não redução artificial de linhas. O `js/app.js` continua sendo o bootstrap mínimo e `js/editor-runtime.js` permanece como orquestrador explícito. A quantidade de linhas do runtime pode crescer um pouco nesta fase porque dependências antes escondidas em optional chaining passaram a ficar nomeadas e auditáveis.

## 1. runtimeModel agora é a fonte de verdade do estado central

`js/modules/runtime-model.js` continua criando as coleções e objetos mutáveis centrais do CAD (`objects`, `spaceRoots`, `raycaster`, `pointer`, grupos de usinagem, vetores de interação etc.).

A diferença é que `editor-runtime.js` **não desestrutura mais** o retorno de `createRuntimeModel()` em dezenas de variáveis soltas. Os módulos consumidores recebem `runtimeModel` e acessam explicitamente, por exemplo:

```js
runtimeModel.objects
runtimeModel.spaceRoots
runtimeModel.raycaster
runtimeModel.pointer
```

Também foram removidos dos argumentos das factories os aliases redundantes como `objects: runtimeModel.objects` e `raycaster: runtimeModel.raycaster`. Estado mutável fica no `runtimeModel`; o registry não é usado para estado.

## 2. Auditoria dos late-bindings

O levantamento da base 1.309.00 encontrou **332 ocorrências reais** do padrão ad-hoc `(...a) => func?.(...a)`. A contagem de 67 era parcial/mais antiga; esta fase auditou todas as ocorrências encontradas no arquivo atual.

Classificação canônica em `LATE_BINDING_AUDIT_1.310.00.csv`:

- **303 — `i-registry`**: dependências de bootstrap/ciclos funcionais que não podem ser resolvidos só movendo a factory.
- **24 — `ii-direct`**: o fornecedor já existia antes do consumidor; o wrapper tardio não era necessário.
- **5 — `ii-reorder`**: dependências de `cad-input` em `camera-navigation`, eliminadas reordenando a inicialização.

Os 5 callbacks eliminados por reordenação são: `cadZoomPrepareIn`, `cadZoomPrepareTouchIn`, `cadZoomResetOut`, `returnTo3D` e `remember3DView`.

O scan final não encontra nenhuma ocorrência do padrão legado `(...a)=>func?.(...a)` no `editor-runtime.js`.

**Correção da auditoria:** a primeira versão do scanner classificou 331 ocorrências, mas havia uma segunda ocorrência de `selectedCellInfo:(...a)=>library?.selectedCellInfo?.(...a)` dentro do `bindUiEvents({...})`. O coletor antigo inferia o consumidor principalmente em blocos atribuídos, como `x=createXModule({...})`; `bindUiEvents({...})` é chamado diretamente, sem atribuição, então esse bloco não foi associado a um consumidor e ficou fora da auditoria. A linha ser muito densa ajudou a esconder visualmente o resíduo, mas o ponto cego real era a detecção de **binders diretos sem atribuição**, não o tamanho da linha. A auditoria corrigida agora tem **332 ocorrências**. O scan final foi trocado por uma varredura por ocorrência de `target:(...a)=>...` independente do tipo de bloco consumidor.

## 3. moduleRegistry explícito

Novo arquivo: `js/modules/module-registry.js`.

Ele mantém apenas **APIs funcionais de módulos** que precisam ser resolvidas durante ciclos de bootstrap. O acesso fica pesquisável no código:

```js
moduleRegistry.register('doorsDrawers', doorsDrawers);
moduleRegistry.callIfReady('doorsDrawers', 'createDoorsInRegion', ...args);
```

O registry também oferece `require`, `requireMethod` e `call` para dependências que precisam obrigatoriamente estar prontas. `callIfReady` preserva o comportamento tolerante dos ciclos antigos durante bootstrap, mas agora o fornecedor e o método ficam explícitos e auditáveis.

Há **305 chamadas `callIfReady`** no runtime final: as 303 da categoria `i-registry` e 2 acessos a `productionClone` que já eram late accesses, mas não usavam exatamente o padrão `(...a)=>x?.(...a)` e por isso não faziam parte das 332 linhas da auditoria corrigida.

## 4. Ordem de inicialização corrigida

`camera-navigation` agora é criado antes de `cad-input`. `cad-input` recebe diretamente as cinco funções de navegação que antes eram wrappers tardios. O objeto `last3DView` é compartilhado explicitamente entre os dois módulos.

## 5. Offline / Service Worker

`sw.js` foi atualizado para `1.310.00-r4` e inclui `js/modules/module-registry.js` no App Shell. O grafo de imports locais foi comparado com o cache do Service Worker para impedir módulo novo ausente no modo offline.

## Validação automática executada

- `node --check` em todos os JavaScripts;
- resolução de todos os imports relativos locais;
- travessia do grafo a partir de `js/app.js`;
- conferência de cobertura do grafo pelo App Shell do Service Worker;
- validação de `version.json`, `manifest.json` e `.well-known/assetlinks.json`;
- conferência de que módulos consumidores de estado recebem `runtimeModel`;
- conferência de que nenhum campo do `runtimeModel` continua sendo desestruturado de `ctx`;
- conferência de que todos os módulos citados por `moduleRegistry.callIfReady` são registrados uma vez;
- conferência de que todos os métodos citados pelo registry aparecem na API retornada pelo módulo fornecedor;
- smoke sintético das funções puras: envelope de porta com dois vãos, motor básico de plano de corte e comportamento do moduleRegistry.

## Smoke test manual obrigatório em Firefox e Chrome

O ambiente de refatoração não executa o fluxo visual completo do navegador. Antes de publicar, testar exatamente:

| Fluxo | Módulos diretamente envolvidos |
|---|---|
| Criar espaço e cortar vão | `runtime-model.js`, `spaces-cuts.js`, `space-editor.js`, `space-healing.js` |
| Criar porta com 1 e 2+ vãos / criar gavetas | `doors-drawers.js`, `piece-editor.js`, `geometry-core.js`, `production-materials.js` |
| Selecionar e mover peça | `selection-3d.js`, `interaction-helpers.js`, `piece-inspector.js`, `runtime-model.js` |
| Trena, snap, guia e zoom | `tape-movement.js`, `tool-controller.js`, `cad-input.js`, `camera-navigation.js` |
| Desfazer/refazer após criar, mover e cortar | `editor-history.js`, `geometry-core.js`, `spaces-cuts.js`, `doors-drawers.js` |
| Modo Visual / sombras / Raio-X / voltar 2D→3D | `cad-appearance.js`, `camera-navigation.js`, `cad-input.js`, `3d-engine.js` |
| Plano de corte e exportações | `cut-plan-ui.js`, `cut-plan.js`, `production-suite.js`, `production-export-helpers.js`, `production-materials.js` |
| Salvar, fechar e reabrir projeto | `projects.js`, `editor-history.js`, `cloud-account.js` |
| Login/Premium/Admin e atualização | `auth.js`, `cloud-account.js`, `admin.js`, `app-update.js` |

Se esses fluxos passarem nos dois navegadores, a Fase 10 pode ser considerada estabilizada. Não há objetivo de reduzir o runtime a um número arbitrário de linhas; wiring explícito e correto é preferível a esconder dependências.

## 7. Status do smoke test manual

A Fase 10 **não deve ser considerada estabilizada apenas pelas validações estáticas**. O smoke test manual completo precisa ser executado em Chrome/Chromium **e** Firefox, cobrindo: criar/cortar espaço; porta 1 e 2+ vãos; gavetas; selecionar/mover peça; Trena/snap/guia/zoom com mouse e pinça; 2D↔3D; desfazer/refazer após criar/mover/cortar; Visual/sombras/Raio-X; plano de corte/exportações; salvar/fechar/reabrir projeto; login/Premium/Admin/atualização.

O pacote r2 corrige o resíduo da auditoria e passa validações estáticas/grafo/offline, mas o resultado só deve ser marcado como **estabilizado** depois desse roteiro manual em ambos os navegadores.

## Hotfix r3 — smoke test local

Durante o smoke test real no navegador foi encontrado um erro de wiring que a validação sintática não detectava: `XRAY_3D_KEY` era passado por shorthand ao `tool-dock`, mas deixou de existir no escopo do `editor-runtime.js` após a extração de aparência. O `tool-dock` agora recebe explicitamente `CAD_APPEARANCE_KEYS.xray`.

A mesma auditoria de escopo encontrou três referências que seriam os próximos `ReferenceError`: `mmPrec`, `shapeCopyPieceEligible` e `shapeDeepClone`. As três já eram exportadas por `machining-shapes.js`, mas não eram desestruturadas no runtime antes de serem passadas a `production-materials.js`. Isso foi corrigido no mesmo hotfix.

Build: **1.310.00-r4**.

## Hotfix r4 — portas e menu de espaço

O smoke test real encontrou dois problemas no fluxo de Porta/Gaveta:

- O `createDoorsDrawersModule()` desestruturava o helper `m` (conversão mm → metros), mas `editor-runtime.js` não o repassava à factory. O erro só aparecia ao confirmar a criação da porta (`m is not a function`). O wiring agora passa `m` explicitamente.
- O duplo clique em um espaço mostrava simultaneamente o menu rápido central **Adicionar ao espaço** e a barra inferior **Seleção de espaços**. A barra inferior foi aposentada visualmente; sua API foi mantida apenas por compatibilidade. O menu rápido central é agora a única interface visível para Porta/Gaveta.

A seleção múltipla continua disponível: no PC, `Ctrl + clique` adiciona/remove referências e o duplo clique abre o menu central; no celular, toque longo adiciona a referência e abre o mesmo menu.

Build: **1.310.00-r4**.
