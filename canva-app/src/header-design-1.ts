const encode = (svg: string) =>
  `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

const shell = (content: string) => encode(`
<svg xmlns="http://www.w3.org/2000/svg" width="362" height="165" viewBox="0 0 362 165">
  <defs><path id="arc" d="M24 88C80 12 282 12 338 88"/></defs>
  ${content}
</svg>`);

export const header1FloatADataUrl = shell(`
  <text fill="#f8f8f2" font-family="Amatic SC,Arial,sans-serif" font-size="49" letter-spacing="1.1">
    <textPath href="#arc" startOffset="24%" text-anchor="middle">QUADRO</textPath>
  </text>
  <path d="M104 109L71 91M107 127L76 126" fill="none" stroke="#f8f8f2" stroke-width="3" stroke-linecap="round"/>
`);

export const header1FloatBDataUrl = shell(`
  <text fill="#f8f8f2" font-family="Amatic SC,Arial,sans-serif" font-size="49" letter-spacing="1.1">
    <textPath href="#arc" startOffset="80%" text-anchor="middle">RECORDES</textPath>
  </text>
  <g fill="none" stroke="#f8f8f2" stroke-width="3" stroke-linejoin="round">
    <rect x="131" y="125" width="43" height="34"/><rect x="174" y="107" width="49" height="52"/><rect x="223" y="134" width="43" height="25"/>
  </g>
  <g fill="#f8f8f2" font-family="Amatic SC,Arial,sans-serif" font-size="27" font-weight="700" text-anchor="middle">
    <text x="152" y="120">2</text><text x="198" y="102">1</text><text x="244" y="129">3</text>
  </g>
`);

export const header1FloatCDataUrl = shell(`
  <g transform="translate(181 42)" fill="none" stroke="#f8f8f2" stroke-width="3" stroke-linejoin="round">
    <path d="M0-25l5 9 10-3 2 10 8 6-7 7 5 10-11 2-4 10-9-6-10 5-1-11-10-5 8-8-3-10 11-1z"/>
    <circle cx="0" cy="3" r="14"/><path d="M-10 20l-8 20 13-9 6 10 7-21"/>
  </g>
  <text x="181" y="51" fill="#f8f8f2" font-family="Amatic SC,Arial,sans-serif" font-size="19" font-weight="700" text-anchor="middle">DE</text>
  <path d="M99 145L69 158M263 109l20-16M260 127l21-1M263 144l19 12" fill="none" stroke="#f8f8f2" stroke-width="3" stroke-linecap="round"/>
`);
