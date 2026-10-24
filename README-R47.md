# r47 — Furos sólidos no CAD 3D

- Em peças retangulares, furos cilíndricos, copos de dobradiça e séries passam a remover material visualmente.
- Furos passantes respeitam a face de entrada e atravessam a peça; cegos respeitam profundidade.
- Furos e rasgos podem coexistir; a malha de corte é recalculada somente se a usinagem mudar.
- Fallback visual em casos complexos (mais de 24 cortes, peças curvas ou perfis especiais).
- Não modifica coordenadas ou programas de produção; verificar antes da máquina.
- Layout clássico mantido. Não exige atualização do Cloudflare Worker.
