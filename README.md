# DesignLabMoveis 1.311.00 — Fase 10: runtimeModel + moduleRegistry

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

Classificação canônica em `LATE_BINDING_AUDIT_1.311.00.csv`:

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

`sw.js` foi atualizado para `1.311.00-r8` e inclui `js/modules/module-registry.js` no App Shell. O grafo de imports locais foi comparado com o cache do Service Worker para impedir módulo novo ausente no modo offline.

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

Build: **1.311.00-r8**.

## Hotfix r4 — portas e menu de espaço

O smoke test real encontrou dois problemas no fluxo de Porta/Gaveta:

- O `createDoorsDrawersModule()` desestruturava o helper `m` (conversão mm → metros), mas `editor-runtime.js` não o repassava à factory. O erro só aparecia ao confirmar a criação da porta (`m is not a function`). O wiring agora passa `m` explicitamente.
- O duplo clique em um espaço mostrava simultaneamente o menu rápido central **Adicionar ao espaço** e a barra inferior **Seleção de espaços**. A barra inferior foi aposentada visualmente; sua API foi mantida apenas por compatibilidade. O menu rápido central é agora a única interface visível para Porta/Gaveta.

A seleção múltipla continua disponível: no PC, `Ctrl + clique` adiciona/remove referências e o duplo clique abre o menu central; no celular, toque longo adiciona a referência e abre o mesmo menu.

Build: **1.311.00-r8**.


## Hotfix r5 — divisão vertical centralizada

O smoke test real no Windows encontrou `mergeIntervals is not a function` ao criar uma **Divisão vertical** com medida **0 mm = centralizar**. A causa era de wiring: `spaces-cuts` nasce antes de `library`, mas recebia por shorthand quatro helpers da Biblioteca (`mergeIntervals`, `fixedIntervalsFromSpace`, `structuralFixedIntervalsFromRoot` e `makeBalancedSpaceAxisMapper`). Nesse momento as variáveis ainda eram `undefined` e o módulo congelava esse valor.

O runtime agora resolve esses quatro helpers pelo `moduleRegistry` no momento da chamada. O botão **Criar** também ganhou trava curta contra duplo clique/toque para não duplicar a peça por reenvio rápido.

Build: **1.311.00-r8**.


## 1.311.00-r8 — seleção de vãos no touch

- Celular: duplo toque em um vão adiciona/remove esse vão da seleção de porta.
- Celular: toque longo abre o menu Porta/Gaveta usando os vãos já selecionados; o último vão pressionado é incluído se ainda não estiver na seleção.
- O `dblclick` sintético gerado pelo Android/WebView após dois toques é bloqueado para não abrir o menu antes da hora.
- PC mantém Ctrl+clique para seleção múltipla e duplo clique para abrir o menu rápido.


## Hotfix r8 — Trena por ponto

No smoke test real no celular, a Trena em modo **por ponto** lançava `referenceMeshes is not a function`, enquanto a Trena por peça seguia funcionando.

A causa era novamente late-binding de bootstrap: `tapeMovement` é criado antes de `spacesCuts`, porém recebia `referenceMeshes` por shorthand. Nesse instante a variável ainda era `undefined` e esse valor ficava congelado dentro do módulo. Os caminhos da Trena por ponto usam `referenceMeshes()` para snap/raycast em cantos, arestas e linhas de referência; por isso o erro aparecia ao escolher o ponto.

O wiring de `tapeMovement` agora resolve `spacesCuts.referenceMeshes` pelo `moduleRegistry` no momento da chamada, com fallback seguro para `[]`. A Trena por peça não foi alterada.

Build: **1.311.00-r8**.

## Hotfix 1.311.00-r8
- Frentes de gaveta com opção de criar frentes agora ficam inteiramente dentro do vão; a caixa e a corrediça descontam a espessura da frente para não sobrepor.
- Criar Fundo: o campo de recuo vira “Afastar da traseira (mm)” e o painel corta o espaço em duas regiões livres (atrás e à frente), evitando encavalamento.


### r12 · Fundo com seleção de lados de usinagem
- Criar Fundo agora repete o padrão visual/funcional usado em Gavetas: checkboxes individuais para escolher quais peças recebem rasgo.
- Lados disponíveis: lateral esquerda, lateral direita, chapéu/cima e base/baixo.
- O fundo continua podendo passar medidas independentes em cada lado; somente os lados marcados recebem usinagem automática.
- A seleção é salva junto da configuração do tipo Fundo.


## r14 · Windows sem banner PWA
- Quando aberto com `?desktop=windows` ou pelo user-agent do app Windows, o banner **Abrir como aplicativo / Instalar** é desativado.
- O app Windows não registra Service Worker/PWA duplicado; continua usando o Netlify diretamente para login, conta e projetos.
- Essa mudança evita trabalho duplicado de PWA/cache dentro de um programa que já é desktop, sem reduzir a qualidade do render 3D.


### r15
- Exportação Aspire: fallback automático para download quando File System Access perde a ativação do usuário (User activation required), comum em PWA/WebView/Electron.


## Hotfix 1.311.00-r8
- Remove layers-base vazias como `CORTE_EXTERNO`/`CORTE_INTERNO` do DXF Aspire.
- Contornos passam a aparecer somente como `CORTE_EXTERNO_E<espessura>_P<profundidade>`.
- Corte interno e encaixes seguem o mesmo padrão.
- No modo seccionadora, a layer passa a ser `CORTE_SECCIONADORA_E<espessura>_P<profundidade>`.
- Não altera posição, contorno ou quantidade de vetores; muda somente o nome/organização das layers.


## 1.311.00-r8 · Ripas
- Novo botão **Ripas** no submenu Criar peças.
- Toque curto: cria diretamente usando a última configuração.
- Pressionar/segurar: abre configuração da ripa.
- Orientação horizontal ou vertical; posição na frente ou no fundo; tamanho e posição no vão.
- 0 mm na posição centraliza a ripa.
- A espessura usa a espessura padrão da peça/material.
- A caixa ocupada pela ripa é subtraída da célula selecionada, gerando automaticamente os novos espaços livres sem encavalar a peça.

## r20 · Sarrafos estruturais
- Novo botão **Sarrafos** em **Criar peças** e no menu rápido inferior.
- Toque cria com a última configuração; segurar abre as opções.
- Configuração independente das Ripas: horizontal/vertical, frente/fundo, tamanho e posição no vão.
- O sarrafo é uma peça fabricável normal, pode sobrepor peças existentes e entra na lista/plano de corte/Aspire.
- Diferente de Ripas, **Sarrafos não recortam nem dividem os espaços**. São tratados como reforço estrutural.


## r21 · Sarrafo: orientação física + local no móvel
- Sarrafo atravessa toda a largura do vão e fica sempre na parte superior.
- Local: Superior frontal ou Superior traseiro.
- Horizontal = deitado (tamanho na profundidade, espessura na altura).
- Vertical = em pé (espessura na profundidade, tamanho na altura).
- Continua estrutural, pode sobrepor peças e não recorta/divide o espaço.


## r22 — correção de inicialização/login
- Corrige boot interrompido por `pieceRailPosition` removido da UI na r21.
- Registro de eventos de controles opcionais agora usa guarda segura, evitando `null.addEventListener`.
- Nenhuma alteração na lógica de login/conta Netlify; a falha acontecia antes do bootstrap da autenticação.


## 1.311.00-r8 — sarrafo recorta o espaço útil

Sarrafos superiores agora recortam simultaneamente a profundidade e a altura úteis do vão. Em sarrafo horizontal de 100 mm com MDF 18 mm, um vão de profundidade 600 mm passa a ter 500 mm de profundidade útil e perde 18 mm na altura. Frente/traseira define de qual lado a profundidade é descontada.


## r24 — Sarrafo frontal/traseiro + corte só no topo
- Atalhos separados: Sarrafo frontal e Sarrafo traseiro, com ícones próprios.
- Deitado: reduz a altura do vão apenas pela espessura (ex.: 18 mm).
- Em pé: reduz a altura apenas pela largura/tamanho do sarrafo (ex.: 60 mm).
- A profundidade do espaço não é reduzida.


## r25 · Sarrafos por volume + vistas do espaço
- Sarrafo deitado: altura ocupada = espessura; profundidade ocupada = tamanho do sarrafo.
- Sarrafo em pé: altura ocupada = tamanho; profundidade ocupada = espessura.
- O recorte do espaço usa apenas a caixa física do sarrafo, preservando uma faixa oposta na profundidade para outro sarrafo.
- Quatro atalhos: superior frontal/traseiro e inferior frontal/traseiro.
- Configuração do espaço abre diretamente o painel com vistas Frontal/Traseira/Laterais/Cima/Baixo.


## r26
- Gavetas: espessura da caixa agora é escolhida explicitamente entre 15 mm e 18 mm.
- Conjuntos antigos com espessura diferente continuam editáveis sem perda de dados.

## 1.311.00-r8 · Presets completos de gavetas + tamponamento

- A biblioteca de gavetas agora salva a configuração completa: corrediça, quantidade, caixa, frentes, fundo, usinagens, furação e tamponamento.
- Novo tamponamento para dobradiças: esquerdo, direito ou ambos, com espessura/afastamento e recuos frontal/traseiro.
- O tamponamento é peça MDF real, entra em lista de peças/plano de corte/Aspire e reduz automaticamente a largura útil das gavetas/frentes.
- Quando o tamponamento existe, a furação automática da corrediça usa o próprio tamponamento como apoio lateral.


## 1.311.00-r8 · Tamponamento por ripas internas + rolagem em Ferramentas
- O recuo frontal/traseiro passa a posicionar a ripa interna do tamponamento, em vez de encurtar uma peça de profundidade inteira.
- Novo comprimento da ripa interna (padrão 60 mm); exemplo: 60 mm com recuo frontal 50 mm começa 50 mm após a frente.
- Ripa frontal e traseira podem ser ativadas de forma independente.
- A espessura/afastamento lateral continua descontando a largura útil da gaveta.
- O painel flutuante Ferramentas agora possui rolagem vertical para acessar todos os menus.


## 1.311.00-r8 · geometria do tamponamento confirmada pelo MCAD
- A ripa frontal/traseira usa a medida de profundidade (ex. 60 mm) apenas no eixo frente↔trás.
- O afastamento lateral (ex. 18 mm) desloca o conjunto da gaveta para dentro.
- A caixa começa após `afastamento lateral + folga da corrediça`; a profundidade de 60 mm da ripa não entra nesse cálculo lateral.
- Configuração de gavetas continua salvando esses valores no preset.

## 1.311.00-r8
- Tamponamento de gaveta corrigido para representar o conjunto físico completo: ripas curtas de afastamento + lateral interna inteira antes da corrediça/gaveta.
- A frente da gaveta passa a usar o vão útil após a lateral interna, ficando embutida em relação a ela.
- Presets de gaveta restauram corretamente valores decimais em campos `type=number`, inclusive a folga por lado da corrediça (ex.: 12.7 mm).
- Campos de recuo frontal/traseiro reorganizados para evitar sobreposição de textos em janelas estreitas.

## 1.311.00-r8 · Zoom Windows
- O zoom por roda do mouse no aplicativo Windows agora usa como pivô a superfície sob o cursor, em vez de depender apenas do target/origem do OrbitControls.
- O pivô é reancorado gradualmente no móvel durante a aproximação, evitando perda de velocidade quando o projeto foi movido para longe do XYZ.
- Permite aproximação muito maior antes de limitar o zoom e reduz dinamicamente o near plane para evitar corte visual perto da peça.
- A mudança é ativada somente quando `DesignLabDesktop.isDesktop` indica Windows. Navegação mobile e navegador comum permanecem inalteradas.


## 1.311.00-r8 · foco dos campos no Windows

- Mantém o zoom e a órbita da r6 sem alterações.
- Campos `input`, `textarea` e `select` não disparam mais fechamentos globais de menus/painéis no mesmo `pointerdown`.
- No Windows, o foco do campo é restaurado ao fim do evento quando algum listener global o remove durante a transição de painéis.
- A correção é defensiva e não altera valores, validações nem cálculos dos formulários.


## 1.311.00-r8 · veio universal + plano de corte
- Compensado Naval passa a vir com veio no comprimento por padrão.
- Qualquer material de chapa pode usar o checkbox de veio e direção comprimento/largura.
- Peça marcada com veio não entra mais na rotação livre de 90°, inclusive compensado.
- Materiais com mesmo nome mas cadastros/direções diferentes não são misturados na mesma chapa.
- Otimização avançada vira padrão e testa mais ordens determinísticas para buscar menor número de chapas.


## 1.311.00-r15 · plano seguro + melhor aproveitamento

- Base retomada da 1.311.00-r8; as tentativas r9/r10 sobre bloqueio/rotação de peça não fazem parte desta versão.
- Alterações de chapa/veio/configuração do plano agora são transacionais: se a nova configuração fizer qualquer peça deixar de caber, o último plano válido é restaurado automaticamente em vez de zerar/desaparecer as peças.
- O plano anterior continua disponível para abrir, imprimir e exportar; o aviso informa qual alteração foi cancelada e qual peça não coube.
- Otimização avançada guilhotina ganhou mais ordens determinísticas e passou a favorecer sobras maiores/concentradas quando o número de chapas empata.
- Seccionadora ganhou ordens determinísticas adicionais e, em empate de número de chapas, prioriza sobras maiores e menos fragmentadas antes de comparar cortes/giros.


## 1.311.00-r15
- Plano de corte: segurar uma peça abre **Transferir peça** com as chapas compatíveis do mesmo material/espessura.
- O destino é testado antes da mudança; se não couber com veio, margem e corte atuais, a chapa fica desabilitada e nada muda.
- A transferência repacota apenas as chapas de origem/destino para manter um plano válido e pode ser revertida por **Voltar ao automático**.
- A preferência manual da peça é salva junto ao projeto/MCAD e participa das exportações do plano.


## 1.311.00-r15 — sentido do veio unificado

- Corrigida a inversão entre o otimizador e o verificador de produção.
- `VEIO 0°` agora acompanha `faceW` (comprimento natural exibido primeiro, ex.: 1527 em uma peça 1527 × 451).
- `VEIO 90°` acompanha `faceH`.
- Em chapa com veio no comprimento (ex.: 2750 × 1850), peça 1527 × 451 com veio 0° fica 1527 paralela aos 2750.
- Plano de corte, validação de encaixe e setas/etiquetas usam a mesma convenção.


## 1.311.00-r15
- Corrigido sentido do veio: 0° acompanha o maior lado da peça e 90° o menor.
- Porta 540 × 2990 com veio 0° passa a alinhar 2990 ao comprimento da chapa; painel 1527 × 451 alinha 1527.
- Verificador de produção, otimizador e setas do plano usam a mesma convenção.

## 1.311.00-r15 · chapa por material
- O plano de corte não usa mais um tamanho global editável de chapa.
- Cada grupo usa `sheetWidth`, `sheetHeight`, `grain` e `grainDirection` do material cadastrado.
- Projetos mistos são calculados juntos na mesma tela, mas sem misturar estoques: MDF 2750×1850 continua em MDF e Compensado Naval 3050×1610 continua em Compensado Naval.
- Refilo, espessura de corte e estratégia de otimização continuam configuráveis globalmente.
