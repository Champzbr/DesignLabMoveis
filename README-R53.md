# DesignLabMoveis r53 — usinagens combinadas

- A mesma chapa pode ter vários furos cegos e passantes junto com vários rasgos retos na espessura principal.
- Construção de malha por fatias e contornos ortogonais, sem o CSG que danificou a r47.
- Furos em série são expandidos e considerados junto com rasgos.
- Não há limite fixo de 24 furos para a combinação; há proteções de complexidade para não travar o CAD.
- Em colisões entre furos e rasgos, círculos sobrepostos ou formas especiais, é preservada a geometria segura anterior com marcadores de operações não resolvidas.
- Contornos e medidas CNC/ZAW, dados de fabricação, QR, layout clássico e interface mobile não são alterados intencionalmente.
- Experimente primeiro numa chapa de testes com 1 rasgo e 2 furos Ø5×8 mm, depois múltiplos rasgos e passantes.
- Requer teste de renderização no navegador antes de uso em produção. Não requer Worker Cloudflare.
