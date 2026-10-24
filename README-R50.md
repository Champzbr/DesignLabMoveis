# DesignLabMoveis 1.312.00-r50 — Correção isolada de furos passantes

- Corrige bloqueio da geração de furos passantes em peças retangulares que guardam metadados `formProfile` apesar de não possuírem formas especiais ativas.
- Mantém o uso de `THREE.ExtrudeGeometry` com recortes circulares; sem CSG da r47.
- Valida as dimensões finais da malha antes de substituir a peça.
- Mantém a marcação rosa para furo cego, copo de dobradiça, furo em testa não suportado ou peça com rasgos simultâneos. **Estas operações ainda não são cavadas.**
- Mantidos rasgos reais e interface clássica; nenhuma alteração intencional nos formatos de produção.
- Testar uma única chapa com um único furo Ø5 passante e conferir os dois lados, antes de publicar projetos de produção.
- Não requer atualização do Worker Cloudflare.
