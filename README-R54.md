# DesignLabMoveis 1.312.00-r54 — Contornos de rasgos

- Restabelece as linhas de contorno escuras na boca dos rasgos quando existem furos e rasgos na mesma peça.
- Reutiliza as coordenadas geométricas dos rasgos na malha combinada, incluindo rasgos que terminam na borda.
- As linhas são apenas auxiliares de visualização: não modificam a cavidade, profundidade, DXF, ZAW ou etiquetas.
- Mantém o comportamento da r53 para múltiplos furos cegos/passantes e rasgos.
- Atenção: interseções de furos com rasgos ainda obedecem aos limites/fallbacks da r53.
- Atualizados HTML, Service Worker e version.json para evitar mistura de caches.
- Não é necessário atualizar o Worker Cloudflare.
- Validar no navegador com uma peça de teste e a câmera em diferentes ângulos.
