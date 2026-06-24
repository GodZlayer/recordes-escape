# Painel de Recordes

Este projeto gera um painel visual de recordes para salas, com uma tela de lista, uma tela de foto para cada recorde e exportacao em video MP4. A tela principal fica em `index.html`, os dados ficam em XML, os designs visuais ficam em fragmentos HTML/SVG, e o menu de manutencao roda pelo `painel.bat`.

## Estrutura dos arquivos

| Caminho | Funcao |
| --- | --- |
| `index.html` | Tela principal do painel. Carrega XMLs, aplica configuracoes, renderiza a lista, troca para a tela de foto e contem o CSS das animacoes. |
| `config.xml` | Configuracoes gerais: quantidade de salas, design usado, float, brilho e velocidade por area. |
| `records.xml` | Dados dos recordes: sala, equipe, tempo e estilo de texto de cada sala. |
| `design-*.html` | Fragmentos HTML/SVG usados no topo do quadro de recordes. |
| `photo-design-*.html` | Fragmentos HTML/SVG usados sobre a tela de foto da sala. |
| `fotos/` | Fotos das equipes/salas. O nome deve ser o ID da sala: `1.jpeg`, `2.png`, etc. |
| `salaslogos/` | Logos das salas em SVG. O nome deve ser o ID da sala: `1.svg`, `2.svg`, etc. |
| `painel.bat` | Atalho para abrir o gerenciador pelo CMD/Prompt do Windows. |
| `scripts/video-manager.mjs` | Menu interativo para editar recordes, trocar fotos/logos, trocar designs e gerar video. |
| `scripts/generate-video-mp4.mjs` | Renderiza o painel em frames com Playwright/Chrome e monta MP4 com FFmpeg. |
| `scripts/vectorize-png-to-svg.mjs` | Converte uma logo PNG para SVG usando `potrace`. |

## Como o painel funciona

1. O navegador abre `index.html`.
2. `index.html` chama `loadConfig()` e tenta ler `config.xml`.
3. A configuracao define:
   - quantas salas aparecem;
   - qual `design-N.html` sera carregado no topo;
   - qual `photo-design-N.html` sera carregado na tela de foto;
   - como float e brilho se comportam no topo, na lista e na foto.
4. Depois o painel le `records.xml`.
5. `renderRecords()` monta a lista usando o template interno `#entry-template`.
6. `startPhotoCycle()` cria o ciclo automatico:
   - lista por 11 segundos;
   - transicao com wipe;
   - foto do recorde por 6 segundos;
   - transicao de volta para a lista;
   - repete para todas as salas ativas.

Uma sala so entra na tela de foto se tiver `id` entre `1` e a quantidade ativa de salas, e se `room`, `team` e `time` nao estiverem vazios.

## `records.xml`

Exemplo:

```xml
<record id="1" style="plain">
  <room>Emboscada</room>
  <team>Vigil-Antes</team>
  <time>32:43</time>
</record>
```

Campos:

| Campo | O que altera |
| --- | --- |
| `id` | Numero da sala. Tambem define quais imagens serao usadas: `fotos/ID.*` e `salaslogos/ID.svg`. |
| `style` | Estilo do texto do nome da sala na lista. `plain` usa fonte menor/mais simples; `script` usa fonte manuscrita maior. |
| `room` | Nome da sala. |
| `team` | Nome da equipe recordista. |
| `time` | Tempo do recorde. |

O JavaScript aceita ate 7 salas porque `maxRooms = 7` em `index.html`.

## `config.xml`

Exemplo atual:

```xml
<config>
  <salas quantidade="7" />
  <design numero="2" />

  <topo>
    <floatIndividual>1</floatIndividual>
    <forcaFloat>1.0</forcaFloat>
    <velocidadeFloat>1.0</velocidadeFloat>
    <brilhoSempreAtivo>2</brilhoSempreAtivo>
    <forcaBrilhoMaxima>1.0</forcaBrilhoMaxima>
    <tipoBrilho>1</tipoBrilho>
    <velocidadeWaveBrilho>1.0</velocidadeWaveBrilho>
  </topo>

  <lista>...</lista>

  <foto>
    <design numero="3" />
    ...
  </foto>
</config>
```

### Configuracoes gerais

| XML | Valor | O que modifica |
| --- | --- | --- |
| `<salas quantidade="7" />` | `1` a `7` | Quantas salas aparecem na lista e entram no ciclo de fotos. |
| `<design numero="2" />` | `1`, `2`, `3`... | Escolhe o arquivo `design-N.html` usado no topo do quadro. |
| `<foto><design numero="3" /></foto>` | `1`, `2`, `3`... | Escolhe o arquivo `photo-design-N.html` usado na tela de foto. |

Se um design escolhido nao existir, o painel tenta usar um fallback interno e depois tenta voltar para o design `1`.

### Secoes `topo`, `lista` e `foto`

As tres secoes usam quase os mesmos controles:

| XML | Faixa | O que modifica |
| --- | --- | --- |
| `floatIndividual` | `0` a `1` no `topo`; `0` a `2` na `lista`; `0` a `1` na `foto` | Define o modo de flutuacao. |
| `forcaFloat` | `0` a `2` | Distancia do movimento. `0` para o movimento; `1` e o normal; `2` dobra a forca. |
| `velocidadeFloat` | `0` a `2` | Velocidade do movimento. `0` pausa; `1` e normal; `2` dobra a velocidade. |
| `brilhoSempreAtivo` | `0` a `2` | Define o brilho: `0` desligado, `1` brilho fixo, `2` brilho animado. |
| `forcaBrilhoMaxima` | `0` a `2` | Intensidade do brilho e do `drop-shadow`. |
| `tipoBrilho` | `1` a `4` | Tipo da animacao de brilho. |
| `velocidadeWaveBrilho` | `0` a `2` | Velocidade do brilho animado. `0` pausa; `1` normal; `2` mais rapido. |

Modos de `floatIndividual`:

| Area | Valor | Comportamento |
| --- | --- | --- |
| `topo` | `0` | O topo inteiro flutua junto. |
| `topo` | `1` | Elementos com `top-float-item` flutuam individualmente. |
| `lista` | `0` | A lista inteira flutua junto. |
| `lista` | `1` | Icones e fitas da lista flutuam individualmente. |
| `lista` | `2` | Cada linha da lista deriva/flutua separadamente. |
| `foto` | `0` | A composicao inteira da foto flutua junto. |
| `foto` | `1` | Elementos com `photo-float-item` flutuam individualmente. |

Tipos de brilho:

| `tipoBrilho` | Animacao CSS | Efeito |
| --- | --- | --- |
| `1` | `brightness-wave` | O brilho sobe e desce suavemente. |
| `2` | `brightness-square` | Alterna entre apagado e aceso em blocos. |
| `3` | `brightness-square-variant` | Alterna apagado, brilho medio e brilho maximo. |
| `4` | `brightness-triangle` | Sobe ate o brilho maximo e volta de forma linear. |

## Logica dos SVGs e designs

Os arquivos `design-*.html` e `photo-design-*.html` nao sao paginas completas. Eles sao fragmentos carregados por `index.html` usando `fetch()`.

### `design-*.html`

Esses arquivos controlam o visual do topo do quadro, dentro do elemento `#top-design`.

Contrato principal:

- O arquivo pode conter HTML e SVG.
- O conteudo e injetado dentro de `<div class="top-brightness">...</div>`.
- Use classes `top-float-item`, `top-float-a`, `top-float-b` e `top-float-c` para que a configuracao de float do topo funcione.
- O CSS de `index.html` ja estiliza classes comuns como `.title-row`, `.title-arc`, `.badge-mark`, `.podium-mark`, `.design-2-title`, `.design-2-trophy`, `.design-2-lock`, `.design-2-rays`.

#### `design-1.html`

Usa uma estetica de giz:

- Define um filtro SVG `#chalky` com `feTurbulence` e `feDisplacementMap`.
- Cria um arco SVG para os textos `QUADRO` e `RECORDES` usando `<textPath>`.
- Cria um selo central com o texto `DE`.
- Cria um podio animado com retangulos e numeros `1`, `2`, `3`.
- Usa `<animate>` diretamente no SVG para mover a altura/posicao das colunas do podio.
- Usa linhas laterais como raios decorativos.

#### `design-2.html`

Usa um titulo unico e elementos de premio/escape:

- Cria o texto `QUADRO DE RECORDES` em arco.
- Desenha raios, trofeu, cadeados e estrelas com SVG.
- Usa classes especificas como `.design-2-trophy`, `.design-2-lock`, `.design-2-rays` e `.design-2-side-stars`.
- Depende do CSS do `index.html` para stroke, fill e posicionamento.

### `photo-design-*.html`

Esses arquivos controlam as informacoes sobrepostas na tela de foto, dentro do elemento `#photo-design`.

Contrato principal:

- O plano de fundo da foto sempre vem de `<img id="record-photo" class="photo-image">` em `index.html`.
- O design deve conter os IDs que o JavaScript preenche:
  - `photo-room`: nome da sala;
  - `photo-team`: nome da equipe;
  - `photo-time`: tempo;
  - `photo-room-logo`: opcional, logo SVG da sala.
- Use `photo-float-shell` como camada geral.
- Use `photo-brightness` para receber o brilho configurado em `config.xml`.
- Use `photo-float-item`, `photo-float-a`, `photo-float-b` e `photo-float-c` para participar do float individual.

#### `photo-design-1.html`

Layout em linhas:

- Mostra o titulo `RECORDE ATUAL`.
- Cria tres linhas com icones SVG: sala, equipe e tempo.
- Cada linha recebe um dos campos `photo-room`, `photo-team` e `photo-time`.
- Nao usa logo da sala.

#### `photo-design-2.html`

Layout compacto com logo:

- Usa `photo-room-logo` para mostrar `salaslogos/ID.svg`.
- Mostra a sala em uma faixa.
- Mostra equipe e tempo juntos em um bloco de recorde.

#### `photo-design-3.html`

Layout comemorativo:

- Cria raios, aneis, confetes e brilhos com SVG.
- Usa um badge circular para a logo da sala.
- Mostra `RECORDE`, nome da sala, equipe e tempo.
- Ativa ajustes especiais pelo CSS quando `.frame` recebe `data-photo-design="3"`.

## Como criar um novo design do topo

1. Copie um arquivo existente, por exemplo:

```text
design-2.html -> design-3.html
```

2. Edite o SVG/HTML do novo arquivo.
3. Use as classes de animacao se quiser respeitar o XML:

```html
<g class="top-float-item top-float-a">...</g>
<g class="top-float-item top-float-b">...</g>
<g class="top-float-item top-float-c">...</g>
```

4. Se criar classes novas, adicione o CSS correspondente em `index.html`.
5. Ative no `config.xml`:

```xml
<design numero="3" />
```

Tambem e possivel trocar pelo menu do `painel.bat`, opcao `A`.

## Como criar um novo design da tela de foto

1. Copie um arquivo existente:

```text
photo-design-3.html -> photo-design-4.html
```

2. Mantenha os IDs que serao preenchidos:

```html
<span id="photo-room"></span>
<span id="photo-team"></span>
<span id="photo-time"></span>
<img id="photo-room-logo" alt="" />
```

3. Envolva o conteudo com as camadas esperadas:

```html
<div class="photo-float-shell photo-design-4">
  <div class="photo-brightness">
    ...
  </div>
</div>
```

4. Marque elementos animaveis:

```html
<div class="photo-float-item photo-float-a">...</div>
```

5. Se precisar de CSS novo, adicione em `index.html`.
6. Ative no `config.xml`:

```xml
<foto>
  <design numero="4" />
</foto>
```

Tambem e possivel trocar pelo menu do `painel.bat`, opcao `B`.

## Fotos e logos das salas

Fotos:

- Ficam em `fotos/`.
- Podem ser `.jpeg`, `.png`, `.jpg` ou `.webp`.
- O painel tenta nesta ordem: `ID.jpeg`, `ID.png`, `ID.jpg`, `ID.webp`.
- Exemplo para sala 3: `fotos/3.jpeg`.

Logos:

- Ficam em `salaslogos/`.
- Devem ser SVG.
- Exemplo para sala 3: `salaslogos/3.svg`.
- O menu consegue escolher um PNG e converter para SVG automaticamente.

## `painel.bat`

O arquivo `painel.bat` e o ponto de entrada para usuarios no Windows.

Fluxo:

1. Entra na pasta do projeto com `cd /d "%~dp0"`.
2. Verifica se `node` existe no PATH.
3. Verifica se `ffmpeg` existe no PATH.
4. Se `node_modules/playwright-core/package.json` nao existir, instala `playwright-core@1.49.1`.
5. Executa:

```bat
node "%~dp0scripts\video-manager.mjs"
```

6. Se o gerenciador terminar com erro, mostra mensagem e pausa.
7. Se terminar normal, mostra `Gerenciador encerrado.` e pausa.

## Menu do gerenciador

Ao abrir `painel.bat`, o script `scripts/video-manager.mjs` mostra:

| Opcao | Acao |
| --- | --- |
| `1` a `7` | Edita o recorde da sala escolhida. |
| `A` | Altera o design do quadro/lista, escolhendo entre `design-*.html`. |
| `B` | Altera o design da tela de foto, escolhendo entre `photo-design-*.html`. |
| `8` | Gera video vertical `1080x1920`. |
| `9` | Gera video horizontal `1920x1080`, girando o retrato 90 graus no sentido horario. |
| `0` | Fecha o gerenciador. |

Ao editar uma sala, o menu permite:

- alterar nome da sala;
- alterar equipe;
- alterar tempo;
- trocar a foto;
- trocar a logo PNG e converter para SVG.

## Funcoes de `scripts/video-manager.mjs`

| Funcao | O que faz |
| --- | --- |
| `decodeXml(value)` | Converte entidades XML (`&amp;`, `&lt;`, etc.) de volta para texto normal. |
| `encodeXml(value)` | Escapa caracteres especiais antes de salvar texto no XML. |
| `parseRecords(xml)` | Le todos os `<record>` de `records.xml` e retorna objetos com `id`, `room`, `team` e `time`. |
| `updateRecordXml(xml, id, nextRecord)` | Substitui `room`, `team` e `time` de um recorde especifico mantendo o restante do XML. |
| `loadRecords()` | Le `records.xml` e retorna o XML original mais a lista parseada. |
| `loadConfigXml()` | Le `config.xml` como texto. |
| `currentListDesignNumber(configXml)` | Descobre qual `design-N.html` esta selecionado. |
| `currentPhotoDesignNumber(configXml)` | Descobre qual `photo-design-N.html` esta selecionado. |
| `updateListDesignXml(configXml, designNumber)` | Atualiza o numero do design do topo/lista em `config.xml`. |
| `updatePhotoDesignXml(configXml, designNumber)` | Atualiza o numero do design de foto em `config.xml`. |
| `listDesignOptions(kind)` | Lista arquivos `design-*.html` ou `photo-design-*.html` existentes na raiz. |
| `printMenu(records)` | Limpa a tela e imprime o menu com os recordes atuais. |
| `askWithDefault(label, currentValue)` | Pergunta um novo valor e mantem o atual se o usuario apertar Enter. |
| `openImagePicker(options)` | Abre uma janela do Windows para escolher imagem usando PowerShell e Windows Forms. |
| `writePngAsSvg(sourcePath, targetPath)` | Chama `vectorize-png-to-svg.mjs` para transformar PNG em SVG. |
| `replacePhoto(id)` | Copia uma nova imagem para `fotos/ID.ext` e remove outras imagens antigas do mesmo ID. |
| `replaceLogo(id)` | Escolhe um PNG, converte para SVG e salva em `salaslogos/ID.svg`. |
| `askPhotoReplacement(id)` | Pergunta se o usuario quer trocar a foto da sala. |
| `askLogoReplacement(id)` | Pergunta se o usuario quer trocar a logo da sala. |
| `editRecord(id)` | Fluxo completo para editar dados, foto e logo de uma sala. |
| `changeDesign(kind)` | Mostra designs disponiveis e salva a escolha no `config.xml`. |
| `generateVideo(args)` | Executa `generate-video-mp4.mjs`, repassando argumentos como rotacao. |
| `main()` | Loop principal do menu. |

## Funcoes de `scripts/generate-video-mp4.mjs`

| Funcao | O que faz |
| --- | --- |
| `browserExecutable()` | Procura Chrome ou Edge instalado, ou usa `CHROME_PATH` se existir. |
| `timestamp()` | Cria uma string de data/hora segura para nome de arquivo. |
| `run(command, args, options)` | Executa comandos externos, principalmente `ffmpeg`. |
| `startStaticServer()` | Sobe um servidor HTTP local temporario para servir `index.html`, XMLs, fotos e SVGs. |
| `pageData(page)` | Dentro do navegador, le config e records para descobrir salas ativas. |
| `preparePage(page)` | Ajusta CSS para renderizar em `1080x1920`, pausa animacoes automaticas e esconde o botao fullscreen. |
| `buildTimeline(activeRecords)` | Monta a sequencia: lista, transicao para foto, foto, transicao para lista. |
| `timelinePosition(timeline, timeMs)` | Descobre qual segmento da timeline corresponde a um tempo especifico. |
| `describeTimeline(timeline)` | Gera texto com a ordem e duracao dos segmentos. |
| `validateTimeline(timeline)` | Confere se a timeline nao tem duas telas de lista seguidas por erro. |
| `setFrame(page, position)` | Posiciona visualmente o painel em um momento exato e espera as imagens carregarem. |
| `main()` | Renderiza todos os frames em JPG, chama FFmpeg e salva o MP4 final em `videos/`. |

Configuracoes fixas do gerador:

| Constante | Valor |
| --- | --- |
| `renderWidth` | `1080` |
| `renderHeight` | `1920` |
| `fps` | `30` |
| `boardDuration` | `11000` ms |
| `photoDuration` | `6000` ms |
| `transitionDuration` | `1150` ms |

Saidas:

- Frames temporarios: `temp/frames-TIMESTAMP/`.
- Video final: `videos/painel-recordes-...mp4`.
- A pasta temporaria e apagada ao final quando tudo da certo.

Variaveis uteis para teste:

| Variavel | Uso |
| --- | --- |
| `VIDEO_TEST_FRAMES` | Limita a quantidade de frames renderizados. Bom para testar rapido. |
| `VIDEO_TEST_START` | Comeca a renderizar a partir de um frame especifico. |

Exemplo:

```powershell
$env:VIDEO_TEST_FRAMES = "30"
node scripts/generate-video-mp4.mjs
```

## Funcao de `scripts/vectorize-png-to-svg.mjs`

Esse script recebe:

```powershell
node scripts/vectorize-png-to-svg.mjs origem.png destino.svg
```

Ele usa `potrace.trace()` com estes parametros principais:

| Parametro | Valor | Efeito |
| --- | --- | --- |
| `blackOnWhite` | `false` | Mantem fundo transparente. |
| `threshold` | `128` | Define o corte entre area desenhada e area ignorada. |
| `color` | `#ffffff` | Gera o SVG em branco. |
| `background` | `transparent` | Mantem o fundo transparente. |
| `turdSize` | `2` | Remove pequenos ruidos. |
| `alphaMax` | `1` | Controla suavizacao das curvas. |
| `optCurve` | `true` | Otimiza curvas. |
| `optTolerance` | `0.2` | Tolerancia da otimizacao. |

## Funcoes principais de `index.html`

| Funcao | O que faz |
| --- | --- |
| `fitBoard()` | Calcula a escala do quadro para caber na janela. |
| `textFrom(node, selector)` | Le texto de um no XML/DOM. |
| `numberFromXml(xml, selectors, fallback)` | Busca numeros no XML por seletores alternativos. |
| `clampNumber(value, min, max, fallback)` | Garante que um numero fique dentro de uma faixa. |
| `numberFromSection(section, selectors, attributes, fallback)` | Le numero de uma secao usando atributos ou texto. |
| `clampRoomCount(value)` | Limita a quantidade de salas entre `1` e `7`. |
| `floatConfigFromSection(section, fallback, maxMode)` | Monta a config de float de uma secao. |
| `brightnessConfigFromSection(section, fallback)` | Monta a config de brilho de uma secao. |
| `configFromXml(xml)` | Transforma `config.xml` em um objeto de configuracao usado pelo painel. |
| `setFloatVariables(prefix, config, baseDistance, baseDuration)` | Escreve variaveis CSS de distancia, duracao e pausa do float. |
| `setBrightnessVariables(prefix, config, baseDuration)` | Escreve variaveis CSS de brilho maximo, brilho medio, sombra e duracao. |
| `applyConfig(config)` | Aplica `data-*` na `.frame` e atualiza variaveis CSS. |
| `recordsFromXml(xml)` | Transforma `records.xml` em objetos de recorde. |
| `applyTextFit(element, value, baseSize)` | Diminui a fonte ate o texto caber no elemento. |
| `logoPathForRecord(record)` | Retorna `salaslogos/ID.svg`. |
| `fetchTextFile(path)` | Carrega arquivo sem cache usando `fetch`. |
| `loadConfig()` | Carrega `config.xml` ou usa configuracao fallback. |
| `loadTopDesign(designNumber)` | Carrega `design-N.html` no topo. |
| `loadPhotoDesign(designNumber)` | Carrega `photo-design-N.html` na tela de foto. |
| `renderRecords(records, roomCount)` | Renderiza a lista de salas. |
| `isActivePhotoRecord(record, roomCount)` | Decide se um recorde entra no ciclo de fotos. |
| `setPhotoRecord(record)` | Atualiza foto, logo, sala, equipe e tempo da tela de foto. |
| `runWipe()` | Reinicia a animacao de wipe/transicao. |
| `showBoard()` | Volta da foto para a lista. |
| `showNextPhoto()` | Mostra a proxima foto do ciclo. |
| `schedulePhotoCycle(delay)` | Agenda a proxima troca de tela. |
| `enterFullscreen()` | Tenta colocar a pagina em tela cheia. |
| `setupFullscreenButton()` | Configura o botao de tela cheia e o esconde depois de 10 segundos. |
| `startPhotoCycle(records, roomCount)` | Filtra recordes ativos e inicia o ciclo. |
| `loadRecords()` | Fluxo completo de inicializacao: config, designs, records, lista e ciclo. |

## Fluxo de renderizacao do video

O video nao e gravado em tempo real. O script calcula cada frame:

1. Abre `index.html` em Chrome/Edge headless.
2. Pausa transicoes/animacoes automaticas.
3. Cria uma timeline com todos os recordes ativos.
4. Para cada frame:
   - calcula o tempo do frame;
   - descobre se esta na lista, transicao ou foto;
   - chama `setFrame()` para posicionar o DOM exatamente naquele estado;
   - tira um screenshot JPG.
5. Chama FFmpeg:

```text
ffmpeg -y -framerate 30 -i frame_%06d.jpg -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart saida.mp4
```

Na opcao `9`, adiciona:

```text
-vf transpose=1
```

Isso gira o video 90 graus no sentido horario e gera `1920x1080`.

## Dependencias

Necessario no Windows:

- Node.js no PATH.
- FFmpeg no PATH.
- Google Chrome ou Microsoft Edge instalado.
- `playwright-core`, instalado automaticamente pelo `painel.bat` se estiver faltando.
- `potrace` em `node_modules` para converter logos PNG em SVG.

Se o gerador nao encontrar Chrome/Edge, defina `CHROME_PATH` apontando para o executavel do navegador.

## Dicas de manutencao

- Para adicionar sala acima de 7, nao basta editar XML: e preciso alterar `maxRooms`, layout da lista e provavelmente fotos/logos.
- Para trocar apenas texto/tempo, use o menu `1` a `7`.
- Para trocar so o visual do topo, crie `design-N.html` e selecione no menu `A`.
- Para trocar so a tela de foto, crie `photo-design-N.html` e selecione no menu `B`.
- Para designs novos, preserve os IDs de preenchimento e as classes de animacao quando quiser manter compatibilidade com `config.xml`.
- Se texto ficar grande demais, `applyTextFit()` reduz a fonte automaticamente, mas layouts muito estreitos ainda podem precisar de CSS novo.
