import type { Musica } from '../musica';
import type { IdPersonaje } from './personajes';
import type { Sala } from './red';
import type { Fase } from './sim';

/*
 * Contrato entre la pantalla de React (ArenaZombies.tsx) y el motor del juego (escena3d.ts).
 */

export interface JugadorPartida {
    id: string;
    nombre: string;
    personaje: IdPersonaje;
}

export interface Hud {
    fase: Fase;
    oleada: number;
    puntos: number;
    restantes: number;
    tiempoFase: number;
    /** Vida del zombie jefe (0…1) o null si no hay. */
    jefe: number | null;
    /** El mouse está capturado (cámara activa). Si es false en compu, se muestra «Haz clic para jugar». */
    bloqueado: boolean;
    yo: { vida: number; vidaMax: number; caido: boolean; revive: number; recarga: number; recargaMax: number; bajas: number };
    otro: { nombre: string; personaje: IdPersonaje; vida: number; vidaMax: number; caido: boolean; revive: number; bajas: number } | null;
}

export interface Resumen {
    oleada: number;
    puntos: number;
    jugadores: { nombre: string; personaje: IdPersonaje; bajas: number }[];
}

export interface ConfigPartida {
    modo: 'solo' | 'anfitrion' | 'invitado';
    yo: JugadorPartida;
    otro?: JugadorPartida;
    sala: Sala | null;
    musica: Musica;
    /** 'alta' = brillo (bloom), sombras y más partículas; 'baja' = celular o equipo modesto. */
    calidad: 'alta' | 'baja';
    alHud: (hud: Hud) => void;
    alTerminar: (resumen: Resumen) => void;
}

export interface ControlJuego {
    /**
     * Mando táctil. (mx, my): palanca izquierda, mover (−1…1, «arriba» = adelante respecto a la cámara).
     * (ax, ay): palanca derecha; ax gira la cámara (izquierda/derecha) y, si la palanca está activa, dispara.
     */
    mandoTactil(mx: number, my: number, ax: number, ay: number): void;
    habilidad(): void;
    /** El compañero salió de la sala. */
    companeroSalio(): void;
    /** Pide capturar el mouse (se llama desde un clic). */
    capturarMouse(): void;
    destruir(): void;
}
