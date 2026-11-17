import { personaje, type IdHabilidad, type IdPersonaje, type TipoBala } from './personajes';

/*
 * Simulación del juego de zombies, sin nada de dibujo. Dos modos:
 *  · «anfitrion»: calcula todo (zombies, daño, oleadas, puntos). Es la verdad de la partida.
 *  · «espejo»: el invitado; recibe fotos del anfitrión ~15 veces por segundo y las suaviza. Su propio
 *    movimiento y sus balas se ven al instante (el daño real lo decide el anfitrión).
 */

export const MUNDO = { ancho: 1800, alto: 1200, borde: 36 };

export type TipoZombie = 'caminante' | 'corredor' | 'gordo' | 'escupidor' | 'jefe';
export const TIPOS_ZOMBIE: TipoZombie[] = ['caminante', 'corredor', 'gordo', 'escupidor', 'jefe'];
const ZOMBIES: Record<TipoZombie, { radio: number; vida: number; vel: number; danio: number; puntos: number; ataque: number }> = {
    caminante: { radio: 17, vida: 32, vel: 62, danio: 9, puntos: 10, ataque: 0.8 },
    corredor: { radio: 14, vida: 20, vel: 128, danio: 7, puntos: 14, ataque: 0.7 },
    gordo: { radio: 27, vida: 150, vel: 42, danio: 18, puntos: 35, ataque: 1 },
    escupidor: { radio: 16, vida: 28, vel: 56, danio: 10, puntos: 22, ataque: 0.9 },
    jefe: { radio: 56, vida: 1500, vel: 58, danio: 26, puntos: 600, ataque: 0.9 },
};
export const radioZombie = (tipo: TipoZombie) => ZOMBIES[tipo].radio;
export const RADIO_JUGADOR = 22;

export interface Jugador {
    id: string;
    nombre: string;
    personaje: IdPersonaje;
    x: number;
    y: number;
    ang: number;
    vida: number;
    vidaMax: number;
    caido: boolean;
    /** Avance para revivir (0 → 1) cuando el compañero está cerca. */
    revive: number;
    escudo: number;
    invulnerable: number;
    /** Segundos para volver a usar la habilidad. */
    recarga: number;
    cdDisparo: number;
    disparando: boolean;
    bajas: number;
}

export interface Zombie {
    id: number;
    tipo: TipoZombie;
    x: number;
    y: number;
    vida: number;
    vidaMax: number;
    radio: number;
    vel: number;
    ang: number;
    aturdido: number;
    cdAtaque: number;
    cdEspecial: number;
    empujeX: number;
    empujeY: number;
    embestida: number;
    paso: number;
    /** Espejo: posición a la que se acerca suavemente. */
    objX: number;
    objY: number;
}

export interface Bala {
    x: number;
    y: number;
    vx: number;
    vy: number;
    vida: number;
    danio: number;
    radio: number;
    perfora: number;
    tipo: TipoBala;
    /** Id del jugador que disparó (o '' si es de un zombie). */
    duenio: string;
    golpeados: number[] | null;
    explosion?: { radio: number; danio: number };
    /** Solo se ve (espejo): no hace daño. */
    visual: boolean;
}

export interface Torreta {
    id: number;
    x: number;
    y: number;
    vida: number;
    cd: number;
    ang: number;
    duenio: string;
}

/** Eventos para efectos visuales/sonido y para el invitado. */
export type Evento =
    | ['b', number, number, number, number, TipoBala, number, string]
    | ['m', number, number, number]
    | ['i', number, number]
    | ['h', IdHabilidad, string, number, number, number, number, number]
    | ['d', string, number]
    | ['o', number]
    | ['r', string]
    | ['x', number, number, number]
    | ['fin'];

export type Fase = 'preparando' | 'oleada' | 'descanso' | 'fin';

export interface Foto {
    f: Fase;
    o: number;
    p: number;
    q: number;
    tf: number;
    j: [string, number, number, number, number, number, number, number, number, number, number][];
    z: [number, number, number, number, number, number][];
    t: [number, number, number, number][];
    e: Evento[];
}

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/** Distancia² de un punto a un segmento. */
function dist2Segmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const largo = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo));
    return dist2(px, py, ax + dx * k, ay + dy * k);
}

export class Sim {
    jugadores: Jugador[] = [];
    zombies: Zombie[] = [];
    balas: Bala[] = [];
    torretas: Torreta[] = [];
    fase: Fase = 'preparando';
    oleada = 0;
    puntos = 0;
    tiempoFase = 2.5;
    /** Eventos para dibujar en esta máquina. */
    eventos: Evento[] = [];
    /** Eventos para mandar al invitado (solo anfitrión con compañero). */
    salida: Evento[] = [];
    /** Id del jugador invitado: sus balas no se le mandan (él ya las dibuja). */
    idInvitado: string | null = null;

    private siguienteId = 1;
    private porSalir = 0;
    private cdSalida = 0;
    private jefesVencidos = 0;
    private programados: { t: number; fn: () => void }[] = [];
    private reloj = 0;
    private restantesEspejo = 0;

    constructor(
        jugadores: { id: string; nombre: string; personaje: IdPersonaje }[],
        readonly modo: 'anfitrion' | 'espejo',
    ) {
        jugadores.forEach((j, i) => {
            const p = personaje(j.personaje);
            this.jugadores.push({
                ...j,
                x: MUNDO.ancho / 2 + (i === 0 ? -60 : 60),
                y: MUNDO.alto / 2,
                ang: 0,
                vida: p.vida,
                vidaMax: p.vida,
                caido: false,
                revive: 0,
                escudo: 0,
                invulnerable: 0,
                recarga: 0,
                cdDisparo: 0,
                disparando: false,
                bajas: 0,
            });
        });
    }

    get enEquipo(): boolean {
        return this.jugadores.length > 1;
    }

    jugador(id: string): Jugador | undefined {
        return this.jugadores.find((j) => j.id === id);
    }

    /** Zombies que faltan en la oleada (vivos + por salir). */
    get restantes(): number {
        return this.modo === 'espejo' ? this.restantesEspejo : this.zombies.length + this.porSalir;
    }

    get jefe(): Zombie | undefined {
        return this.zombies.find((z) => z.tipo === 'jefe');
    }

    private emitir(ev: Evento, aLaRed = true, aqui = true): void {
        if (aqui && ev[0] !== 'b') this.eventos.push(ev);
        if (aLaRed && this.modo === 'anfitrion' && this.idInvitado) this.salida.push(ev);
    }

    // ——— Paso de simulación ————————————————————————————————————————————————
    paso(dt: number): void {
        this.reloj += dt;
        if (this.modo === 'espejo') {
            this.pasoEspejo(dt);
            return;
        }
        if (this.fase === 'fin') {
            this.moverBalas(dt);
            return;
        }

        this.programados = this.programados.filter((p) => {
            if (p.t > this.reloj) return true;
            p.fn();
            return false;
        });

        this.avanzarFase(dt);

        for (const j of this.jugadores) {
            j.escudo = Math.max(0, j.escudo - dt);
            j.invulnerable = Math.max(0, j.invulnerable - dt);
            j.cdDisparo = Math.max(0, j.cdDisparo - dt);
            if (j.caido) continue;
            if (j.disparando && j.cdDisparo <= 0) this.disparar(j);
        }

        this.revivir(dt);
        this.moverZombies(dt);
        this.moverTorretas(dt);
        this.moverBalas(dt);
    }

    private avanzarFase(dt: number): void {
        this.tiempoFase -= dt;
        if (this.fase === 'preparando' || this.fase === 'descanso') {
            if (this.tiempoFase <= 0) this.empezarOleada();
            return;
        }
        if (this.fase !== 'oleada') return;

        // Salen zombies poco a poco por las orillas.
        this.cdSalida -= dt;
        if (this.porSalir > 0 && this.cdSalida <= 0 && this.zombies.length < 70) {
            this.cdSalida = Math.max(0.16, 0.85 - this.oleada * 0.05) / (this.enEquipo ? 1.3 : 1);
            this.porSalir -= 1;
            this.crearZombie(this.tipoAlAzar());
        }
        if (this.porSalir === 0 && this.zombies.length === 0) {
            this.fase = 'descanso';
            this.tiempoFase = 4;
            // Premio: todos recuperan vida y los caídos se levantan.
            for (const j of this.jugadores) {
                if (j.caido) this.levantar(j, 0.4);
                else j.vida = Math.min(j.vidaMax, j.vida + j.vidaMax * 0.25);
            }
        }
    }

    private empezarOleada(): void {
        this.oleada += 1;
        this.fase = 'oleada';
        const factor = this.enEquipo ? 1.6 : 1;
        const deJefe = this.oleada % 5 === 0;
        this.porSalir = Math.round((8 + this.oleada * 5) * factor * (deJefe ? 0.5 : 1));
        this.cdSalida = 0.6;
        if (deJefe) this.programar(1.2, () => this.crearZombie('jefe'));
        this.emitir(['o', this.oleada]);
    }

    private tipoAlAzar(): TipoZombie {
        const n = this.oleada;
        const pesos: [TipoZombie, number][] = [
            ['caminante', 1],
            ['corredor', n >= 2 ? 0.25 + n * 0.04 : 0],
            ['gordo', n >= 3 ? 0.14 : 0],
            ['escupidor', n >= 4 ? 0.16 + n * 0.01 : 0],
        ];
        let r = Math.random() * pesos.reduce((s, [, p]) => s + p, 0);
        for (const [tipo, p] of pesos) {
            if ((r -= p) <= 0) return tipo;
        }
        return 'caminante';
    }

    private crearZombie(tipo: TipoZombie, x?: number, y?: number): Zombie {
        const base = ZOMBIES[tipo];
        const nivel = 1 + (this.oleada - 1) * 0.09;
        let vida = base.vida * nivel;
        if (tipo === 'jefe') vida = base.vida * (1 + this.jefesVencidos * 0.6) * (this.enEquipo ? 1.5 : 1);

        if (x === undefined || y === undefined) [x, y] = this.puntoDeSalida();
        const z: Zombie = {
            id: this.siguienteId++,
            tipo,
            x,
            y,
            vida,
            vidaMax: vida,
            radio: base.radio,
            vel: base.vel * Math.min(1.45, 1 + (this.oleada - 1) * 0.025) * (0.9 + Math.random() * 0.2),
            ang: 0,
            aturdido: 0,
            cdAtaque: 0,
            cdEspecial: 3,
            empujeX: 0,
            empujeY: 0,
            embestida: 0,
            paso: Math.random() * 10,
            objX: x,
            objY: y,
        };
        this.zombies.push(z);
        return z;
    }

    /** Punto en una orilla, lejos de los jugadores. */
    private puntoDeSalida(): [number, number] {
        const { ancho, alto, borde } = MUNDO;
        let mejor: [number, number] = [borde + 10, borde + 10];
        for (let i = 0; i < 12; i++) {
            const lado = Math.floor(Math.random() * 4);
            const x = lado === 0 ? borde + 10 : lado === 1 ? ancho - borde - 10 : borde + Math.random() * (ancho - borde * 2);
            const y = lado === 2 ? borde + 10 : lado === 3 ? alto - borde - 10 : borde + Math.random() * (alto - borde * 2);
            mejor = [x, y];
            if (this.jugadores.every((j) => dist2(x, y, j.x, j.y) > 430 ** 2)) break;
        }
        return mejor;
    }

    private objetivo(z: Zombie): Jugador | undefined {
        let mejor: Jugador | undefined;
        let d = Infinity;
        for (const j of this.jugadores) {
            if (j.caido) continue;
            const dj = dist2(z.x, z.y, j.x, j.y);
            if (dj < d) {
                d = dj;
                mejor = j;
            }
        }
        return mejor;
    }

    private moverZombies(dt: number): void {
        const { ancho, alto, borde } = MUNDO;
        for (const z of this.zombies) {
            z.cdAtaque = Math.max(0, z.cdAtaque - dt);
            z.aturdido = Math.max(0, z.aturdido - dt);
            z.embestida = Math.max(0, z.embestida - dt);
            const blanco = this.objetivo(z);
            let vx = 0;
            let vy = 0;

            if (blanco && z.aturdido <= 0) {
                const dx = blanco.x - z.x;
                const dy = blanco.y - z.y;
                const d = Math.hypot(dx, dy) || 1;
                z.ang = Math.atan2(dy, dx);
                let vel = z.vel * (z.embestida > 0 ? 3.3 : 1);

                if (z.tipo === 'escupidor') {
                    // Guarda distancia y escupe ácido.
                    if (d < 250) vel = -z.vel;
                    else if (d < 340) vel = 0;
                    z.cdEspecial -= dt;
                    if (z.cdEspecial <= 0 && d < 520) {
                        z.cdEspecial = 2.2;
                        this.crearBala(z.x, z.y, z.ang, 270, 'acido', '', ZOMBIES.escupidor.danio, 1.9, 9, 0);
                    }
                }
                if (z.tipo === 'jefe') this.especialJefe(z, dt, blanco);

                vx = (dx / d) * vel;
                vy = (dy / d) * vel;
                if (z.tipo === 'escupidor' && vel === 0) {
                    vx = (-dy / d) * z.vel * 0.6;
                    vy = (dx / d) * z.vel * 0.6;
                }

                // Golpe al tocar.
                if (z.cdAtaque <= 0 && d < z.radio + RADIO_JUGADOR + 3) {
                    z.cdAtaque = ZOMBIES[z.tipo].ataque;
                    this.daniarJugador(blanco, ZOMBIES[z.tipo].danio);
                }
            }

            z.empujeX *= Math.exp(-dt * 6);
            z.empujeY *= Math.exp(-dt * 6);
            z.x += (vx + z.empujeX) * dt;
            z.y += (vy + z.empujeY) * dt;
            z.paso += dt * (Math.hypot(vx, vy) / 18);
            z.x = Math.max(borde + z.radio, Math.min(ancho - borde - z.radio, z.x));
            z.y = Math.max(borde + z.radio, Math.min(alto - borde - z.radio, z.y));
        }

        // Que no se encimen.
        const zs = this.zombies;
        for (let i = 0; i < zs.length; i++) {
            for (let k = i + 1; k < zs.length; k++) {
                const a = zs[i];
                const b = zs[k];
                const min = a.radio + b.radio;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                if (d2 >= min * min || d2 === 0) continue;
                const d = Math.sqrt(d2);
                const sobra = (min - d) / 2;
                const pa = a.tipo === 'jefe' ? 0.1 : 1;
                const pb = b.tipo === 'jefe' ? 0.1 : 1;
                a.x -= (dx / d) * sobra * pa;
                a.y -= (dy / d) * sobra * pa;
                b.x += (dx / d) * sobra * pb;
                b.y += (dy / d) * sobra * pb;
            }
        }
    }

    private especialJefe(z: Zombie, dt: number, blanco: Jugador): void {
        z.cdEspecial -= dt;
        if (z.cdEspecial > 0) return;
        z.cdEspecial = 3.2;
        const turno = Math.floor(this.reloj / 3.2) % 3;
        if (turno === 0) {
            for (let i = 0; i < 18; i++) this.crearBala(z.x, z.y, (i / 18) * Math.PI * 2, 230, 'acido', '', 12, 2.6, 11, 0);
        } else if (turno === 1) {
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                this.crearZombie('caminante', z.x + Math.cos(a) * 90, z.y + Math.sin(a) * 90);
            }
        } else {
            z.embestida = 0.9;
            z.ang = Math.atan2(blanco.y - z.y, blanco.x - z.x);
        }
    }

    private moverTorretas(dt: number): void {
        this.torretas = this.torretas.filter((t) => {
            t.vida -= dt;
            t.cd -= dt;
            let blanco: Zombie | undefined;
            let d = 560 ** 2;
            for (const z of this.zombies) {
                const dz = dist2(t.x, t.y, z.x, z.y);
                if (dz < d) {
                    d = dz;
                    blanco = z;
                }
            }
            if (blanco) {
                t.ang = Math.atan2(blanco.y - t.y, blanco.x - t.x);
                if (t.cd <= 0) {
                    t.cd = 0.16;
                    this.crearBala(t.x + Math.cos(t.ang) * 18, t.y + Math.sin(t.ang) * 18, t.ang, 1000, 'torreta', t.duenio, 9, 0.6, 4, 0);
                }
            }
            return t.vida > 0;
        });
    }

    private disparar(j: Jugador): void {
        const { arma } = personaje(j.personaje);
        j.cdDisparo = arma.cadencia;
        this.balasDeArma(j.x, j.y, j.ang, j.id, false);
    }

    /** Crea las balas del arma del jugador. `visual`: solo para verse (espejo). */
    balasDeArma(x: number, y: number, ang: number, duenio: string, visual: boolean): void {
        const jugador = this.jugador(duenio);
        if (!jugador) return;
        const { arma } = personaje(jugador.personaje);
        const salidaX = x + Math.cos(ang) * 26;
        const salidaY = y + Math.sin(ang) * 26;
        for (let i = 0; i < arma.balas; i++) {
            const abanico = arma.balas > 1 ? -arma.apertura / 2 + (arma.apertura * i) / (arma.balas - 1) : 0;
            const a = ang + abanico + (Math.random() - 0.5) * 2 * arma.dispersion;
            const radio = arma.tipo === 'cañon' ? 8 : arma.tipo === 'perdigon' ? 4 : 5;
            const vel = arma.velocidad * (arma.tipo === 'perdigon' ? 0.85 + Math.random() * 0.3 : 1);
            if (arma.paralelas) {
                const px = Math.cos(ang + Math.PI / 2) * arma.paralelas * 0.5;
                const py = Math.sin(ang + Math.PI / 2) * arma.paralelas * 0.5;
                this.crearBala(salidaX + px, salidaY + py, a, vel, arma.tipo, duenio, arma.danio, arma.vida, radio, arma.perfora, arma.explosion, visual);
                this.crearBala(salidaX - px, salidaY - py, a, vel, arma.tipo, duenio, arma.danio, arma.vida, radio, arma.perfora, arma.explosion, visual);
            } else {
                this.crearBala(salidaX, salidaY, a, vel, arma.tipo, duenio, arma.danio, arma.vida, radio, arma.perfora, arma.explosion, visual);
            }
        }
    }

    crearBala(
        x: number,
        y: number,
        ang: number,
        vel: number,
        tipo: TipoBala,
        duenio: string,
        danio: number,
        vida: number,
        radio: number,
        perfora: number,
        explosion?: { radio: number; danio: number },
        visual = false,
    ): void {
        const vx = Math.cos(ang) * vel;
        const vy = Math.sin(ang) * vel;
        this.balas.push({ x, y, vx, vy, vida, danio, radio, perfora, tipo, duenio, golpeados: perfora > 0 ? [] : null, explosion, visual });
        // El invitado ya dibuja sus propias balas: no se le mandan.
        if (this.modo === 'anfitrion' && duenio !== this.idInvitado) {
            this.emitir(['b', Math.round(x), Math.round(y), Math.round(vx), Math.round(vy), tipo, Math.round(vida * 100) / 100, duenio], true, false);
        }
    }

    private moverBalas(dt: number): void {
        const { ancho, alto } = MUNDO;
        const vivas: Bala[] = [];
        for (const b of this.balas) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vida -= dt;
            if (b.vida <= 0 || b.x < 0 || b.y < 0 || b.x > ancho || b.y > alto) continue;

            if (b.duenio === '') {
                // Ácido de zombie contra jugadores.
                if (this.modo === 'anfitrion') {
                    const golpe = this.jugadores.find((j) => !j.caido && dist2(b.x, b.y, j.x, j.y) < (b.radio + RADIO_JUGADOR) ** 2);
                    if (golpe) {
                        this.daniarJugador(golpe, b.danio);
                        continue;
                    }
                }
                vivas.push(b);
                continue;
            }

            let sigue = true;
            for (const z of this.zombies) {
                if (dist2(b.x, b.y, z.x, z.y) >= (b.radio + z.radio) ** 2) continue;
                if (b.golpeados?.includes(z.id)) continue;
                if (b.visual) {
                    // Espejo: la bala se ve chocar; el daño lo decide el anfitrión.
                    if (b.perfora <= 0) {
                        sigue = false;
                        break;
                    }
                    b.perfora -= 1;
                    b.golpeados?.push(z.id);
                    continue;
                }
                this.daniarZombie(z, b.danio, b.duenio, b.vx * 0.04, b.vy * 0.04);
                this.emitir(['i', Math.round(b.x), Math.round(b.y)], false);
                if (b.explosion) this.explotar(b.x, b.y, b.explosion.radio, b.explosion.danio, b.duenio);
                if (b.perfora > 0) {
                    b.perfora -= 1;
                    b.golpeados?.push(z.id);
                } else {
                    sigue = false;
                    break;
                }
            }
            if (sigue) vivas.push(b);
        }
        this.balas = vivas;
        this.zombies = this.zombies.filter((z) => z.vida > 0);
    }

    private explotar(x: number, y: number, radio: number, danio: number, duenio: string): void {
        this.emitir(['x', Math.round(x), Math.round(y), radio]);
        for (const z of this.zombies) {
            if (z.vida > 0 && dist2(x, y, z.x, z.y) < (radio + z.radio) ** 2) this.daniarZombie(z, danio, duenio, 0, 0);
        }
    }

    private daniarZombie(z: Zombie, danio: number, duenio: string, empujeX: number, empujeY: number): void {
        if (z.vida <= 0) return;
        z.vida -= danio;
        if (z.tipo !== 'jefe') {
            z.empujeX += empujeX;
            z.empujeY += empujeY;
        }
        if (z.vida > 0) return;
        const base = ZOMBIES[z.tipo];
        this.puntos += Math.round(base.puntos * (1 + (this.oleada - 1) * 0.1));
        const j = this.jugador(duenio);
        if (j) j.bajas += 1;
        if (z.tipo === 'jefe') this.jefesVencidos += 1;
        this.emitir(['m', Math.round(z.x), Math.round(z.y), TIPOS_ZOMBIE.indexOf(z.tipo)]);
    }

    private daniarJugador(j: Jugador, danio: number): void {
        if (j.caido || j.invulnerable > 0 || this.fase === 'fin') return;
        const real = danio * (j.escudo > 0 ? 0.25 : 1);
        j.vida -= real;
        this.emitir(['d', j.id, Math.round(real)]);
        if (j.vida > 0) return;
        j.vida = 0;
        j.caido = true;
        j.revive = 0;
        j.disparando = false;
        if (this.jugadores.every((x) => x.caido)) {
            this.fase = 'fin';
            this.emitir(['fin']);
        }
    }

    private levantar(j: Jugador, fraccion: number): void {
        j.caido = false;
        j.revive = 0;
        j.vida = j.vidaMax * fraccion;
        j.invulnerable = 1.5;
        this.emitir(['r', j.id]);
    }

    /** Revive al compañero caído si el otro se queda junto a él 3 segundos. */
    private revivir(dt: number): void {
        for (const j of this.jugadores) {
            if (!j.caido) continue;
            const ayuda = this.jugadores.some((o) => o !== j && !o.caido && dist2(o.x, o.y, j.x, j.y) < 80 ** 2);
            j.revive = ayuda ? j.revive + dt / 3 : Math.max(0, j.revive - dt / 6);
            if (j.revive >= 1) this.levantar(j, 0.45);
        }
    }

    private programar(segundos: number, fn: () => void): void {
        this.programados.push({ t: this.reloj + segundos, fn });
    }

    // ——— Habilidades (anfitrión) ———————————————————————————————————————————
    /** `destino`: para la embestida del invitado (él ya se movió; aquí solo se aplica el daño). */
    usarHabilidad(id: string, ang: number, destino?: { x: number; y: number; desdeX: number; desdeY: number }): void {
        const j = this.jugador(id);
        if (!j || j.caido || this.fase === 'fin') return;
        const p = personaje(j.personaje);
        const h = p.habilidad.id;
        let x2 = 0;
        let y2 = 0;

        if (h === 'rugido') {
            for (const z of this.zombies) {
                const d = Math.hypot(z.x - j.x, z.y - j.y);
                if (d > 240 + z.radio) continue;
                const fuerza = z.tipo === 'jefe' ? 140 : 560;
                z.empujeX += ((z.x - j.x) / (d || 1)) * fuerza;
                z.empujeY += ((z.y - j.y) / (d || 1)) * fuerza;
                z.aturdido = z.tipo === 'jefe' ? 0.5 : 1.7;
                this.daniarZombie(z, 28, j.id, 0, 0);
            }
        } else if (h === 'laser') {
            x2 = j.x + Math.cos(ang) * 1200;
            y2 = j.y + Math.sin(ang) * 1200;
            for (const z of this.zombies) if (dist2Segmento(z.x, z.y, j.x, j.y, x2, y2) < (30 + z.radio) ** 2) this.daniarZombie(z, 150, j.id, Math.cos(ang) * 120, Math.sin(ang) * 120);
        } else if (h === 'sonrisa') {
            for (const o of this.jugadores) {
                if (dist2(o.x, o.y, j.x, j.y) > 320 ** 2) continue;
                if (o.caido) this.levantar(o, 0.55);
                else o.vida = Math.min(o.vidaMax, o.vida + 50);
                o.escudo = 3.5;
            }
        } else if (h === 'torreta') {
            this.torretas.push({ id: this.siguienteId++, x: j.x, y: j.y, vida: 9, cd: 0.3, ang, duenio: j.id });
        } else if (h === 'dash') {
            const desdeX = destino?.desdeX ?? j.x;
            const desdeY = destino?.desdeY ?? j.y;
            if (destino) {
                x2 = destino.x;
                y2 = destino.y;
            } else {
                x2 = Math.max(MUNDO.borde + RADIO_JUGADOR, Math.min(MUNDO.ancho - MUNDO.borde - RADIO_JUGADOR, j.x + Math.cos(ang) * 280));
                y2 = Math.max(MUNDO.borde + RADIO_JUGADOR, Math.min(MUNDO.alto - MUNDO.borde - RADIO_JUGADOR, j.y + Math.sin(ang) * 280));
                j.x = x2;
                j.y = y2;
            }
            j.invulnerable = Math.max(j.invulnerable, 0.45);
            for (const z of this.zombies) {
                if (dist2Segmento(z.x, z.y, desdeX, desdeY, x2, y2) < (34 + z.radio) ** 2) {
                    this.daniarZombie(z, 55, j.id, 0, 0);
                    z.aturdido = Math.max(z.aturdido, 0.5);
                }
            }
            this.emitir(['h', h, j.id, Math.round(desdeX), Math.round(desdeY), ang, Math.round(x2), Math.round(y2)]);
            return;
        } else if (h === 'billetes') {
            const rafaga = (desfase: number) => {
                for (let i = 0; i < 28; i++) this.crearBala(j.x, j.y, (i / 28) * Math.PI * 2 + desfase, 720, 'billete', j.id, 22, 0.7, 7, 1);
            };
            rafaga(0);
            this.programar(0.18, () => rafaga(Math.PI / 28));
        }

        this.emitir(['h', h, j.id, Math.round(j.x), Math.round(j.y), Math.round(ang * 100) / 100, Math.round(x2), Math.round(y2)]);
    }

    // ——— Red ———————————————————————————————————————————————————————————————
    /** Foto compacta del estado para el invitado (con los eventos pendientes). */
    foto(): Foto {
        const e = this.salida;
        this.salida = [];
        return {
            f: this.fase,
            o: this.oleada,
            p: this.puntos,
            q: this.restantes,
            tf: Math.round(this.tiempoFase * 10) / 10,
            j: this.jugadores.map((j) => [
                j.id,
                Math.round(j.x),
                Math.round(j.y),
                Math.round(j.ang * 100) / 100,
                Math.round(j.vida),
                j.vidaMax,
                j.caido ? 1 : 0,
                Math.round(j.revive * 100),
                j.escudo > 0 ? 1 : 0,
                j.invulnerable > 0 ? 1 : 0,
                j.bajas,
            ]),
            z: this.zombies.map((z) => [z.id, TIPOS_ZOMBIE.indexOf(z.tipo), Math.round(z.x), Math.round(z.y), Math.round((z.vida / z.vidaMax) * 100), Math.round(z.ang * 100) / 100]),
            t: this.torretas.map((t) => [t.id, Math.round(t.x), Math.round(t.y), Math.round(t.ang * 100) / 100]),
            e,
        };
    }

    /** Espejo: aplica la foto del anfitrión. `yo`: el jugador de esta máquina (su posición manda aquí). */
    aplicarFoto(f: Foto, yo: string): void {
        this.fase = f.f;
        this.oleada = f.o;
        this.puntos = f.p;
        this.restantesEspejo = f.q;
        this.tiempoFase = f.tf;

        for (const [id, x, y, ang, vida, vidaMax, caido, revive, escudo, invulnerable, bajas] of f.j) {
            const j = this.jugador(id);
            if (!j) continue;
            if (id !== yo) {
                j.x += (x - j.x) * 0.5;
                j.y += (y - j.y) * 0.5;
                j.ang = ang;
            }
            j.vida = vida;
            j.vidaMax = vidaMax;
            j.caido = caido === 1;
            j.revive = revive / 100;
            j.escudo = escudo ? 1 : 0;
            j.invulnerable = invulnerable ? 1 : 0;
            j.bajas = bajas;
        }

        const vistos = new Set<number>();
        for (const [id, tipo, x, y, vida, ang] of f.z) {
            vistos.add(id);
            let z = this.zombies.find((q) => q.id === id);
            if (!z) {
                const t = TIPOS_ZOMBIE[tipo];
                z = { ...this.crearZombieEspejo(t), id, x, y, objX: x, objY: y };
                this.zombies.push(z);
            }
            z.objX = x;
            z.objY = y;
            z.ang = ang;
            z.vida = (vida / 100) * z.vidaMax;
        }
        this.zombies = this.zombies.filter((z) => vistos.has(z.id));

        this.torretas = f.t.map(([id, x, y, ang]) => ({ id, x, y, ang, vida: 1, cd: 0, duenio: '' }));

        for (const ev of f.e) {
            if (ev[0] === 'b') {
                const [, x, y, vx, vy, tipo, vida, duenio] = ev;
                const radio = tipo === 'cañon' ? 8 : tipo === 'perdigon' ? 4 : tipo === 'billete' ? 7 : tipo === 'acido' ? 9 : 5;
                this.balas.push({ x, y, vx, vy, vida, danio: 0, radio, perfora: tipo === 'billete' || tipo === 'rifle' ? 1 : 0, tipo, duenio, golpeados: [], visual: true });
            } else {
                this.eventos.push(ev);
            }
        }
    }

    private crearZombieEspejo(tipo: TipoZombie): Zombie {
        const base = ZOMBIES[tipo];
        return { id: 0, tipo, x: 0, y: 0, vida: 1, vidaMax: 1, radio: base.radio, vel: base.vel, ang: 0, aturdido: 0, cdAtaque: 0, cdEspecial: 0, empujeX: 0, empujeY: 0, embestida: 0, paso: Math.random() * 10, objX: 0, objY: 0 };
    }

    private pasoEspejo(dt: number): void {
        const k = 1 - Math.exp(-dt * 12);
        for (const z of this.zombies) {
            const dx = (z.objX - z.x) * k;
            const dy = (z.objY - z.y) * k;
            z.x += dx;
            z.y += dy;
            z.paso += Math.hypot(dx, dy) / 18;
        }
        this.moverBalas(dt);
    }
}
