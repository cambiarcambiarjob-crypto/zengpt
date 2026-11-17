import cara2 from '../cabeza-2.webp';
import cara3 from '../cabeza-3.webp';
import cara4 from '../cabeza-4.webp';
import cara5 from '../cabeza-5.webp';
import cara1 from '../cabeza.webp';
import caraJefe from './jefe.webp';

export type IdPersonaje = 'leon' | 'lentes' | 'sonrisa' | 'tec' | 'azul' | 'jefe';
export type IdHabilidad = 'rugido' | 'laser' | 'sonrisa' | 'torreta' | 'dash' | 'billetes';
export type TipoBala = 'normal' | 'perdigon' | 'rifle' | 'cañon' | 'billete' | 'acido' | 'torreta';

export interface Arma {
    /** Segundos entre disparos. */
    cadencia: number;
    balas: number;
    /** Apertura total del abanico (radianes) cuando hay varias balas. */
    apertura: number;
    /** Desviación aleatoria de cada bala (radianes). */
    dispersion: number;
    velocidad: number;
    danio: number;
    /** Segundos que vive la bala. */
    vida: number;
    /** A cuántos zombies más atraviesa. */
    perfora: number;
    tipo: TipoBala;
    /** Dos cañones paralelos separados por esta distancia (px). */
    paralelas?: number;
    /** Explota al pegar: radio y daño en área. */
    explosion?: { radio: number; danio: number };
}

export interface Personaje {
    id: IdPersonaje;
    nombre: string;
    cara: string;
    color: string;
    vida: number;
    velocidad: number;
    arma: Arma;
    habilidad: { id: IdHabilidad; nombre: string; descripcion: string; recarga: number };
    arma_nombre: string;
}

export const PERSONAJES: Personaje[] = [
    {
        id: 'leon',
        nombre: 'El León',
        cara: cara1,
        color: '#ffb02e',
        vida: 160,
        velocidad: 205,
        arma_nombre: 'Escopeta',
        arma: { cadencia: 0.55, balas: 6, apertura: 0.38, dispersion: 0.04, velocidad: 760, danio: 10, vida: 0.36, perfora: 0, tipo: 'perdigon' },
        habilidad: { id: 'rugido', nombre: 'Rugido', descripcion: 'Empuja, daña y aturde a los zombies cercanos.', recarga: 8 },
    },
    {
        id: 'lentes',
        nombre: 'Lentes Oscuros',
        cara: cara2,
        color: '#ff3dd8',
        vida: 95,
        velocidad: 235,
        arma_nombre: 'Rifle',
        arma: { cadencia: 0.17, balas: 1, apertura: 0, dispersion: 0.01, velocidad: 1150, danio: 17, vida: 0.75, perfora: 1, tipo: 'rifle' },
        habilidad: { id: 'laser', nombre: 'Mirada láser', descripcion: 'Rayo que atraviesa a todos los zombies en línea.', recarga: 7 },
    },
    {
        id: 'sonrisa',
        nombre: 'La Sonrisa',
        cara: cara3,
        color: '#e8e8ff',
        vida: 120,
        velocidad: 215,
        arma_nombre: 'Pistolas',
        arma: { cadencia: 0.19, balas: 1, apertura: 0, dispersion: 0.03, velocidad: 900, danio: 14, vida: 0.6, perfora: 0, tipo: 'normal' },
        habilidad: { id: 'sonrisa', nombre: 'Sonrisa radiante', descripcion: 'Cura y protege a los dos; revive al compañero caído.', recarga: 11 },
    },
    {
        id: 'tec',
        nombre: 'El Ingeniero',
        cara: cara4,
        color: '#ff9a1f',
        vida: 120,
        velocidad: 205,
        arma_nombre: 'Subametralladora',
        arma: { cadencia: 0.085, balas: 1, apertura: 0, dispersion: 0.09, velocidad: 950, danio: 8, vida: 0.55, perfora: 0, tipo: 'normal' },
        habilidad: { id: 'torreta', nombre: 'Torreta', descripcion: 'Pone una torreta que dispara sola por 9 segundos.', recarga: 12 },
    },
    {
        id: 'azul',
        nombre: 'El Ejecutivo',
        cara: cara5,
        color: '#39c5bb',
        vida: 105,
        velocidad: 255,
        arma_nombre: 'Pistolas dobles',
        arma: { cadencia: 0.15, balas: 1, apertura: 0, dispersion: 0.025, velocidad: 950, danio: 11, vida: 0.6, perfora: 0, tipo: 'normal', paralelas: 12 },
        habilidad: { id: 'dash', nombre: 'Embestida', descripcion: 'Se lanza de golpe, sin recibir daño, y lastima a lo que cruza.', recarga: 3.5 },
    },
    {
        id: 'jefe',
        nombre: 'El Jefe',
        cara: caraJefe,
        color: '#3dff7a',
        vida: 130,
        velocidad: 200,
        arma_nombre: 'Cañón',
        arma: { cadencia: 0.45, balas: 1, apertura: 0, dispersion: 0.01, velocidad: 820, danio: 30, vida: 0.8, perfora: 0, tipo: 'cañon', explosion: { radio: 70, danio: 16 } },
        habilidad: { id: 'billetes', nombre: 'Lluvia de billetes', descripcion: 'Dos ráfagas de billetes en todas direcciones.', recarga: 9 },
    },
];

export const personaje = (id: IdPersonaje): Personaje => PERSONAJES.find((p) => p.id === id) ?? PERSONAJES[0];
