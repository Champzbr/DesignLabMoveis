# DesignLabMoveis 1.312.00-r53 — Furos cegos

- Furos cegos em faces principais de chapas retangulares: cavidade circular na geometria com fundo fechado na profundidade cadastrada.
- A construção por camadas usa ExtrudeGeometry, sem a subtração CSG que danificou a geometria na r47.
- Furos passantes continuam com a geometria existente, e rasgos permanecem no caminho da r51.
- Limitado a faces correspondentes à espessura da peça, sem formas curvas, rasgos simultâneos ou furos que se sobrepõem.
- Peças com operações não suportadas mantêm os marcadores; não alteramos DXF/ZAW ou dados de fabricação.
- Não foi testado em navegador real. Verifique cavidade, fundo, remoção e alterações de operações antes de produzir.
- Não exige atualização do Worker Cloudflare.
