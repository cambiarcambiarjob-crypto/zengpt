import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import CountUp from '@/components/reactbits/CountUp';
import GradientText from '@/components/reactbits/GradientText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import StarBorder from '@/components/reactbits/StarBorder';
import cabeza2Url from './cabeza-2.webp';
import cabeza3Url from './cabeza-3.webp';
import cabeza4Url from './cabeza-4.webp';
import cabeza5Url from './cabeza-5.webp';
import fondo5Url from './fondo-5.webp';
import cabezaUrl from './cabeza.webp';
import { Musica, type Pista } from './musica';

/**
 * Easter egg: Snake neón estilo arcade. La cabeza es una foto que cambia con el nivel, la comida son bloques de
 * Tetris y cada nivel trae su fondo animado y su música (la canción o una pieza estilo Tetris), en ciclo de 3.
 * Se descarga aparte (import dinámico) solo cuando alguien lo abre.
 */

const CELDAS = 20;
const COMIDAS_POR_NIVEL = 5;
// Colores de las piezas de Tetris (I, O, T, S, Z, J, L).
const PIEZAS = ['#22e5ff', '#ffe600', '#c84bff', '#3dff7a', '#ff3d5e', '#3d7bff', '#ff9a1f'];

type Punto = { x: number; y: number };
type Fondo = 'rejilla' | 'synthwave' | 'lluvia' | 'estrellas' | 'imagen';
type Tema = { cara: string; color: string; pista: Pista; fondo: Fondo };

// Ciclo de 5 niveles (en el 6 vuelve a empezar). Niveles 1–2 con la canción, 3–4 con la pieza estilo Tetris
// y 5 con la polka chiptune sobre la imagen de fondo.
const TEMAS: Tema[] = [
    { cara: cabezaUrl, color: '#22e5ff', pista: 'cancion', fondo: 'rejilla' },
    { cara: cabeza2Url, color: '#ff3dd8', pista: 'cancion', fondo: 'synthwave' },
    { cara: cabeza3Url, color: '#ff9a1f', pista: 'tetris', fondo: 'lluvia' },
    { cara: cabeza4Url, color: '#e8e8ff', pista: 'tetris', fondo: 'estrellas' },
    { cara: cabeza5Url, color: '#39c5bb', pista: 'polka', fondo: 'imagen' },
];
const temaDe = (nivel: number) => TEMAS[(nivel - 1) % TEMAS.length];
const indiceTema = (nivel: number) => (nivel - 1) % TEMAS.length;

type Pieza = { x: number; y: number; v: number; color: string; celdas: Punto[] };
const FORMAS: Punto[][] = [
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
    [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
];
type Chispa = { x: number; y: number; vx: number; vy: number; vida: number; color: string };
type Fase = 'inicio' | 'jugando' | 'pausa' | 'fin';

const RECORD = 'zengpt.snake.record';
const SILENCIO = 'zengpt.snake.silencio';
const leer = (clave: string): string | null => {
    try {
        return localStorage.getItem(clave);
    } catch {
        return null;
    }
};
const guardar = (clave: string, valor: string): void => {
    try {
        localStorage.setItem(clave, valor);
    } catch {
        // Sin almacenamiento: no pasa nada.
    }
};

const intervaloDe = (nivel: number) => Math.max(55, 150 - (nivel - 1) * 12);

interface Estado {
    cuerpo: Punto[];
    /** Posiciones antes del último paso: para dibujar el movimiento suave entre casillas. */
    previo: Punto[];
    direccion: Punto;
    cola: Punto[];
    comida: Punto;
    color: string;
    siguiente: string;
    puntos: number;
    comidas: number;
    nivel: number;
}

function comidaLibre(cuerpo: Punto[]): Punto {
    for (;;) {
        const p = { x: Math.floor(Math.random() * CELDAS), y: Math.floor(Math.random() * CELDAS) };
        if (!cuerpo.some((c) => c.x === p.x && c.y === p.y)) return p;
    }
}

const azar = () => PIEZAS[Math.floor(Math.random() * PIEZAS.length)];

function nuevoEstado(): Estado {
    const cuerpo = [
        { x: 8, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 10 },
    ];

    return { cuerpo, previo: cuerpo.map((c) => ({ ...c })), direccion: { x: 1, y: 0 }, cola: [], comida: comidaLibre(cuerpo), color: azar(), siguiente: azar(), puntos: 0, comidas: 0, nivel: 1 };
}

const neon = (color: string) => ({ color, textShadow: `0 0 6px ${color}, 0 0 18px ${color}` });
const NEON = ['#ff3dd8', '#22e5ff', '#ffe600', '#ff3dd8'];

/** Tarjeta de marcador (SpotlightCard de React Bits). Fuera del juego para que no se vuelva a montar en cada cuadro. */
function Dato({ titulo, color, children }: { titulo: string; color: string; children: ReactNode }) {
    return (
        <SpotlightCard theme="dark" spotlightColor={`${color}40`} className="min-w-[44%] flex-1 !rounded-none !border-white/10 !bg-black/40 px-3 py-2 sm:flex-none">
            <p className="text-[10px] tracking-[0.3em] text-white/50">{titulo}</p>
            <p className="text-2xl font-bold tabular-nums" style={neon(color)}>
                {children}
            </p>
        </SpotlightCard>
    );
}

export default function Serpiente({ alCerrar }: { alCerrar: () => void }) {
    const lienzo = useRef<HTMLCanvasElement>(null);
    const caja = useRef<HTMLDivElement>(null);
    const estado = useRef<Estado>(nuevoEstado());
    const fase = useRef<Fase>('inicio');
    const musica = useRef<Musica | null>(null);
    const imagenes = useRef<HTMLImageElement[]>([]);
    const onda = useRef<{ x: number; y: number; inicio: number; color: string } | null>(null);
    const lluvia = useRef<Pieza[]>([]);
    const estrellas = useRef<{ x: number; y: number; z: number }[]>([]);
    const fondoImagen = useRef<HTMLImageElement | null>(null);
    const ultimoCuadro = useRef(0);
    const reducido = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const chispas = useRef<Chispa[]>([]);
    const sacudida = useRef(0);
    const [avisoNivel, setAvisoNivel] = useState<number | null>(null);

    const [vista, setVista] = useState({ fase: 'inicio' as Fase, puntos: 0, nivel: 1, largo: 3, siguiente: estado.current.siguiente });
    const [record, setRecord] = useState(() => Number(leer(RECORD) ?? 0));
    const [silencio, setSilencio] = useState(() => leer(SILENCIO) === '1');

    const refrescar = useCallback(() => {
        const e = estado.current;
        setVista({ fase: fase.current, puntos: e.puntos, nivel: e.nivel, largo: e.cuerpo.length, siguiente: e.siguiente });
    }, []);

    // ——— Dibujo ———————————————————————————————————————————————————————————————
    /** Fondo de cada tema: rejilla que respira, synthwave que avanza o lluvia de piezas de Tetris. */
    const dibujarFondo = useCallback((ctx: CanvasRenderingContext2D, lado: number, celda: number, t: number, dt: number, tema: Tema) => {
        const quieto = reducido.current;

        if (tema.fondo === 'rejilla') {
            const a = quieto ? 0.1 : 0.08 + 0.04 * Math.sin(t / 900);
            ctx.strokeStyle = `rgba(120, 80, 255, ${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 1; i < CELDAS; i++) {
                ctx.moveTo(i * celda, 0);
                ctx.lineTo(i * celda, lado);
                ctx.moveTo(0, i * celda);
                ctx.lineTo(lado, i * celda);
            }
            ctx.stroke();
            return;
        }

        if (tema.fondo === 'synthwave') {
            // Rejilla que corre hacia abajo + barrido de luz.
            const desplazamiento = quieto ? 0 : (t * 0.04) % celda;
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 61, 216, 0.16)';
            ctx.beginPath();
            for (let y = -celda + desplazamiento; y < lado; y += celda) {
                ctx.moveTo(0, y);
                ctx.lineTo(lado, y);
            }
            ctx.stroke();
            ctx.strokeStyle = 'rgba(34, 229, 255, 0.12)';
            ctx.beginPath();
            for (let i = 1; i < CELDAS; i++) {
                ctx.moveTo(i * celda, 0);
                ctx.lineTo(i * celda, lado);
            }
            ctx.stroke();
            if (!quieto) {
                const y = ((t * 0.12) % (lado * 1.4)) - lado * 0.2;
                const g = ctx.createLinearGradient(0, y - celda * 2, 0, y + celda * 2);
                g.addColorStop(0, 'rgba(255,61,216,0)');
                g.addColorStop(0.5, 'rgba(255,61,216,0.10)');
                g.addColorStop(1, 'rgba(255,61,216,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, y - celda * 2, lado, celda * 4);
            }
            return;
        }

        if (tema.fondo === 'imagen') {
            // Imagen de fondo que «late» al ritmo de la polka, oscurecida para que la serpiente resalte.
            const img = fondoImagen.current;
            if (img?.complete && img.naturalWidth) {
                const zoom = quieto ? 1 : 1.04 + 0.025 * Math.abs(Math.sin((t / 1000) * Math.PI * (168 / 60)));
                const escala = Math.max(lado / img.naturalWidth, lado / img.naturalHeight) * zoom;
                const w = img.naturalWidth * escala;
                const h = img.naturalHeight * escala;
                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
                ctx.restore();
            }
            const velo = ctx.createRadialGradient(lado / 2, lado / 2, lado * 0.15, lado / 2, lado / 2, lado * 0.75);
            velo.addColorStop(0, 'rgba(5,3,15,0.25)');
            velo.addColorStop(1, 'rgba(5,3,15,0.8)');
            ctx.fillStyle = velo;
            ctx.fillRect(0, 0, lado, lado);
            ctx.strokeStyle = 'rgba(57, 197, 187, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 1; i < CELDAS; i++) {
                ctx.moveTo(i * celda, 0);
                ctx.lineTo(i * celda, lado);
                ctx.moveTo(0, i * celda);
                ctx.lineTo(lado, i * celda);
            }
            ctx.stroke();
            return;
        }

        if (tema.fondo === 'estrellas') {
            // Viaje entre estrellas: salen del centro hacia las orillas.
            if (estrellas.current.length === 0) estrellas.current = Array.from({ length: 90 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
            const centro = lado / 2;
            ctx.save();
            ctx.fillStyle = '#e8e8ff';
            for (const est of estrellas.current) {
                if (!quieto) {
                    est.z -= dt * 0.35;
                    if (est.z <= 0.02) {
                        est.x = Math.random() * 2 - 1;
                        est.y = Math.random() * 2 - 1;
                        est.z = 1;
                    }
                }
                const sx = centro + (est.x / est.z) * centro * 0.5;
                const sy = centro + (est.y / est.z) * centro * 0.5;
                if (sx < 0 || sy < 0 || sx > lado || sy > lado) continue;
                const tamEst = Math.max(0.6, (1 - est.z) * celda * 0.18);
                ctx.globalAlpha = Math.min(0.85, (1 - est.z) * 1.1);
                ctx.fillRect(sx, sy, tamEst, tamEst);
            }
            ctx.restore();
            return;
        }

        // Lluvia de piezas de Tetris (tenue, detrás de todo).
        if (lluvia.current.length === 0) {
            lluvia.current = Array.from({ length: 12 }, () => ({
                x: Math.floor(Math.random() * (CELDAS - 3)),
                y: Math.random() * CELDAS - CELDAS,
                v: 1.5 + Math.random() * 2.5,
                color: PIEZAS[Math.floor(Math.random() * PIEZAS.length)],
                celdas: FORMAS[Math.floor(Math.random() * FORMAS.length)],
            }));
        }
        ctx.save();
        ctx.globalAlpha = 0.16;
        for (const pieza of lluvia.current) {
            if (!quieto) {
                pieza.y += pieza.v * dt;
                if (pieza.y > CELDAS + 2) {
                    pieza.y = -4;
                    pieza.x = Math.floor(Math.random() * (CELDAS - 3));
                }
            }
            ctx.fillStyle = pieza.color;
            for (const c of pieza.celdas) ctx.fillRect((pieza.x + c.x) * celda + 1, (Math.floor(pieza.y) + c.y) * celda + 1, celda - 2, celda - 2);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255, 154, 31, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < CELDAS; i++) {
            ctx.moveTo(i * celda, 0);
            ctx.lineTo(i * celda, lado);
            ctx.moveTo(0, i * celda);
            ctx.lineTo(lado, i * celda);
        }
        ctx.stroke();
    }, []);

    const dibujar = useCallback(
        (t: number, alfa: number) => {
            const c = lienzo.current;
            if (!c) return;
            const ctx = c.getContext('2d');
            if (!ctx) return;
            const lado = c.width;
            const celda = lado / CELDAS;
            const e = estado.current;
            const tema = temaDe(e.nivel);
            const brillo = reducido.current ? 1 : 0.85 + 0.15 * Math.sin(t / 260);
            const dt = Math.min(0.05, (t - (ultimoCuadro.current || t)) / 1000);
            ultimoCuadro.current = t;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#05030f';
            ctx.fillRect(0, 0, lado, lado);
            // Sacudida al perder (no con «menos movimiento»).
            if (sacudida.current > t && !reducido.current) {
                const fuerza = ((sacudida.current - t) / 350) * celda * 0.35;
                ctx.translate((Math.random() - 0.5) * fuerza, (Math.random() - 0.5) * fuerza);
            }

            dibujarFondo(ctx, lado, celda, t, dt, tema);

            // Comida: bloque de Tetris con bisel, que late.
            const latido = reducido.current ? 0 : Math.sin(t / 180) * 1.5;
            const margen = 2 - latido;
            const px = e.comida.x * celda + margen;
            const py = e.comida.y * celda + margen;
            const tam = celda - margen * 2;
            ctx.save();
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 18 * brillo;
            ctx.fillStyle = e.color;
            ctx.fillRect(px, py, tam, tam);
            ctx.restore();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(px, py, tam, tam * 0.18);
            ctx.fillRect(px, py, tam * 0.18, tam);
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.fillRect(px, py + tam * 0.82, tam, tam * 0.18);
            ctx.fillRect(px + tam * 0.82, py, tam * 0.18, tam);

            // Posiciones suavizadas: entre la casilla anterior y la nueva según el avance del paso.
            const pos = (i: number): Punto => {
                const b = e.cuerpo[i];
                const a = e.previo[i] ?? e.previo[e.previo.length - 1] ?? b;
                return { x: (a.x + (b.x - a.x) * alfa + 0.5) * celda, y: (a.y + (b.y - a.y) * alfa + 0.5) * celda };
            };
            const puntos = e.cuerpo.map((_, i) => pos(i));

            // Cuerpo continuo: un trazo con brillo y encima los tramos de color (magenta → cian).
            if (puntos.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = celda * 0.64;
                ctx.shadowColor = tema.color;
                ctx.shadowBlur = 16 * brillo;
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.moveTo(puntos[0].x, puntos[0].y);
                for (let i = 1; i < puntos.length; i++) ctx.lineTo(puntos[i].x, puntos[i].y);
                ctx.stroke();
                ctx.shadowBlur = 0;
                const desfase = indiceTema(e.nivel) * 50;
                for (let i = puntos.length - 1; i >= 1; i--) {
                    const hue = (300 - (i / Math.max(1, puntos.length - 1)) * 120 + desfase) % 360;
                    ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
                    ctx.beginPath();
                    ctx.moveTo(puntos[i].x, puntos[i].y);
                    ctx.lineTo(puntos[i - 1].x, puntos[i - 1].y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Cabeza: la foto del nivel, con marco neón del color del tema.
            const cabeza = puntos[0];
            const tamCabeza = celda * 1.5;
            const cx = cabeza.x - tamCabeza / 2;
            const cy = cabeza.y - tamCabeza / 2;
            ctx.save();
            ctx.shadowColor = tema.color;
            ctx.shadowBlur = 22 * brillo;
            ctx.strokeStyle = tema.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(cx, cy, tamCabeza, tamCabeza, tamCabeza * 0.28);
            ctx.stroke();
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(cx, cy, tamCabeza, tamCabeza, tamCabeza * 0.28);
            ctx.clip();
            const foto = imagenes.current[indiceTema(e.nivel)];
            if (foto?.complete) ctx.drawImage(foto, cx, cy, tamCabeza, tamCabeza);
            else {
                ctx.fillStyle = tema.color;
                ctx.fillRect(cx, cy, tamCabeza, tamCabeza);
            }
            ctx.restore();

            // Chispas de la comida.
            if (chispas.current.length) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                chispas.current = chispas.current.filter((ch) => {
                    ch.x += ch.vx;
                    ch.y += ch.vy;
                    ch.vx *= 0.94;
                    ch.vy *= 0.94;
                    ch.vida -= 0.035;
                    if (ch.vida <= 0) return false;
                    ctx.globalAlpha = ch.vida;
                    ctx.fillStyle = ch.color;
                    ctx.fillRect(ch.x * celda, ch.y * celda, celda * 0.16, celda * 0.16);
                    return true;
                });
                ctx.restore();
            }

            // Subida de nivel: destello y onda expansiva desde la cabeza.
            const o = onda.current;
            if (o) {
                const k = (t - o.inicio) / 700;
                if (k >= 1) onda.current = null;
                else {
                    ctx.save();
                    ctx.globalAlpha = 0.35 * Math.max(0, 1 - k * 3);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, lado, lado);
                    ctx.globalAlpha = 1 - k;
                    ctx.strokeStyle = o.color;
                    ctx.shadowColor = o.color;
                    ctx.shadowBlur = 24;
                    ctx.lineWidth = celda * 0.35 * (1 - k) + 2;
                    for (const extra of [0, 0.18]) {
                        const r = Math.max(0, k - extra) * lado * 1.1;
                        if (r <= 0) continue;
                        ctx.beginPath();
                        ctx.arc(o.x * celda, o.y * celda, r, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
        },
        [dibujarFondo],
    );

    // ——— Lógica ———————————————————————————————————————————————————————————————
    const terminar = useCallback(() => {
        fase.current = 'fin';
        musica.current?.perder();
        sacudida.current = performance.now() + 350;
        const puntos = estado.current.puntos;
        setRecord((r) => {
            if (puntos > r) {
                guardar(RECORD, String(puntos));
                return puntos;
            }
            return r;
        });
        refrescar();
    }, [refrescar]);

    /** Aviso «NIVEL N», onda expansiva, fanfarria y la música del nuevo tema. */
    const alSubirNivel = useCallback(() => {
        const e = estado.current;
        const tema = temaDe(e.nivel);
        setAvisoNivel(e.nivel);
        window.setTimeout(() => setAvisoNivel(null), 1300);
        if (!reducido.current) onda.current = { x: e.cuerpo[0].x + 0.5, y: e.cuerpo[0].y + 0.5, inicio: performance.now(), color: tema.color };
        musica.current?.subir();
        musica.current?.tocar(tema.pista);
    }, []);

    const avanzar = useCallback(() => {
        const e = estado.current;
        if (e.cola.length) {
            const d = e.cola.shift()!;
            if (d.x !== -e.direccion.x || d.y !== -e.direccion.y) e.direccion = d;
        }
        const cabeza = { x: e.cuerpo[0].x + e.direccion.x, y: e.cuerpo[0].y + e.direccion.y };
        e.previo = e.cuerpo.map((c) => ({ ...c }));
        const come = cabeza.x === e.comida.x && cabeza.y === e.comida.y;
        const cuerpo = come ? e.cuerpo : e.cuerpo.slice(0, -1);

        if (cabeza.x < 0 || cabeza.y < 0 || cabeza.x >= CELDAS || cabeza.y >= CELDAS || cuerpo.some((s) => s.x === cabeza.x && s.y === cabeza.y)) {
            e.previo = e.cuerpo.map((c) => ({ ...c }));
            terminar();
            return;
        }

        e.cuerpo = [cabeza, ...cuerpo];
        if (come) {
            const nivelAntes = e.nivel;
            if (!reducido.current) {
                for (let i = 0; i < 16; i++) {
                    const angulo = (i / 16) * Math.PI * 2;
                    const v = 0.12 + Math.random() * 0.16;
                    chispas.current.push({ x: e.comida.x + 0.5, y: e.comida.y + 0.5, vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v, vida: 1, color: e.color });
                }
            }
            e.comidas += 1;
            e.puntos += 10 * e.nivel;
            e.nivel = 1 + Math.floor(e.comidas / COMIDAS_POR_NIVEL);
            if (e.nivel > nivelAntes) alSubirNivel();
            e.comida = comidaLibre(e.cuerpo);
            e.color = e.siguiente;
            e.siguiente = azar();
            musica.current?.comer(e.nivel);
            refrescar();
        }
    }, [alSubirNivel, refrescar, terminar]);

    /** Truco (Shift + N): sube un nivel sin sumar puntos, para ver todos los temas. */
    const saltarNivel = useCallback(() => {
        if (fase.current !== 'jugando') return;
        const e = estado.current;
        e.nivel += 1;
        e.comidas = (e.nivel - 1) * COMIDAS_POR_NIVEL;
        alSubirNivel();
        refrescar();
    }, [alSubirNivel, refrescar]);

    const empezar = useCallback(() => {
        estado.current = nuevoEstado();
        chispas.current = [];
        fase.current = 'jugando';
        if (!musica.current) {
            musica.current = new Musica();
            musica.current.silenciada = leer(SILENCIO) === '1';
        }
        musica.current.iniciar();
        musica.current.pausar(false);
        musica.current.tocar(temaDe(1).pista);
        onda.current = null;
        refrescar();
    }, [refrescar]);

    const girar = useCallback(
        (d: Punto) => {
            if (fase.current === 'inicio' || fase.current === 'fin') {
                empezar();
                if (d.x === -1) return;
            }
            if (fase.current !== 'jugando') return;
            const e = estado.current;
            const ultima = e.cola[e.cola.length - 1] ?? e.direccion;
            if ((d.x === ultima.x && d.y === ultima.y) || (d.x === -ultima.x && d.y === -ultima.y)) return;
            if (e.cola.length < 3) e.cola.push(d);
        },
        [empezar],
    );

    const pausar = useCallback(() => {
        if (fase.current === 'jugando') fase.current = 'pausa';
        else if (fase.current === 'pausa') fase.current = 'jugando';
        else return;
        musica.current?.pausar(fase.current === 'pausa');
        refrescar();
    }, [refrescar]);

    const alternarSonido = useCallback(() => {
        const m = musica.current;
        const nuevo = m ? m.alternarSilencio() : !(leer(SILENCIO) === '1');
        guardar(SILENCIO, nuevo ? '1' : '0');
        setSilencio(nuevo);
    }, []);

    // Fotos de la cabeza (una por tema) y la canción: empiezan a cargar en cuanto se abre el juego.
    useEffect(() => {
        imagenes.current = TEMAS.map((tema) => {
            const img = new Image();
            img.src = tema.cara;
            return img;
        });
        const fondo = new Image();
        fondo.src = fondo5Url;
        fondoImagen.current = fondo;
        if (!musica.current) {
            musica.current = new Musica();
            musica.current.silenciada = leer(SILENCIO) === '1';
        }
    }, []);

    // Bucle: avanza a ritmo fijo según el nivel y dibuja cada cuadro.
    useEffect(() => {
        let id = 0;
        let ultimo = performance.now();
        let alfa = 1;
        const ciclo = (t: number) => {
            const intervalo = intervaloDe(estado.current.nivel);
            if (fase.current === 'jugando') {
                if (t - ultimo >= intervalo) {
                    // Paso fijo; si el navegador se atrasó mucho, no acumula pasos de golpe.
                    ultimo = t - Math.min(intervalo, t - ultimo - intervalo);
                    avanzar();
                }
                // Qué tanto va el paso actual (0 → 1): la serpiente se dibuja entre una casilla y la siguiente.
                alfa = Math.min(1, (t - ultimo) / intervalo);
            } else {
                // En pausa se queda donde iba; al reanudar sigue desde ahí.
                ultimo = t - alfa * intervalo;
                if (fase.current !== 'pausa') alfa = 1;
            }
            dibujar(t, alfa);
            id = requestAnimationFrame(ciclo);
        };
        id = requestAnimationFrame(ciclo);

        return () => cancelAnimationFrame(id);
    }, [avanzar, dibujar]);

    // Tamaño del lienzo (nítido en pantallas de alta densidad).
    useEffect(() => {
        const ajustar = () => {
            const c = lienzo.current;
            const contenedor = caja.current;
            if (!c || !contenedor) return;
            const lado = Math.floor(Math.min(contenedor.clientWidth, contenedor.clientHeight));
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            c.style.width = `${lado}px`;
            c.style.height = `${lado}px`;
            c.width = Math.floor((lado * dpr) / CELDAS) * CELDAS;
            c.height = c.width;
        };
        ajustar();
        const observador = new ResizeObserver(ajustar);
        if (caja.current) observador.observe(caja.current);

        return () => observador.disconnect();
    }, []);

    // Teclado.
    useEffect(() => {
        const teclas: Record<string, Punto> = {
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            w: { x: 0, y: -1 },
            s: { x: 0, y: 1 },
            a: { x: -1, y: 0 },
            d: { x: 1, y: 0 },
        };
        const alPresionar = (ev: KeyboardEvent) => {
            const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
            if (k === 'Escape') {
                ev.preventDefault();
                alCerrar();
            } else if (teclas[k]) {
                ev.preventDefault();
                girar(teclas[k]);
            } else if (k === ' ' || k === 'p') {
                ev.preventDefault();
                if (fase.current === 'inicio' || fase.current === 'fin') empezar();
                else pausar();
            } else if (k === 'Enter') {
                ev.preventDefault();
                if (fase.current !== 'jugando') empezar();
            } else if (k === 'm') {
                alternarSonido();
            } else if (ev.key === 'N' && ev.shiftKey) {
                saltarNivel();
            }
        };
        window.addEventListener('keydown', alPresionar);

        return () => window.removeEventListener('keydown', alPresionar);
    }, [alCerrar, alternarSonido, empezar, girar, pausar, saltarNivel]);

    // Deslizar el dedo en el celular.
    useEffect(() => {
        const c = lienzo.current;
        if (!c) return;
        let inicio: { x: number; y: number } | null = null;
        const tocar = (ev: TouchEvent) => {
            inicio = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        };
        const soltar = (ev: TouchEvent) => {
            if (!inicio) return;
            const dx = ev.changedTouches[0].clientX - inicio.x;
            const dy = ev.changedTouches[0].clientY - inicio.y;
            inicio = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
                if (fase.current !== 'jugando') empezar();
                return;
            }
            girar(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
        };
        c.addEventListener('touchstart', tocar, { passive: true });
        c.addEventListener('touchend', soltar);

        return () => {
            c.removeEventListener('touchstart', tocar);
            c.removeEventListener('touchend', soltar);
        };
    }, [empezar, girar]);

    // Al cerrar: apaga la música.
    useEffect(() => () => musica.current?.detener(), []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Juego Snake">
            <div className="flex max-h-full w-full max-w-[920px] flex-col gap-3 border border-[#7a4bff]/50 bg-[#07051a] p-3 shadow-[0_0_40px_rgba(122,75,255,0.35)] sm:flex-row sm:p-4" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                <div ref={caja} className="relative aspect-square w-full min-w-0 sm:w-[min(70vh,600px)] sm:flex-none">
                    <canvas
                        ref={lienzo}
                        className="block touch-none border transition-[border-color,box-shadow] duration-700"
                        style={{ borderColor: `${temaDe(vista.nivel).color}80`, boxShadow: `0 0 26px ${temaDe(vista.nivel).color}40` }}
                    />
                    {/* Líneas de monitor retro (solo CSS). */}
                    <div className="pointer-events-none absolute inset-0 opacity-[0.13]" style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)' }} aria-hidden="true" />

                    {avisoNivel !== null && vista.fase === 'jugando' && (
                        <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center" aria-live="polite">
                            <GradientText colors={NEON} animationSpeed={2} glow={1} className="text-4xl font-bold tracking-[0.25em]">
                                NIVEL {avisoNivel}
                            </GradientText>
                        </div>
                    )}

                    {vista.fase !== 'jugando' && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05030f]/70 text-center">
                            {vista.fase === 'inicio' && (
                                <>
                                    <GradientText colors={NEON} animationSpeed={3} glow={1.2} className="text-4xl font-bold tracking-[0.3em] sm:text-6xl">
                                        SNAKE
                                    </GradientText>
                                    <p className="text-sm tracking-[0.4em]" style={neon('#22e5ff')}>
                                        ZEN EDITION
                                    </p>
                                    <p className="mt-4 animate-pulse text-xs tracking-widest text-white/80 motion-reduce:animate-none">PICA UNA FLECHA O ESPACIO</p>
                                </>
                            )}
                            {vista.fase === 'pausa' && (
                                <GradientText colors={['#ffe600', '#ff9a1f', '#ffe600']} animationSpeed={2} glow={1} className="text-4xl font-bold tracking-[0.3em]">
                                    PAUSA
                                </GradientText>
                            )}
                            {vista.fase === 'fin' && (
                                <>
                                    <GradientText colors={['#ff3d5e', '#ff3dd8', '#ff3d5e']} animationSpeed={2} glow={1.2} className="text-3xl font-bold tracking-[0.2em] sm:text-5xl">
                                        FIN DEL JUEGO
                                    </GradientText>
                                    <p className="text-lg" style={neon('#3dff7a')}>
                                        {vista.puntos} PUNTOS{vista.puntos > 0 && vista.puntos >= record ? ' · ¡RÉCORD!' : ''}
                                    </p>
                                    <p className="mt-2 animate-pulse text-xs tracking-widest text-white/80 motion-reduce:animate-none">ENTER PARA JUGAR OTRA VEZ</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <aside className="flex min-w-0 flex-1 flex-row flex-wrap gap-2 text-white sm:flex-col sm:gap-3">
                    <Dato titulo="PUNTOS" color="#22e5ff">
                        <CountUp to={vista.puntos} from={0} duration={0.35} trigger="load" />
                    </Dato>
                    <Dato titulo="RÉCORD" color="#ff3dd8">
                        <CountUp to={record} from={0} duration={0.5} trigger="load" />
                    </Dato>
                    <Dato titulo="NIVEL" color="#ffe600">
                        <CountUp to={vista.nivel} from={1} duration={0.3} trigger="load" />
                    </Dato>
                    <Dato titulo="LARGO" color="#3dff7a">
                        <CountUp to={vista.largo} from={3} duration={0.25} trigger="load" />
                    </Dato>
                    <div className="hidden border border-white/10 bg-black/40 px-3 py-2 sm:block">
                        <p className="text-[10px] tracking-[0.3em] text-white/50">SIGUIENTE</p>
                        <div className="mt-2 size-7 transition-colors" style={{ background: vista.siguiente, boxShadow: `0 0 14px ${vista.siguiente}` }} />
                    </div>
                    <div className="hidden text-[11px] leading-relaxed text-white/50 sm:block">
                        <p>Flechas / WASD: mover</p>
                        <p>Espacio: pausa · M: música</p>
                        <p>Esc: salir</p>
                    </div>
                    <div className="mt-auto flex w-full gap-2">
                        <StarBorder as="button" type="button" onClick={alternarSonido} theme="dark" color="#22e5ff" radius={0} thickness={1} className="flex-1 text-xs tracking-widest">
                            {silencio ? 'MÚSICA: NO' : 'MÚSICA: SÍ'}
                        </StarBorder>
                        <StarBorder as="button" type="button" onClick={alCerrar} theme="dark" color="#ff3d5e" radius={0} thickness={1} className="flex-1 text-xs tracking-widest">
                            SALIR
                        </StarBorder>
                    </div>
                </aside>
            </div>
        </div>
    );
}
