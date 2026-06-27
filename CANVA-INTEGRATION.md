# Integração Canva Design Editing

Esta integração representa as telas do painel como elementos nativos do Canva:

- `list`: tela de lista, incluindo um grupo-modelo de recorde;
- `transition`: tela de transição;
- `groups`: tela de grupos/foto (`photo-design`).

O formato intermediário fica em `designs/*.json`. Ele preserva coordenadas, dimensões,
rotação, opacidade, textos, cores, formas, grupos e as configurações de movimento que
não existem no editor estático do Canva.

## Desenvolvimento local

Requisitos: Node.js 22 ou 24 e uma conta de desenvolvedor Canva.

No Windows, `canva-editor.bat` instala o app quando necessário e inicia os dois serviços.
Mantenha essa janela aberta: ela supervisiona os processos e os encerra ao receber
Ctrl+C ou quando o console é fechado.

```powershell
npm install
npm --prefix canva-app install
npm run canva:bridge
```

Em outro terminal:

```powershell
npm run canva:app
```

No Canva Developer Portal, crie um app e use exatamente `http://localhost:8080` como
Development URL. Essa URL deve mostrar JavaScript minificado, não uma página HTML.
Abra um design personalizado de `450 × 800 px`, execute o app e:

1. escolha `Lista`, `Transição` ou `Grupos / foto`;
2. clique em **Importar do painel**;
3. edite textos, formas, posições, tamanhos, cores e grupos no editor;
4. clique em **Exportar para o painel**.

O bridge local salva o resultado no JSON correspondente.
O `index.html` carrega esses JSONs automaticamente e usa o visual exportado no próximo
reload do painel.

## Contrato dos campos dinâmicos

Textos com `{{room}}`, `{{team}}`, `{{time}}` e `{{rank}}` são preenchidos em tempo de
execução. Eles podem ser movidos e estilizados no Canva, mas o marcador deve permanecer
no conteúdo do texto.

## Produção

O bridge local é adequado para desenvolvimento. Para publicar o app, hospede os mesmos
endpoints em HTTPS, limite CORS ao domínio do app e adicione autenticação. Apps públicos
precisam passar pela revisão do Canva; apps privados para uma equipe exigem Canva
Enterprise.

## Limites do Canva

O Canva edita o estado visual. Animações do painel, repetição dos sete registros e
substituição de fotos continuam descritas em `motion`, `repeat` e `role` no JSON. A
integração conserva essas informações ao exportar novamente.
