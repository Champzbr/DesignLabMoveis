#!/usr/bin/env python3
from pathlib import Path

HERE=Path(__file__).resolve().parent
SRC=HERE/'src'
ORDER=['01-core-projects.js', '02-scene-editor.js', '03-materials-spaces.js', '04-movel-curvo.js', '05-trena-estado-peca.js', '06-pecas-portas-gavetas.js', '07-biblioteca-usinagem-etiquetas.js', '08-exportacao-aspire.js', '09-espacos-cortes-curvo-ui.js', '10-plano-corte-eventos.js']
text=''.join((SRC/name).read_text(encoding='utf-8') for name in ORDER)
(HERE/'app.js').write_text(text,encoding='utf-8')
print(f'app.js gerado: {len(text)} bytes / {len(ORDER)} partes')
