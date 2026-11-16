/** «lunes 16 de noviembre» → «Lunes 16 de noviembre» (para textos en línea, donde `first-letter:` de CSS no aplica). */
export function capitalizar(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
