import * as THREE from 'three';

/*
 * Texturas procedurales del modo Zombies 3D (CanvasTexture). Todo se dibuja en un canvas nuevo por llamada:
 * nada de imágenes externas salvo las caras de los personajes. Estética: neón sobre noche oscura, con brillos
 * suaves (shadowBlur y degradados). Los tamaños son pequeños (potencias de dos cuando se repiten) para que
 * la subida a la GPU sea barata.
 */

type Lienzo = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

type OpcionesTextura = {
    /** Repetición horizontal (por defecto ClampToEdge). */
    repetirX?: boolean;
    /** Repetición vertical (por defecto ClampToEdge). */
    repetirY?: boolean;
    /** Generar mipmaps (por defecto sí). */
    mipmaps?: boolean;
};

/** Crea un canvas del tamaño pedido con su contexto 2D. */
function crearLienzo(ancho: number, alto: number): Lienzo {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(ancho));
    canvas.height = Math.max(1, Math.round(alto));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('No se pudo crear el contexto 2D para la textura.');
    }
    return { canvas, ctx };
}

/** Envuelve el canvas en una CanvasTexture con espacio de color sRGB y el wrapping indicado. */
function aTextura(canvas: HTMLCanvasElement, op: OpcionesTextura = {}): THREE.CanvasTexture {
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.wrapS = op.repetirX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    textura.wrapT = op.repetirY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    textura.magFilter = THREE.LinearFilter;
    if (op.mipmaps === false) {
        textura.generateMipmaps = false;
        textura.minFilter = THREE.LinearFilter;
    } else {
        textura.generateMipmaps = true;
        textura.minFilter = THREE.LinearMipmapLinearFilter;
    }
    textura.needsUpdate = true;
    return textura;
}

/** Generador pseudoaleatorio con semilla (mulberry32): las texturas salen iguales en cada partida. */
function aleatorio(semilla: number): () => number {
    let s = semilla >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Convierte '#rrggbb' (o '#rgb') a componentes 0…255. Si no se entiende, regresa blanco. */
function aRgb(color: string): [number, number, number] {
    let hex = color.trim().replace('#', '');
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((c) => c + c)
            .join('');
    }
    const n = Number.parseInt(hex, 16);
    if (hex.length !== 6 || Number.isNaN(n)) {
        return [255, 255, 255];
    }
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color con transparencia en formato rgba(). */
function rgba(color: string, alfa: number): string {
    const [r, g, b] = aRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/** Mezcla el color con blanco (0 = color, 1 = blanco): sirve para el núcleo caliente del neón. */
function aclarar(color: string, cuanto: number): string {
    const [r, g, b] = aRgb(color);
    const m = (v: number) => Math.round(v + (255 - v) * cuanto);
    return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

/** Fuente monoespaciada del sistema (sin descargar nada). */
const FUENTE_MONO = "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/* ------------------------------------------------------------------------------------------------ */

/**
 * Ficha del jugador (256×256): la foto recortada en círculo y un aro neón grueso del color con brillo.
 * Fondo transparente. Si la imagen aún no cargó, se dibuja un degradado del color en su lugar.
 */
export function texturaFicha(img: HTMLImageElement, color: string): THREE.CanvasTexture {
    const T = 256;
    const { canvas, ctx } = crearLienzo(T, T);
    const c = T / 2;
    const radioAro = 104;
    const grosor = 14;
    const radioFoto = radioAro - grosor / 2;

    // Halo exterior muy suave detrás de todo.
    const halo = ctx.createRadialGradient(c, c, radioAro - 8, c, c, c);
    halo.addColorStop(0, rgba(color, 0.45));
    halo.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, T, T);

    // Foto recortada en círculo (recorte tipo «cover» centrado).
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, radioFoto, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#0b0614';
    ctx.fillRect(0, 0, T, T);
    const ancho = img.naturalWidth || img.width;
    const alto = img.naturalHeight || img.height;
    if (img.complete && ancho > 0 && alto > 0) {
        const lado = Math.min(ancho, alto);
        const sx = (ancho - lado) / 2;
        const sy = (alto - lado) / 2;
        const d = radioFoto * 2;
        ctx.drawImage(img, sx, sy, lado, lado, c - radioFoto, c - radioFoto, d, d);
    } else {
        const relleno = ctx.createRadialGradient(c, c - 20, 10, c, c, radioFoto);
        relleno.addColorStop(0, aclarar(color, 0.35));
        relleno.addColorStop(1, rgba(color, 0.25));
        ctx.fillStyle = relleno;
        ctx.fillRect(0, 0, T, T);
    }
    // Viñeta interior para que la foto se funda con el aro.
    const vineta = ctx.createRadialGradient(c, c, radioFoto * 0.62, c, c, radioFoto);
    vineta.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vineta.addColorStop(1, rgba(color, 0.35));
    ctx.fillStyle = vineta;
    ctx.fillRect(0, 0, T, T);
    ctx.restore();

    // Aro neón: capa de brillo, cuerpo del color y núcleo claro.
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.beginPath();
    ctx.arc(c, c, radioAro, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = aclarar(color, 0.7);
    ctx.lineWidth = grosor * 0.32;
    ctx.beginPath();
    ctx.arc(c, c, radioAro, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Reflejo superior sutil (un arco brillante en el aro).
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c, c, radioAro - grosor / 2 - 5, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();

    return aTextura(canvas);
}

/**
 * Etiqueta con el nombre: texto monoespaciado con brillo del color, fondo transparente.
 * `aspecto` = ancho / alto, para escalar el sprite sin deformarlo.
 */
export function texturaEtiqueta(texto: string, color: string): { textura: THREE.CanvasTexture; aspecto: number } {
    const tamano = 44;
    const margen = 22;
    const fuente = `700 ${tamano}px ${FUENTE_MONO}`;
    const contenido = texto.trim().toUpperCase() || '—';

    // Medir primero con un contexto auxiliar.
    const medida = crearLienzo(1, 1).ctx;
    medida.font = fuente;
    const anchoTexto = Math.ceil(medida.measureText(contenido).width);

    const ancho = Math.min(1024, anchoTexto + margen * 2);
    const alto = tamano + margen * 2;
    const { canvas, ctx } = crearLienzo(ancho, alto);

    // Píldora oscura semitransparente detrás para que se lea sobre cualquier fondo.
    const px = margen * 0.45;
    const py = margen * 0.55;
    const r = (alto - py * 2) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, ancho - px * 2, alto - py * 2, r);
    ctx.fillStyle = 'rgba(8, 4, 18, 0.55)';
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Texto con brillo en dos pasadas y núcleo claro encima.
    ctx.font = fuente;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tx = ancho / 2;
    const ty = alto / 2 + 2;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(contenido, tx, ty, ancho - margen * 2);
    ctx.shadowBlur = 6;
    ctx.fillText(contenido, tx, ty, ancho - margen * 2);
    ctx.restore();
    ctx.fillStyle = aclarar(color, 0.75);
    ctx.fillText(contenido, tx, ty, ancho - margen * 2);

    // Con mipmaps: la etiqueta casi siempre se ve chica y lejos; sin ellos el texto centellea al moverse
    // (WebGL2 los admite aunque el ancho no sea potencia de dos).
    return { textura: aTextura(canvas), aspecto: ancho / alto };
}

/**
 * Mosaico del piso (512×512, cubre 8 m: 1 m = 64 px) que se repite. Fondo casi negro morado, cuadrícula
 * neón con línea más brillante en los bordes del mosaico, y ruido sutil. Sirve como `map` y `emissiveMap`.
 */
export function texturaPiso(): THREE.CanvasTexture {
    const T = 512;
    const paso = 64;
    const { canvas, ctx } = crearLienzo(T, T);
    const azar = aleatorio(0x5eed01);

    // Fondo con un leve degradado radial por celda grande (da textura sin romper el mosaico).
    ctx.fillStyle = '#07040f';
    ctx.fillRect(0, 0, T, T);
    const centro = ctx.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T * 0.7);
    centro.addColorStop(0, 'rgba(40, 14, 70, 0.35)');
    centro.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centro;
    ctx.fillRect(0, 0, T, T);

    // Placas: algunas celdas ligeramente más claras o más oscuras.
    for (let i = 0; i < T / paso; i++) {
        for (let j = 0; j < T / paso; j++) {
            const v = azar();
            if (v < 0.22) {
                ctx.fillStyle = `rgba(70, 30, 120, ${0.05 + azar() * 0.07})`;
                ctx.fillRect(i * paso + 2, j * paso + 2, paso - 4, paso - 4);
            } else if (v > 0.9) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.fillRect(i * paso + 2, j * paso + 2, paso - 4, paso - 4);
            }
        }
    }

    // Ruido fino (granos claros y oscuros).
    for (let k = 0; k < 2600; k++) {
        const x = azar() * T;
        const y = azar() * T;
        const claro = azar() > 0.5;
        ctx.fillStyle = claro ? `rgba(150, 110, 220, ${azar() * 0.07})` : `rgba(0, 0, 0, ${azar() * 0.25})`;
        ctx.fillRect(x, y, 1 + azar() * 1.5, 1 + azar() * 1.5);
    }

    // Subcuadrícula muy tenue cada 0.5 m.
    ctx.strokeStyle = 'rgba(120, 70, 220, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let p = paso / 2; p < T; p += paso) {
        ctx.moveTo(p + 0.5, 0);
        ctx.lineTo(p + 0.5, T);
        ctx.moveTo(0, p + 0.5);
        ctx.lineTo(T, p + 0.5);
    }
    ctx.stroke();

    // Cuadrícula principal cada 1 m con brillo. Las líneas en 0 y en T se dibujan a medias en cada borde:
    // al repetirse el mosaico se juntan en una sola línea continua.
    const linea = (p: number, grosor: number, color: string, brillo: number) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = grosor;
        ctx.shadowColor = color;
        ctx.shadowBlur = brillo;
        ctx.beginPath();
        ctx.moveTo(p, -brillo);
        ctx.lineTo(p, T + brillo);
        ctx.moveTo(-brillo, p);
        ctx.lineTo(T + brillo, p);
        ctx.stroke();
        ctx.restore();
    };
    for (let p = paso; p < T; p += paso) {
        linea(p, 1.6, 'rgba(160, 80, 255, 0.55)', 6);
    }
    // Bordes del mosaico (cada 8 m): más gruesos y brillantes, con núcleo cian.
    for (const p of [0, T]) {
        linea(p, 6, 'rgba(190, 90, 255, 0.85)', 14);
        linea(p, 2.4, 'rgba(120, 240, 255, 0.95)', 6);
    }

    // Marcas en las intersecciones (pequeñas cruces cian).
    ctx.save();
    ctx.strokeStyle = 'rgba(110, 230, 255, 0.55)';
    ctx.shadowColor = 'rgba(110, 230, 255, 0.9)';
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = paso; x < T; x += paso) {
        for (let y = paso; y < T; y += paso) {
            ctx.moveTo(x - 4, y);
            ctx.lineTo(x + 4, y);
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x, y + 4);
        }
    }
    ctx.stroke();
    ctx.restore();

    return aTextura(canvas, { repetirX: true, repetirY: true });
}

/** Degradado radial blanco → transparente (128×128) para sprites aditivos, destellos y auras. */
export function texturaBrillo(): THREE.CanvasTexture {
    const T = 128;
    const { canvas, ctx } = crearLienzo(T, T);
    const c = T / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.12, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
    g.addColorStop(0.55, 'rgba(255, 255, 255, 0.12)');
    g.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, T, T);
    return aTextura(canvas);
}

/** Anillo blanco suave con brillo (256×256) para ondas expansivas. */
export function texturaAnillo(): THREE.CanvasTexture {
    const T = 256;
    const { canvas, ctx } = crearLienzo(T, T);
    const c = T / 2;
    const radio = 104;

    // Banda difusa (degradado radial centrado en el radio del anillo).
    const g = ctx.createRadialGradient(c, c, radio - 26, c, c, radio + 22);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.45, 'rgba(255, 255, 255, 0.35)');
    g.addColorStop(0.58, 'rgba(255, 255, 255, 0.55)');
    g.addColorStop(0.75, 'rgba(255, 255, 255, 0.18)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, T, T);

    // Línea nítida con brillo.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.shadowColor = 'rgba(255, 255, 255, 1)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, radio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Relleno interior muy tenue (la onda «empuja» aire).
    const interior = ctx.createRadialGradient(c, c, 0, c, c, radio);
    interior.addColorStop(0, 'rgba(255, 255, 255, 0)');
    interior.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
    interior.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = interior;
    ctx.beginPath();
    ctx.arc(c, c, radio, 0, Math.PI * 2);
    ctx.fill();

    return aTextura(canvas);
}

/** Billete verde neón (128×64) con «$» al centro. */
export function texturaBillete(): THREE.CanvasTexture {
    const A = 128;
    const H = 64;
    const { canvas, ctx } = crearLienzo(A, H);
    const verde = '#39ff88';
    const m = 6;

    // Cuerpo del billete.
    const fondo = ctx.createLinearGradient(0, 0, A, H);
    fondo.addColorStop(0, '#0d5a33');
    fondo.addColorStop(0.5, '#14804a');
    fondo.addColorStop(1, '#0d5a33');
    ctx.save();
    ctx.shadowColor = verde;
    ctx.shadowBlur = 8;
    ctx.fillStyle = fondo;
    ctx.beginPath();
    ctx.roundRect(m, m, A - m * 2, H - m * 2, 6);
    ctx.fill();
    ctx.restore();

    // Marco neón doble.
    ctx.save();
    ctx.strokeStyle = verde;
    ctx.shadowColor = verde;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(m + 1.5, m + 1.5, A - m * 2 - 3, H - m * 2 - 3, 5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(190, 255, 215, 0.6)';
    ctx.beginPath();
    ctx.roundRect(m + 7, m + 7, A - m * 2 - 14, H - m * 2 - 14, 3);
    ctx.stroke();
    ctx.restore();

    // Medallón central.
    const c = { x: A / 2, y: H / 2 };
    const med = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 18);
    med.addColorStop(0, 'rgba(160, 255, 200, 0.55)');
    med.addColorStop(1, 'rgba(160, 255, 200, 0)');
    ctx.fillStyle = med;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
    ctx.fill();

    // Esquinas con puntos.
    ctx.fillStyle = 'rgba(200, 255, 220, 0.8)';
    for (const [x, y] of [
        [m + 13, m + 13],
        [A - m - 13, m + 13],
        [m + 13, H - m - 13],
        [A - m - 13, H - m - 13],
    ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Signo de pesos con brillo.
    ctx.font = `900 38px ${FUENTE_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = verde;
    ctx.shadowBlur = 10;
    ctx.fillStyle = verde;
    ctx.fillText('$', c.x, c.y + 2);
    ctx.restore();
    ctx.fillStyle = '#eafff1';
    ctx.fillText('$', c.x, c.y + 2);

    return aTextura(canvas);
}

/** Mancha irregular blanca (128×128) con bordes suaves y fondo transparente; se tiñe con el material. */
export function texturaMancha(): THREE.CanvasTexture {
    const T = 128;
    const { canvas, ctx } = crearLienzo(T, T);
    const azar = aleatorio(0xb10d);
    const c = T / 2;

    // Contorno irregular: radio ruidoso con varios armónicos.
    const puntos = 40;
    const fases = [azar() * 6.28, azar() * 6.28, azar() * 6.28];
    const contorno = (escala: number) => {
        ctx.beginPath();
        for (let i = 0; i <= puntos; i++) {
            const a = (i / puntos) * Math.PI * 2;
            const r =
                escala *
                (34 + Math.sin(a * 3 + fases[0]) * 6 + Math.sin(a * 5 + fases[1]) * 4 + Math.sin(a * 9 + fases[2]) * 2.5);
            const x = c + Math.cos(a) * r;
            const y = c + Math.sin(a) * r;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
    };

    // Cuerpo con borde suave: se dibuja fuera del lienzo y solo se deja su sombra difuminada.
    ctx.save();
    ctx.translate(-1000, 0);
    ctx.shadowOffsetX = 1000;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    contorno(1);
    ctx.fill();
    ctx.restore();

    // Centro más denso.
    const nucleo = ctx.createRadialGradient(c, c, 0, c, c, 34);
    nucleo.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    nucleo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = nucleo;
    ctx.beginPath();
    ctx.arc(c, c, 34, 0, Math.PI * 2);
    ctx.fill();

    // Salpicaduras alrededor.
    for (let i = 0; i < 11; i++) {
        const a = azar() * Math.PI * 2;
        const d = 40 + azar() * 18;
        const r = 2 + azar() * 4.5;
        const x = c + Math.cos(a) * d;
        const y = c + Math.sin(a) * d;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        g.addColorStop(0.6, 'rgba(255, 255, 255, 0.6)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return aTextura(canvas);
}

/** Cielo (16×512): degradado vertical de azul noche muy oscuro arriba a morado/magenta tenue en el horizonte. */
export function texturaCielo(): THREE.CanvasTexture {
    const A = 16;
    const H = 512;
    const { canvas, ctx } = crearLienzo(A, H);
    // Arriba del canvas = cenit (v = 1 en la esfera); la mitad = horizonte.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#010208');
    g.addColorStop(0.25, '#040618');
    g.addColorStop(0.4, '#0b0a2a');
    g.addColorStop(0.47, '#24103f');
    g.addColorStop(0.5, '#3a1250');
    g.addColorStop(0.53, '#1a0a2a');
    g.addColorStop(0.62, '#07040e');
    g.addColorStop(1, '#020104');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, A, H);
    return aTextura(canvas, { repetirX: true, mipmaps: false });
}

/**
 * Fachada de edificio (256×512): negro con ventanitas de colores neón (cian, magenta, ámbar) dispersas.
 * Para `emissiveMap` de edificios lejanos; se repite en ambos ejes.
 */
export function texturaVentanas(): THREE.CanvasTexture {
    const A = 256;
    const H = 512;
    const { canvas, ctx } = crearLienzo(A, H);
    const azar = aleatorio(0xc17a);
    const colores = ['#22e6ff', '#ff3df2', '#ffb02e', '#8a7dff'];

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, A, H);

    const columnas = 8;
    const filas = 24;
    const celdaA = A / columnas;
    const celdaH = H / filas;
    const ventA = celdaA * 0.5;
    const ventH = celdaH * 0.42;

    // Bloques: a veces un piso entero apagado o un grupo del mismo color (como oficinas encendidas).
    for (let f = 0; f < filas; f++) {
        const pisoApagado = azar() < 0.18;
        const colorPiso = colores[Math.floor(azar() * colores.length)];
        for (let k = 0; k < columnas; k++) {
            const v = azar();
            if (pisoApagado ? v > 0.08 : v > 0.38) {
                // Ventana apagada: un gris casi negro para que la fachada no sea totalmente plana.
                ctx.fillStyle = 'rgba(20, 22, 40, 0.9)';
                ctx.fillRect(k * celdaA + (celdaA - ventA) / 2, f * celdaH + (celdaH - ventH) / 2, ventA, ventH);
                continue;
            }
            const color = azar() < 0.6 ? colorPiso : colores[Math.floor(azar() * colores.length)];
            const x = k * celdaA + (celdaA - ventA) / 2;
            const y = f * celdaH + (celdaH - ventH) / 2;
            ctx.save();
            ctx.globalAlpha = 0.45 + azar() * 0.55;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, ventA, ventH);
            ctx.restore();
            // Brillo interior más claro en la parte alta de la ventana.
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.fillRect(x + 1, y + 1, ventA - 2, ventH * 0.35);
        }
    }

    // Franja neón ocasional (como un letrero horizontal).
    for (let i = 0; i < 2; i++) {
        const y = Math.floor(azar() * filas) * celdaH + celdaH - 2;
        const color = colores[Math.floor(azar() * colores.length)];
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.fillRect(0, y, A, 2);
        ctx.restore();
    }

    return aTextura(canvas, { repetirX: true, repetirY: true });
}

/**
 * Muro de energía (256×256): degradado vertical (abajo opaco, arriba transparente) con franjas horizontales
 * tenues. Blanco para teñirlo con el material; se repite en X.
 */
export function texturaMuroEnergia(): THREE.CanvasTexture {
    const T = 256;
    const { canvas, ctx } = crearLienzo(T, T);
    const azar = aleatorio(0xe7e6);

    // Degradado base: el canvas abajo corresponde a v = 0 (pie del muro).
    const g = ctx.createLinearGradient(0, T, 0, 0);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.08, 'rgba(255, 255, 255, 0.6)');
    g.addColorStop(0.35, 'rgba(255, 255, 255, 0.22)');
    g.addColorStop(0.7, 'rgba(255, 255, 255, 0.06)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, T, T);

    // Franjas horizontales (más visibles abajo, se pierden arriba).
    for (let y = 6; y < T; y += 12) {
        const alfa = 0.16 * (y / T) + 0.02;
        ctx.fillStyle = `rgba(255, 255, 255, ${alfa})`;
        ctx.fillRect(0, y, T, 2);
    }

    // Vetas verticales de energía que no rompen la repetición en X (se envuelven por el borde).
    for (let i = 0; i < 7; i++) {
        const x = azar() * T;
        const ancho = 2 + azar() * 6;
        const alto = T * (0.25 + azar() * 0.5);
        const v = ctx.createLinearGradient(0, T, 0, T - alto);
        v.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        v.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = v;
        for (const dx of [-T, 0, T]) {
            ctx.fillRect(x + dx - ancho / 2, T - alto, ancho, alto);
        }
    }

    // Línea brillante en el pie.
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillRect(0, T - 3, T, 3);

    return aTextura(canvas, { repetirX: true });
}

/** Marcador del compañero (64×64): rombo con cruz interior, blanco con brillo (se tiñe). */
export function texturaCruz(): THREE.CanvasTexture {
    const T = 64;
    const { canvas, ctx } = crearLienzo(T, T);
    const c = T / 2;
    const r = 20;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 1)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(c, c - r);
    ctx.lineTo(c + r, c);
    ctx.lineTo(c, c + r);
    ctx.lineTo(c - r, c);
    ctx.closePath();
    ctx.stroke();

    // Cruz interior.
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c, c - 8);
    ctx.lineTo(c, c + 8);
    ctx.moveTo(c - 8, c);
    ctx.lineTo(c + 8, c);
    ctx.stroke();
    ctx.restore();

    // Punto central caliente.
    const g = ctx.createRadialGradient(c, c, 0, c, c, 6);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, 6, 0, Math.PI * 2);
    ctx.fill();

    return aTextura(canvas);
}
