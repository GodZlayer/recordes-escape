const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 362 154">
  <defs>
    <path id="titleArc" d="M37 73C84 10 278 10 325 73"/>
  </defs>
  <g fill="none" stroke="#f8f8f2" stroke-linecap="round" stroke-linejoin="round">
    <g stroke-width="3.2">
      <path d="M181 38V25M160 43L153 32M202 43L209 32M142 58L132 50M220 58L230 50"/>
    </g>
    <g stroke-width="4.2">
      <path d="M163 57h36v23c0 11-8 19-18 19s-18-8-18-19z"/>
      <path d="M168 99h26M175 99v14M187 99v14M171 113h20l3 9h-26zM166 122h30"/>
      <path d="M163 64h-17c0 17 7 27 20 28M199 64h17c0 17-7 27-20 28"/>
      <path d="M151 70c1 8 5 13 13 15M211 70c-1 8-5 13-13 15"/>
    </g>
    <g stroke-width="3.8" transform="translate(102 96) rotate(-45)">
      <path d="M-20-11c0-12 9-22 21-22s21 10 21 22M-10-11c0-7 4-12 11-12s11 5 11 12"/>
      <rect x="-16" y="-11" width="34" height="27" rx="3"/>
      <path d="M0-1v9M-27-24l-6-6M-20-32l-2-8M-33-17l-8-2"/>
      <circle cx="0" cy="-2" r="3"/>
    </g>
    <g stroke-width="3.8" transform="translate(260 96) rotate(45)">
      <path d="M-20-11c0-12 9-22 21-22s21 10 21 22M-10-11c0-7 4-12 11-12s11 5 11 12"/>
      <rect x="-16" y="-11" width="34" height="27" rx="3"/>
      <path d="M0-1v9M27-24l6-6M20-32l2-8M33-17l8-2"/>
      <circle cx="0" cy="-2" r="3"/>
    </g>
  </g>
  <g fill="#f8f8f2">
    <path d="M181 66L185 74L194 75L187 81L189 90L181 85L173 90L175 81L168 75L177 74Z"/>
    <path d="M55 81L59 88L67 89L61 94L62 102L55 98L48 102L49 94L43 89L51 88Z"/>
    <path d="M39 109L43 116L51 117L45 122L46 130L39 126L32 130L33 122L27 117L35 116Z"/>
    <path d="M307 81L311 88L319 89L313 94L314 102L307 98L300 102L301 94L295 89L303 88Z"/>
    <path d="M323 109L327 116L335 117L329 122L330 130L323 126L316 130L317 122L311 117L319 116Z"/>
  </g>
  <text fill="#f8f8f2" font-family="Arial Black, Arial, sans-serif" font-size="24" font-weight="900" letter-spacing=".8" text-anchor="middle">
    <textPath href="#titleArc" startOffset="50%">QUADRO DE RECORDES</textPath>
  </text>
</svg>`;

export const headerDesign2DataUrl =
  `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

function svgDataUrl(content: string) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(content)))}`;
}

export const headerFloatADataUrl = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 362 154">
  <defs><path id="titleArcA" d="M37 73C84 10 278 10 325 73"/></defs>
  <g fill="#f8f8f2">
    <path d="M55 81L59 88L67 89L61 94L62 102L55 98L48 102L49 94L43 89L51 88Z"/>
    <path d="M39 109L43 116L51 117L45 122L46 130L39 126L32 130L33 122L27 117L35 116Z"/>
    <path d="M307 81L311 88L319 89L313 94L314 102L307 98L300 102L301 94L295 89L303 88Z"/>
    <path d="M323 109L327 116L335 117L329 122L330 130L323 126L316 130L317 122L311 117L319 116Z"/>
  </g>
  <text fill="#f8f8f2" font-family="Arial Black, Arial, sans-serif" font-size="24" font-weight="900" letter-spacing=".8" text-anchor="middle">
    <textPath href="#titleArcA" startOffset="50%">QUADRO DE RECORDES</textPath>
  </text>
</svg>`);

export const headerFloatBDataUrl = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 362 154">
  <g fill="none" stroke="#f8f8f2" stroke-linecap="round" stroke-linejoin="round">
    <g stroke-width="3.2"><path d="M181 38V25M160 43L153 32M202 43L209 32M142 58L132 50M220 58L230 50"/></g>
    <g stroke-width="4.2">
      <path d="M163 57h36v23c0 11-8 19-18 19s-18-8-18-19z"/>
      <path d="M168 99h26M175 99v14M187 99v14M171 113h20l3 9h-26zM166 122h30"/>
      <path d="M163 64h-17c0 17 7 27 20 28M199 64h17c0 17-7 27-20 28"/>
      <path d="M151 70c1 8 5 13 13 15M211 70c-1 8-5 13-13 15"/>
    </g>
  </g>
  <path fill="#f8f8f2" d="M181 66L185 74L194 75L187 81L189 90L181 85L173 90L175 81L168 75L177 74Z"/>
</svg>`);

export const headerFloatCDataUrl = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 362 154">
  <g fill="none" stroke="#f8f8f2" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round">
    <g transform="translate(102 96) rotate(-45)">
      <path d="M-20-11c0-12 9-22 21-22s21 10 21 22M-10-11c0-7 4-12 11-12s11 5 11 12"/>
      <rect x="-16" y="-11" width="34" height="27" rx="3"/><circle cx="0" cy="-2" r="3"/>
      <path d="M0-1v9M-27-24l-6-6M-20-32l-2-8M-33-17l-8-2"/>
    </g>
    <g transform="translate(260 96) rotate(45)">
      <path d="M-20-11c0-12 9-22 21-22s21 10 21 22M-10-11c0-7 4-12 11-12s11 5 11 12"/>
      <rect x="-16" y="-11" width="34" height="27" rx="3"/><circle cx="0" cy="-2" r="3"/>
      <path d="M0-1v9M27-24l6-6M20-32l2-8M33-17l8-2"/>
    </g>
  </g>
</svg>`);
