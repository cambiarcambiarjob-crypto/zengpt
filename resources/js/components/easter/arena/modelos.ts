import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { aMetros, COLOR_ZOMBIE } from './mundo3d';
import { MUNDO, type TipoZombie } from './sim';
import { texturaBrillo, texturaCielo, texturaMuroEnergia, texturaPiso, texturaVentanas } from './texturas';

/*
 * Modelos del modo Zombies 3D: zombies (geometrías para InstancedMesh), personajes jugables, torretas y el
 * escenario completo. Todo en metros, con el origen en el piso al centro del modelo y mirando hacia +X
 * (derecha = +Z, arriba = +Y). Estilo low-poly estilizado: caras planas (normales por cara), colores por
 * vértice con una ligera variación por cara y un sombreado suave por altura que da volumen sin texturas.
 *
 * Las piezas se juntan con `mergeGeometries` para que cada parte sea una sola llamada de dibujo.
 */

/* ------------------------------------------------------------------------------------------------ */
/* Utilidades de geometría                                                                          */
/* ------------------------------------------------------------------------------------------------ */

type Azar = () => number;

/** Generador pseudoaleatorio con semilla (mulberry32): los modelos salen iguales en cada partida. */
function azarConSemilla(semilla: number): Azar {
    let s = semilla >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const EJE_Y = new THREE.Vector3(0, 1, 0);
const UNO = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _esc = new THREE.Vector3();
const _color = new THREE.Color();

/** Matriz de posición + rotación (Euler XYZ) + escala. */
function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    return new THREE.Matrix4().compose(_pos.set(x, y, z), _quat.setFromEuler(_euler.set(rx, ry, rz)), _esc.set(sx, sy, sz));
}

/** Producto de matrices a · b (b se aplica primero). */
function por(a: THREE.Matrix4, b: THREE.Matrix4): THREE.Matrix4 {
    return new THREE.Matrix4().multiplyMatrices(a, b);
}

/** Matriz que coloca una geometría alineada al eje Y (centrada) entre los puntos a y b. */
function entre(a: THREE.Vector3, b: THREE.Vector3): { m: THREE.Matrix4; largo: number; dir: THREE.Vector3 } {
    const dir = new THREE.Vector3().subVectors(b, a);
    const largo = Math.max(1e-4, dir.length());
    dir.divideScalar(largo);
    const q = new THREE.Quaternion().setFromUnitVectors(EJE_Y, dir);
    const centro = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    return { m: new THREE.Matrix4().compose(centro, q, UNO), largo, dir };
}

/** Mezcla dos colores hex (t = 0 → a, t = 1 → b). */
function mezclar(a: number, b: number, t: number): number {
    return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

/** Oscurece (f < 1) o aclara (f > 1) un color hex. */
function tono(c: number, f: number): number {
    const col = new THREE.Color(c).multiplyScalar(f);
    col.r = Math.min(1, col.r);
    col.g = Math.min(1, col.g);
    col.b = Math.min(1, col.b);
    return col.getHex();
}

/**
 * Caja cuyo tapón superior se escala por `arriba` (en x y z): da torsos anchos de hombros, cráneos que se
 * angostan, etc. Dimensiones: x (fondo), y (alto), z (ancho).
 */
function cajaConica(x: number, y: number, z: number, arriba: number): THREE.BufferGeometry {
    const g = new THREE.BoxGeometry(x, y, z);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
        if (p.getY(i) > 0) {
            p.setX(i, p.getX(i) * arriba);
            p.setZ(i, p.getZ(i) * arriba);
        }
    }
    return g;
}

/**
 * Prepara una pieza y la agrega a la lista: sin índices (para caras planas), sin UV, transformada, con
 * normales por cara y, si se da `color`, con atributo de color por vértice (variación ligera por cara).
 * `intensidad` multiplica el color (para neones que deben pasar de 1 y brillar con el bloom).
 */
function pieza(
    lista: THREE.BufferGeometry[],
    geo: THREE.BufferGeometry,
    m: THREE.Matrix4,
    color: number | null,
    azar: Azar,
    variacion = 0.07,
    intensidad = 1,
): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) {
        geo.dispose();
    }
    g.deleteAttribute('uv');
    g.applyMatrix4(m);
    g.computeVertexNormals();
    if (color !== null) {
        const n = g.getAttribute('position').count;
        const col = new Float32Array(n * 3);
        _color.setHex(color);
        for (let i = 0; i < n; i += 3) {
            const f = (1 + (azar() * 2 - 1) * variacion) * intensidad;
            for (let k = 0; k < 3 && i + k < n; k++) {
                const j = (i + k) * 3;
                col[j] = _color.r * f;
                col[j + 1] = _color.g * f;
                col[j + 2] = _color.b * f;
            }
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    lista.push(g);
}

/** Cilindro (o cono truncado) entre dos puntos: rA es el radio en a y rB en b. */
function hueso(
    lista: THREE.BufferGeometry[],
    a: THREE.Vector3,
    b: THREE.Vector3,
    rA: number,
    rB: number,
    color: number | null,
    azar: Azar,
    lados = 5,
): void {
    const { m, largo } = entre(a, b);
    pieza(lista, new THREE.CylinderGeometry(rB, rA, largo, lados, 1), m, color, azar);
}

/** Pico (cono) que nace en `base` y apunta en `dir`. */
function pico(lista: THREE.BufferGeometry[], base: THREE.Vector3, dir: THREE.Vector3, alto: number, radio: number, color: number, azar: Azar): void {
    const d = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(EJE_Y, d);
    const centro = base.clone().addScaledVector(d, alto / 2);
    pieza(lista, new THREE.ConeGeometry(radio, alto, 5, 1), new THREE.Matrix4().compose(centro, q, UNO), color, azar, 0.1);
}

/** Junta las piezas en una sola geometría y libera las piezas. */
function fusionar(lista: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const g = mergeGeometries(lista, false);
    for (const p of lista) {
        p.dispose();
    }
    if (!g) {
        throw new Error('No se pudieron fusionar las piezas del modelo.');
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
}

/** Oscurece los colores por vértice cerca del piso (oclusión falsa): da volumen y asienta el modelo. */
function sombrearPorAltura(geo: THREE.BufferGeometry, desplazY: number, alto: number, minimo = 0.58): void {
    const pos = geo.getAttribute('position');
    const col = geo.getAttribute('color');
    if (!col) {
        return;
    }
    for (let i = 0; i < pos.count; i++) {
        const t = THREE.MathUtils.clamp((pos.getY(i) + desplazY) / alto, 0, 1);
        const f = minimo + (1 - minimo) * (t * t * (3 - 2 * t));
        col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
    }
    col.needsUpdate = true;
}

/* ------------------------------------------------------------------------------------------------ */
/* Zombies                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

interface Forma {
    /** Altura final del modelo (m): todo se escala para llegar a ella. */
    altura: number;
    /** Largo de la pierna = altura de la cadera antes de escalar. */
    pierna: number;
    separacion: number;
    grosorPierna: number;
    torsoAlto: number;
    /** Fondo del torso (eje X). */
    torsoX: number;
    /** Ancho del torso (eje Z). */
    torsoZ: number;
    /** Inclinación hacia adelante del torso (rad). */
    inclinacion: number;
    cabeza: number;
    brazoLargo: number;
    brazoGrosor: number;
    /** Caída de los brazos (rad) [derecho, izquierdo]: 0 = horizontales. */
    caidaBrazos: [number, number];
    piel: number;
    ropa: number;
    pantalon: number;
    semilla: number;
}

const FORMAS: Record<TipoZombie, Forma> = {
    caminante: {
        altura: 1.75,
        pierna: 0.82,
        separacion: 0.12,
        grosorPierna: 0.075,
        torsoAlto: 0.62,
        torsoX: 0.26,
        torsoZ: 0.44,
        inclinacion: 0.38,
        cabeza: 0.25,
        brazoLargo: 0.62,
        brazoGrosor: 0.05,
        caidaBrazos: [0.12, 0.3],
        piel: 0x7f9a6c,
        ropa: 0x3a4157,
        pantalon: 0x2a2c33,
        semilla: 0x2a11,
    },
    corredor: {
        altura: 1.6,
        pierna: 0.8,
        separacion: 0.1,
        grosorPierna: 0.058,
        torsoAlto: 0.56,
        torsoX: 0.2,
        torsoZ: 0.36,
        inclinacion: 0.66,
        cabeza: 0.23,
        brazoLargo: 0.72,
        brazoGrosor: 0.038,
        caidaBrazos: [0.32, 0.5],
        piel: 0x9aa48c,
        ropa: 0x2c2f38,
        pantalon: 0x1f2129,
        semilla: 0x3c07,
    },
    gordo: {
        altura: 1.9,
        pierna: 0.7,
        separacion: 0.24,
        grosorPierna: 0.13,
        torsoAlto: 0.8,
        torsoX: 0.5,
        torsoZ: 0.82,
        inclinacion: 0.18,
        cabeza: 0.27,
        brazoLargo: 0.6,
        brazoGrosor: 0.095,
        caidaBrazos: [0.22, 0.38],
        piel: 0x8aa074,
        ropa: 0x4a3a35,
        pantalon: 0x2d2a2a,
        semilla: 0x9e4d,
    },
    escupidor: {
        altura: 1.7,
        pierna: 0.8,
        separacion: 0.12,
        grosorPierna: 0.07,
        torsoAlto: 0.6,
        torsoX: 0.26,
        torsoZ: 0.42,
        inclinacion: 0.48,
        cabeza: 0.24,
        brazoLargo: 0.58,
        brazoGrosor: 0.05,
        caidaBrazos: [0.2, 0.42],
        piel: 0x6f977c,
        ropa: 0x2b3a3a,
        pantalon: 0x252a2c,
        semilla: 0x51a7,
    },
    jefe: {
        altura: 4.6,
        pierna: 0.95,
        separacion: 0.24,
        grosorPierna: 0.14,
        torsoAlto: 0.95,
        torsoX: 0.55,
        torsoZ: 0.95,
        inclinacion: 0.42,
        cabeza: 0.3,
        brazoLargo: 1.0,
        brazoGrosor: 0.12,
        caidaBrazos: [0.55, 0.75],
        piel: 0x6a7a5a,
        ropa: 0x2a2230,
        pantalon: 0x1f1a24,
        semilla: 0xb055,
    },
};

/**
 * Multiplicador de los detalles del color del tipo (corbata, dorsal, tirantes, saco, grietas…): su color por
 * vértice pasa de 1 y el material de escena3d emite el excedente, así brillan solos aun sin bloom.
 */
const BRILLO_DETALLE = 2.3;

const COLOR_HERIDA = 0x6b1414;
const COLOR_HUESO = 0xd9cfb0;
const COLOR_HUECO = 0x140707;

/**
 * Geometrías de un zombie para InstancedMesh (todas comparten el mismo marco: origen al piso, mirando a +X).
 * - `cuerpo`: todo menos las piernas (con atributo `color`).
 * - `piernaIzq` / `piernaDer`: con el ORIGEN EN LA CADERA; cuelgan hacia −Y y ya traen su desplazamiento en
 *   z (izquierda = −Z, derecha = +Z). Para usarlas: matriz del zombie · trasladar(0, caderaY, 0) · rotarZ(balanceo).
 *   Con rotación z positiva el pie va hacia adelante (+X).
 * - `ojos`: dos esferitas al frente de la cabeza, sin color (se pintan con un material emisivo aparte).
 */
export function crearGeometriasZombie(tipo: TipoZombie): {
    cuerpo: THREE.BufferGeometry;
    piernaIzq: THREE.BufferGeometry;
    piernaDer: THREE.BufferGeometry;
    ojos: THREE.BufferGeometry;
    caderaY: number;
    altura: number;
} {
    const f = FORMAS[tipo];
    const azar = azarConSemilla(f.semilla);
    const colorTipo = COLOR_ZOMBIE[tipo];
    // Piel y ropa más claras que el piso oscuro, con un tinte del color del tipo: se leen de lejos.
    const piel = tono(f.piel, 1.12);
    const ropa = tono(mezclar(f.ropa, colorTipo, 0.15), 1.4);
    const pantalon = tono(mezclar(f.pantalon, colorTipo, 0.08), 1.35);
    const detalle = mezclar(piel, colorTipo, 0.7);
    const cuerpo: THREE.BufferGeometry[] = [];
    const ojos: THREE.BufferGeometry[] = [];
    const { torsoAlto: alto, torsoX: fx, torsoZ: fz, cabeza: c } = f;
    const esGordo = tipo === 'gordo';
    const esJefe = tipo === 'jefe';

    // Marco del torso: pivote en la cadera, inclinado hacia adelante (la parte de arriba va hacia +X).
    const T = mat(0, f.pierna, 0, 0, 0, -f.inclinacion);
    const enT = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(T);
    const dirT = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).transformDirection(T);
    const mT = (m: THREE.Matrix4) => por(T, m);

    // Pelvis.
    pieza(cuerpo, new THREE.BoxGeometry(fx * 0.88, 0.2, fz * 0.92), mat(0, f.pierna + 0.03, 0), pantalon, azar);
    // Cinturón (del color del tipo en el gordo y el jefe).
    pieza(
        cuerpo,
        new THREE.BoxGeometry(fx * 0.94, 0.05, fz * 0.97),
        mat(0, f.pierna + 0.11, 0),
        esGordo || esJefe ? colorTipo : 0x1a1612,
        azar,
        0.07,
        esGordo || esJefe ? BRILLO_DETALLE * 0.8 : 1,
    );

    // Abdomen descubierto (la camisa está rota abajo).
    if (esGordo) {
        // Panza enorme que sobresale hacia adelante.
        pieza(cuerpo, new THREE.SphereGeometry(1, 8, 6), mT(mat(fx * 0.16, alto * 0.3, 0, 0, 0, 0, fx * 0.78, alto * 0.42, fz * 0.56)), piel, azar);
        // Pústulas del color del tipo sobre la panza.
        for (let i = 0; i < 4; i++) {
            const a = -0.6 + i * 0.4;
            pieza(
                cuerpo,
                new THREE.IcosahedronGeometry(0.035 + azar() * 0.03, 0),
                mT(mat(fx * 0.16 + Math.cos(a) * fx * 0.74, alto * (0.2 + azar() * 0.25), Math.sin(a) * fz * 0.5)),
                detalle,
                azar,
                0.07,
                BRILLO_DETALLE * 0.85,
            );
        }
    } else {
        pieza(cuerpo, cajaConica(fx * 0.86, alto * 0.36, fz * 0.86, 1.04), mT(mat(0, alto * 0.18, 0)), piel, azar);
        // Costillas expuestas.
        for (let i = 0; i < 3; i++) {
            pieza(cuerpo, new THREE.BoxGeometry(0.02, 0.016, fz * 0.32), mT(mat(fx * 0.44, alto * (0.08 + i * 0.075), -fz * 0.12, 0.08 * i)), COLOR_HUESO, azar, 0.04);
        }
    }

    // Camisa (parte alta del torso, más ancha de hombros).
    const camisaDesde = esGordo ? 0.42 : tipo === 'corredor' ? 0.34 : 0.26;
    const camisaAlto = 0.98 - camisaDesde;
    pieza(cuerpo, cajaConica(fx, alto * camisaAlto, fz, 1.13), mT(mat(0, alto * (camisaDesde + camisaAlto / 2), 0)), ropa, azar);
    // Espalda abultada (joroba) para la silueta encorvada.
    pieza(cuerpo, new THREE.SphereGeometry(1, 6, 4), mT(mat(-fx * 0.3, alto * 0.8, 0, 0, 0, 0, fx * 0.38, alto * 0.22, fz * 0.42)), ropa, azar);

    // Tiras de ropa rota colgando del borde de la camisa.
    const tiraColor = tono(ropa, 0.72);
    const nTiras = esJefe ? 9 : 7;
    for (let i = 0; i < nTiras; i++) {
        const cara = esGordo ? 1 + Math.floor(azar() * 3) : Math.floor(azar() * 4);
        const largo = (0.07 + azar() * 0.15) * (esJefe ? 1.5 : 1);
        const ancho = 0.035 + azar() * 0.05;
        const giro = (azar() - 0.5) * 0.5;
        const y = alto * camisaDesde - largo / 2 + 0.01;
        if (cara < 2) {
            const sx = cara === 0 ? 1 : -1;
            pieza(cuerpo, new THREE.BoxGeometry(0.014, largo, ancho), mT(mat(sx * (fx / 2 + 0.008), y, (azar() - 0.5) * fz * 0.8, giro)), tiraColor, azar);
        } else {
            const sz = cara === 2 ? 1 : -1;
            pieza(cuerpo, new THREE.BoxGeometry(ancho, largo, 0.014), mT(mat((azar() - 0.5) * fx * 0.8, y, sz * (fz / 2 + 0.008), 0, 0, giro)), tiraColor, azar);
        }
    }

    // Herida en el pecho.
    pieza(cuerpo, new THREE.BoxGeometry(0.02, alto * 0.14, fz * 0.22), mT(mat(fx * 0.5 + 0.004, alto * 0.62, fz * 0.18, 0.3)), COLOR_HERIDA, azar);

    // Detalles por tipo en el torso.
    if (tipo === 'caminante') {
        // Corbata rota del color del tipo (oficinista), brillante.
        pieza(cuerpo, new THREE.BoxGeometry(0.024, alto * 0.42, 0.08), mT(mat(fx * 0.5 + 0.012, alto * 0.7, -0.02, 0.12)), colorTipo, azar, 0.04, BRILLO_DETALLE);
        // Pústulas en el hombro.
        for (let i = 0; i < 3; i++) {
            pieza(cuerpo, new THREE.IcosahedronGeometry(0.03 + azar() * 0.02, 0), mT(mat(-fx * 0.1 + azar() * 0.1, alto * 0.95, fz * (0.32 + i * 0.07))), detalle, azar, 0.07, BRILLO_DETALLE * 0.85);
        }
    } else if (tipo === 'corredor') {
        // Número de carrera (dorsal) del color del tipo y franja en la camiseta.
        pieza(cuerpo, new THREE.BoxGeometry(0.014, alto * 0.24, fz * 0.46), mT(mat(fx * 0.5 + 0.01, alto * 0.6, 0, 0.1)), colorTipo, azar, 0.03, BRILLO_DETALLE);
        pieza(cuerpo, new THREE.BoxGeometry(fx * 1.05, 0.03, 0.03), mT(mat(0, alto * 0.86, fz * 0.38)), colorTipo, azar, 0.03, BRILLO_DETALLE);
        pieza(cuerpo, new THREE.BoxGeometry(fx * 1.05, 0.03, 0.03), mT(mat(0, alto * 0.86, -fz * 0.38)), colorTipo, azar, 0.03, BRILLO_DETALLE);
    } else if (esGordo) {
        // Tirantes del color del tipo.
        for (const s of [-1, 1]) {
            pieza(cuerpo, new THREE.BoxGeometry(fx * 1.04, 0.035, 0.06), mT(mat(0, alto * 0.98, s * fz * 0.28)), colorTipo, azar, 0.04, BRILLO_DETALLE);
            pieza(cuerpo, new THREE.BoxGeometry(0.02, alto * 0.5, 0.06), mT(mat(fx * 0.5 + 0.01, alto * 0.7, s * fz * 0.28)), colorTipo, azar, 0.04, BRILLO_DETALLE);
        }
    } else if (tipo === 'escupidor') {
        // Saco de ácido en la espalda (bulboso) con bolsas más chicas.
        pieza(cuerpo, new THREE.SphereGeometry(1, 8, 6), mT(mat(-fx * 0.75, alto * 0.62, 0.03, 0, 0, 0.3, 0.24, 0.3, 0.27)), detalle, azar, 0.12, BRILLO_DETALLE * 0.7);
        for (let i = 0; i < 4; i++) {
            const a = azar() * Math.PI * 2;
            pieza(
                cuerpo,
                new THREE.SphereGeometry(0.06 + azar() * 0.05, 6, 4),
                mT(mat(-fx * 0.75 - 0.12 + azar() * 0.08, alto * 0.62 + Math.cos(a) * 0.22, Math.sin(a) * 0.22)),
                mezclar(detalle, colorTipo, 0.5),
                azar,
                0.07,
                BRILLO_DETALLE,
            );
        }
        // Tubos que unen el saco con el cuello.
        hueso(cuerpo, enT(-fx * 0.6, alto * 0.85, 0.08), enT(-fx * 0.1, alto * 1.0, 0.06), 0.03, 0.022, tono(detalle, 0.8), azar, 4);
        hueso(cuerpo, enT(-fx * 0.6, alto * 0.8, -0.06), enT(-fx * 0.1, alto * 0.98, -0.05), 0.03, 0.022, tono(detalle, 0.8), azar, 4);
    } else if (esJefe) {
        // Grietas brillantes en el pecho y núcleo del color del tipo.
        for (let i = 0; i < 5; i++) {
            pieza(
                cuerpo,
                new THREE.BoxGeometry(0.018, alto * (0.12 + azar() * 0.18), 0.035),
                mT(mat(fx * 0.5 + 0.006, alto * (0.45 + azar() * 0.35), (azar() - 0.5) * fz * 0.6, (azar() - 0.5) * 1.6)),
                colorTipo,
                azar,
                0.03,
                BRILLO_DETALLE * 1.1,
            );
        }
        pieza(cuerpo, new THREE.IcosahedronGeometry(0.08, 0), mT(mat(fx * 0.5, alto * 0.62, 0)), colorTipo, azar, 0.02, BRILLO_DETALLE * 1.3);
        // Hombreras blindadas con picos.
        for (const s of [-1, 1]) {
            pieza(cuerpo, cajaConica(0.46, 0.2, 0.42, 0.72), mT(mat(-0.02, alto * 0.97, s * (fz * 0.56 + 0.08), s * 0.38)), 0x3a2f45, azar);
            for (let k = 0; k < 3; k++) {
                pico(
                    cuerpo,
                    enT(-0.12 + k * 0.12, alto * 1.05, s * (fz * 0.6 + 0.1)),
                    dirT(-0.25 + k * 0.2, 1, s * 0.55),
                    0.3 + (k === 1 ? 0.12 : 0),
                    0.06,
                    COLOR_HUESO,
                    azar,
                );
            }
        }
        // Picos a lo largo de la espalda.
        for (let k = 0; k < 5; k++) {
            const t = k / 4;
            pico(cuerpo, enT(-fx * 0.48, alto * (0.3 + t * 0.62), 0), dirT(-1, 0.5 + t * 0.4, 0), 0.24 + (1 - Math.abs(t - 0.6)) * 0.2, 0.055, COLOR_HUESO, azar);
        }
        // Placas de la columna.
        for (let k = 0; k < 4; k++) {
            pieza(cuerpo, new THREE.BoxGeometry(0.06, 0.1, 0.16), mT(mat(-fx * 0.5, alto * (0.32 + k * 0.17), 0)), 0x3a2f45, azar);
        }
    }

    // Cuello.
    hueso(cuerpo, enT(0, alto * 0.94, 0), enT(fx * 0.12, alto + 0.08, 0), c * 0.24, c * 0.2, piel, azar);

    // Cabeza: adelantada y algo ladeada; se endereza un poco respecto al torso para «mirar» a su presa.
    const H = por(T, mat(fx * 0.16, alto + 0.06 + c * 0.5, 0, 0.16, 0, f.inclinacion * 0.5));
    const enH = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(H);
    const mH = (m: THREE.Matrix4) => por(H, m);
    pieza(cuerpo, cajaConica(c * 0.92, c, c * 0.82, 0.9), H.clone(), piel, azar, 0.08);
    // Mandíbula colgando (boca abierta) y el hueco de la boca.
    pieza(cuerpo, new THREE.BoxGeometry(c * 0.6, c * 0.22, c * 0.66), mH(mat(c * 0.16, -c * 0.6, 0, 0, 0, -0.32)), tono(piel, 0.86), azar);
    pieza(cuerpo, new THREE.BoxGeometry(c * 0.06, c * 0.16, c * 0.5), mH(mat(c * 0.44, -c * 0.42, 0)), COLOR_HUECO, azar, 0.02);
    // Dientes.
    for (let i = 0; i < 3; i++) {
        pieza(cuerpo, new THREE.BoxGeometry(c * 0.05, c * 0.07, c * 0.07), mH(mat(c * 0.46, -c * 0.36, (i - 1) * c * 0.15)), COLOR_HUESO, azar, 0.05);
    }
    // Ceja y cuencas hundidas.
    pieza(cuerpo, new THREE.BoxGeometry(c * 0.14, c * 0.1, c * 0.8), mH(mat(c * 0.44, c * 0.2, 0, 0.12)), tono(piel, 0.78), azar);
    for (const s of [-1, 1]) {
        pieza(cuerpo, new THREE.BoxGeometry(c * 0.06, c * 0.18, c * 0.22), mH(mat(c * 0.43, c * 0.04, s * c * 0.21)), COLOR_HUECO, azar, 0.02);
        // Ojos grandes (siguen dentro de la cuenca): el rojo se lee de lejos aun sin bloom.
        const ojo = new THREE.SphereGeometry(c * (esJefe ? 0.13 : 0.115), 6, 4);
        pieza(ojos, ojo, mH(mat(c * 0.46, c * 0.04, s * c * 0.21)), null, azar);
    }
    // Una sola oreja (a la otra se la comieron).
    pieza(cuerpo, new THREE.BoxGeometry(c * 0.18, c * 0.26, c * 0.06), mH(mat(-c * 0.02, 0, -c * 0.44, 0.2)), tono(piel, 0.9), azar);
    if (esJefe) {
        // Cuernos.
        for (const s of [-1, 1]) {
            pico(cuerpo, enH(c * 0.1, c * 0.42, s * c * 0.3), new THREE.Vector3(0.45, 1, s * 0.55).transformDirection(H), c * 1.0, c * 0.14, COLOR_HUESO, azar);
        }
    } else if (tipo !== 'corredor') {
        // Mechones de pelo.
        for (let i = 0; i < 4; i++) {
            pieza(
                cuerpo,
                new THREE.BoxGeometry(c * (0.2 + azar() * 0.2), c * 0.12, c * (0.2 + azar() * 0.2)),
                mH(mat(-c * 0.1 + (azar() - 0.5) * c * 0.5, c * 0.52, (azar() - 0.5) * c * 0.5, 0, azar(), (azar() - 0.5) * 0.4)),
                0x1b1712,
                azar,
            );
        }
    }
    if (tipo === 'escupidor') {
        // Garganta hinchada y babas de ácido.
        pieza(cuerpo, new THREE.SphereGeometry(c * 0.36, 6, 4), mH(mat(c * 0.12, -c * 0.72, 0)), detalle, azar, 0.1);
        for (const z of [-0.1, 0.12]) {
            pieza(cuerpo, new THREE.BoxGeometry(c * 0.06, c * 0.42, c * 0.06), mH(mat(c * 0.42, -c * 0.85, z * c)), colorTipo, azar, 0.03, BRILLO_DETALLE);
        }
    }

    // Brazos estirados hacia el frente (pose clásica).
    for (const s of [1, -1]) {
        const g = f.brazoGrosor;
        const caida = s === 1 ? f.caidaBrazos[0] : f.caidaBrazos[1];
        const hombro = enT(0, alto * 0.86, s * (fz * 0.5 * 1.1 + g * 0.8));
        const l1 = f.brazoLargo * 0.47;
        const l2 = f.brazoLargo * 0.53;
        const codo = hombro.clone().add(new THREE.Vector3(Math.cos(caida) * l1, -Math.sin(caida) * l1, -s * 0.04));
        const caida2 = caida * 0.35 - (s === 1 ? 0.06 : -0.04);
        const muneca = codo.clone().add(new THREE.Vector3(Math.cos(caida2) * l2, -Math.sin(caida2) * l2, -s * 0.03));
        // Brazo con manga rota.
        hueso(cuerpo, hombro, codo, g * 1.05, g, piel, azar);
        const finManga = hombro.clone().lerp(codo, s === 1 ? 0.85 : 0.6);
        hueso(cuerpo, hombro, finManga, g * 1.35, g * 1.22, ropa, azar, 6);
        pieza(cuerpo, new THREE.BoxGeometry(g * 0.8, g * 1.8, 0.012), mat(finManga.x, finManga.y - g * 1.1, finManga.z + s * g * 1.15, 0, 0, 0.2), tiraColor, azar);
        // Antebrazo y mano.
        hueso(cuerpo, codo, muneca, g * 0.95, g * 0.8, piel, azar);
        const { m: mMano, dir } = entre(muneca, muneca.clone().add(new THREE.Vector3(Math.cos(caida2), -Math.sin(caida2), 0).multiplyScalar(g * 2)));
        pieza(cuerpo, new THREE.BoxGeometry(g * 1.9, g * 2, g * 0.85), mMano, tono(piel, 0.92), azar);
        // Dedos en garra (ganchudos hacia abajo).
        for (let k = -1; k <= 1; k++) {
            const base = muneca.clone().addScaledVector(dir, g * 1.8).add(new THREE.Vector3(0, 0, k * g * 0.6));
            const punta = base.clone().addScaledVector(dir, g * 1.4).add(new THREE.Vector3(0, -g * 0.9, 0));
            hueso(cuerpo, base, punta, g * 0.28, g * 0.18, tono(piel, 0.82), azar, 4);
            if (esJefe) {
                pico(cuerpo, punta, new THREE.Vector3(0.5, -1, 0), g * 1.2, g * 0.22, COLOR_HUESO, azar);
            }
        }
        // Venas/pústulas del color del tipo en el antebrazo.
        if (tipo === 'caminante' || tipo === 'escupidor' || esJefe) {
            const medio = codo.clone().lerp(muneca, 0.5);
            pieza(cuerpo, new THREE.IcosahedronGeometry(g * 0.55, 0), mat(medio.x, medio.y + g * 0.8, medio.z), detalle, azar, 0.07, BRILLO_DETALLE * 0.85);
        }
    }

    // Piernas (pivote en la cadera, colgando hacia −Y).
    const crearPierna = (s: number): THREE.BufferGeometry => {
        const lista: THREE.BufferGeometry[] = [];
        const L = f.pierna;
        const g = f.grosorPierna;
        const z = s * f.separacion;
        const rodilla = new THREE.Vector3(0.05, -L * 0.5, z);
        const tobillo = new THREE.Vector3(-0.01, -L + 0.09, z);
        hueso(lista, new THREE.Vector3(0, 0.04, z), rodilla, g * 1.15, g * 0.92, pantalon, azar, 6);
        const rasgada = s === -1 || tipo === 'corredor';
        if (rasgada) {
            // Pantalón roto a la rodilla: espinilla descubierta y jirones.
            hueso(lista, rodilla, tobillo, g * 0.82, g * 0.68, piel, azar);
            hueso(lista, rodilla.clone().add(new THREE.Vector3(0, 0.05, 0)), rodilla.clone().add(new THREE.Vector3(-0.005, -0.04, 0)), g * 1.0, g * 1.02, tono(pantalon, 0.8), azar, 6);
            pieza(lista, new THREE.BoxGeometry(g * 0.7, g * 1.6, 0.012), mat(rodilla.x, rodilla.y - g * 1.0, z + s * g * 0.95, 0.15), tono(pantalon, 0.75), azar);
        } else {
            hueso(lista, rodilla, tobillo, g * 0.9, g * 0.76, pantalon, azar, 6);
            // Parche más claro.
            pieza(lista, new THREE.BoxGeometry(0.012, g * 1.2, g * 1.1), mat(0.05 + g * 0.88, -L * 0.3, z, 0.2), tono(pantalon, 1.35), azar);
        }
        if (esJefe) {
            pico(lista, rodilla.clone().add(new THREE.Vector3(g * 0.8, 0, 0)), new THREE.Vector3(1, 0.3, 0), g * 1.6, g * 0.3, COLOR_HUESO, azar);
        }
        // Pie: un zapato viejo; el izquierdo perdió el suyo (pie descalzo). El corredor trae tenis del color del tipo.
        const corredor = tipo === 'corredor';
        const zapato = corredor ? colorTipo : s === -1 ? tono(piel, 0.8) : 0x1c1a17;
        pieza(lista, new THREE.BoxGeometry(L * 0.3, 0.09, g * 1.7), mat(0.05, -L + 0.045, z, 0, -s * 0.15), zapato, azar, 0.07, corredor ? BRILLO_DETALLE * 0.9 : 1);
        return fusionar(lista);
    };

    const geoCuerpo = fusionar(cuerpo);
    const geoIzq = crearPierna(-1);
    const geoDer = crearPierna(1);
    const geoOjos = fusionar(ojos);

    // Escala final para llegar a la altura pedida (y sombreado por altura).
    const altoNatural = geoCuerpo.boundingBox ? geoCuerpo.boundingBox.max.y : f.altura;
    const e = f.altura / altoNatural;
    sombrearPorAltura(geoCuerpo, 0, altoNatural * 0.95);
    sombrearPorAltura(geoIzq, f.pierna, altoNatural * 0.95);
    sombrearPorAltura(geoDer, f.pierna, altoNatural * 0.95);
    for (const g of [geoCuerpo, geoIzq, geoDer, geoOjos]) {
        g.scale(e, e, e);
        g.computeBoundingBox();
        g.computeBoundingSphere();
    }

    return {
        cuerpo: geoCuerpo,
        piernaIzq: geoIzq,
        piernaDer: geoDer,
        ojos: geoOjos,
        caderaY: f.pierna * e,
        altura: f.altura,
    };
}

/* ------------------------------------------------------------------------------------------------ */
/* Personajes jugables                                                                              */
/* ------------------------------------------------------------------------------------------------ */

type Capas = { tela: THREE.BufferGeometry[]; blindaje: THREE.BufferGeometry[]; neon: THREE.BufferGeometry[] };

const nuevasCapas = (): Capas => ({ tela: [], blindaje: [], neon: [] });

/** Monta las capas como mallas (una por material) dentro de `padre`. */
function montar(padre: THREE.Object3D, capas: Capas, mats: { tela: THREE.Material; blindaje: THREE.Material; neon: THREE.Material }): void {
    for (const clave of ['tela', 'blindaje', 'neon'] as const) {
        const lista = capas[clave];
        if (lista.length === 0) {
            continue;
        }
        const malla = new THREE.Mesh(fusionar(lista), mats[clave]);
        malla.castShadow = true;
        malla.receiveShadow = clave !== 'neon';
        malla.name = clave;
        padre.add(malla);
    }
}

/**
 * Personaje jugable SIN cabeza (escena3d pone la ficha con la foto en ALTURA.cabeza). Traje táctico con
 * chaleco blindado y franjas emisivas del color del personaje; sostiene el arma con ambas manos hacia +X.
 * Jerarquía: grupo → cuerpo (en la cadera) → brazos (en los hombros) → arma → puntaArma; las piernas son
 * hijas del grupo con pivote en la cadera (girar `rotation.z`: positivo = pie hacia adelante).
 */
export function crearPersonaje(color: string): {
    grupo: THREE.Group;
    cuerpo: THREE.Object3D;
    piernaIzq: THREE.Object3D;
    piernaDer: THREE.Object3D;
    brazos: THREE.Object3D;
    arma: THREE.Object3D;
    puntaArma: THREE.Object3D;
    materiales: THREE.Material[];
} {
    const azar = azarConSemilla(0x7e57);
    const col = new THREE.Color(color);
    const hex = col.getHex();
    const tela = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 });
    // Sin mapa de entorno, un metal alto se ve casi negro (la luz hemisférica solo aporta difuso).
    const blindaje = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.3 });
    const neon = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.1 });
    const mats = { tela, blindaje, neon };

    // Traje un poco más claro que el piso: de espaldas a la cámara no se lee como una silueta negra.
    const TRAJE = tono(0x1b1f2b, 1.35);
    const TRAJE2 = tono(0x262b3a, 1.35);
    const GUANTE = 0x111318;
    const METAL = tono(0x161922, 1.4);
    const METAL_CLARO = tono(0x3a4152, 1.4);
    const ARMADURA = tono(mezclar(0x2c3142, hex, 0.3), 1.4);
    const ARMADURA_OSC = tono(mezclar(0x1d2130, hex, 0.18), 1.4);
    const v = 0.035;

    const CADERA = 0.9;
    const grupo = new THREE.Group();
    grupo.name = 'personaje';

    // ---- Cuerpo (origen en la cadera) ----
    const cuerpo = new THREE.Group();
    cuerpo.name = 'cuerpo';
    cuerpo.position.set(0, CADERA, 0);
    grupo.add(cuerpo);
    const cc = nuevasCapas();
    // Pelvis, cinturón y hebilla.
    pieza(cc.tela, new THREE.BoxGeometry(0.24, 0.14, 0.36), mat(0, 0.0, 0), TRAJE, azar, v);
    pieza(cc.blindaje, new THREE.BoxGeometry(0.27, 0.05, 0.39), mat(0, 0.06, 0), METAL, azar, v);
    pieza(cc.neon, new THREE.BoxGeometry(0.02, 0.035, 0.08), mat(0.14, 0.06, 0), null, azar);
    // Cartucheras del cinturón.
    for (const s of [-1, 1]) {
        pieza(cc.blindaje, new THREE.BoxGeometry(0.07, 0.08, 0.06), mat(0.1, 0.02, s * 0.16), ARMADURA_OSC, azar, v);
    }
    // Abdomen y pecho.
    pieza(cc.tela, new THREE.CylinderGeometry(0.17, 0.15, 0.2, 8), mat(0, 0.16, 0, 0, 0, 0, 0.78, 1, 1.08), TRAJE2, azar, v);
    pieza(cc.tela, cajaConica(0.26, 0.28, 0.4, 1.08), mat(0, 0.3, 0), TRAJE, azar, v);
    // Chaleco blindado: placas de pecho, espalda y costados.
    pieza(cc.blindaje, cajaConica(0.07, 0.26, 0.36, 1.06), mat(0.15, 0.31, 0, 0, 0, -0.06), ARMADURA, azar, v);
    pieza(cc.blindaje, cajaConica(0.06, 0.24, 0.34, 1.04), mat(-0.145, 0.31, 0, 0, 0, 0.05), ARMADURA, azar, v);
    for (const s of [-1, 1]) {
        pieza(cc.blindaje, new THREE.BoxGeometry(0.2, 0.18, 0.05), mat(0, 0.27, s * 0.205), ARMADURA_OSC, azar, v);
    }
    // Placa abdominal segmentada.
    for (let i = 0; i < 2; i++) {
        pieza(cc.blindaje, new THREE.BoxGeometry(0.05, 0.06, 0.24 - i * 0.03), mat(0.13, 0.15 - i * 0.07, 0), ARMADURA_OSC, azar, v);
    }
    // Franjas emisivas del chaleco: dos verticales, una horizontal en «V» y el núcleo del pecho.
    for (const s of [-1, 1]) {
        pieza(cc.neon, new THREE.BoxGeometry(0.014, 0.2, 0.022), mat(0.188, 0.31, s * 0.11, 0, 0, -0.06), null, azar);
        pieza(cc.neon, new THREE.BoxGeometry(0.014, 0.022, 0.13), mat(0.182, 0.22, s * 0.06, s * 0.45, 0, -0.06), null, azar);
        pieza(cc.neon, new THREE.BoxGeometry(0.16, 0.018, 0.012), mat(0, 0.3, s * 0.232), null, azar);
    }
    pieza(cc.neon, new THREE.OctahedronGeometry(0.035, 0), mat(0.19, 0.36, 0, 0, 0, 0, 0.5, 1, 1), null, azar);
    // Mochila con celdas de energía.
    pieza(cc.blindaje, new THREE.BoxGeometry(0.12, 0.24, 0.26), mat(-0.22, 0.3, 0), METAL, azar, v);
    pieza(cc.blindaje, new THREE.BoxGeometry(0.03, 0.2, 0.2), mat(-0.29, 0.3, 0), METAL_CLARO, azar, v);
    for (const s of [-1, 1]) {
        pieza(cc.neon, new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), mat(-0.25, 0.31, s * 0.15), null, azar);
    }
    pieza(cc.neon, new THREE.BoxGeometry(0.012, 0.16, 0.02), mat(-0.307, 0.3, 0), null, azar);
    // Antena corta, a un costado de la mochila: desde la cámara de atrás no cruza la ficha de la cabeza.
    pieza(cc.blindaje, new THREE.CylinderGeometry(0.006, 0.008, 0.16, 4), mat(-0.25, 0.49, -0.17, -0.2), METAL_CLARO, azar, v);
    pieza(cc.neon, new THREE.SphereGeometry(0.014, 5, 3), mat(-0.25, 0.57, -0.186), null, azar);
    // Cuello: collarín metálico con anillo de luz.
    pieza(cc.blindaje, new THREE.CylinderGeometry(0.1, 0.13, 0.08, 8), mat(0, 0.46, 0), METAL, azar, v);
    pieza(cc.neon, new THREE.TorusGeometry(0.11, 0.011, 4, 14), mat(0, 0.47, 0, Math.PI / 2), null, azar);
    // Hombreras.
    for (const s of [-1, 1]) {
        pieza(
            cc.blindaje,
            new THREE.SphereGeometry(0.11, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
            mat(0, 0.38, s * 0.25, s * 0.3, 0, 0, 1, 0.75, 1.05),
            ARMADURA,
            azar,
            v,
        );
        pieza(cc.neon, new THREE.BoxGeometry(0.15, 0.016, 0.02), mat(0, 0.43, s * 0.285, s * 0.55), null, azar);
    }
    montar(cuerpo, cc, mats);

    // ---- Brazos (origen a la altura de los hombros, ≈ 1.28 m) ----
    const brazos = new THREE.Group();
    brazos.name = 'brazos';
    brazos.position.set(0, 0.38, 0);
    cuerpo.add(brazos);
    const cb = nuevasCapas();
    const brazo = (hombro: THREE.Vector3, codo: THREE.Vector3, mano: THREE.Vector3) => {
        hueso(cb.tela, hombro, codo, 0.058, 0.05, TRAJE2, azar, 7);
        hueso(cb.tela, codo, mano, 0.05, 0.044, TRAJE, azar, 7);
        // Codera y brazalete blindado con anillo de luz.
        pieza(cb.blindaje, new THREE.SphereGeometry(0.055, 6, 4), mat(codo.x, codo.y, codo.z), ARMADURA_OSC, azar, v);
        const a = codo.clone().lerp(mano, 0.25);
        const b = codo.clone().lerp(mano, 0.8);
        hueso(cb.blindaje, a, b, 0.058, 0.054, ARMADURA, azar, 6);
        const anillo = entre(a.clone().lerp(b, 0.55), a.clone().lerp(b, 0.62));
        pieza(cb.neon, new THREE.CylinderGeometry(0.06, 0.06, anillo.largo, 6), anillo.m, null, azar);
        // Guante.
        pieza(cb.tela, new THREE.BoxGeometry(0.09, 0.08, 0.075), mat(mano.x, mano.y, mano.z, 0, 0, -0.3), GUANTE, azar, v);
    };
    // Derecho (+Z): empuñadura. Izquierdo (−Z): guardamanos al frente.
    brazo(new THREE.Vector3(0, 0, 0.25), new THREE.Vector3(0.08, -0.22, 0.25), new THREE.Vector3(0.25, -0.12, 0.06));
    brazo(new THREE.Vector3(0, 0, -0.25), new THREE.Vector3(0.2, -0.17, -0.24), new THREE.Vector3(0.46, -0.1, -0.02));
    montar(brazos, cb, mats);

    // ---- Arma (empuñadura en la mano derecha; la boca queda en ≈ x 0.85, y 1.2) ----
    const arma = new THREE.Group();
    arma.name = 'arma';
    arma.position.set(0.26, -0.08, 0.02);
    brazos.add(arma);
    const ca = nuevasCapas();
    pieza(ca.blindaje, new THREE.BoxGeometry(0.36, 0.09, 0.07), mat(0.1, 0, 0), METAL, azar, v);
    pieza(ca.blindaje, new THREE.BoxGeometry(0.2, 0.07, 0.05), mat(-0.15, -0.015, 0, 0, 0, 0.06), METAL, azar, v);
    pieza(ca.blindaje, new THREE.BoxGeometry(0.04, 0.1, 0.055), mat(-0.25, -0.03, 0), ARMADURA_OSC, azar, v);
    pieza(ca.blindaje, new THREE.BoxGeometry(0.05, 0.11, 0.04), mat(-0.01, -0.08, 0, 0, 0, 0.3), METAL, azar, v);
    pieza(ca.blindaje, new THREE.BoxGeometry(0.065, 0.13, 0.045), mat(0.12, -0.1, 0, 0, 0, -0.12), ARMADURA, azar, v);
    pieza(ca.blindaje, new THREE.CylinderGeometry(0.038, 0.038, 0.17, 6), mat(0.35, 0.005, 0, 0, 0, Math.PI / 2), ARMADURA, azar, v);
    pieza(ca.blindaje, new THREE.CylinderGeometry(0.022, 0.022, 0.18, 6), mat(0.5, 0.005, 0, 0, 0, Math.PI / 2), METAL_CLARO, azar, v);
    // Mira.
    pieza(ca.blindaje, new THREE.BoxGeometry(0.13, 0.045, 0.04), mat(0.08, 0.07, 0), METAL, azar, v);
    pieza(ca.neon, new THREE.BoxGeometry(0.012, 0.03, 0.03), mat(0.15, 0.07, 0), null, azar);
    // Franjas de luz a los costados y anillo de la boca.
    for (const s of [-1, 1]) {
        pieza(ca.neon, new THREE.BoxGeometry(0.3, 0.012, 0.006), mat(0.08, 0.018, s * 0.037), null, azar);
        pieza(ca.neon, new THREE.BoxGeometry(0.1, 0.01, 0.006), mat(0.35, -0.02, s * 0.04), null, azar);
    }
    pieza(ca.neon, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8), mat(0.58, 0.005, 0, 0, 0, Math.PI / 2), null, azar);
    montar(arma, ca, mats);
    const puntaArma = new THREE.Object3D();
    puntaArma.name = 'puntaArma';
    puntaArma.position.set(0.6, 0.005, 0);
    arma.add(puntaArma);

    // ---- Piernas (pivote en la cadera, z = ±0.11) ----
    const crearPierna = (s: number): THREE.Object3D => {
        const pierna = new THREE.Group();
        pierna.name = s < 0 ? 'piernaIzq' : 'piernaDer';
        pierna.position.set(0, CADERA, s * 0.11);
        const cp = nuevasCapas();
        hueso(cp.tela, new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.02, -0.43, 0), 0.085, 0.07, TRAJE2, azar, 7);
        hueso(cp.tela, new THREE.Vector3(0.02, -0.43, 0), new THREE.Vector3(0, -0.8, 0), 0.068, 0.056, TRAJE, azar, 7);
        // Placa del muslo con franja de luz al costado exterior.
        pieza(cp.blindaje, new THREE.BoxGeometry(0.05, 0.2, 0.12), mat(0.08, -0.2, 0, 0, 0, -0.04), ARMADURA, azar, v);
        pieza(cp.neon, new THREE.BoxGeometry(0.02, 0.2, 0.012), mat(0.01, -0.21, s * 0.088), null, azar);
        // Funda en el muslo derecho.
        if (s > 0) {
            pieza(cp.blindaje, new THREE.BoxGeometry(0.1, 0.14, 0.04), mat(0, -0.24, s * 0.1), METAL, azar, v);
        }
        // Rodillera y espinillera.
        pieza(cp.blindaje, cajaConica(0.07, 0.1, 0.11, 0.8), mat(0.075, -0.44, 0), ARMADURA_OSC, azar, v);
        pieza(cp.neon, new THREE.BoxGeometry(0.01, 0.022, 0.05), mat(0.111, -0.44, 0), null, azar);
        pieza(cp.blindaje, new THREE.BoxGeometry(0.05, 0.22, 0.1), mat(0.055, -0.64, 0, 0, 0, 0.04), ARMADURA, azar, v);
        // Bota con suela de luz.
        pieza(cp.blindaje, new THREE.BoxGeometry(0.25, 0.1, 0.13), mat(0.04, -0.84, 0), METAL, azar, v);
        pieza(cp.blindaje, new THREE.BoxGeometry(0.08, 0.06, 0.135), mat(0.14, -0.82, 0, 0, 0, 0.3), METAL_CLARO, azar, v);
        pieza(cp.neon, new THREE.BoxGeometry(0.26, 0.016, 0.137), mat(0.04, -0.892, 0), null, azar);
        montar(pierna, cp, mats);
        grupo.add(pierna);
        return pierna;
    };
    const piernaIzq = crearPierna(-1);
    const piernaDer = crearPierna(1);

    return { grupo, cuerpo, piernaIzq, piernaDer, brazos, arma, puntaArma, materiales: [tela, blindaje, neon] };
}

/* ------------------------------------------------------------------------------------------------ */
/* Torreta                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

/** Torreta (≈ 0.9 m): base hexagonal naranja y cabeza con doble cañón (`canon`, mira a +X) que gira en Y. */
export function crearTorreta(): { grupo: THREE.Group; canon: THREE.Object3D; materiales: THREE.Material[] } {
    const azar = azarConSemilla(0x70e7);
    const NARANJA = 0xff9a1f;
    const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.35 });
    const naranja = new THREE.MeshStandardMaterial({ color: NARANJA, emissive: NARANJA, emissiveIntensity: 0.45, roughness: 0.45, metalness: 0.35 });
    const neon = new THREE.MeshStandardMaterial({ color: NARANJA, emissive: NARANJA, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0 });
    const mats = { tela: naranja, blindaje: metal, neon };

    const grupo = new THREE.Group();
    grupo.name = 'torreta';
    const cbase = nuevasCapas();
    // Patas.
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        pieza(cbase.blindaje, new THREE.BoxGeometry(0.42, 0.06, 0.08), mat(Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.36, 0, -a, 0), 0x1a1c24, azar, 0.05);
    }
    // Base hexagonal naranja con aro de luz.
    pieza(cbase.tela, new THREE.CylinderGeometry(0.4, 0.5, 0.22, 6), mat(0, 0.13, 0), NARANJA, azar, 0.05);
    pieza(cbase.neon, new THREE.CylinderGeometry(0.41, 0.41, 0.035, 6), mat(0, 0.255, 0), null, azar);
    pieza(cbase.blindaje, new THREE.CylinderGeometry(0.3, 0.36, 0.06, 6), mat(0, 0.3, 0), 0x22252f, azar, 0.05);
    // Poste.
    pieza(cbase.blindaje, new THREE.CylinderGeometry(0.1, 0.13, 0.26, 8), mat(0, 0.45, 0), 0x2a2e3a, azar, 0.05);
    montar(grupo, cbase, mats);

    const canon = new THREE.Group();
    canon.name = 'canon';
    canon.position.set(0, 0.62, 0);
    grupo.add(canon);
    const cc = nuevasCapas();
    pieza(cc.blindaje, cajaConica(0.34, 0.2, 0.3, 0.85), mat(0, 0, 0), 0x1d2029, azar, 0.05);
    for (const s of [-1, 1]) {
        pieza(cc.tela, new THREE.BoxGeometry(0.28, 0.14, 0.03), mat(-0.01, 0, s * 0.165), NARANJA, azar, 0.05);
        pieza(cc.blindaje, new THREE.CylinderGeometry(0.034, 0.034, 0.44, 7), mat(0.36, -0.02, s * 0.075, 0, 0, Math.PI / 2), 0x3a4050, azar, 0.04);
        pieza(cc.neon, new THREE.CylinderGeometry(0.038, 0.038, 0.025, 7), mat(0.58, -0.02, s * 0.075, 0, 0, Math.PI / 2), null, azar);
    }
    // Sensor (ojo) y antena.
    pieza(cc.neon, new THREE.BoxGeometry(0.02, 0.04, 0.12), mat(0.17, 0.06, 0), null, azar);
    pieza(cc.blindaje, new THREE.CylinderGeometry(0.006, 0.008, 0.2, 4), mat(-0.1, 0.19, 0.08), 0x3a4050, azar, 0.04);
    pieza(cc.neon, new THREE.SphereGeometry(0.018, 5, 3), mat(-0.1, 0.29, 0.08), null, azar);
    montar(canon, cc, mats);

    return { grupo, canon, materiales: [naranja, metal, neon] };
}

/* ------------------------------------------------------------------------------------------------ */
/* Escenario                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

const ANCHO = aMetros(MUNDO.ancho);
const ALTO = aMetros(MUNDO.alto);
const CENTRO_X = ANCHO / 2;
const CENTRO_Z = ALTO / 2;
/** Radio del cielo (la cámara necesita `far` ≥ ~300 m). */
const RADIO_CIELO = 230;

/** Ventanas a escala real en los edificios: la fachada (12 × 60 m) se repite según la escala de cada instancia. */
const SHADER_VENTANAS = /* glsl */ `
#include <uv_vertex>
#if defined( USE_INSTANCING ) && defined( USE_EMISSIVEMAP )
{
    vec3 escCaja = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
    vec2 rep = vec2( abs( normal.x ) > 0.5 ? escCaja.z : escCaja.x, escCaja.y ) / vec2( 12.0, 60.0 );
    vec2 desfase = floor( fract( instanceMatrix[ 3 ].xz * vec2( 0.0731, 0.0419 ) ) * vec2( 8.0, 24.0 ) ) / vec2( 8.0, 24.0 );
    vEmissiveMapUv = abs( normal.y ) > 0.5 ? vec2( 0.008, 0.494 ) : vEmissiveMapUv * rep + desfase;
}
#endif
`;

/**
 * Arma el escenario: piso de la arena, suelo exterior, barrera con bordes neón, muro de energía, pilares
 * con luces, ciudad lejana, cielo con estrellas y luna, luces y partículas de ambiente. No pone niebla.
 */
export function crearEscenario(escena: THREE.Scene, calidad: 'alta' | 'baja'): { actualizar(t: number, dt: number): void; dispose(): void } {
    const alta = calidad === 'alta';
    const azar = azarConSemilla(0xe5ce);
    const geometrias: THREE.BufferGeometry[] = [];
    const materiales: THREE.Material[] = [];
    const texturas: THREE.Texture[] = [];
    const objetos: THREE.Object3D[] = [];
    const luces: THREE.Light[] = [];

    const agregar = <T extends THREE.Object3D>(o: T): T => {
        escena.add(o);
        objetos.push(o);
        return o;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T): T => {
        geometrias.push(g);
        return g;
    };
    const material = <T extends THREE.Material>(m: T): T => {
        materiales.push(m);
        return m;
    };
    const textura = <T extends THREE.Texture>(t: T): T => {
        texturas.push(t);
        return t;
    };

    // ---- Piso de la arena ----
    const texPiso = textura(texturaPiso());
    texPiso.repeat.set(ANCHO / 8, ALTO / 8);
    // Línea gruesa del mosaico justo en el centro de la arena.
    texPiso.offset.set(0.1875, 0.125);
    // La cámara ve el piso casi siempre de lado: sin anisotropía la cuadrícula se emborrona a pocos metros.
    texPiso.anisotropy = alta ? 8 : 4;
    const matPiso = material(
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: texPiso,
            emissive: 0xffffff,
            emissiveMap: texPiso,
            emissiveIntensity: 1,
            // Mate: con más brillo especular la luna dejaba una mancha blanca que lavaba la cuadrícula.
            roughness: 0.72,
            metalness: 0.1,
        }),
    );
    const piso = agregar(new THREE.Mesh(geo(new THREE.PlaneGeometry(ANCHO, ALTO)), matPiso));
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(CENTRO_X, 0, CENTRO_Z);
    piso.receiveShadow = alta;
    piso.name = 'piso';

    // ---- Suelo exterior (la misma cuadrícula, muy tenue) ----
    const RADIO_SUELO = 250;
    const texFuera = textura(texPiso.clone());
    texFuera.repeat.set((RADIO_SUELO * 2) / 8, (RADIO_SUELO * 2) / 8);
    texFuera.offset.set(0.75, 0.75);
    texFuera.needsUpdate = true;
    const matFuera = material(
        new THREE.MeshStandardMaterial({
            color: 0x2a2440,
            map: texFuera,
            emissive: 0xffffff,
            emissiveMap: texFuera,
            emissiveIntensity: 0.16,
            roughness: 0.9,
            metalness: 0.1,
        }),
    );
    const fuera = agregar(new THREE.Mesh(geo(new THREE.CircleGeometry(RADIO_SUELO, 48)), matFuera));
    fuera.rotation.x = -Math.PI / 2;
    fuera.position.set(CENTRO_X, -0.05, CENTRO_Z);
    fuera.name = 'sueloExterior';

    // ---- Barrera baja + pilares (cuerpo con color por vértice) y sus neones (una sola malla) ----
    const cuerpoMuro: THREE.BufferGeometry[] = [];
    const neonMuro: THREE.BufferGeometry[] = [];
    const MORADO = 0xb04dff;
    const CIAN = 0x22e6ff;
    const lados = [
        { x: CENTRO_X, z: -0.25, largo: ANCHO + 1, rot: 0 },
        { x: CENTRO_X, z: ALTO + 0.25, largo: ANCHO + 1, rot: Math.PI },
        { x: -0.25, z: CENTRO_Z, largo: ALTO, rot: Math.PI / 2 },
        { x: ANCHO + 0.25, z: CENTRO_Z, largo: ALTO, rot: -Math.PI / 2 },
    ];
    for (const l of lados) {
        // Marco del lado: x local a lo largo del muro, +z local = cara interior (hacia la arena).
        const M = mat(l.x, 0, l.z, 0, l.rot, 0);
        const n = Math.max(1, Math.round(l.largo / 3));
        const tramo = l.largo / n;
        for (let i = 0; i < n; i++) {
            const x = -l.largo / 2 + tramo * (i + 0.5);
            pieza(cuerpoMuro, new THREE.BoxGeometry(tramo - 0.08, 0.92, 0.46), por(M, mat(x, 0.46, 0)), 0x15121f, azar, 0.12);
            // Panel interior biselado.
            pieza(cuerpoMuro, new THREE.BoxGeometry(tramo - 0.5, 0.5, 0.04), por(M, mat(x, 0.5, 0.24)), 0x1f1a2e, azar, 0.1);
            // Poste entre tramos con luz cian.
            const xp = -l.largo / 2 + tramo * i;
            pieza(cuerpoMuro, new THREE.BoxGeometry(0.2, 1.1, 0.56), por(M, mat(xp, 0.55, 0)), 0x0e0c16, azar, 0.05);
            pieza(neonMuro, new THREE.BoxGeometry(0.05, 0.55, 0.02), por(M, mat(xp, 0.6, 0.285)), CIAN, azar, 0.05, 1.75);
        }
        // Bordes superiores (interior y exterior) y zócalo luminoso.
        pieza(neonMuro, new THREE.BoxGeometry(l.largo, 0.05, 0.05), por(M, mat(0, 0.95, 0.22)), MORADO, azar, 0.02, 1.7);
        pieza(neonMuro, new THREE.BoxGeometry(l.largo, 0.04, 0.04), por(M, mat(0, 0.95, -0.22)), MORADO, azar, 0.02, 1.2);
        pieza(neonMuro, new THREE.BoxGeometry(l.largo, 0.03, 0.02), por(M, mat(0, 0.1, 0.24)), MORADO, azar, 0.02, 1.3);
    }
    // Pilares en las esquinas.
    const COLORES_PILAR = [0xff3df2, CIAN, 0x8a5dff, 0xffb02e];
    const esquinas: Array<[number, number]> = [
        [-1.3, -1.3],
        [ANCHO + 1.3, -1.3],
        [ANCHO + 1.3, ALTO + 1.3],
        [-1.3, ALTO + 1.3],
    ];
    const ALTO_PILAR = 7;
    esquinas.forEach(([x, z], i) => {
        const cp = COLORES_PILAR[i];
        pieza(cuerpoMuro, new THREE.CylinderGeometry(0.9, 1.05, 0.5, 6), mat(x, 0.25, z), 0x110e1a, azar, 0.08);
        pieza(cuerpoMuro, new THREE.CylinderGeometry(0.5, 0.62, ALTO_PILAR, 6), mat(x, ALTO_PILAR / 2, z), 0x17131f, azar, 0.1);
        pieza(cuerpoMuro, new THREE.CylinderGeometry(0.72, 0.6, 0.35, 6), mat(x, ALTO_PILAR + 0.1, z), 0x110e1a, azar, 0.08);
        for (let k = 0; k < 3; k++) {
            const y = 1.6 + k * 1.75;
            const r = 0.62 - (y / ALTO_PILAR) * 0.12 + 0.03;
            pieza(neonMuro, new THREE.CylinderGeometry(r, r, 0.09, 6), mat(x, y, z), cp, azar, 0.02, 1.8);
        }
        // Franjas verticales en las aristas.
        for (let k = 0; k < 6; k += 2) {
            const a = (k / 6) * Math.PI * 2;
            pieza(neonMuro, new THREE.BoxGeometry(0.05, ALTO_PILAR - 1, 0.05), mat(x + Math.sin(a) * 0.56, ALTO_PILAR / 2 + 0.3, z + Math.cos(a) * 0.56), cp, azar, 0.02, 1.3);
        }
        // Orbe en la punta.
        pieza(neonMuro, new THREE.OctahedronGeometry(0.42, 0), mat(x, ALTO_PILAR + 0.75, z), cp, azar, 0.03, 2.4);
    });
    const matMuro = material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.3 }));
    const muro = agregar(new THREE.Mesh(geo(fusionar(cuerpoMuro)), matMuro));
    muro.castShadow = alta;
    muro.receiveShadow = alta;
    muro.name = 'barrera';
    const matNeonMuro = material(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    const neonM = agregar(new THREE.Mesh(geo(fusionar(neonMuro)), matNeonMuro));
    neonM.name = 'neonBarrera';

    // ---- Muro de energía (dos capas aditivas que se deslizan en sentidos opuestos) ----
    const geoMuroEnergia = (desfase: number, uPorMetro: number, y0: number, y1: number): THREE.BufferGeometry => {
        const esq: Array<[number, number]> = [
            [-0.25 + desfase, -0.25 + desfase],
            [ANCHO + 0.25 - desfase, -0.25 + desfase],
            [ANCHO + 0.25 - desfase, ALTO + 0.25 - desfase],
            [-0.25 + desfase, ALTO + 0.25 - desfase],
        ];
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        let acum = 0;
        for (let i = 0; i < 4; i++) {
            const [ax, az] = esq[i];
            const [bx, bz] = esq[(i + 1) % 4];
            const largo = Math.hypot(bx - ax, bz - az);
            const u0 = acum * uPorMetro;
            const u1 = (acum + largo) * uPorMetro;
            const base = pos.length / 3;
            pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
            uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            acum += largo;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeBoundingSphere();
        return g;
    };
    const texEnergiaA = textura(texturaMuroEnergia());
    const texEnergiaB = textura(texEnergiaA.clone());
    texEnergiaB.needsUpdate = true;
    const matEnergiaA = material(
        new THREE.MeshBasicMaterial({
            map: texEnergiaA,
            color: new THREE.Color(0x9b4dff).multiplyScalar(1.3),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
        }),
    );
    const matEnergiaB = material(
        new THREE.MeshBasicMaterial({
            map: texEnergiaB,
            color: new THREE.Color(CIAN).multiplyScalar(0.9),
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
        }),
    );
    const energiaA = agregar(new THREE.Mesh(geo(geoMuroEnergia(0, 1 / 9, 0.92, 4.4)), matEnergiaA));
    energiaA.renderOrder = 2;
    energiaA.name = 'muroEnergia';
    const energiaB = agregar(new THREE.Mesh(geo(geoMuroEnergia(0.06, 1 / 5.5, 0.92, 3.4)), matEnergiaB));
    energiaB.renderOrder = 3;

    // ---- Ciudad lejana (un solo InstancedMesh) + letreros neón (otro InstancedMesh) ----
    type Edificio = { x: number; z: number; ancho: number; fondo: number; alto: number; rot: number };
    const edificios: Edificio[] = [];
    const N_EDIFICIOS = alta ? 170 : 120;
    for (let i = 0; i < N_EDIFICIOS; i++) {
        const lejos = i % 3 !== 0;
        const r = lejos ? 95 + azar() * 45 : 60 + azar() * 32;
        const a = azar() * Math.PI * 2;
        const x = CENTRO_X + Math.cos(a) * r;
        const z = CENTRO_Z + Math.sin(a) * r * 0.85;
        const alto = (lejos ? 22 : 10) + Math.pow(azar(), 1.7) * (lejos ? 62 : 34);
        edificios.push({
            x,
            z,
            ancho: 6 + azar() * 10,
            fondo: 6 + azar() * 10,
            alto,
            // La fachada (+X local) mira hacia la arena.
            rot: -Math.atan2(CENTRO_Z - z, CENTRO_X - x) + (azar() - 0.5) * 0.3,
        });
    }
    const texVentanas = textura(texturaVentanas());
    const matCiudad = material(
        new THREE.MeshStandardMaterial({
            color: 0x080a14,
            roughness: 0.8,
            metalness: 0.25,
            emissive: 0xffffff,
            emissiveMap: texVentanas,
            emissiveIntensity: 1.25,
            fog: false,
        }),
    );
    matCiudad.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', SHADER_VENTANAS);
        // Perspectiva atmosférica: las ventanas lejanas se apagan un poco (la ciudad no tiene niebla).
        sh.fragmentShader = sh.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            totalEmissiveRadiance *= mix( 1.0, 0.45, smoothstep( 60.0, 140.0, length( vViewPosition ) ) );`,
        );
    };
    matCiudad.customProgramCacheKey = () => 'zombies-ciudad-ventanas-lejania';
    const geoCaja = geo(new THREE.BoxGeometry(1, 1, 1));
    geoCaja.translate(0, 0.5, 0);
    const ciudad = agregar(new THREE.InstancedMesh(geoCaja, matCiudad, edificios.length));
    ciudad.name = 'ciudad';
    const mBase = new THREE.Matrix4();
    const mTmp = new THREE.Matrix4();
    const qTmp = new THREE.Quaternion();
    const vTmp = new THREE.Vector3();
    const sTmp = new THREE.Vector3();
    const letreros: Array<{ m: THREE.Matrix4; color: number }> = [];
    const COLORES_LETRERO = [0xff3df2, CIAN, 0xffb02e, 0x8a7dff, 0x57ff6a];
    edificios.forEach((e, i) => {
        qTmp.setFromAxisAngle(EJE_Y, e.rot);
        mTmp.compose(vTmp.set(e.x, -0.5, e.z), qTmp, sTmp.set(e.ancho, e.alto, e.fondo));
        ciudad.setMatrixAt(i, mTmp);
        mBase.compose(vTmp.set(e.x, -0.5, e.z), qTmp, UNO);
        const tirada = azar();
        const colorL = COLORES_LETRERO[Math.floor(azar() * COLORES_LETRERO.length)];
        if (tirada < 0.3) {
            // Letrero vertical en la fachada.
            const h = 5 + azar() * 8;
            const y = Math.min(e.alto - h / 2 - 1, e.alto * (0.35 + azar() * 0.35));
            letreros.push({
                m: por(mBase, mat(e.ancho / 2 + 0.35, Math.max(h / 2 + 2, y), (azar() - 0.5) * e.fondo * 0.6, 0, 0, 0, 0.3, h, 1.2 + azar() * 1.2)),
                color: colorL,
            });
        } else if (tirada < 0.55) {
            // Franja horizontal en la azotea.
            letreros.push({ m: por(mBase, mat(e.ancho / 2 + 0.12, e.alto - 0.9, 0, 0, 0, 0, 0.2, 0.4, e.fondo * 0.96)), color: colorL });
        }
        if (e.alto > 55) {
            // Luz roja de aviso en la azotea de los más altos.
            letreros.push({ m: por(mBase, mat(0, e.alto + 0.4, 0, 0, 0, 0, 0.7, 0.7, 0.7)), color: 0xff2a3a });
        }
    });
    ciudad.instanceMatrix.needsUpdate = true;
    ciudad.computeBoundingSphere();

    const matLetreros = material(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }));
    const geoLetrero = geo(new THREE.BoxGeometry(1, 1, 1));
    const letrerosMalla = agregar(new THREE.InstancedMesh(geoLetrero, matLetreros, Math.max(1, letreros.length)));
    letrerosMalla.name = 'letreros';
    const colTmp = new THREE.Color();
    letreros.forEach((l, i) => {
        letrerosMalla.setMatrixAt(i, l.m);
        letrerosMalla.setColorAt(i, colTmp.setHex(l.color).multiplyScalar(1.6));
    });
    letrerosMalla.count = letreros.length;
    letrerosMalla.instanceMatrix.needsUpdate = true;
    if (letrerosMalla.instanceColor) {
        letrerosMalla.instanceColor.needsUpdate = true;
    }
    letrerosMalla.computeBoundingSphere();

    // Resplandor del horizonte detrás de la ciudad (cilindro aditivo con degradado por vértice).
    const geoResplandor = geo(new THREE.CylinderGeometry(175, 175, 60, 40, 1, true));
    {
        const p = geoResplandor.getAttribute('position');
        const cols = new Float32Array(p.count * 3);
        const abajo = new THREE.Color(0x5a1d8a);
        for (let i = 0; i < p.count; i++) {
            const t = p.getY(i) > 0 ? 0 : 1;
            cols[i * 3] = abajo.r * t;
            cols[i * 3 + 1] = abajo.g * t;
            cols[i * 3 + 2] = abajo.b * t;
        }
        geoResplandor.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    const matResplandor = material(
        new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
            fog: false,
            dithering: true,
        }),
    );
    const resplandor = agregar(new THREE.Mesh(geoResplandor, matResplandor));
    resplandor.position.set(CENTRO_X, 22, CENTRO_Z);
    resplandor.renderOrder = -1;

    // ---- Cielo, estrellas y luna ----
    const texCielo = textura(texturaCielo());
    // Tramado (dithering): el degradado oscuro de 8 bits no se ve en bandas.
    const matCielo = material(new THREE.MeshBasicMaterial({ map: texCielo, side: THREE.BackSide, fog: false, depthWrite: false, dithering: true }));
    const cielo = agregar(new THREE.Mesh(geo(new THREE.SphereGeometry(RADIO_CIELO, 24, 16)), matCielo));
    cielo.position.set(CENTRO_X, 0, CENTRO_Z);
    cielo.renderOrder = -2;
    cielo.name = 'cielo';

    const N_ESTRELLAS = alta ? 900 : 450;
    const posEstrellas = new Float32Array(N_ESTRELLAS * 3);
    const tinteEstrellas = new Float32Array(N_ESTRELLAS * 3);
    const tamEstrellas = new Float32Array(N_ESTRELLAS);
    const faseEstrellas = new Float32Array(N_ESTRELLAS);
    const tintes = [new THREE.Color(0xffffff), new THREE.Color(0xbfd4ff), new THREE.Color(0xffd6f4), new THREE.Color(0xc8b8ff)];
    for (let i = 0; i < N_ESTRELLAS; i++) {
        // Hemisferio superior, más densas cerca del cenit que del horizonte.
        const u = azar();
        const elev = Math.asin(0.08 + u * 0.92);
        const az = azar() * Math.PI * 2;
        const r = RADIO_CIELO * 0.93;
        posEstrellas[i * 3] = CENTRO_X + Math.cos(az) * Math.cos(elev) * r;
        posEstrellas[i * 3 + 1] = Math.sin(elev) * r;
        posEstrellas[i * 3 + 2] = CENTRO_Z + Math.sin(az) * Math.cos(elev) * r;
        const t = tintes[Math.floor(azar() * tintes.length)];
        const brillo = 0.5 + azar() * 0.7;
        tinteEstrellas[i * 3] = t.r * brillo;
        tinteEstrellas[i * 3 + 1] = t.g * brillo;
        tinteEstrellas[i * 3 + 2] = t.b * brillo;
        tamEstrellas[i] = 1.2 + Math.pow(azar(), 3) * 3.2;
        faseEstrellas[i] = azar();
    }
    const geoEstrellas = geo(new THREE.BufferGeometry());
    geoEstrellas.setAttribute('position', new THREE.BufferAttribute(posEstrellas, 3));
    geoEstrellas.setAttribute('tinte', new THREE.BufferAttribute(tinteEstrellas, 3));
    geoEstrellas.setAttribute('tamano', new THREE.BufferAttribute(tamEstrellas, 1));
    geoEstrellas.setAttribute('fase', new THREE.BufferAttribute(faseEstrellas, 1));
    const uniformesEstrellas = { uTiempo: { value: 0 }, uPixel: { value: 1 } };
    const matEstrellas = material(
        new THREE.ShaderMaterial({
            uniforms: uniformesEstrellas,
            vertexShader: /* glsl */ `
                attribute vec3 tinte;
                attribute float tamano;
                attribute float fase;
                uniform float uTiempo;
                uniform float uPixel;
                varying vec3 vTinte;
                varying float vAlfa;
                void main() {
                    vTinte = tinte;
                    vAlfa = 0.55 + 0.45 * sin( uTiempo * ( 0.7 + fase * 1.6 ) + fase * 6.2831 );
                    gl_PointSize = tamano * uPixel;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec3 vTinte;
                varying float vAlfa;
                void main() {
                    float d = length( gl_PointCoord - 0.5 );
                    float a = smoothstep( 0.5, 0.0, d );
                    gl_FragColor = vec4( vTinte, a * a * vAlfa );
                    #include <colorspace_fragment>
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        }),
    );
    const estrellas = agregar(new THREE.Points(geoEstrellas, matEstrellas));
    // Tamaño en píxeles según la densidad con la que se dibuja de verdad (cambia con la calidad y el ajuste).
    estrellas.onBeforeRender = (renderer) => {
        uniformesEstrellas.uPixel.value = renderer.getPixelRatio();
    };
    estrellas.frustumCulled = false;
    estrellas.renderOrder = -1;
    estrellas.name = 'estrellas';

    const DIR_LUNA = new THREE.Vector3(-0.55, 0.45, -0.7).normalize();
    const texBrillo = textura(texturaBrillo());
    const matHalo = material(
        new THREE.SpriteMaterial({
            map: texBrillo,
            color: new THREE.Color(0x8fa6ff),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        }),
    );
    const matLuna = material(
        new THREE.SpriteMaterial({
            map: texBrillo,
            color: new THREE.Color(0xe8eeff).multiplyScalar(1.6),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        }),
    );
    const posLuna = new THREE.Vector3(CENTRO_X, 0, CENTRO_Z).addScaledVector(DIR_LUNA, RADIO_CIELO * 0.86);
    const halo = agregar(new THREE.Sprite(matHalo));
    halo.position.copy(posLuna);
    halo.scale.setScalar(80);
    halo.renderOrder = -1;
    const luna = agregar(new THREE.Sprite(matLuna));
    luna.position.copy(posLuna);
    luna.scale.setScalar(20);
    luna.renderOrder = -1;
    luna.name = 'luna';

    // ---- Luces ----
    const hemi = agregar(new THREE.HemisphereLight(0x3d4f9a, 0x2a0f3a, alta ? 0.55 : 0.85));
    luces.push(hemi);
    const lunaLuz = agregar(new THREE.DirectionalLight(0xa4b8ff, alta ? 1.25 : 1.45));
    lunaLuz.position.set(CENTRO_X, 0, CENTRO_Z).addScaledVector(DIR_LUNA, 70);
    lunaLuz.target.position.set(CENTRO_X, 0, CENTRO_Z);
    agregar(lunaLuz.target);
    luces.push(lunaLuz);
    if (alta) {
        lunaLuz.castShadow = true;
        lunaLuz.shadow.mapSize.set(2048, 2048);
        const cs = lunaLuz.shadow.camera;
        cs.left = -30;
        cs.right = 30;
        cs.top = 30;
        cs.bottom = -30;
        cs.near = 20;
        cs.far = 130;
        cs.updateProjectionMatrix();
        lunaLuz.shadow.bias = -0.0004;
        lunaLuz.shadow.normalBias = 0.03;
    }
    const pilarLuces: Array<{ luz: THREE.PointLight; base: number; fase: number }> = [];
    if (alta) {
        esquinas.forEach(([x, z], i) => {
            const luz = agregar(new THREE.PointLight(COLORES_PILAR[i], 70, 34, 2));
            // Un poco hacia dentro de la arena para que pinte el piso.
            luz.position.set(x + (x < CENTRO_X ? 2.2 : -2.2), 4.2, z + (z < CENTRO_Z ? 2.2 : -2.2));
            luces.push(luz);
            pilarLuces.push({ luz, base: 70, fase: i * 1.7 });
        });
    }

    // ---- Partículas de ambiente (polvo y ceniza que flotan) ----
    const N_POLVO = alta ? 240 : 110;
    const posPolvo = new Float32Array(N_POLVO * 3);
    const colPolvo = new Float32Array(N_POLVO * 3);
    const velPolvo = new Float32Array(N_POLVO);
    const fasePolvo = new Float32Array(N_POLVO);
    const POLVO_ALTO = 11;
    const coloresPolvo = [new THREE.Color(0xc9a6ff), new THREE.Color(0x8fe9ff), new THREE.Color(0xffb27a)];
    for (let i = 0; i < N_POLVO; i++) {
        posPolvo[i * 3] = -6 + azar() * (ANCHO + 12);
        posPolvo[i * 3 + 1] = azar() * POLVO_ALTO;
        posPolvo[i * 3 + 2] = -6 + azar() * (ALTO + 12);
        const c = coloresPolvo[Math.floor(azar() * coloresPolvo.length)];
        const b = 0.4 + azar() * 0.6;
        colPolvo[i * 3] = c.r * b;
        colPolvo[i * 3 + 1] = c.g * b;
        colPolvo[i * 3 + 2] = c.b * b;
        velPolvo[i] = 0.12 + azar() * 0.35;
        fasePolvo[i] = azar() * Math.PI * 2;
    }
    const geoPolvo = geo(new THREE.BufferGeometry());
    const atrPolvo = new THREE.BufferAttribute(posPolvo, 3);
    atrPolvo.setUsage(THREE.DynamicDrawUsage);
    geoPolvo.setAttribute('position', atrPolvo);
    geoPolvo.setAttribute('color', new THREE.BufferAttribute(colPolvo, 3));
    const matPolvo = material(
        new THREE.PointsMaterial({
            map: texBrillo,
            size: 0.16,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }),
    );
    const polvo = agregar(new THREE.Points(geoPolvo, matPolvo));
    polvo.frustumCulled = false;
    polvo.name = 'polvo';

    // ---- Animación ----
    const colorNeon = new THREE.Color(1, 1, 1);
    const actualizar = (t: number, dt: number): void => {
        texEnergiaA.offset.x = (texEnergiaA.offset.x + dt * 0.045) % 1;
        texEnergiaB.offset.x = (texEnergiaB.offset.x - dt * 0.08 + 1) % 1;
        texEnergiaA.offset.y = Math.sin(t * 0.7) * 0.03;
        matEnergiaA.opacity = 0.48 + Math.sin(t * 1.9) * 0.08 + Math.sin(t * 7.3) * 0.02;
        matEnergiaB.opacity = 0.28 + Math.sin(t * 2.6 + 1.2) * 0.07;

        uniformesEstrellas.uTiempo.value = t;

        // Neones que respiran (muy sutil) y letreros con un leve parpadeo.
        matNeonMuro.color.copy(colorNeon).multiplyScalar(0.88 + Math.sin(t * 1.6) * 0.12);
        matLetreros.color.setScalar(0.9 + Math.sin(t * 3.1) * 0.05 + (Math.sin(t * 23.0) > 0.97 ? -0.25 : 0));
        matHalo.opacity = 0.5 + Math.sin(t * 0.5) * 0.06;
        for (const p of pilarLuces) {
            p.luz.intensity = p.base * (0.82 + Math.sin(t * 1.6 + p.fase) * 0.18);
        }

        // Polvo: sube despacio con un vaivén y reaparece abajo.
        for (let i = 0; i < N_POLVO; i++) {
            const j = i * 3;
            const fz = fasePolvo[i];
            posPolvo[j] += Math.sin(t * 0.45 + fz) * 0.18 * dt;
            posPolvo[j + 1] += velPolvo[i] * dt;
            posPolvo[j + 2] += Math.cos(t * 0.38 + fz * 1.3) * 0.14 * dt;
            if (posPolvo[j + 1] > POLVO_ALTO) {
                posPolvo[j + 1] = 0;
            }
        }
        atrPolvo.needsUpdate = true;
    };

    const dispose = (): void => {
        for (const o of objetos) {
            escena.remove(o);
        }
        for (const l of luces) {
            l.dispose();
        }
        ciudad.dispose();
        letrerosMalla.dispose();
        for (const g of geometrias) {
            g.dispose();
        }
        for (const m of materiales) {
            m.dispose();
        }
        for (const t of texturas) {
            t.dispose();
        }
        objetos.length = 0;
        geometrias.length = 0;
        materiales.length = 0;
        texturas.length = 0;
    };

    return { actualizar, dispose };
}
