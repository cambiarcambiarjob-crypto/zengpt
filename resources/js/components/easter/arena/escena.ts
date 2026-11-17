import Phaser from 'phaser';
import type { Musica } from '../musica';
import { personaje, type IdPersonaje, type TipoBala } from './personajes';
import type { Sala } from './red';
import { MUNDO, RADIO_JUGADOR, Sim, TIPOS_ZOMBIE, type Evento, type Foto, type Jugador, type TipoZombie } from './sim';

/*
 * Escena de Phaser del juego de zombies: dibuja la simulación (sim.ts), lee el teclado/mouse/toque y,
 * en equipo, manda y recibe datos por la sala (red.ts). El anfitrión calcula la partida; el invitado
 * la refleja y manda su posición, puntería y habilidades.
 */

export interface JugadorPartida {
    id: string;
    nombre: string;
    personaje: IdPersonaje;
}

export interface Hud {
    fase: Sim['fase'];
    oleada: number;
    puntos: number;
    restantes: number;
    tiempoFase: number;
    jefe: number | null;
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
    calidad: 'alta' | 'baja';
    alHud: (hud: Hud) => void;
    alTerminar: (resumen: Resumen) => void;
}

export interface ControlJuego {
    /** Mando táctil: movimiento y puntería (vectores −1…1); con puntería activa también dispara. */
    mandoTactil(mx: number, my: number, ax: number, ay: number): void;
    habilidad(): void;
    /** El compañero salió de la sala. */
    companeroSalio(): void;
    destruir(): void;
}

const COLOR_ZOMBIE: Record<TipoZombie, string> = {
    caminante: '#57ff6a',
    corredor: '#d4ff3d',
    gordo: '#a46bff',
    escupidor: '#3dffd2',
    jefe: '#ff3d6e',
};
const COLOR_BALA: Record<TipoBala, number> = {
    normal: 0xffe27a,
    perdigon: 0xffb02e,
    rifle: 0xff3dd8,
    cañon: 0x3dff7a,
    billete: 0x7dff9a,
    acido: 0x8bff3d,
    torreta: 0xff9a1f,
};
const hex = (c: string) => Number.parseInt(c.slice(1), 16);

/** Texturas dibujadas una sola vez con canvas (degradados suaves que se ven bien con el brillo). */
function crearTexturas(escena: Phaser.Scene): void {
    const t = escena.textures;
    const lienzo = (clave: string, w: number, h: number, dibujar: (c: CanvasRenderingContext2D) => void) => {
        if (t.exists(clave)) return;
        const tex = t.createCanvas(clave, w, h);
        if (!tex) return;
        dibujar(tex.getContext());
        tex.refresh();
    };
    const radial = (c: CanvasRenderingContext2D, x: number, y: number, r: number, paradas: [number, string][]) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        paradas.forEach(([p, col]) => g.addColorStop(p, col));
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
    };

    lienzo('chispa', 16, 16, (c) => radial(c, 8, 8, 8, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
    lienzo('luz', 256, 256, (c) => radial(c, 128, 128, 128, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]));
    lienzo('anillo', 128, 128, (c) => {
        c.strokeStyle = 'rgba(255,255,255,1)';
        c.lineWidth = 6;
        c.shadowColor = 'white';
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(64, 64, 52, 0, Math.PI * 2);
        c.stroke();
    });
    lienzo('burbuja', 112, 112, (c) => {
        radial(c, 56, 56, 52, [[0, 'rgba(255,255,255,0.02)'], [0.8, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0.4)']]);
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(56, 56, 51, 0, Math.PI * 2);
        c.stroke();
    });
    lienzo('piso', 160, 160, (c) => {
        c.fillStyle = '#07061a';
        c.fillRect(0, 0, 160, 160);
        c.strokeStyle = 'rgba(110, 80, 255, 0.10)';
        c.lineWidth = 1;
        for (let i = 0; i <= 160; i += 40) {
            c.beginPath();
            c.moveTo(i + 0.5, 0);
            c.lineTo(i + 0.5, 160);
            c.moveTo(0, i + 0.5);
            c.lineTo(160, i + 0.5);
            c.stroke();
        }
        for (let i = 0; i < 60; i++) {
            c.fillStyle = `rgba(150,130,255,${Math.random() * 0.06})`;
            c.fillRect(Math.random() * 160, Math.random() * 160, 2, 2);
        }
    });
    lienzo('bala', 24, 24, (c) => radial(c, 12, 12, 12, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]));
    lienzo('bala-larga', 40, 14, (c) => {
        const g = c.createLinearGradient(0, 0, 40, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(20, 7, 20, 4, 0, 0, Math.PI * 2);
        c.fill();
    });
    lienzo('billete', 26, 14, (c) => {
        c.fillStyle = '#2bd66a';
        c.fillRect(1, 1, 24, 12);
        c.strokeStyle = '#d9ffe6';
        c.lineWidth = 1.5;
        c.strokeRect(2, 2, 22, 10);
        c.fillStyle = '#eaffef';
        c.font = 'bold 10px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('$', 13, 7.5);
    });
    lienzo('mancha', 72, 72, (c) => {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 9; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * 18;
            c.beginPath();
            c.arc(36 + Math.cos(a) * d, 36 + Math.sin(a) * d, 6 + Math.random() * 12, 0, Math.PI * 2);
            c.fill();
        }
    });
    lienzo('arma', 34, 12, (c) => {
        c.fillStyle = '#c9cbe0';
        c.beginPath();
        c.roundRect(0, 2, 34, 8, 3);
        c.fill();
        c.fillStyle = '#4d4f6b';
        c.fillRect(4, 4, 18, 4);
    });
    lienzo('torreta', 72, 72, (c) => {
        c.fillStyle = '#ff9a1f';
        c.fillRect(36, 30, 32, 12);
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            c.lineTo(36 + Math.cos(a) * 22, 36 + Math.sin(a) * 22);
        }
        c.closePath();
        c.fillStyle = '#2a1608';
        c.fill();
        c.strokeStyle = '#ff9a1f';
        c.lineWidth = 3;
        c.stroke();
        radial(c, 36, 36, 9, [[0, '#fff3d6'], [1, 'rgba(255,154,31,0.4)']]);
    });

    // Zombies: dibujados mirando a la derecha, al doble de tamaño para que se vean nítidos.
    for (const tipo of TIPOS_ZOMBIE) {
        const r = { caminante: 17, corredor: 14, gordo: 27, escupidor: 16, jefe: 56 }[tipo] * 2;
        const tam = r * 2 + 60;
        lienzo(`zombie-${tipo}`, tam, tam, (c) => {
            const color = COLOR_ZOMBIE[tipo];
            const cx = tam / 2;
            const cy = tam / 2;
            // Brazos estirados hacia adelante.
            c.strokeStyle = color;
            c.lineCap = 'round';
            c.lineWidth = r * 0.32;
            c.shadowColor = color;
            c.shadowBlur = 10;
            c.beginPath();
            c.moveTo(cx, cy - r * 0.55);
            c.lineTo(cx + r * 1.15, cy - r * 0.62);
            c.moveTo(cx, cy + r * 0.55);
            c.lineTo(cx + r * 1.1, cy + r * 0.5);
            c.stroke();
            // Cuerpo con degradado tóxico.
            const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
            g.addColorStop(0, color);
            g.addColorStop(0.55, '#14301a');
            g.addColorStop(1, '#081108');
            c.fillStyle = g;
            c.beginPath();
            c.arc(cx, cy, r, 0, Math.PI * 2);
            c.fill();
            c.lineWidth = Math.max(3, r * 0.1);
            c.strokeStyle = color;
            c.stroke();
            // Picos del jefe.
            if (tipo === 'jefe') {
                c.fillStyle = color;
                for (let i = 0; i < 9; i++) {
                    const a = Math.PI / 2 + (i / 8) * Math.PI;
                    c.beginPath();
                    c.moveTo(cx + Math.cos(a - 0.12) * r, cy + Math.sin(a - 0.12) * r);
                    c.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
                    c.lineTo(cx + Math.cos(a + 0.12) * r, cy + Math.sin(a + 0.12) * r);
                    c.fill();
                }
            }
            // Manchas del gordo / baba del escupidor.
            if (tipo === 'gordo' || tipo === 'escupidor') {
                c.shadowBlur = 0;
                c.fillStyle = tipo === 'gordo' ? 'rgba(200,160,255,0.35)' : 'rgba(61,255,210,0.5)';
                for (let i = 0; i < 5; i++) {
                    c.beginPath();
                    c.arc(cx + (Math.random() - 0.6) * r, cy + (Math.random() - 0.5) * r * 1.2, r * (0.08 + Math.random() * 0.1), 0, Math.PI * 2);
                    c.fill();
                }
            }
            // Ojos rojos que brillan y boca.
            c.shadowColor = '#ff2a2a';
            c.shadowBlur = 12;
            c.fillStyle = '#ff4040';
            const ojo = Math.max(3, r * 0.14);
            c.beginPath();
            c.arc(cx + r * 0.5, cy - r * 0.28, ojo, 0, Math.PI * 2);
            c.arc(cx + r * 0.5, cy + r * 0.28, ojo, 0, Math.PI * 2);
            c.fill();
            c.shadowBlur = 0;
            c.strokeStyle = '#0a0a0a';
            c.lineWidth = Math.max(2, r * 0.07);
            c.beginPath();
            c.moveTo(cx + r * 0.78, cy - r * 0.2);
            for (let i = 0; i <= 4; i++) c.lineTo(cx + r * (i % 2 ? 0.86 : 0.74), cy - r * 0.2 + (i * r * 0.4) / 4);
            c.stroke();
        });
    }
}

/** Ficha redonda con la foto y aro del color del personaje. */
function crearFicha(escena: Phaser.Scene, id: IdPersonaje): string {
    const clave = `ficha-${id}`;
    if (escena.textures.exists(clave)) return clave;
    const p = personaje(id);
    const img = escena.textures.get(`cara-${id}`).getSourceImage() as HTMLImageElement;
    const tex = escena.textures.createCanvas(clave, 112, 112);
    if (!tex) return clave;
    const c = tex.getContext();
    c.save();
    c.beginPath();
    c.arc(56, 56, 46, 0, Math.PI * 2);
    c.clip();
    c.drawImage(img, 10, 10, 92, 92);
    c.restore();
    c.strokeStyle = p.color;
    c.lineWidth = 7;
    c.shadowColor = p.color;
    c.shadowBlur = 14;
    c.beginPath();
    c.arc(56, 56, 48, 0, Math.PI * 2);
    c.stroke();
    tex.refresh();
    return clave;
}

interface VistaJugador {
    caja: Phaser.GameObjects.Container;
    ficha: Phaser.GameObjects.Image;
    arma: Phaser.GameObjects.Image;
    aura: Phaser.GameObjects.Image;
    burbuja: Phaser.GameObjects.Image;
    etiqueta: Phaser.GameObjects.Text;
    ultimoCd: number;
}

class Arena extends Phaser.Scene {
    private cfg!: ConfigPartida;
    private sim!: Sim;
    private vistas = new Map<string, VistaJugador>();
    private vistasZombie = new Map<number, Phaser.GameObjects.Image>();
    private vidaZombie = new Map<number, number>();
    private libresZombie: Phaser.GameObjects.Image[] = [];
    private vistasBala: Phaser.GameObjects.Image[] = [];
    private vistasTorreta = new Map<number, Phaser.GameObjects.Image>();
    private manchas: Phaser.GameObjects.Image[] = [];
    private barras!: Phaser.GameObjects.Graphics;
    private indicador!: Phaser.GameObjects.Graphics;
    private emisores = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
    private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
    private rojo!: Phaser.GameObjects.Rectangle;

    private recarga = 0;
    private cdLocal = 0;
    private tactil = { mx: 0, my: 0, ax: 0, ay: 0 };
    private ultimoAng = 0;
    private cdRed = 0;
    private cdHud = 0;
    private terminado = false;
    private tiempoFin = 0;
    private ultimoDolor = 0;
    private faseAnterior: Sim['fase'] = 'preparando';
    private conJefe = false;
    private fpsBajos = 0;
    private brillo: Phaser.FX.Bloom | null = null;
    private otroSalio = false;

    constructor() {
        super('arena');
    }

    init(cfg: ConfigPartida): void {
        this.cfg = cfg;
        // El anfitrión siempre va primero (aparece a la izquierda) para que las dos pantallas coincidan.
        const jugadores = cfg.modo === 'invitado' && cfg.otro ? [cfg.otro, cfg.yo] : [cfg.yo, ...(cfg.otro ? [cfg.otro] : [])];
        this.sim = new Sim(jugadores, cfg.modo === 'invitado' ? 'espejo' : 'anfitrion');
        if (cfg.modo === 'anfitrion' && cfg.otro) this.sim.idInvitado = cfg.otro.id;
    }

    preload(): void {
        for (const j of this.sim.jugadores) {
            const clave = `cara-${j.personaje}`;
            if (!this.textures.exists(clave)) this.load.image(clave, personaje(j.personaje).cara);
        }
    }

    create(): void {
        crearTexturas(this);
        const { ancho, alto, borde } = MUNDO;

        this.add.tileSprite(0, 0, ancho, alto, 'piso').setOrigin(0);
        // Luces de ambiente que respiran.
        const colores = [0x7a4bff, 0x22e5ff, 0xff3dd8, 0x3dff7a];
        for (let i = 0; i < 9; i++) {
            const luz = this.add
                .image(borde + Math.random() * (ancho - borde * 2), borde + Math.random() * (alto - borde * 2), 'luz')
                .setTint(colores[i % colores.length])
                .setAlpha(0.18)
                .setScale(2.4 + Math.random() * 1.6)
                .setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: luz, alpha: 0.32, duration: 2200 + Math.random() * 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        // Paredes neón.
        const pared = this.add.graphics();
        pared.lineStyle(10, 0x7a4bff, 0.25);
        pared.strokeRect(borde - 6, borde - 6, ancho - borde * 2 + 12, alto - borde * 2 + 12);
        pared.lineStyle(3, 0xb48bff, 1);
        pared.strokeRect(borde, borde, ancho - borde * 2, alto - borde * 2);
        pared.fillStyle(0x020108, 1);
        pared.fillRect(-400, -400, ancho + 800, borde + 400 - 6);
        pared.fillRect(-400, alto - borde + 6, ancho + 800, borde + 400);
        pared.fillRect(-400, -400, borde + 400 - 6, alto + 800);
        pared.fillRect(ancho - borde + 6, -400, borde + 400, alto + 800);

        this.barras = this.add.graphics().setDepth(40);
        this.indicador = this.add.graphics().setDepth(60);

        for (const j of this.sim.jugadores) this.crearVistaJugador(j);

        const camara = this.cameras.main;
        camara.setBounds(-120, -120, ancho + 240, alto + 240);
        camara.setBackgroundColor('#020108');
        const mio = this.vistas.get(this.cfg.yo.id);
        if (mio) camara.startFollow(mio.caja, true, 0.12, 0.12);
        this.ajustarZoom();
        this.scale.on('resize', () => this.ajustarZoom());

        if (this.cfg.calidad === 'alta' && this.game.renderer.type === Phaser.WEBGL) {
            this.brillo = camara.postFX.addBloom(0xffffff, 1, 1, 1.15, 1.25, 4);
            camara.postFX.addVignette(0.5, 0.5, 0.92, 0.32);
        }

        // Destello rojo al recibir daño (fijo a la pantalla).
        this.rojo = this.add.rectangle(0, 0, 10, 10, 0xff1e3c, 0).setOrigin(0).setScrollFactor(0).setDepth(100);

        const teclado = this.input.keyboard;
        if (teclado) {
            this.teclas = teclado.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,E') as Record<string, Phaser.Input.Keyboard.Key>;
            teclado.on('keydown-SPACE', () => this.habilidad());
            teclado.on('keydown-Q', () => this.habilidad());
            teclado.on('keydown-E', () => this.habilidad());
        }
        this.input.mouse?.disableContextMenu();
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.rightButtonDown()) this.habilidad();
        });

        this.conectarRed();
        this.cfg.musica.tocar('robots');
    }

    private ajustarZoom(): void {
        const { width, height } = this.scale.gameSize;
        this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(width / 1150, height / 760), 0.55, 1.05));
        this.rojo?.setSize(width / this.cameras.main.zoom + 400, height / this.cameras.main.zoom + 400).setPosition(-200, -200);
    }

    private crearVistaJugador(j: Jugador): void {
        const p = personaje(j.personaje);
        const color = hex(p.color);
        const aura = this.add.image(0, 0, 'luz').setTint(color).setScale(0.55).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
        const sombra = this.add.ellipse(0, 16, 40, 14, 0x000000, 0.45);
        const arma = this.add.image(0, 0, 'arma').setOrigin(0.05, 0.5);
        const ficha = this.add.image(0, 0, crearFicha(this, j.personaje)).setDisplaySize(RADIO_JUGADOR * 2.3, RADIO_JUGADOR * 2.3);
        const burbuja = this.add.image(0, 0, 'burbuja').setDisplaySize(72, 72).setTint(0x7dfcff).setVisible(false);
        const etiqueta = this.add
            .text(0, -RADIO_JUGADOR - 18, j.nombre, { fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: p.color })
            .setOrigin(0.5)
            .setShadow(0, 0, p.color, 8, true, true);
        const caja = this.add.container(j.x, j.y, [aura, sombra, arma, ficha, burbuja, etiqueta]).setDepth(30);
        this.vistas.set(j.id, { caja, ficha, arma, aura, burbuja, etiqueta, ultimoCd: 0 });
    }

    // ——— Red ———————————————————————————————————————————————————————————————
    private conectarRed(): void {
        const sala = this.cfg.sala;
        if (!sala || this.cfg.modo === 'solo') return;

        if (this.cfg.modo === 'anfitrion') {
            sala.escuchar<{ x: number; y: number; a: number; d: number }>('mando', (m) => {
                const otro = this.cfg.otro && this.sim.jugador(this.cfg.otro.id);
                if (!otro || otro.caido) return;
                otro.x = m.x;
                otro.y = m.y;
                otro.ang = m.a;
                otro.disparando = m.d === 1;
            });
            sala.escuchar<{ a: number; dx?: number; dy?: number; ox?: number; oy?: number }>('hab', (h) => {
                if (!this.cfg.otro) return;
                const destino = h.dx !== undefined ? { x: h.dx, y: h.dy ?? 0, desdeX: h.ox ?? 0, desdeY: h.oy ?? 0 } : undefined;
                this.sim.usarHabilidad(this.cfg.otro.id, h.a, destino);
            });
        } else {
            sala.escuchar<Foto>('foto', (f) => this.sim.aplicarFoto(f, this.cfg.yo.id));
        }
    }

    private enviarRed(dt: number): void {
        const sala = this.cfg.sala;
        if (!sala || this.cfg.modo === 'solo' || this.otroSalio) return;
        this.cdRed -= dt;
        if (this.cdRed > 0) return;
        if (this.cfg.modo === 'anfitrion') {
            this.cdRed = 1 / 15;
            sala.enviar('foto', this.sim.foto());
        } else {
            this.cdRed = 1 / 20;
            const yo = this.sim.jugador(this.cfg.yo.id);
            if (yo) sala.enviar('mando', { x: Math.round(yo.x), y: Math.round(yo.y), a: Math.round(yo.ang * 100) / 100, d: yo.disparando ? 1 : 0 });
        }
    }

    // ——— API para React ——————————————————————————————————————————————————————
    mandoTactil(mx: number, my: number, ax: number, ay: number): void {
        this.tactil = { mx, my, ax, ay };
    }

    habilidad(): void {
        const yo = this.sim.jugador(this.cfg.yo.id);
        if (!yo || yo.caido || this.recarga > 0 || this.sim.fase === 'fin') return;
        const p = personaje(yo.personaje);
        this.recarga = p.habilidad.recarga;

        if (this.cfg.modo !== 'invitado') {
            this.sim.usarHabilidad(yo.id, yo.ang);
            return;
        }
        // Invitado: la embestida se mueve aquí mismo; el anfitrión aplica el daño y los efectos.
        if (p.habilidad.id === 'dash') {
            const ox = yo.x;
            const oy = yo.y;
            yo.x = Phaser.Math.Clamp(yo.x + Math.cos(yo.ang) * 280, MUNDO.borde + RADIO_JUGADOR, MUNDO.ancho - MUNDO.borde - RADIO_JUGADOR);
            yo.y = Phaser.Math.Clamp(yo.y + Math.sin(yo.ang) * 280, MUNDO.borde + RADIO_JUGADOR, MUNDO.alto - MUNDO.borde - RADIO_JUGADOR);
            this.efectoDash(ox, oy, yo.x, yo.y, p.color, yo.personaje);
            this.cfg.musica.efecto('dash');
            this.cfg.sala?.enviar('hab', { a: yo.ang, dx: Math.round(yo.x), dy: Math.round(yo.y), ox: Math.round(ox), oy: Math.round(oy) });
        } else {
            this.cfg.sala?.enviar('hab', { a: Math.round(yo.ang * 100) / 100 });
        }
    }

    companeroSalio(): void {
        this.otroSalio = true;
        if (this.cfg.modo === 'anfitrion' && this.cfg.otro) {
            const id = this.cfg.otro.id;
            this.sim.jugadores = this.sim.jugadores.filter((j) => j.id !== id);
            this.sim.idInvitado = null;
            this.vistas.get(id)?.caja.destroy();
            this.vistas.delete(id);
        } else if (this.cfg.modo === 'invitado') {
            this.sim.fase = 'fin';
        }
    }

    // ——— Bucle ———————————————————————————————————————————————————————————————
    update(_tiempo: number, deltaMs: number): void {
        const dt = Math.min(0.05, deltaMs / 1000);
        this.vigilarRendimiento(deltaMs);
        this.moverme(dt);

        if (this.cfg.modo === 'invitado') this.dispararLocal(dt);
        this.sim.paso(dt);
        this.recarga = Math.max(0, this.recarga - dt);

        this.enviarRed(dt);
        this.procesarEventos();
        this.dibujar(dt);
        this.vigilarFase();

        this.cdHud -= dt;
        if (this.cdHud <= 0) {
            this.cdHud = 0.12;
            this.cfg.alHud(this.hud());
        }

        if (this.sim.fase === 'fin' && !this.terminado) {
            this.tiempoFin += dt;
            if (this.tiempoFin > 1.6) {
                this.terminado = true;
                if (this.cfg.modo === 'anfitrion') this.cfg.sala?.enviar('foto', this.sim.foto());
                this.cfg.alTerminar({
                    oleada: this.sim.oleada,
                    puntos: this.sim.puntos,
                    jugadores: this.sim.jugadores.map((j) => ({ nombre: j.nombre, personaje: j.personaje, bajas: j.bajas })),
                });
            }
        }
    }

    private moverme(dt: number): void {
        const yo = this.sim.jugador(this.cfg.yo.id);
        if (!yo) return;
        const k = this.teclas;
        let mx = this.tactil.mx;
        let my = this.tactil.my;
        if (k) {
            mx += (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
            my += (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
        }
        const largo = Math.hypot(mx, my);
        if (largo > 1) {
            mx /= largo;
            my /= largo;
        }

        // Puntería: mouse, o la palanca derecha en el celular (y si no, hacia donde camina).
        const puntero = this.input.activePointer;
        const tactilApunta = Math.hypot(this.tactil.ax, this.tactil.ay) > 0.25;
        if (tactilApunta) {
            yo.ang = Math.atan2(this.tactil.ay, this.tactil.ax);
        } else if (!this.esTactil()) {
            const mundo = this.cameras.main.getWorldPoint(puntero.x, puntero.y);
            yo.ang = Math.atan2(mundo.y - yo.y, mundo.x - yo.x);
        } else if (largo > 0.2) {
            yo.ang = Math.atan2(my, mx);
        }
        this.ultimoAng = yo.ang;
        yo.disparando = !yo.caido && this.sim.fase !== 'fin' && (tactilApunta || (!this.esTactil() && puntero.leftButtonDown()));

        if (yo.caido || this.sim.fase === 'fin') return;
        const vel = personaje(yo.personaje).velocidad;
        yo.x += mx * vel * dt;
        yo.y += my * vel * dt;
        // No atravesar zombies.
        for (const z of this.sim.zombies) {
            const dx = yo.x - z.x;
            const dy = yo.y - z.y;
            const min = z.radio + RADIO_JUGADOR;
            const d2 = dx * dx + dy * dy;
            if (d2 < min * min && d2 > 0) {
                const d = Math.sqrt(d2);
                yo.x = z.x + (dx / d) * min;
                yo.y = z.y + (dy / d) * min;
            }
        }
        yo.x = Phaser.Math.Clamp(yo.x, MUNDO.borde + RADIO_JUGADOR, MUNDO.ancho - MUNDO.borde - RADIO_JUGADOR);
        yo.y = Phaser.Math.Clamp(yo.y, MUNDO.borde + RADIO_JUGADOR, MUNDO.alto - MUNDO.borde - RADIO_JUGADOR);
    }

    private esTactil(): boolean {
        return this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
    }

    /** Invitado: sus balas se ven al instante (el anfitrión calcula el daño de verdad). */
    private dispararLocal(dt: number): void {
        const yo = this.sim.jugador(this.cfg.yo.id);
        this.cdLocal = Math.max(0, this.cdLocal - dt);
        if (!yo || !yo.disparando || yo.caido || this.cdLocal > 0) return;
        const p = personaje(yo.personaje);
        this.cdLocal = p.arma.cadencia;
        this.sim.balasDeArma(yo.x, yo.y, yo.ang, yo.id, true);
        this.sonidoDisparo(p.arma.tipo, 1);
        this.fogonazo(yo, p.color);
    }

    private sonidoDisparo(tipo: TipoBala, volumen: number): void {
        this.cfg.musica.efecto(tipo === 'perdigon' ? 'perdigon' : tipo === 'cañon' ? 'cañon' : 'disparo', volumen);
    }

    private fogonazo(j: Jugador, color: string): void {
        this.chispas(color).explode(3, j.x + Math.cos(j.ang) * 34, j.y + Math.sin(j.ang) * 34);
    }

    private chispas(color: string): Phaser.GameObjects.Particles.ParticleEmitter {
        let e = this.emisores.get(color);
        if (!e) {
            e = this.add
                .particles(0, 0, 'chispa', {
                    lifespan: { min: 220, max: 520 },
                    speed: { min: 60, max: 280 },
                    scale: { start: 0.9, end: 0 },
                    alpha: { start: 1, end: 0 },
                    tint: hex(color),
                    blendMode: Phaser.BlendModes.ADD,
                    emitting: false,
                })
                .setDepth(50);
            this.emisores.set(color, e);
        }
        return e;
    }

    // ——— Efectos ———————————————————————————————————————————————————————————————
    private procesarEventos(): void {
        const yo = this.cfg.yo.id;
        for (const ev of this.sim.eventos) this.efecto(ev, yo);
        this.sim.eventos = [];
    }

    private efecto(ev: Evento, yo: string): void {
        const musica = this.cfg.musica;
        switch (ev[0]) {
            case 'i':
                this.chispas('#ffffff').explode(4, ev[1], ev[2]);
                musica.efecto('impacto', 0.6);
                break;
            case 'x':
                this.chispas('#3dff7a').explode(22, ev[1], ev[2]);
                this.anillo(ev[1], ev[2], 0x3dff7a, ev[3] / 52, 320);
                break;
            case 'm': {
                const tipo = TIPOS_ZOMBIE[ev[3]];
                const color = COLOR_ZOMBIE[tipo];
                this.chispas(color).explode(tipo === 'jefe' ? 80 : 16, ev[1], ev[2]);
                this.mancha(ev[1], ev[2], color, tipo === 'jefe' ? 3.5 : tipo === 'gordo' ? 1.5 : 1);
                musica.efecto('muerte', tipo === 'jefe' ? 1.4 : 0.8);
                if (tipo === 'jefe') {
                    this.cameras.main.shake(500, 0.012);
                    this.anillo(ev[1], ev[2], hex(color), 9, 900);
                }
                break;
            }
            case 'd':
                if (ev[1] === yo && this.time.now - this.ultimoDolor > 250) {
                    this.ultimoDolor = this.time.now;
                    this.cameras.main.shake(140, 0.004);
                    this.rojo.setAlpha(0.22);
                    this.tweens.add({ targets: this.rojo, alpha: 0, duration: 260 });
                    musica.efecto('dolor', 0.8);
                }
                break;
            case 'r':
                musica.efecto('revivir');
                {
                    const j = this.sim.jugador(ev[1]);
                    if (j) this.anillo(j.x, j.y, 0x7dffb0, 3, 600);
                }
                break;
            case 'o':
                musica.efecto('oleada');
                this.cameras.main.flash(260, 60, 255, 140);
                break;
            case 'h':
                this.efectoHabilidad(ev, yo);
                break;
            case 'fin':
                break;
        }
    }

    private efectoHabilidad(ev: Extract<Evento, ['h', ...unknown[]]>, yo: string): void {
        const [, hab, duenio, x, y, ang, x2, y2] = ev;
        const j = this.sim.jugador(duenio);
        const color = j ? personaje(j.personaje).color : '#ffffff';
        const c = hex(color);
        const musica = this.cfg.musica;

        if (hab === 'rugido') {
            this.anillo(x, y, c, 5.2, 520);
            this.anillo(x, y, 0xffffff, 3.5, 380);
            this.chispas(color).explode(40, x, y);
            if (duenio === yo) this.cameras.main.shake(220, 0.008);
            musica.efecto('rugido');
        } else if (hab === 'laser') {
            const g = this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
            g.lineStyle(30, c, 0.55);
            g.lineBetween(x, y, x2, y2);
            g.lineStyle(10, 0xffffff, 1);
            g.lineBetween(x, y, x2, y2);
            this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
            for (let i = 0; i < 12; i++) this.chispas(color).explode(3, x + ((x2 - x) * i) / 12, y + ((y2 - y) * i) / 12);
            musica.efecto('laser');
        } else if (hab === 'sonrisa') {
            this.anillo(x, y, 0x7dffb0, 6.4, 700);
            this.anillo(x, y, 0xffffff, 4, 500);
            this.chispas('#7dffb0').explode(36, x, y);
            musica.efecto('curar');
        } else if (hab === 'torreta') {
            this.chispas('#ff9a1f').explode(20, x, y);
            this.anillo(x, y, 0xff9a1f, 1.6, 300);
            musica.efecto('torreta');
        } else if (hab === 'dash') {
            // El invitado ya vio su propia embestida.
            if (!(duenio === yo && this.cfg.modo === 'invitado')) {
                this.efectoDash(x, y, x2, y2, color, j?.personaje ?? 'azul');
                musica.efecto('dash');
            }
        } else if (hab === 'billetes') {
            this.anillo(x, y, 0x7dff9a, 3, 400);
            musica.efecto('billetes');
        }
        void ang;
    }

    private efectoDash(x: number, y: number, x2: number, y2: number, color: string, id: IdPersonaje): void {
        for (let i = 0; i < 6; i++) {
            const fantasma = this.add
                .image(x + ((x2 - x) * i) / 6, y + ((y2 - y) * i) / 6, crearFicha(this, id))
                .setDisplaySize(RADIO_JUGADOR * 2.3, RADIO_JUGADOR * 2.3)
                .setAlpha(0.15 + i * 0.1)
                .setTint(hex(color))
                .setDepth(25);
            this.tweens.add({ targets: fantasma, alpha: 0, duration: 380, delay: i * 20, onComplete: () => fantasma.destroy() });
        }
        this.chispas(color).explode(24, x2, y2);
    }

    private anillo(x: number, y: number, color: number, escala: number, duracion: number): void {
        const a = this.add.image(x, y, 'anillo').setTint(color).setScale(0.2).setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: a, scale: escala, alpha: 0, duration: duracion, ease: 'Cubic.easeOut', onComplete: () => a.destroy() });
    }

    private mancha(x: number, y: number, color: string, escala: number): void {
        let m = this.manchas.length >= 40 ? this.manchas.shift() : undefined;
        if (!m) m = this.add.image(0, 0, 'mancha').setDepth(5);
        this.tweens.killTweensOf(m);
        m.setPosition(x, y).setTint(hex(color)).setAlpha(0.32).setScale(escala * (0.8 + Math.random() * 0.4)).setRotation(Math.random() * Math.PI * 2);
        this.tweens.add({ targets: m, alpha: 0, delay: 5000, duration: 2500 });
        this.manchas.push(m);
    }

    private vigilarFase(): void {
        const fase = this.sim.fase;
        const jefe = Boolean(this.sim.jefe);
        if (jefe && !this.conJefe) {
            this.cameras.main.shake(600, 0.01);
            this.cfg.musica.tocar('caricatura');
        } else if (!jefe && this.conJefe) {
            this.cfg.musica.tocar('robots');
        }
        this.conJefe = jefe;
        if (fase === 'fin' && this.faseAnterior !== 'fin') {
            this.cfg.musica.perder();
            this.cameras.main.shake(400, 0.01);
        }
        this.faseAnterior = fase;
    }

    /** Si va lento, apaga el brillo (para que siga fluido). */
    private vigilarRendimiento(deltaMs: number): void {
        if (!this.brillo) return;
        this.fpsBajos = deltaMs > 28 ? this.fpsBajos + 1 : Math.max(0, this.fpsBajos - 2);
        if (this.fpsBajos > 120) {
            this.cameras.main.postFX.remove(this.brillo);
            this.brillo = null;
        }
    }

    // ——— Dibujo ———————————————————————————————————————————————————————————————
    private dibujar(dt: number): void {
        const ahora = this.time.now;

        // Jugadores.
        for (const j of this.sim.jugadores) {
            const v = this.vistas.get(j.id);
            if (!v) continue;
            const p = personaje(j.personaje);
            v.caja.setPosition(j.x, j.y);
            v.arma.setRotation(j.ang).setPosition(Math.cos(j.ang) * 10, Math.sin(j.ang) * 10).setVisible(!j.caido);
            v.ficha.setTint(j.caido ? 0x555566 : 0xffffff).setAlpha(j.invulnerable > 0 && !j.caido ? 0.55 + 0.45 * Math.sin(ahora / 40) : 1);
            v.ficha.setRotation(j.caido ? 0.5 : 0);
            v.burbuja.setVisible(j.escudo > 0);
            v.aura.setScale(0.5 + 0.06 * Math.sin(ahora / 300)).setAlpha(j.caido ? 0.2 : 0.55);
            // Sonido y fogonazo de los disparos que calcula el anfitrión.
            if (this.cfg.modo !== 'invitado' && j.cdDisparo > v.ultimoCd + 0.01) {
                this.sonidoDisparo(p.arma.tipo, j.id === this.cfg.yo.id ? 1 : 0.4);
                this.fogonazo(j, p.color);
            }
            v.ultimoCd = j.cdDisparo;
        }

        // Zombies.
        const vistos = new Set<number>();
        for (const z of this.sim.zombies) {
            vistos.add(z.id);
            let img = this.vistasZombie.get(z.id);
            if (!img) {
                img = this.libresZombie.pop() ?? this.add.image(0, 0, `zombie-${z.tipo}`).setDepth(20);
                img.setTexture(`zombie-${z.tipo}`).setVisible(true).setAlpha(1).clearTint().setScale(0.5);
                this.vistasZombie.set(z.id, img);
                this.vidaZombie.set(z.id, z.vida);
                // Aparece desde el suelo.
                img.setScale(0.1);
                this.tweens.add({ targets: img, scale: 0.5, duration: 260, ease: 'Back.easeOut' });
            }
            const bamboleo = Math.sin(z.paso) * 0.08;
            img.setPosition(z.x, z.y).setRotation(z.ang + bamboleo);
            if (z.aturdido > 0) img.setTint(0x9999ff);
            else if ((this.vidaZombie.get(z.id) ?? z.vida) > z.vida + 0.5) {
                img.setTintFill(0xffffff);
                this.time.delayedCall(60, () => img?.clearTint());
            } else if (!img.isTinted || img.tintFill === false) img.clearTint();
            this.vidaZombie.set(z.id, z.vida);
        }
        for (const [id, img] of this.vistasZombie) {
            if (vistos.has(id)) continue;
            img.setVisible(false);
            this.tweens.killTweensOf(img);
            this.libresZombie.push(img);
            this.vistasZombie.delete(id);
            this.vidaZombie.delete(id);
        }

        // Balas (imágenes reutilizadas).
        const balas = this.sim.balas;
        while (this.vistasBala.length < balas.length) this.vistasBala.push(this.add.image(0, 0, 'bala').setDepth(35).setBlendMode(Phaser.BlendModes.ADD));
        for (let i = 0; i < this.vistasBala.length; i++) {
            const img = this.vistasBala[i];
            const b = balas[i];
            if (!b) {
                if (img.visible) img.setVisible(false);
                continue;
            }
            const textura = b.tipo === 'billete' ? 'billete' : b.tipo === 'rifle' || b.tipo === 'torreta' ? 'bala-larga' : 'bala';
            if (img.texture.key !== textura) img.setTexture(textura);
            const tam = b.tipo === 'cañon' ? 1.4 : b.tipo === 'acido' ? 1.3 : b.tipo === 'perdigon' ? 0.6 : b.tipo === 'billete' ? 1 : 0.75;
            img.setVisible(true).setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx)).setScale(tam);
            if (b.tipo === 'billete') img.clearTint();
            else img.setTint(COLOR_BALA[b.tipo]);
        }

        // Torretas.
        const torretas = new Set<number>();
        for (const t of this.sim.torretas) {
            torretas.add(t.id);
            let img = this.vistasTorreta.get(t.id);
            if (!img) {
                img = this.add.image(t.x, t.y, 'torreta').setScale(0.75).setDepth(18);
                this.vistasTorreta.set(t.id, img);
            }
            img.setPosition(t.x, t.y).setRotation(t.ang);
        }
        for (const [id, img] of this.vistasTorreta) {
            if (torretas.has(id)) continue;
            this.chispas('#ff9a1f').explode(10, img.x, img.y);
            img.destroy();
            this.vistasTorreta.delete(id);
        }

        // Barras de vida (gordos, jefe y jugadores) y anillo para revivir.
        const g = this.barras;
        g.clear();
        for (const z of this.sim.zombies) {
            if (z.tipo !== 'gordo' && z.tipo !== 'jefe') continue;
            const ancho = z.tipo === 'jefe' ? 110 : 40;
            const y = z.y - z.radio - (z.tipo === 'jefe' ? 30 : 12);
            g.fillStyle(0x000000, 0.6).fillRect(z.x - ancho / 2, y, ancho, 5);
            g.fillStyle(hex(COLOR_ZOMBIE[z.tipo]), 1).fillRect(z.x - ancho / 2, y, ancho * Math.max(0, z.vida / z.vidaMax), 5);
        }
        for (const j of this.sim.jugadores) {
            const color = hex(personaje(j.personaje).color);
            g.fillStyle(0x000000, 0.6).fillRect(j.x - 24, j.y + RADIO_JUGADOR + 8, 48, 5);
            g.fillStyle(j.vida / j.vidaMax > 0.35 ? color : 0xff3d5e, 1).fillRect(j.x - 24, j.y + RADIO_JUGADOR + 8, 48 * Math.max(0, j.vida / j.vidaMax), 5);
            if (j.caido) {
                g.lineStyle(4, 0x333344, 0.8).strokeCircle(j.x, j.y, 40);
                g.lineStyle(4, 0x7dffb0, 1);
                g.beginPath();
                g.arc(j.x, j.y, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * j.revive);
                g.strokePath();
            }
        }

        this.dibujarIndicador();
        void dt;
    }

    /** Flecha en la orilla de la pantalla hacia el compañero cuando no se ve. */
    private dibujarIndicador(): void {
        const g = this.indicador;
        g.clear();
        const yo = this.sim.jugador(this.cfg.yo.id);
        const otro = this.sim.jugadores.find((j) => j.id !== this.cfg.yo.id);
        if (!yo || !otro) return;
        const vista = this.cameras.main.worldView;
        if (vista.contains(otro.x, otro.y)) return;
        const margen = 40 / this.cameras.main.zoom;
        const ang = Math.atan2(otro.y - yo.y, otro.x - yo.x);
        const x = Phaser.Math.Clamp(otro.x, vista.x + margen, vista.right - margen);
        const y = Phaser.Math.Clamp(otro.y, vista.y + margen, vista.bottom - margen);
        const color = otro.caido ? 0xff3d5e : hex(personaje(otro.personaje).color);
        const tam = 16 / this.cameras.main.zoom;
        g.fillStyle(color, 0.9);
        g.fillTriangle(
            x + Math.cos(ang) * tam,
            y + Math.sin(ang) * tam,
            x + Math.cos(ang + 2.5) * tam,
            y + Math.sin(ang + 2.5) * tam,
            x + Math.cos(ang - 2.5) * tam,
            y + Math.sin(ang - 2.5) * tam,
        );
    }

    private hud(): Hud {
        const yo = this.sim.jugador(this.cfg.yo.id);
        const otro = this.sim.jugadores.find((j) => j.id !== this.cfg.yo.id);
        const jefe = this.sim.jefe;
        return {
            fase: this.sim.fase,
            oleada: this.sim.oleada,
            puntos: this.sim.puntos,
            restantes: this.sim.restantes,
            tiempoFase: this.sim.tiempoFase,
            jefe: jefe ? Math.max(0, jefe.vida / jefe.vidaMax) : null,
            yo: {
                vida: yo?.vida ?? 0,
                vidaMax: yo?.vidaMax ?? 1,
                caido: yo?.caido ?? false,
                revive: yo?.revive ?? 0,
                recarga: this.recarga,
                recargaMax: yo ? personaje(yo.personaje).habilidad.recarga : 1,
                bajas: yo?.bajas ?? 0,
            },
            otro: otro ? { nombre: otro.nombre, personaje: otro.personaje, vida: otro.vida, vidaMax: otro.vidaMax, caido: otro.caido, revive: otro.revive, bajas: otro.bajas } : null,
        };
    }

    get angulo(): number {
        return this.ultimoAng;
    }
}

/** Arranca Phaser dentro de `padre`. */
export function crearJuego(padre: HTMLElement, cfg: ConfigPartida): ControlJuego {
    const juego = new Phaser.Game({
        type: Phaser.AUTO,
        parent: padre,
        backgroundColor: '#020108',
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.RESIZE, width: padre.clientWidth || 800, height: padre.clientHeight || 600 },
        render: { antialias: true, powerPreference: 'high-performance' },
        input: { activePointers: 3 },
        fps: { target: 60 },
        scene: [],
    });
    juego.scene.add('arena', Arena, true, cfg);
    const escena = () => juego.scene.getScene('arena') as Arena | null;

    return {
        mandoTactil: (mx, my, ax, ay) => escena()?.mandoTactil(mx, my, ax, ay),
        habilidad: () => escena()?.habilidad(),
        companeroSalio: () => escena()?.companeroSalio(),
        destruir: () => juego.destroy(true),
    };
}
