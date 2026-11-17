import type { TipoBala } from './personajes';
import type { TipoZombie } from './sim';

/*
 * Escala y medidas del mundo 3D. La simulación (sim.ts) trabaja en un plano de 1800 × 1200 «px»;
 * en 3D, 1 metro = 40 px: la arena mide 45 × 30 m. Eje Y hacia arriba; sim.x → x, sim.y → z.
 * Un ángulo de la simulación `ang` (dirección cos/sin en x/z) se vuelve `rotation.y = -ang` en un modelo
 * que mira hacia +X.
 */
export const ESCALA = 1 / 40;
export const aMetros = (px: number) => px * ESCALA;

/** Alturas (m). */
export const ALTURA = {
    bala: 1.15,
    cabeza: 1.62,
    etiqueta: 2.35,
    marcador: 2.75,
};

/** Cámara en tercera persona (m). */
export const CAMARA = {
    distancia: 6.2,
    altura: 2.6,
    /** Hacia dónde mira: un poco arriba y adelante del personaje. */
    mirarAltura: 1.5,
    mirarAdelante: 2.4,
    inclinacionMin: -0.35,
    inclinacionMax: 0.55,
    sensibilidad: 0.0022,
    campoVision: 62,
};

export const COLOR_ZOMBIE: Record<TipoZombie, number> = {
    caminante: 0x57ff6a,
    corredor: 0xd4ff3d,
    gordo: 0xa46bff,
    escupidor: 0x3dffd2,
    jefe: 0xff3d6e,
};

export const COLOR_BALA: Record<TipoBala, number> = {
    normal: 0xffe27a,
    perdigon: 0xffb02e,
    rifle: 0xff3dd8,
    cañon: 0x3dff7a,
    billete: 0x7dff9a,
    acido: 0x8bff3d,
    torreta: 0xff9a1f,
};

export const hexANumero = (c: string) => Number.parseInt(c.replace('#', ''), 16);
