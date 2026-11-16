/**
 * Colores de las tres series del reporte (los mismos de la gráfica del panel). Van en hex porque se usan en atributos de
 * SVG; se validaron juntos sobre la superficie de las tarjetas (#0f1413): se distinguen también con daltonismo
 * rojo-verde y los tres superan 3:1 de contraste.
 */
export const COLOR_SERIE = { ventas: '#1ba981', publicidad: '#d9652e', neto: '#8087ee' } as const;
