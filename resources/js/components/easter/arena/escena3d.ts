import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Anillos, Destellos, Manchas, materialBrillo, Particulas, Rayos } from './efectos';
import { crearEscenario, crearGeometriasZombie, crearPersonaje, crearTorreta } from './modelos';
import { ALTURA, aMetros, CAMARA, COLOR_BALA, COLOR_ZOMBIE, ESCALA, hexANumero } from './mundo3d';
import { personaje, type IdPersonaje, type TipoBala } from './personajes';
import { MUNDO, RADIO_JUGADOR, Sim, TIPOS_ZOMBIE, type Evento, type Fase, type Foto, type Jugador, type TipoZombie, type Zombie } from './sim';
import { texturaBillete, texturaBrillo, texturaCruz, texturaEtiqueta, texturaFicha } from './texturas';
import type { ConfigPartida, ControlJuego, Hud } from './tipos';

/*
 * Motor 3D del juego de zombies (Three.js, tercera persona). Dibuja la simulación (sim.ts), lee teclado,
 * mouse (pointer lock) y el mando táctil y, en equipo, manda y recibe datos por la sala (red.ts). La lógica
 * de juego y de red es la misma que la de la versión 2D anterior: el anfitrión calcula la partida; el invitado
 * la refleja y manda su posición, puntería y habilidades (su embestida se mueve en su propia pantalla).
 *
 * Rendimiento: zombies, balas, billetes, barras de vida y sombras de contacto van en InstancedMesh; los
 * efectos usan pools (efectos.ts); en cada cuadro solo se reutilizan objetos temporales. Si el equipo no
 * aguanta, se apagan en orden las sombras, el brillo (bloom), la resolución alta, las luces de los pilares y,
 * al final, se dibuja a 0.75× con menos partículas.
 */

// ———————————————————————————————————————————————————————————————————————————————————————————————
// Constantes
// ———————————————————————————————————————————————————————————————————————————————————————————————

const E = ESCALA;
const ANCHO_M = aMetros(MUNDO.ancho);
const ALTO_M = aMetros(MUNDO.alto);
const BORDE_M = aMetros(MUNDO.borde);

/** Instancias reservadas por tipo de zombie. */
const MAX_ZOMBIES: Record<TipoZombie, number> = { caminante: 100, corredor: 80, gordo: 80, escupidor: 80, jefe: 4 };
const MAX_BALAS = 500;
const MAX_BARRAS = 40;
const MAX_SOMBRAS = 300;
const MAX_FANTASMAS = 12;

/** Giro de la cámara con la palanca derecha (rad/s con la palanca al tope). */
const GIRO_TACTIL = 2.8;
/** Inclinación inicial de la cámara (la del celular, que no la cambia). */
const INCLINACION_INICIAL = 0.2;
/** Aparición de un zombie: crece desde el suelo en estos segundos. */
const APARICION = 0.3;
/** Destello blanco al recibir daño (s). */
const GOLPE = 0.075;
/** Brillo de la ficha y del nombre: por debajo del umbral del bloom (las zonas claras de la foto no se lavan). */
const TONO_FICHA = 0.9;
/** Umbral de luminancia del bloom (antes del tone mapping): solo brilla lo que pasa de ~1 (neones HDR). */
const UMBRAL_BLOOM = 0.95;
/** Separación visual de la torreta respecto a donde la puso el jugador (m), hacia donde apuntaba. */
const ADELANTE_TORRETA = 0.75;
/** Tras capturar el mouse se ignora su movimiento este tiempo (ms): el primer evento suele traer un salto. */
const PAUSA_MOUSE = 150;
/** Movimiento máximo creíble del mouse en un evento (px): los saltos más grandes se descartan. */
const SALTO_MOUSE = 120;

/**
 * Forma de cada tipo de bala: grosor (m), largo por velocidad (s; trazadora), brillo (HDR para el bloom, en
 * calidad alta) y tamaño del halo aditivo de la punta (m).
 */
const FORMA_BALA: Record<TipoBala, { grosor: number; largo: number; brillo: number; halo: number }> = {
    normal: { grosor: 0.1, largo: 0.034, brillo: 2.2, halo: 0.55 },
    perdigon: { grosor: 0.085, largo: 0.028, brillo: 2, halo: 0.42 },
    rifle: { grosor: 0.09, largo: 0.045, brillo: 2.4, halo: 0.6 },
    cañon: { grosor: 0.28, largo: 0.016, brillo: 2.3, halo: 1.15 },
    billete: { grosor: 0.2, largo: 0, brillo: 1, halo: 0 },
    acido: { grosor: 0.3, largo: 0.035, brillo: 1.8, halo: 0.9 },
    torreta: { grosor: 0.085, largo: 0.034, brillo: 2.3, halo: 0.45 },
};

/** Teclas que el juego lee de forma continua (por posición física, sirve en cualquier distribución). */
const TECLAS_JUEGO = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// ———————————————————————————————————————————————————————————————————————————————————————————————
// Temporales reutilizados (nunca se guardan fuera de una llamada)
// ———————————————————————————————————————————————————————————————————————————————————————————————

const EJE_Y = new THREE.Vector3(0, 1, 0);
const _pos = new THREE.Vector3();
const _pos2 = new THREE.Vector3();
const _esc = new THREE.Vector3();
const _desde = new THREE.Vector3();
const _hasta = new THREE.Vector3();
const _punta = new THREE.Vector3();
const _mirar = new THREE.Vector3();
const _derecha = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();
const _matPierna = new THREE.Matrix4();
const _matFinal = new THREE.Matrix4();
const _color = new THREE.Color();
const BLANCO = new THREE.Color(1, 1, 1);

// ———————————————————————————————————————————————————————————————————————————————————————————————
// Utilidades
// ———————————————————————————————————————————————————————————————————————————————————————————————

const limitar = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
/** Factor de un lerp exponencial independiente de los cuadros por segundo. */
const suavizar = (dt: number, rapidez: number) => 1 - Math.exp(-dt * rapidez);
/** Rebote al final (easeOutBack): para lo que «brota» del suelo. */
function salidaRebote(p: number): number {
    const c1 = 1.70158;
    const q = p - 1;
    return 1 + (c1 + 1) * q * q * q + c1 * q * q;
}
function normalizarAngulo(a: number): number {
    let r = a % (Math.PI * 2);
    if (r > Math.PI) r -= Math.PI * 2;
    if (r < -Math.PI) r += Math.PI * 2;
    return r;
}
/** Ruido suave (dos senos) para la sacudida de cámara. */
const ruido = (t: number, f: number) => Math.sin(t * f) * Math.cos(t * f * 0.61 + 1.3);
/** Muestras de MSAA del composer: con densidad alta ya hay sobremuestreo y el MSAA solo gasta memoria. */
const muestrasMsaa = (pixelRatio: number) => (pixelRatio >= 1.5 ? 0 : 4);

/**
 * Trazadora de bala: cápsula de 1 m a lo largo de +X y 1 m de diámetro (se escala por instancia) con un
 * degradado en los colores por vértice, de la cola tenue a la punta brillante (con mezcla aditiva se desvanece).
 */
function geometriaTrazadora(): THREE.BufferGeometry {
    const g = new THREE.CapsuleGeometry(0.5, 1, 2, 6).rotateZ(-Math.PI / 2).scale(0.5, 1, 1);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const t = limitar(pos.getX(i) + 0.5, 0, 1);
        const f = 0.12 + 0.88 * t * t;
        col[i * 3] = f;
        col[i * 3 + 1] = f;
        col[i * 3 + 2] = f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}

/**
 * Material de los zombies: colores por vértice + `instanceColor` (blanco al recibir daño, azul si está aturdido),
 * contorno (fresnel) del color del tipo para leerlos de lejos y detalles que brillan solos: las piezas con color
 * por vértice mayor que 1 (modelos.ts) emiten el excedente. Todos los tipos comparten el mismo programa.
 */
function crearMaterialZombie(colorTipo: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
    const borde = { value: new THREE.Color(colorTipo).multiplyScalar(0.85) };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uBorde = borde;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGolpe;\nvarying vec3 vBrillo;').replace(
            '#include <color_vertex>',
            `#include <color_vertex>
            #ifdef USE_INSTANCING_COLOR
                vGolpe = max( instanceColor.rgb - 1.0, 0.0 );
            #else
                vGolpe = vec3( 0.0 );
            #endif
            #ifdef USE_COLOR
                vBrillo = max( color.rgb - 1.0, 0.0 );
            #else
                vBrillo = vec3( 0.0 );
            #endif`,
        );
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uBorde;\nvarying vec3 vGolpe;\nvarying vec3 vBrillo;')
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                float bordeZ = 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) );
                totalEmissiveRadiance += uBorde * pow( bordeZ, 2.5 ) + diffuseColor.rgb * pow( bordeZ, 3.0 ) * 0.8 + vBrillo + vGolpe * 0.45;`,
            );
    };
    material.customProgramCacheKey = () => 'zombie-borde-brillo';
    return material;
}

/** Burbuja del escudo: brillo en el borde (fresnel) y líneas de energía que suben. */
const VERTICE_BURBUJA = /* glsl */ `
    varying vec3 vNormalVista;
    varying vec3 vVista;
    varying float vAlto;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalVista = normalize(normalMatrix * normal);
        vVista = normalize(-mv.xyz);
        vAlto = position.y;
        gl_Position = projectionMatrix * mv;
    }
`;
const FRAGMENTO_BURBUJA = /* glsl */ `
    uniform vec3 uColor;
    uniform float uTiempo;
    varying vec3 vNormalVista;
    varying vec3 vVista;
    varying float vAlto;
    void main() {
        float f = 1.0 - abs(dot(normalize(vNormalVista), normalize(vVista)));
        float borde = pow(f, 2.4);
        float lineas = smoothstep(0.86, 1.0, 0.5 + 0.5 * sin(vAlto * 34.0 - uTiempo * 5.0)) * 0.35;
        float a = 0.05 + borde * 0.95 + lineas * (0.3 + borde);
        gl_FragColor = vec4(uColor * (0.6 + borde * 1.6), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

// ———————————————————————————————————————————————————————————————————————————————————————————————
// Tipos internos
// ———————————————————————————————————————————————————————————————————————————————————————————————

interface GrupoZombie {
    cuerpo: THREE.InstancedMesh;
    izq: THREE.InstancedMesh;
    der: THREE.InstancedMesh;
    ojos: THREE.InstancedMesh;
    /** Las cuatro mallas (para recorrerlas sin crear arreglos por cuadro). */
    mallas: THREE.InstancedMesh[];
    geometrias: THREE.BufferGeometry[];
    caderaY: number;
    altura: number;
    max: number;
    /** Instancias usadas en este cuadro. */
    n: number;
}

interface EstadoZombie {
    edad: number;
    vidaPrev: number;
    golpe: number;
    visto: number;
}

interface MaterialOriginal {
    mat: THREE.MeshStandardMaterial;
    color: THREE.Color;
    emisivo: THREE.Color;
    intensidad: number;
    neon: boolean;
}

interface VistaJugador {
    id: string;
    personaje: IdPersonaje;
    esYo: boolean;
    raiz: THREE.Group;
    giro: THREE.Group;
    modelo: ReturnType<typeof crearPersonaje>;
    cabeza: THREE.Sprite;
    matCabeza: THREE.SpriteMaterial;
    etiqueta: THREE.Sprite;
    matEtiqueta: THREE.SpriteMaterial;
    texEtiqueta: THREE.CanvasTexture;
    /** Ancho de la etiqueta (m) a tamaño completo. */
    anchoEtiqueta: number;
    aura: THREE.Mesh;
    matAura: THREE.MeshBasicMaterial;
    burbuja: THREE.Mesh;
    aroFondo: THREE.Mesh;
    aroRevivir: THREE.Mesh;
    geoAro: THREE.RingGeometry;
    marcador: THREE.Sprite | null;
    matMarcador: THREE.SpriteMaterial | null;
    color: number;
    originales: MaterialOriginal[];
    gris: boolean;
    baseCuerpoY: number;
    baseBrazosX: number;
    /** Posición y ángulo mostrados (suavizados para el compañero). */
    x: number;
    z: number;
    ang: number;
    prevX: number;
    prevZ: number;
    iniciado: boolean;
    vel: number;
    fase: number;
    caida: number;
    retroceso: number;
    ultimoCd: number;
    /** Compañero: opacidad mostrada (baja cuando estorba la vista de la cámara). */
    opacidad: number;
}

interface VistaTorreta {
    id: number;
    modelo: ReturnType<typeof crearTorreta>;
    edad: number;
    visto: number;
    x: number;
    z: number;
    /** Desplazamiento visual (m) para que no se encime con quien la puso. */
    dx: number;
    dz: number;
}

/** Mensajes de la sala (invitado → anfitrión). */
interface MensajeMando {
    x: number;
    y: number;
    a: number;
    d: number;
}

interface MensajeHabilidad {
    a: number;
    dx?: number;
    dy?: number;
    ox?: number;
    oy?: number;
}

interface Fantasma {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    t: number;
    retraso: number;
    duracion: number;
    alfa: number;
    activo: boolean;
}

// ———————————————————————————————————————————————————————————————————————————————————————————————
// Motor
// ———————————————————————————————————————————————————————————————————————————————————————————————

class Juego3D implements ControlJuego {
    private readonly cfg: ConfigPartida;
    private readonly padre: HTMLElement;
    private readonly sim: Sim;
    private readonly alta: boolean;
    private readonly esTactil: boolean;
    private readonly movimientoReducido: boolean;

    // Render.
    private readonly renderer: THREE.WebGLRenderer;
    private readonly lienzo: HTMLCanvasElement;
    private readonly escena = new THREE.Scene();
    private readonly camara: THREE.PerspectiveCamera;
    private composer: EffectComposer | null = null;
    private bloom: UnrealBloomPass | null = null;
    private pasosComposer: (RenderPass | UnrealBloomPass | OutputPass)[] = [];
    /** Densidad máxima de píxeles: 1.75 en alta, 1 en baja; el ajuste automático la puede bajar. */
    private topePixel: number;
    private pixelRatio: number;
    private ancho = 1;
    private alto = 1;
    private readonly observador: ResizeObserver;
    /** Cambio de tamaño pendiente: se aplica una sola vez al empezar el siguiente cuadro. */
    private tamanoPendiente = false;
    /** Consulta de la densidad actual (para enterarse si cambia: otro monitor, zoom del navegador). */
    private consultaDensidad: MediaQueryList | null = null;
    private readonly vineta: HTMLDivElement;
    private readonly flash: HTMLDivElement;

    // Mundo y efectos.
    private readonly escenario: ReturnType<typeof crearEscenario>;
    private readonly particulas: Particulas;
    private readonly anillos: Anillos;
    private readonly rayos: Rayos;
    private readonly manchas: Manchas;
    private readonly destellos: Destellos;
    /** Geometrías, materiales y texturas compartidas (se liberan al final). */
    private readonly desechables: { dispose(): void }[] = [];

    // Recursos compartidos.
    private readonly texBrillo: THREE.CanvasTexture;
    private readonly texCruz: THREE.CanvasTexture;
    private readonly geoPiso: THREE.PlaneGeometry;
    private readonly geoBurbuja: THREE.SphereGeometry;
    private readonly matBurbuja: THREE.ShaderMaterial;
    private readonly geoAroFondo: THREE.RingGeometry;
    private readonly matAroFondo: THREE.MeshBasicMaterial;
    private readonly matAroRevivir: THREE.MeshBasicMaterial;
    private readonly fichas = new Map<IdPersonaje, THREE.CanvasTexture>();
    private readonly materialesFicha: THREE.SpriteMaterial[] = [];

    // Vistas.
    private readonly vistas = new Map<string, VistaJugador>();
    private readonly grupos = {} as Record<TipoZombie, GrupoZombie>;
    private readonly matOjos: THREE.MeshBasicMaterial;
    private readonly estados = new Map<number, EstadoZombie>();
    private readonly balas: THREE.InstancedMesh;
    /** Halo aditivo en la punta de cada bala (se lee aun sin bloom). */
    private readonly halos: THREE.InstancedMesh;
    private readonly billetes: THREE.InstancedMesh;
    private readonly barrasFondo: THREE.InstancedMesh;
    private readonly barrasRelleno: THREE.InstancedMesh;
    private readonly sombras: THREE.InstancedMesh;
    private nSombras = 0;
    private readonly torretas = new Map<number, VistaTorreta>();
    private readonly torretasLibres: VistaTorreta[] = [];
    private readonly fantasmas: Fantasma[] = [];
    private cursorFantasma = 0;
    private cuadro = 0;

    // Entrada.
    private readonly teclas = new Set<string>();
    private mouseIzq = false;
    private readonly tactil = { mx: 0, my: 0, ax: 0, ay: 0 };
    private yaw = 0;
    private pitch = INCLINACION_INICIAL;
    /** Hasta cuándo se ignora el mouse (justo después de capturarlo). */
    private ignorarMouseHasta = 0;

    // Cámara.
    private readonly foco = new THREE.Vector3();
    private camIniciada = false;
    private elevacion = 0;
    private sacT = 0;
    private sacDur = 1;
    private sacAmp = 0;

    // Pantalla.
    private vinetaAlfa = 0;
    private vinetaEscrita = -1;
    private flashAlfa = 0;
    private flashEscrito = -1;

    // Partida (igual que la versión 2D).
    private recarga = 0;
    private cdLocal = 0;
    private cdRed = 0;
    private cdHud = 0;
    private terminado = false;
    private tiempoFin = 0;
    private ultimoDolor = 0;
    private faseAnterior: Fase = 'preparando';
    private conJefe = false;
    private otroSalio = false;
    /** Invitado: el compañero disparó (llegaron sus balas en la foto): fogonazo pendiente. */
    private readonly fogonazosPendientes = new Set<string>();
    /**
     * Intermediario para los oyentes de la sala: la sala no permite quitarlos, así que al destruir se vacía y lo
     * único que queda retenido es este objeto, no el motor entero.
     */
    private readonly refRed: { juego: Juego3D | null } = { juego: this };

    // Bucle y rendimiento.
    private raf = 0;
    private ultimo = 0;
    private reloj = 0;
    private medidaT = 0;
    private medidaN = 0;
    /** Mejor promedio de cuadro visto (ms): referencia para saber si de verdad se puso lento. */
    private referenciaMs = Infinity;
    private ventanasMalas = 0;
    /** Ventanas de medición a ignorar (tras bajar un escalón se recompilan shaders). */
    private ventanasIgnoradas = 0;
    /** Promedio antes del último escalón (0 = no hay que comprobar). */
    private antesDeBajar = 0;
    /** Bajar un escalón no ayudó: el límite no es el dibujo (rAF a 30 Hz, ahorro de batería…). */
    private estancado = false;
    private sombrasActivas: boolean;
    private lucesActivas = true;
    /** Multiplicador de partículas (el último escalón del ajuste lo baja). */
    private factorParticulas = 1;
    private destruido = false;

    constructor(padre: HTMLElement, cfg: ConfigPartida) {
        this.cfg = cfg;
        this.padre = padre;
        this.alta = cfg.calidad === 'alta';
        this.esTactil = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        this.movimientoReducido = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // El anfitrión siempre va primero (aparece a la izquierda) para que las dos pantallas coincidan.
        const jugadores = cfg.modo === 'invitado' && cfg.otro ? [cfg.otro, cfg.yo] : [cfg.yo, ...(cfg.otro ? [cfg.otro] : [])];
        this.sim = new Sim(jugadores, cfg.modo === 'invitado' ? 'espejo' : 'anfitrion');
        if (cfg.modo === 'anfitrion' && cfg.otro) this.sim.idInvitado = cfg.otro.id;

        // ——— Render (lo primero: si no hay WebGL, falla aquí antes de tocar el DOM) ———
        this.topePixel = this.alta ? 1.75 : 1;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.topePixel);
        // En alta el antialias lo da el composer (MSAA en su render target); el del lienzo solo serviría al
        // dibujar directo (tras quitar el bloom) y con densidad alta ya hay sobremuestreo: solo se pide a 1×.
        this.renderer = new THREE.WebGLRenderer({ antialias: this.alta && this.pixelRatio < 1.5, powerPreference: 'high-performance', stencil: false });
        this.lienzo = this.renderer.domElement;

        // Viñeta roja (daño) y destello de pantalla (oleada): se agregan al DOM al final.
        this.vineta = document.createElement('div');
        Object.assign(this.vineta.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            opacity: '0',
            background: 'radial-gradient(ellipse at center, rgba(255, 20, 60, 0) 42%, rgba(255, 20, 60, 0.42) 74%, rgba(150, 0, 30, 0.92) 100%)',
        });
        this.flash = document.createElement('div');
        Object.assign(this.flash.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            opacity: '0',
            background: 'rgb(60, 255, 140)',
            mixBlendMode: 'screen',
        });

        // Si algo falla de aquí en adelante, se libera el contexto WebGL y no queda nada en el DOM.
        try {
            this.renderer.setPixelRatio(this.pixelRatio);
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.1;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.sombrasActivas = this.alta;
            this.lucesActivas = this.alta;
            this.renderer.shadowMap.enabled = this.alta;
            // PCFSoftShadowMap se retiró en r186: PCFShadowMap ya filtra suave.
            this.renderer.shadowMap.type = THREE.PCFShadowMap;

            this.lienzo.style.display = 'block';
            this.lienzo.style.touchAction = 'none';
            this.lienzo.style.outline = 'none';
            this.lienzo.tabIndex = -1;

            this.escena.background = new THREE.Color(0x05030c);
            // Del tono del horizonte del cielo: el suelo y la barrera lejanos se funden con él, sin franja oscura.
            this.escena.fog = new THREE.FogExp2(0x1a0b2e, 0.0105);
            this.camara = new THREE.PerspectiveCamera(CAMARA.campoVision, 1, 0.1, 420);

            if (this.alta) this.crearComposer();
            this.ajustarTamano();

            // ——— Mundo y efectos ———
            this.escenario = crearEscenario(this.escena, cfg.calidad);
            this.particulas = new Particulas(this.escena, this.alta ? 2600 : 1000);
            this.anillos = new Anillos(this.escena, 32);
            this.rayos = new Rayos(this.escena, 8);
            this.manchas = new Manchas(this.escena, this.alta ? 60 : 30);
            this.destellos = new Destellos(this.escena, 48);

            // ——— Recursos compartidos ———
            this.texBrillo = this.guardar(texturaBrillo());
            this.texCruz = this.guardar(texturaCruz());
            this.geoPiso = this.guardar(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
            this.geoBurbuja = this.guardar(new THREE.SphereGeometry(1, 28, 18));
            this.matBurbuja = this.guardar(
                new THREE.ShaderMaterial({
                    uniforms: { uColor: { value: new THREE.Color(0x7dfcff) }, uTiempo: { value: 0 } },
                    vertexShader: VERTICE_BURBUJA,
                    fragmentShader: FRAGMENTO_BURBUJA,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false,
                }),
            );
            this.geoAroFondo = this.guardar(new THREE.RingGeometry(0.86, 1.06, 64).rotateX(-Math.PI / 2));
            this.matAroFondo = this.guardar(new THREE.MeshBasicMaterial({ color: 0x333344, transparent: true, opacity: 0.75, depthWrite: false }));
            this.matAroRevivir = this.guardar(
                new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7dffb0).multiplyScalar(1.8), transparent: true, depthWrite: false, toneMapped: false }),
            );

            // ——— Zombies (InstancedMesh por tipo; un material por tipo para el contorno de su color) ———
            this.matOjos = this.guardar(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.25, 0.2), toneMapped: false, fog: false }));
            for (const tipo of TIPOS_ZOMBIE) this.grupos[tipo] = this.crearGrupoZombie(tipo);

            // ——— Balas (trazadoras aditivas con degradado de la cola a la punta), halos y billetes ———
            this.balas = this.crearInstanciado(
                this.guardar(geometriaTrazadora()),
                this.guardar(
                    new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        vertexColors: true,
                        transparent: true,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        toneMapped: false,
                        fog: false,
                    }),
                ),
                MAX_BALAS,
                true,
            );
            this.balas.renderOrder = 4;
            const geoCuadro = this.guardar(new THREE.PlaneGeometry(1, 1));
            this.halos = this.crearInstanciado(geoCuadro, this.guardar(materialBrillo(this.texBrillo)), MAX_BALAS, true);
            this.halos.renderOrder = 5;
            const texBillete = this.guardar(texturaBillete());
            const matBillete = this.guardar(
                new THREE.MeshBasicMaterial({ map: texBillete, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, alphaTest: 0.05 }),
            );
            matBillete.color.setScalar(1.35);
            this.billetes = this.crearInstanciado(this.guardar(new THREE.PlaneGeometry(0.46, 0.23)), matBillete, MAX_BALAS, false);

            // ——— Barras de vida (gordo y jefe) mirando a la cámara ———
            this.barrasFondo = this.crearInstanciado(
                geoCuadro,
                this.guardar(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false, fog: false })),
                MAX_BARRAS,
                false,
            );
            this.barrasFondo.renderOrder = 10;
            this.barrasRelleno = this.crearInstanciado(
                this.guardar(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0)),
                this.guardar(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false, fog: false })),
                MAX_BARRAS,
                true,
            );
            this.barrasRelleno.renderOrder = 11;

            // ——— Sombras de contacto (manchas oscuras bajo cada personaje y zombie) ———
            this.sombras = this.crearInstanciado(
                this.geoPiso,
                this.guardar(
                    new THREE.MeshBasicMaterial({
                        map: this.texBrillo,
                        color: 0x000000,
                        transparent: true,
                        opacity: this.alta ? 0.5 : 0.72,
                        depthWrite: false,
                        polygonOffset: true,
                        polygonOffsetFactor: -1,
                        polygonOffsetUnits: -1,
                    }),
                ),
                MAX_SOMBRAS,
                false,
            );

            // ——— Fantasmas de la embestida (pool) ———
            for (let i = 0; i < MAX_FANTASMAS; i++) {
                // Con un mapa desde el inicio: cambiar de textura después no obliga a recompilar el shader.
                const mat = new THREE.SpriteMaterial({ map: this.texBrillo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
                const sprite = new THREE.Sprite(mat);
                sprite.visible = false;
                sprite.renderOrder = 6;
                this.escena.add(sprite);
                this.fantasmas.push({ sprite, mat, t: 0, retraso: 0, duracion: 0.38, alfa: 0, activo: false });
                this.materialesFicha.push(mat);
            }

            // ——— Jugadores ———
            for (const j of this.sim.jugadores) this.crearVista(j);
            const yo = this.sim.jugador(cfg.yo.id);
            // En equipo los dos empiezan mirando hacia un costado de la arena (no uno detrás del otro): así
            // ninguno le tapa la vista al compañero al arrancar.
            this.yaw = cfg.otro ? -Math.PI / 2 : (yo?.ang ?? 0);
            if (yo) yo.ang = this.yaw;
        } catch (error) {
            this.destruido = true;
            this.quitarComposer();
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            throw error;
        }

        // ——— DOM, tamaño y entrada (al final: si algo falló arriba, no queda nada colgado) ———
        padre.appendChild(this.lienzo);
        padre.appendChild(this.vineta);
        padre.appendChild(this.flash);
        this.observador = new ResizeObserver(this.alRedimensionar);
        this.observador.observe(padre);
        this.escucharDensidad();

        window.addEventListener('keydown', this.alTeclaAbajo);
        window.addEventListener('keyup', this.alTeclaArriba);
        window.addEventListener('blur', this.alPerderFoco);
        window.addEventListener('mouseup', this.alSoltar);
        document.addEventListener('mousemove', this.alMoverMouse);
        document.addEventListener('pointerlockchange', this.alCambiarBloqueo);
        this.lienzo.addEventListener('mousedown', this.alPresionar);
        this.lienzo.addEventListener('contextmenu', this.alMenuContextual);

        this.conectarRed();
        this.cfg.musica.tocar('robots');
        this.raf = requestAnimationFrame(this.alCuadro);
    }

    // ——— Construcción ————————————————————————————————————————————————————————————————————————

    private guardar<T extends { dispose(): void }>(recurso: T): T {
        this.desechables.push(recurso);
        return recurso;
    }

    private crearComposer(): void {
        const destino = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: muestrasMsaa(this.pixelRatio) });
        const composer = new EffectComposer(this.renderer, destino);
        const render = new RenderPass(this.escena, this.camara);
        // Umbral sobre la luminancia HDR (antes del tone mapping): lo LDR (fotos, nombres, piso) no se lava.
        const brillo = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, UMBRAL_BLOOM);
        const salida = new OutputPass();
        composer.addPass(render);
        composer.addPass(brillo);
        composer.addPass(salida);
        this.composer = composer;
        this.bloom = brillo;
        this.pasosComposer = [render, brillo, salida];
    }

    private quitarComposer(): void {
        for (const p of this.pasosComposer) p.dispose();
        this.pasosComposer = [];
        this.composer?.dispose();
        this.composer = null;
        this.bloom = null;
    }

    /** InstancedMesh vacío (count = 0), sin recorte por frustum y opcionalmente con color por instancia. */
    private crearInstanciado(geo: THREE.BufferGeometry, mat: THREE.Material, max: number, conColor: boolean): THREE.InstancedMesh {
        const malla = new THREE.InstancedMesh(geo, mat, max);
        malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (conColor) {
            for (let i = 0; i < max; i++) malla.setColorAt(i, BLANCO);
            malla.instanceColor?.setUsage(THREE.DynamicDrawUsage);
        }
        malla.count = 0;
        // Vacía no se dibuja (ni en la pasada de sombras): se prende al tener instancias.
        malla.visible = false;
        // Las instancias se mueven por toda la arena: la esfera de la geometría no sirve para recortar.
        malla.frustumCulled = false;
        this.escena.add(malla);
        this.desechables.push(malla);
        return malla;
    }

    private crearGrupoZombie(tipo: TipoZombie): GrupoZombie {
        const g = crearGeometriasZombie(tipo);
        const max = MAX_ZOMBIES[tipo];
        const material = this.guardar(crearMaterialZombie(COLOR_ZOMBIE[tipo]));
        const cuerpo = this.crearInstanciado(g.cuerpo, material, max, true);
        const izq = this.crearInstanciado(g.piernaIzq, material, max, true);
        const der = this.crearInstanciado(g.piernaDer, material, max, true);
        const ojos = this.crearInstanciado(g.ojos, this.matOjos, max, false);
        for (const m of [cuerpo, izq, der]) {
            m.castShadow = this.alta;
            m.receiveShadow = this.alta;
        }
        return {
            cuerpo,
            izq,
            der,
            ojos,
            mallas: [cuerpo, izq, der, ojos],
            geometrias: [g.cuerpo, g.piernaIzq, g.piernaDer, g.ojos],
            caderaY: g.caderaY,
            altura: g.altura,
            max,
            n: 0,
        };
    }

    /** Textura de la ficha (foto en círculo con aro neón). Se rehace al cargar la imagen. */
    private ficha(id: IdPersonaje): THREE.CanvasTexture {
        const existente = this.fichas.get(id);
        if (existente) return existente;
        const p = personaje(id);
        const img = new Image();
        img.decoding = 'async';
        // Mientras carga, texturaFicha dibuja un degradado del color.
        const provisional = texturaFicha(img, p.color);
        this.fichas.set(id, provisional);
        img.onload = () => {
            if (this.destruido) return;
            const vieja = this.fichas.get(id);
            const nueva = texturaFicha(img, p.color);
            this.fichas.set(id, nueva);
            for (const m of this.materialesFicha) if (m.map === vieja) m.map = nueva;
            vieja?.dispose();
        };
        img.src = p.cara;
        return provisional;
    }

    private crearVista(j: Jugador): VistaJugador {
        const p = personaje(j.personaje);
        const color = hexANumero(p.color);
        const esYo = j.id === this.cfg.yo.id;
        const modelo = crearPersonaje(p.color);
        const raiz = new THREE.Group();
        raiz.name = `jugador-${j.id}`;
        const giro = new THREE.Group();
        giro.add(modelo.grupo);
        raiz.add(giro);

        // Cabeza: la ficha con la foto (un poco por debajo de 1 para no pasar el umbral del bloom).
        const matCabeza = new THREE.SpriteMaterial({ map: this.ficha(j.personaje), transparent: true, alphaTest: 0.04 });
        matCabeza.color.setScalar(TONO_FICHA);
        this.materialesFicha.push(matCabeza);
        const cabeza = new THREE.Sprite(matCabeza);
        cabeza.scale.set(0.95, 0.95, 1);
        cabeza.position.y = ALTURA.cabeza;
        raiz.add(cabeza);

        // Nombre (el propio no se muestra: taparía la mira y ya sabes quién eres).
        const { textura: texEtiqueta, aspecto } = texturaEtiqueta(j.nombre, p.color);
        const matEtiqueta = new THREE.SpriteMaterial({ map: texEtiqueta, transparent: true, depthWrite: false });
        matEtiqueta.color.setScalar(TONO_FICHA);
        const etiqueta = new THREE.Sprite(matEtiqueta);
        etiqueta.scale.set(0.3 * aspecto, 0.3, 1);
        etiqueta.position.y = ALTURA.etiqueta;
        etiqueta.renderOrder = 8;
        etiqueta.visible = !esYo;
        raiz.add(etiqueta);

        // Aura del color a los pies.
        const matAura = new THREE.MeshBasicMaterial({
            map: this.texBrillo,
            color: new THREE.Color(color).multiplyScalar(1.4),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        const aura = new THREE.Mesh(this.geoPiso, matAura);
        aura.position.y = 0.035;
        aura.scale.set(2.4, 1, 2.4);
        aura.renderOrder = 1;
        raiz.add(aura);

        // Burbuja del escudo.
        const burbuja = new THREE.Mesh(this.geoBurbuja, this.matBurbuja);
        burbuja.position.y = 1.02;
        burbuja.scale.set(1, 1.18, 1);
        burbuja.visible = false;
        burbuja.renderOrder = 7;
        raiz.add(burbuja);

        // Anillo para revivir (el relleno usa drawRange: no se reconstruye la geometría).
        const aroFondo = new THREE.Mesh(this.geoAroFondo, this.matAroFondo);
        aroFondo.position.y = 0.04;
        aroFondo.visible = false;
        aroFondo.renderOrder = 2;
        raiz.add(aroFondo);
        const geoAro = new THREE.RingGeometry(0.86, 1.06, 64, 1, Math.PI / 2).rotateX(-Math.PI / 2);
        const aroRevivir = new THREE.Mesh(geoAro, this.matAroRevivir);
        aroRevivir.position.y = 0.045;
        aroRevivir.visible = false;
        aroRevivir.renderOrder = 3;
        raiz.add(aroRevivir);

        // Marcador del compañero: siempre visible, incluso detrás de muros.
        let marcador: THREE.Sprite | null = null;
        let matMarcador: THREE.SpriteMaterial | null = null;
        if (!esYo) {
            matMarcador = new THREE.SpriteMaterial({
                map: this.texCruz,
                transparent: true,
                depthTest: false,
                depthWrite: false,
                sizeAttenuation: false,
                toneMapped: false,
                fog: false,
            });
            matMarcador.color.setHex(color).multiplyScalar(1.5);
            marcador = new THREE.Sprite(matMarcador);
            marcador.position.y = ALTURA.marcador;
            marcador.scale.set(0.034, 0.034, 1);
            marcador.renderOrder = 999;
            raiz.add(marcador);
        }

        const originales: MaterialOriginal[] = [];
        for (const m of modelo.materiales) {
            // El compañero puede volverse translúcido si estorba la vista (transparente desde el inicio: con
            // opacidad 1 se ve igual y así no hay que recompilar shaders al cambiarla).
            if (!esYo) m.transparent = true;
            if (!(m instanceof THREE.MeshStandardMaterial)) continue;
            originales.push({ mat: m, color: m.color.clone(), emisivo: m.emissive.clone(), intensidad: m.emissiveIntensity, neon: !m.vertexColors });
        }

        raiz.position.set(j.x * E, 0, j.y * E);
        this.escena.add(raiz);

        const vista: VistaJugador = {
            id: j.id,
            personaje: j.personaje,
            esYo,
            raiz,
            giro,
            modelo,
            cabeza,
            matCabeza,
            etiqueta,
            matEtiqueta,
            texEtiqueta,
            anchoEtiqueta: 0.3 * aspecto,
            aura,
            matAura,
            burbuja,
            aroFondo,
            aroRevivir,
            geoAro,
            marcador,
            matMarcador,
            color,
            originales,
            gris: false,
            baseCuerpoY: modelo.cuerpo.position.y,
            baseBrazosX: modelo.brazos.position.x,
            x: j.x * E,
            z: j.y * E,
            ang: j.ang,
            prevX: j.x * E,
            prevZ: j.y * E,
            iniciado: false,
            vel: 0,
            fase: Math.random() * 6,
            caida: 0,
            retroceso: 0,
            ultimoCd: 0,
            opacidad: 1,
        };
        this.vistas.set(j.id, vista);
        return vista;
    }

    private liberarVista(v: VistaJugador): void {
        this.escena.remove(v.raiz);
        v.modelo.grupo.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        for (const m of v.modelo.materiales) m.dispose();
        v.matCabeza.dispose();
        v.matEtiqueta.dispose();
        v.texEtiqueta.dispose();
        v.matAura.dispose();
        v.geoAro.dispose();
        v.matMarcador?.dispose();
        const i = this.materialesFicha.indexOf(v.matCabeza);
        if (i >= 0) this.materialesFicha.splice(i, 1);
    }

    // ——— Red (igual que la versión 2D) —————————————————————————————————————————————————————————

    private conectarRed(): void {
        const sala = this.cfg.sala;
        if (!sala || this.cfg.modo === 'solo') return;

        // Los oyentes pasan por `refRed`: al destruir se vacía y no retienen al motor (la sala no los quita).
        const ref = this.refRed;
        if (this.cfg.modo === 'anfitrion') {
            sala.escuchar<MensajeMando>('mando', (m) => ref.juego?.alMando(m));
            sala.escuchar<MensajeHabilidad>('hab', (h) => ref.juego?.alHabilidadRed(h));
        } else {
            sala.escuchar<Foto>('foto', (f) => ref.juego?.alFoto(f));
        }
    }

    /** Anfitrión: posición, puntería y gatillo del invitado. */
    private alMando(m: MensajeMando): void {
        if (this.destruido) return;
        const otro = this.cfg.otro && this.sim.jugador(this.cfg.otro.id);
        if (!otro || otro.caido) return;
        otro.x = m.x;
        otro.y = m.y;
        otro.ang = m.a;
        otro.disparando = m.d === 1;
    }

    /** Anfitrión: habilidad del invitado (su embestida trae el destino). */
    private alHabilidadRed(h: MensajeHabilidad): void {
        if (this.destruido || !this.cfg.otro) return;
        const destino = h.dx !== undefined ? { x: h.dx, y: h.dy ?? 0, desdeX: h.ox ?? 0, desdeY: h.oy ?? 0 } : undefined;
        this.sim.usarHabilidad(this.cfg.otro.id, h.a, destino);
    }

    /** Invitado: estado de la partida que manda el anfitrión. */
    private alFoto(f: Foto): void {
        // Si el anfitrión ya salió, una foto atrasada no debe revivir la partida.
        if (this.destruido || this.otroSalio) return;
        this.sim.aplicarFoto(f, this.cfg.yo.id);
        // Las balas del compañero llegan como eventos 'b': con eso se ve su fogonazo.
        const otro = this.cfg.otro;
        if (!otro) return;
        const tipo = personaje(otro.personaje).arma.tipo;
        for (const ev of f.e) {
            if (ev[0] === 'b' && ev[7] === otro.id && ev[5] === tipo) {
                this.fogonazosPendientes.add(otro.id);
                break;
            }
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

    // ——— API para React ————————————————————————————————————————————————————————————————————————

    mandoTactil(mx: number, my: number, ax: number, ay: number): void {
        const t = this.tactil;
        t.mx = mx;
        t.my = my;
        t.ax = ax;
        t.ay = ay;
    }

    habilidad(): void {
        if (this.destruido) return;
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
            yo.x = limitar(yo.x + Math.cos(yo.ang) * 280, MUNDO.borde + RADIO_JUGADOR, MUNDO.ancho - MUNDO.borde - RADIO_JUGADOR);
            yo.y = limitar(yo.y + Math.sin(yo.ang) * 280, MUNDO.borde + RADIO_JUGADOR, MUNDO.alto - MUNDO.borde - RADIO_JUGADOR);
            this.efectoDash(ox, oy, yo.x, yo.y, p.color, yo.personaje);
            this.cfg.musica.efecto('dash');
            this.cfg.sala?.enviar('hab', { a: yo.ang, dx: Math.round(yo.x), dy: Math.round(yo.y), ox: Math.round(ox), oy: Math.round(oy) });
        } else {
            this.cfg.sala?.enviar('hab', { a: Math.round(yo.ang * 100) / 100 });
        }
    }

    companeroSalio(): void {
        if (this.destruido) return;
        this.otroSalio = true;
        if (this.cfg.modo === 'anfitrion' && this.cfg.otro) {
            const id = this.cfg.otro.id;
            this.sim.jugadores = this.sim.jugadores.filter((j) => j.id !== id);
            this.sim.idInvitado = null;
            const v = this.vistas.get(id);
            if (v) this.liberarVista(v);
            this.vistas.delete(id);
            // Si el que se queda ya estaba caído, nadie lo puede revivir ni dañar: la partida termina aquí (el
            // evento 'fin' solo lo lanza la simulación al dañar a alguien).
            if (this.sim.jugadores.length > 0 && this.sim.jugadores.every((j) => j.caido) && this.sim.fase !== 'fin') {
                this.sim.fase = 'fin';
                this.sim.eventos.push(['fin']);
            }
        } else if (this.cfg.modo === 'invitado') {
            this.sim.fase = 'fin';
        }
    }

    capturarMouse(): void {
        if (this.destruido || this.esTactil || this.terminado || this.bloqueado()) return;
        try {
            // En navegadores nuevos regresa una promesa que puede rechazarse (p. ej. justo después de Esc).
            const r: unknown = this.lienzo.requestPointerLock();
            if (r instanceof Promise) r.catch(() => undefined);
        } catch {
            // Sin pointer lock: se sigue jugando con el teclado.
        }
    }

    destruir(): void {
        if (this.destruido) return;
        this.destruido = true;
        this.refRed.juego = null;
        cancelAnimationFrame(this.raf);

        window.removeEventListener('keydown', this.alTeclaAbajo);
        window.removeEventListener('keyup', this.alTeclaArriba);
        window.removeEventListener('blur', this.alPerderFoco);
        window.removeEventListener('mouseup', this.alSoltar);
        document.removeEventListener('mousemove', this.alMoverMouse);
        document.removeEventListener('pointerlockchange', this.alCambiarBloqueo);
        this.lienzo.removeEventListener('mousedown', this.alPresionar);
        this.lienzo.removeEventListener('contextmenu', this.alMenuContextual);
        this.observador.disconnect();
        this.consultaDensidad?.removeEventListener('change', this.alCambiarDensidad);
        this.consultaDensidad = null;
        if (document.pointerLockElement === this.lienzo) document.exitPointerLock();

        for (const v of this.vistas.values()) this.liberarVista(v);
        this.vistas.clear();
        for (const t of this.torretas.values()) this.liberarTorreta(t);
        for (const t of this.torretasLibres) this.liberarTorreta(t);
        this.torretas.clear();
        this.torretasLibres.length = 0;
        for (const tipo of TIPOS_ZOMBIE) for (const g of this.grupos[tipo].geometrias) g.dispose();
        for (const f of this.fantasmas) {
            this.escena.remove(f.sprite);
            f.mat.dispose();
        }
        this.fantasmas.length = 0;
        for (const t of this.fichas.values()) t.dispose();
        this.fichas.clear();
        this.materialesFicha.length = 0;

        this.particulas.dispose();
        this.anillos.dispose();
        this.rayos.dispose();
        this.manchas.dispose();
        this.destellos.dispose();
        this.escenario.dispose();
        for (const d of this.desechables) d.dispose();
        this.desechables.length = 0;
        this.estados.clear();

        this.quitarComposer();
        this.escena.clear();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.lienzo.remove();
        this.vineta.remove();
        this.flash.remove();
    }

    // ——— Entrada ————————————————————————————————————————————————————————————————————————————————

    private bloqueado(): boolean {
        return this.esTactil || document.pointerLockElement === this.lienzo;
    }

    private readonly alTeclaAbajo = (e: KeyboardEvent): void => {
        // Terminada la partida, el teclado es de la pantalla de resultados.
        if (this.terminado) return;
        const destino = e.target;
        if (destino instanceof HTMLInputElement || destino instanceof HTMLTextAreaElement || (destino instanceof HTMLElement && destino.isContentEditable)) return;
        const codigo = e.code;
        if (TECLAS_JUEGO.has(codigo)) this.teclas.add(codigo);
        // Que Espacio no active botones enfocados ni las flechas muevan la página.
        if (codigo === 'Space' || codigo.startsWith('Arrow')) e.preventDefault();
        if (!e.repeat && (codigo === 'Space' || codigo === 'KeyQ' || codigo === 'KeyE')) this.habilidad();
    };

    private readonly alTeclaArriba = (e: KeyboardEvent): void => {
        this.teclas.delete(e.code);
    };

    private readonly alPerderFoco = (): void => {
        this.teclas.clear();
        this.mouseIzq = false;
    };

    private readonly alPresionar = (e: MouseEvent): void => {
        // En el celular los toques también generan eventos de mouse: ahí manda el mando táctil.
        if (this.esTactil) return;
        if (e.button === 2) {
            e.preventDefault();
            this.habilidad();
            return;
        }
        if (e.button !== 0) return;
        if (!this.bloqueado()) {
            this.capturarMouse();
            return;
        }
        this.mouseIzq = true;
    };

    private readonly alSoltar = (e: MouseEvent): void => {
        if (e.button === 0) this.mouseIzq = false;
    };

    private readonly alMoverMouse = (e: MouseEvent): void => {
        // Sin mouse capturado la cámara se queda quieta.
        if (this.esTactil || document.pointerLockElement !== this.lienzo) return;
        // Justo al capturar, el navegador suele mandar un salto enorme (la distancia al centro): se ignora un
        // momento y, después, se descartan los saltos imposibles en vez de recortarlos.
        if (performance.now() < this.ignorarMouseHasta) return;
        const dx = e.movementX;
        const dy = e.movementY;
        if (Math.abs(dx) > SALTO_MOUSE || Math.abs(dy) > SALTO_MOUSE) return;
        this.yaw = normalizarAngulo(this.yaw + dx * CAMARA.sensibilidad);
        this.pitch = limitar(this.pitch + dy * CAMARA.sensibilidad, CAMARA.inclinacionMin, CAMARA.inclinacionMax);
    };

    private readonly alCambiarBloqueo = (): void => {
        if (document.pointerLockElement !== this.lienzo) this.mouseIzq = false;
        else this.ignorarMouseHasta = performance.now() + PAUSA_MOUSE;
        // Que React muestre u oculte «Haz clic para jugar» sin esperar al siguiente HUD.
        this.cdHud = 0;
    };

    private readonly alRedimensionar = (): void => {
        // Se agrupa: durante una transición llegan varios avisos por cuadro y basta con ajustar una vez.
        this.tamanoPendiente = true;
    };

    private readonly alCambiarDensidad = (): void => {
        if (this.destruido) return;
        // La consulta es de una densidad fija: se vuelve a escuchar con la nueva.
        this.escucharDensidad();
        this.tamanoPendiente = true;
    };

    /** Escucha cuándo deja de valer la densidad de píxeles actual (otro monitor o zoom del navegador). */
    private escucharDensidad(): void {
        this.consultaDensidad?.removeEventListener('change', this.alCambiarDensidad);
        this.consultaDensidad = null;
        if (typeof window.matchMedia !== 'function') return;
        const consulta = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        consulta.addEventListener('change', this.alCambiarDensidad);
        this.consultaDensidad = consulta;
    }

    private readonly alMenuContextual = (e: MouseEvent): void => {
        e.preventDefault();
    };

    // ——— Bucle ——————————————————————————————————————————————————————————————————————————————————

    private readonly alCuadro = (ahora: number): void => {
        if (this.destruido) return;
        this.raf = requestAnimationFrame(this.alCuadro);
        const deltaMs = this.ultimo === 0 ? 1000 / 60 : Math.max(0, ahora - this.ultimo);
        this.ultimo = ahora;
        this.paso(Math.min(0.05, deltaMs / 1000), deltaMs);
    };

    private paso(dt: number, deltaMs: number): void {
        this.reloj += dt;
        if (this.tamanoPendiente) {
            this.tamanoPendiente = false;
            this.ajustarTamano();
        }
        this.vigilarRendimiento(deltaMs);
        this.moverme(dt);

        if (this.cfg.modo === 'invitado') this.dispararLocal(dt);
        this.sim.paso(dt);
        this.recarga = Math.max(0, this.recarga - dt);

        this.enviarRed(dt);
        this.procesarEventos();
        this.actualizarCamara(dt);
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
                this.mouseIzq = false;
                // Suelta el mouse para que se pueda usar la pantalla de resultados.
                if (document.pointerLockElement === this.lienzo) document.exitPointerLock();
                if (this.cfg.modo === 'anfitrion') this.cfg.sala?.enviar('foto', this.sim.foto());
                this.cfg.alTerminar({
                    oleada: this.sim.oleada,
                    puntos: this.sim.puntos,
                    jugadores: this.sim.jugadores.map((j) => ({ nombre: j.nombre, personaje: j.personaje, bajas: j.bajas })),
                });
            }
        }

        this.actualizarPantalla(dt);
        this.escenario.actualizar(this.reloj, dt);
        this.matBurbuja.uniforms.uTiempo.value = this.reloj;
        this.particulas.actualizar(dt);
        this.anillos.actualizar(dt);
        this.rayos.actualizar(dt);
        this.manchas.actualizar(dt);
        this.destellos.actualizar(dt);

        if (this.composer) this.composer.render(dt);
        else this.renderer.render(this.escena, this.camara);
    }

    private moverme(dt: number): void {
        const yo = this.sim.jugador(this.cfg.yo.id);
        if (!yo) return;
        const { mx: tmx, my: tmy, ax, ay } = this.tactil;

        // Puntería = hacia donde mira la cámara. En el celular la palanca derecha gira la cámara.
        if (ax !== 0) this.yaw = normalizarAngulo(this.yaw + ax * GIRO_TACTIL * dt);
        yo.ang = this.yaw;

        // Movimiento relativo a la cámara (W = adelante).
        let adelante = -tmy;
        let derecha = tmx;
        const k = this.teclas;
        if (k.has('KeyW') || k.has('ArrowUp')) adelante += 1;
        if (k.has('KeyS') || k.has('ArrowDown')) adelante -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) derecha += 1;
        if (k.has('KeyA') || k.has('ArrowLeft')) derecha -= 1;
        const largo = Math.hypot(adelante, derecha);
        if (largo > 1) {
            adelante /= largo;
            derecha /= largo;
        }

        const tactilDispara = Math.hypot(ax, ay) > 0.25;
        yo.disparando = !yo.caido && this.sim.fase !== 'fin' && (tactilDispara || (this.mouseIzq && this.bloqueado()));

        if (yo.caido || this.sim.fase === 'fin') return;
        const fx = Math.cos(this.yaw);
        const fy = Math.sin(this.yaw);
        // Derecha de la cámara en el plano de la simulación: (−sen, cos).
        const mx = fx * adelante - fy * derecha;
        const my = fy * adelante + fx * derecha;
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
        yo.x = limitar(yo.x, MUNDO.borde + RADIO_JUGADOR, MUNDO.ancho - MUNDO.borde - RADIO_JUGADOR);
        yo.y = limitar(yo.y, MUNDO.borde + RADIO_JUGADOR, MUNDO.alto - MUNDO.borde - RADIO_JUGADOR);
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
        this.fogonazo(yo.id, p.color);
    }

    private sonidoDisparo(tipo: TipoBala, volumen: number): void {
        this.cfg.musica.efecto(tipo === 'perdigon' ? 'perdigon' : tipo === 'cañon' ? 'cañon' : 'disparo', volumen);
    }

    /** Fogonazo en la boca del arma del jugador (y un pequeño retroceso de los brazos). */
    private fogonazo(id: string, color: string): void {
        const v = this.vistas.get(id);
        if (!v) return;
        v.raiz.updateMatrixWorld(true);
        v.modelo.puntaArma.getWorldPosition(_punta);
        const c = hexANumero(color);
        const tipo = personaje(v.personaje).arma.tipo;
        const grande = tipo === 'perdigon' || tipo === 'cañon';
        this.destellos.lanzar(_punta.x, _punta.y, _punta.z, c, grande ? 1.3 : 0.85, 0.07);
        this.destellos.lanzar(_punta.x, _punta.y, _punta.z, 0xffffff, grande ? 0.55 : 0.34, 0.05);
        this.particulas.emitir({ x: _punta.x, y: _punta.y, z: _punta.z, cantidad: this.cant(grande ? 6 : 3), color: c, velocidad: 3.5, vida: 0.16, gravedad: 0, tamano: 0.07 });
        v.retroceso = 1;
    }

    /** Cantidad de partículas según la calidad (y el ajuste automático). */
    private cant(n: number): number {
        return Math.max(1, Math.round(n * (this.alta ? 1 : 0.55) * this.factorParticulas));
    }

    // ——— Efectos por evento (mismos eventos y sonidos que la versión 2D) ——————————————————————————

    private procesarEventos(): void {
        const yo = this.cfg.yo.id;
        const eventos = this.sim.eventos;
        for (let i = 0; i < eventos.length; i++) this.efecto(eventos[i], yo);
        eventos.length = 0;
    }

    private efecto(ev: Evento, yo: string): void {
        const musica = this.cfg.musica;
        switch (ev[0]) {
            case 'i': {
                const x = ev[1] * E;
                const z = ev[2] * E;
                this.particulas.emitir({ x, y: ALTURA.bala, z, cantidad: this.cant(5), color: 0xffffff, velocidad: 4.5, vida: 0.28, gravedad: 6, tamano: 0.07 });
                this.destellos.lanzar(x, ALTURA.bala, z, 0xfff0d0, 0.6, 0.09);
                musica.efecto('impacto', 0.6);
                break;
            }
            case 'x': {
                const x = ev[1] * E;
                const z = ev[2] * E;
                const radio = aMetros(ev[3]);
                this.particulas.emitir({ x, y: 0.8, z, cantidad: this.cant(22), color: 0x3dff7a, velocidad: 7, vida: 0.55, gravedad: 7, tamano: 0.16, arriba: 2 });
                this.anillos.lanzar(x, z, 0x3dff7a, radio, 0.32);
                this.destellos.lanzar(x, 0.9, z, 0x3dff7a, radio * 2.2, 0.25);
                break;
            }
            case 'm': {
                const tipo = TIPOS_ZOMBIE[ev[3]] ?? 'caminante';
                const color = COLOR_ZOMBIE[tipo];
                const x = ev[1] * E;
                const z = ev[2] * E;
                const jefe = tipo === 'jefe';
                this.particulas.emitir({
                    x,
                    y: jefe ? 2.2 : 0.9,
                    z,
                    cantidad: this.cant(jefe ? 80 : 16),
                    color,
                    velocidad: jefe ? 10 : 5,
                    vida: jefe ? 1.1 : 0.6,
                    gravedad: 9,
                    tamano: jefe ? 0.3 : 0.15,
                    arriba: jefe ? 5 : 2.5,
                });
                this.manchas.poner(x, z, color, 2 * (jefe ? 3.5 : tipo === 'gordo' ? 1.5 : 1));
                this.destellos.lanzar(x, jefe ? 2.2 : 0.9, z, color, jefe ? 9 : 1.6, jefe ? 0.6 : 0.25);
                musica.efecto('muerte', jefe ? 1.4 : 0.8);
                if (jefe) {
                    this.sacudir(500, 0.012);
                    this.anillos.lanzar(x, z, color, aMetros(468), 0.9);
                    this.anillos.lanzar(x, z, 0xffffff, aMetros(300), 0.6);
                    this.particulas.emitir({ x, y: 0.3, z, cantidad: this.cant(60), color: 0xffffff, velocidad: 12, vida: 0.7, gravedad: 4, tamano: 0.12 });
                }
                break;
            }
            case 'd':
                if (ev[1] === yo) {
                    const ahora = performance.now();
                    if (ahora - this.ultimoDolor > 250) {
                        this.ultimoDolor = ahora;
                        this.sacudir(140, 0.004);
                        this.vinetaAlfa = Math.max(this.vinetaAlfa, this.movimientoReducido ? 0.35 : 0.75);
                        musica.efecto('dolor', 0.8);
                    }
                }
                break;
            case 'r':
                musica.efecto('revivir');
                {
                    const j = this.sim.jugador(ev[1]);
                    if (j) {
                        const x = j.x * E;
                        const z = j.y * E;
                        this.anillos.lanzar(x, z, 0x7dffb0, aMetros(156), 0.6);
                        this.particulas.emitir({ x, y: 0.4, z, cantidad: this.cant(26), color: 0x7dffb0, velocidad: 2.5, vida: 1, gravedad: -1.5, tamano: 0.13, arriba: 2.5 });
                    }
                }
                break;
            case 'o':
                musica.efecto('oleada');
                this.destelloPantalla(0.38);
                break;
            case 'h':
                this.efectoHabilidad(ev, yo);
                break;
            case 'fin':
                break;
        }
    }

    private efectoHabilidad(ev: Extract<Evento, ['h', ...unknown[]]>, yo: string): void {
        const [, hab, duenio, x, y, angHab, x2, y2] = ev;
        const j = this.sim.jugador(duenio);
        const color = j ? personaje(j.personaje).color : '#ffffff';
        const c = hexANumero(color);
        const musica = this.cfg.musica;
        const px = x * E;
        const pz = y * E;

        if (hab === 'rugido') {
            this.anillos.lanzar(px, pz, c, aMetros(270), 0.52);
            this.anillos.lanzar(px, pz, 0xffffff, aMetros(182), 0.38);
            this.anillos.lanzar(px, pz, c, aMetros(140), 0.3, 1.1);
            this.particulas.emitir({ x: px, y: 1, z: pz, cantidad: this.cant(40), color: c, velocidad: 9, vida: 0.6, gravedad: 3, tamano: 0.16 });
            this.destellos.lanzar(px, 1.2, pz, c, 4, 0.3);
            if (duenio === yo) this.sacudir(220, 0.008);
            musica.efecto('rugido');
        } else if (hab === 'laser') {
            const v = this.vistas.get(duenio);
            if (v) {
                v.raiz.updateMatrixWorld(true);
                v.modelo.puntaArma.getWorldPosition(_desde);
            } else {
                _desde.set(px, ALTURA.bala, pz);
            }
            _hasta.set(x2 * E, ALTURA.bala, y2 * E);
            this.rayos.lanzar(_desde, _hasta, c, 0.75, 0.38);
            for (let i = 0; i < 12; i++) {
                const k = i / 12;
                this.particulas.emitir({
                    x: _desde.x + (_hasta.x - _desde.x) * k,
                    y: ALTURA.bala,
                    z: _desde.z + (_hasta.z - _desde.z) * k,
                    cantidad: this.cant(3),
                    color: c,
                    velocidad: 2.5,
                    vida: 0.45,
                    gravedad: 1,
                    tamano: 0.12,
                });
            }
            this.destellos.lanzar(_desde.x, _desde.y, _desde.z, c, 1.8, 0.2);
            musica.efecto('laser');
        } else if (hab === 'sonrisa') {
            this.anillos.lanzar(px, pz, 0x7dffb0, aMetros(333), 0.7);
            this.anillos.lanzar(px, pz, 0xffffff, aMetros(208), 0.5);
            this.particulas.emitir({ x: px, y: 0.5, z: pz, cantidad: this.cant(36), color: 0x7dffb0, velocidad: 3, vida: 1.2, gravedad: -1.2, tamano: 0.14, arriba: 3 });
            musica.efecto('curar');
        } else if (hab === 'torreta') {
            // Donde se dibuja la torreta (un poco adelante del jugador, ver desplazarTorreta).
            const tx = limitar(px + Math.cos(angHab) * ADELANTE_TORRETA, BORDE_M + 0.5, ANCHO_M - BORDE_M - 0.5);
            const tz = limitar(pz + Math.sin(angHab) * ADELANTE_TORRETA, BORDE_M + 0.5, ALTO_M - BORDE_M - 0.5);
            this.particulas.emitir({ x: tx, y: 0.5, z: tz, cantidad: this.cant(20), color: 0xff9a1f, velocidad: 5, vida: 0.5, gravedad: 8, tamano: 0.12, arriba: 2 });
            this.anillos.lanzar(tx, tz, 0xff9a1f, aMetros(83), 0.3);
            musica.efecto('torreta');
        } else if (hab === 'dash') {
            // El invitado ya vio su propia embestida.
            if (!(duenio === yo && this.cfg.modo === 'invitado')) {
                this.efectoDash(x, y, x2, y2, color, j?.personaje ?? 'azul');
                musica.efecto('dash');
            }
        } else if (hab === 'billetes') {
            this.anillos.lanzar(px, pz, 0x7dff9a, aMetros(156), 0.4);
            musica.efecto('billetes');
        }
    }

    /** Estela de la embestida: fantasmas con la ficha, un trazo de luz y partículas (coordenadas de la simulación). */
    private efectoDash(x: number, y: number, x2: number, y2: number, color: string, id: IdPersonaje): void {
        const c = hexANumero(color);
        const mapa = this.ficha(id);
        const ax = x * E;
        const az = y * E;
        const bx = x2 * E;
        const bz = y2 * E;
        for (let i = 0; i < 6; i++) {
            const k = i / 6;
            this.lanzarFantasma(ax + (bx - ax) * k, ALTURA.cabeza, az + (bz - az) * k, mapa, c, 0.15 + i * 0.1, i * 0.02);
            this.particulas.emitir({ x: ax + (bx - ax) * k, y: 0.9, z: az + (bz - az) * k, cantidad: this.cant(3), color: c, velocidad: 1.5, vida: 0.5, gravedad: -0.5, tamano: 0.12 });
        }
        _desde.set(ax, 1, az);
        _hasta.set(bx, 1, bz);
        this.rayos.lanzar(_desde, _hasta, c, 0.35, 0.3);
        this.particulas.emitir({ x: bx, y: 1, z: bz, cantidad: this.cant(24), color: c, velocidad: 6, vida: 0.5, gravedad: 4, tamano: 0.14 });
    }

    private lanzarFantasma(x: number, y: number, z: number, mapa: THREE.Texture, color: number, alfa: number, retraso: number): void {
        const f = this.fantasmas[this.cursorFantasma];
        this.cursorFantasma = (this.cursorFantasma + 1) % this.fantasmas.length;
        f.mat.map = mapa;
        f.mat.color.setHex(color).multiplyScalar(1.3);
        f.mat.opacity = 0;
        f.sprite.position.set(x, y, z);
        f.sprite.scale.set(0.95, 0.95, 1);
        f.sprite.visible = false;
        f.t = 0;
        f.retraso = retraso;
        f.duracion = 0.38;
        f.alfa = alfa;
        f.activo = true;
    }

    private actualizarFantasmas(dt: number): void {
        for (const f of this.fantasmas) {
            if (!f.activo) continue;
            f.t += dt;
            if (f.t < f.retraso) continue;
            const p = (f.t - f.retraso) / f.duracion;
            if (p >= 1) {
                f.activo = false;
                f.sprite.visible = false;
                continue;
            }
            f.sprite.visible = true;
            f.mat.opacity = f.alfa * (1 - p);
            const lado = 0.95 * (1 + p * 0.3);
            f.sprite.scale.set(lado, lado, 1);
        }
    }

    /** Sacudida de cámara (duración en ms e intensidad como en la versión 2D). */
    private sacudir(ms: number, intensidad: number): void {
        if (this.movimientoReducido) return;
        const dur = ms / 1000;
        const restante = this.sacT > 0 ? this.sacAmp * (this.sacT / this.sacDur) : 0;
        this.sacAmp = Math.max(restante, intensidad * 28);
        this.sacT = Math.max(this.sacT, dur);
        this.sacDur = this.sacT;
    }

    /** Destello verdoso de toda la pantalla (inicio de oleada). */
    private destelloPantalla(alfa: number): void {
        this.flashAlfa = Math.max(this.flashAlfa, alfa * (this.movimientoReducido ? 0.3 : 1));
    }

    private actualizarPantalla(dt: number): void {
        // Viñeta roja: golpe reciente y, con poca vida, un latido suave.
        this.vinetaAlfa *= Math.exp(-dt * 5);
        if (this.vinetaAlfa < 0.004) this.vinetaAlfa = 0;
        const yo = this.sim.jugador(this.cfg.yo.id);
        let base = 0;
        if (yo && !yo.caido && yo.vida / yo.vidaMax < 0.3 && this.sim.fase !== 'fin') {
            base = 0.22 + (this.movimientoReducido ? 0 : 0.1 * Math.sin(this.reloj * 5));
        } else if (yo?.caido) {
            base = 0.35;
        }
        const vineta = Math.round(Math.max(this.vinetaAlfa, base) * 100) / 100;
        if (vineta !== this.vinetaEscrita) {
            this.vinetaEscrita = vineta;
            this.vineta.style.opacity = String(vineta);
        }

        this.flashAlfa *= Math.exp(-dt * 9);
        if (this.flashAlfa < 0.004) this.flashAlfa = 0;
        const flash = Math.round(this.flashAlfa * 100) / 100;
        if (flash !== this.flashEscrito) {
            this.flashEscrito = flash;
            this.flash.style.opacity = String(flash);
        }
    }

    private vigilarFase(): void {
        const fase = this.sim.fase;
        const jefe = Boolean(this.sim.jefe);
        if (jefe && !this.conJefe) {
            this.sacudir(600, 0.01);
            this.cfg.musica.tocar('caricatura');
        } else if (!jefe && this.conJefe) {
            this.cfg.musica.tocar('robots');
        }
        this.conJefe = jefe;
        if (fase === 'fin' && this.faseAnterior !== 'fin') {
            this.cfg.musica.perder();
            this.sacudir(400, 0.01);
        }
        this.faseAnterior = fase;
    }

    // ——— Rendimiento adaptativo ————————————————————————————————————————————————————————————————

    /**
     * Mide el promedio de cuadro en ventanas de ~2 s y baja la calidad un escalón cuando dos ventanas seguidas
     * salen lentas (> 24 ms). «Lenta» se compara con la mejor ventana vista: si el navegador limita el bucle a
     * 30 Hz (ahorro de batería, pantallas de 30 Hz), 33 ms es lo normal y no hay nada que bajar. Tras cada
     * escalón se ignora una ventana (recompilación de shaders) y se comprueba que haya servido; si no mejoró,
     * el límite no es el dibujo y ya no se baja más.
     */
    private vigilarRendimiento(deltaMs: number): void {
        // Los primeros segundos compilan shaders: no cuentan.
        if (this.reloj < 3 || this.estancado) return;
        this.medidaT += Math.min(deltaMs, 100);
        this.medidaN += 1;
        if (this.medidaT < 2000) return;
        const promedio = this.medidaT / this.medidaN;
        this.medidaT = 0;
        this.medidaN = 0;
        if (this.ventanasIgnoradas > 0) {
            this.ventanasIgnoradas -= 1;
            return;
        }
        if (this.antesDeBajar > 0) {
            const sirvio = promedio < this.antesDeBajar * 0.9;
            this.antesDeBajar = 0;
            if (!sirvio) {
                this.estancado = true;
                return;
            }
        }
        this.referenciaMs = Math.min(this.referenciaMs, promedio);
        // Lenta: pasa de 24 ms y es claramente peor que lo mejor visto (o lo mejor visto ya era lento).
        const lenta = promedio > 24 && (promedio > this.referenciaMs * 1.3 || this.referenciaMs > 24);
        this.ventanasMalas = lenta ? this.ventanasMalas + 1 : 0;
        if (this.ventanasMalas < 2) return;
        this.ventanasMalas = 0;
        if (this.degradar()) {
            this.ventanasIgnoradas = 1;
            this.antesDeBajar = promedio;
            // La referencia vieja ya no aplica a la nueva calidad.
            this.referenciaMs = Infinity;
        } else {
            this.estancado = true;
        }
    }

    /**
     * Baja un escalón: sombras → brillo (bloom) → resolución 1× → luces de los pilares → resolución 0.75× y menos
     * partículas. Regresa false si ya no queda nada que bajar.
     */
    private degradar(): boolean {
        if (this.sombrasActivas) {
            this.sombrasActivas = false;
            this.renderer.shadowMap.enabled = false;
            this.escena.traverse((o) => {
                if ((o instanceof THREE.DirectionalLight || o instanceof THREE.PointLight || o instanceof THREE.SpotLight) && o.castShadow) {
                    o.castShadow = false;
                    o.shadow.dispose();
                }
            });
            return true;
        }
        if (this.composer) {
            this.quitarComposer();
            return true;
        }
        if (this.pixelRatio > 1) {
            this.topePixel = 1;
            this.ajustarTamano();
            return true;
        }
        if (this.lucesActivas) {
            // Las 4 luces de los pilares se evalúan en cada fragmento de todos los materiales: sin ellas el
            // piso y los pilares conservan sus neones (emisivos). Cambiar el número de luces recompila una vez.
            this.lucesActivas = false;
            this.escena.traverse((o) => {
                if (o instanceof THREE.PointLight) o.visible = false;
            });
            return true;
        }
        if (this.topePixel > 0.75) {
            this.topePixel = 0.75;
            this.factorParticulas = 0.6;
            this.ajustarTamano();
            return true;
        }
        return false;
    }

    private ajustarTamano(): void {
        const w = Math.max(1, this.padre.clientWidth);
        const h = Math.max(1, this.padre.clientHeight);
        this.ancho = w;
        this.alto = h;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.topePixel);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(w, h);
        if (this.composer) {
            const muestras = muestrasMsaa(this.pixelRatio);
            if (this.composer.renderTarget1.samples !== muestras) {
                // Cambió la densidad: se rehacen los búferes con el MSAA que toca (se recrean al dibujar).
                for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
                    rt.samples = muestras;
                    rt.dispose();
                }
            }
            this.composer.setPixelRatio(this.pixelRatio);
            this.composer.setSize(w, h);
            // El bloom no necesita la densidad del dispositivo: trabaja a resolución CSS (él la divide entre 2).
            this.bloom?.setSize(w, h);
        }
        this.camara.aspect = w / h;
        this.camara.updateProjectionMatrix();
    }

    // ——— Cámara en tercera persona ——————————————————————————————————————————————————————————————

    private actualizarCamara(dt: number): void {
        const yo = this.sim.jugador(this.cfg.yo.id);
        const tx = yo ? yo.x * E : ANCHO_M / 2;
        const tz = yo ? yo.y * E : ALTO_M / 2;
        if (!this.camIniciada) {
            this.foco.set(tx, 0, tz);
            this.camIniciada = true;
        } else {
            const k = suavizar(dt, 10);
            this.foco.x += (tx - this.foco.x) * k;
            this.foco.z += (tz - this.foco.z) * k;
        }

        const p = this.pitch;
        const fx = Math.cos(this.yaw);
        const fz = Math.sin(this.yaw);
        const dh = CAMARA.distancia * Math.cos(p);
        const cx = this.foco.x - fx * dh;
        const cz = this.foco.z - fz * dh;
        let cy = CAMARA.altura + CAMARA.distancia * Math.sin(p);
        // Fuera de la arena la cámara sube por encima de la barrera para no quedar tapada.
        const fuera = cx < BORDE_M || cx > ANCHO_M - BORDE_M || cz < BORDE_M || cz > ALTO_M - BORDE_M;
        const extra = fuera ? Math.max(0, 1.7 - cy) : 0;
        this.elevacion += (extra - this.elevacion) * suavizar(dt, 8);
        cy += this.elevacion;
        // Con la cámara baja se mira un poco más arriba (la cabeza queda debajo de la mira), con tope: la
        // puntería es horizontal y mirar al cielo no sirve de nada.
        const mirarY = CAMARA.mirarAltura + Math.min(0.6, Math.max(0, 0.22 - p) * 4.2);

        let ox = 0;
        let oy = 0;
        let oz = 0;
        let giro = 0;
        if (this.sacT > 0) {
            this.sacT = Math.max(0, this.sacT - dt);
            const f = this.sacT / this.sacDur;
            const a = this.sacAmp * f * f;
            const t = this.reloj;
            ox = a * ruido(t, 53.1);
            oy = a * ruido(t, 47.7) * 0.7;
            oz = a * ruido(t, 61.3);
            giro = a * 0.08 * ruido(t, 39.9);
            if (this.sacT === 0) this.sacAmp = 0;
        }

        this.camara.position.set(cx + ox, cy + oy, cz + oz);
        _mirar.set(this.foco.x + fx * CAMARA.mirarAdelante + ox, mirarY + oy, this.foco.z + fz * CAMARA.mirarAdelante + oz);
        this.camara.lookAt(_mirar);
        if (giro !== 0) this.camara.rotateZ(giro);
        _derecha.set(1, 0, 0).applyQuaternion(this.camara.quaternion);
    }

    // ——— Dibujo ——————————————————————————————————————————————————————————————————————————————————

    private dibujar(dt: number): void {
        this.cuadro += 1;
        this.nSombras = 0;
        this.dibujarJugadores(dt);
        this.dibujarZombies(dt);
        this.dibujarBalas();
        this.dibujarTorretas(dt);
        this.actualizarFantasmas(dt);
        this.sombras.count = this.nSombras;
        this.sombras.visible = this.nSombras > 0;
        if (this.nSombras > 0) this.sombras.instanceMatrix.needsUpdate = true;
    }

    private ponerSombra(x: number, z: number, diametro: number): void {
        if (this.nSombras >= MAX_SOMBRAS) return;
        _pos.set(x, 0.025, z);
        _quat.identity();
        _esc.set(diametro, 1, diametro);
        _mat.compose(_pos, _quat, _esc);
        this.sombras.setMatrixAt(this.nSombras, _mat);
        this.nSombras += 1;
    }

    private dibujarJugadores(dt: number): void {
        const t = this.reloj;
        for (const j of this.sim.jugadores) {
            const v = this.vistas.get(j.id) ?? this.crearVista(j);
            const p = personaje(j.personaje);

            // Posición mostrada: la mía exacta; la del compañero suavizada (llega 15–20 veces por segundo).
            const tx = j.x * E;
            const tz = j.y * E;
            if (v.esYo || !v.iniciado) {
                v.x = tx;
                v.z = tz;
                v.ang = j.ang;
                if (!v.iniciado) {
                    v.prevX = tx;
                    v.prevZ = tz;
                }
                v.iniciado = true;
            } else {
                const dx = tx - v.x;
                const dz = tz - v.z;
                if (dx * dx + dz * dz > 144) {
                    v.x = tx;
                    v.z = tz;
                } else {
                    const k = suavizar(dt, 14);
                    v.x += dx * k;
                    v.z += dz * k;
                }
                v.ang += normalizarAngulo(j.ang - v.ang) * suavizar(dt, 18);
            }
            v.raiz.position.set(v.x, 0, v.z);
            v.giro.rotation.y = -v.ang;

            // Velocidad (comparando con el cuadro anterior) para animar.
            const mvx = v.x - v.prevX;
            const mvz = v.z - v.prevZ;
            v.prevX = v.x;
            v.prevZ = v.z;
            const rapidez = dt > 0 ? Math.min(12, Math.hypot(mvx, mvz) / dt) : 0;
            v.vel += (rapidez - v.vel) * suavizar(dt, 10);
            const andar = j.caido ? 0 : Math.min(1, v.vel / 4);
            const sentido = mvx * Math.cos(v.ang) + mvz * Math.sin(v.ang) < -1e-4 ? -1 : 1;
            if (andar > 0.05) v.fase += dt * (4 + v.vel * 1.5) * sentido;
            const m = v.modelo;
            const zancada = Math.sin(v.fase) * 0.65 * andar;
            m.piernaIzq.rotation.z = zancada;
            m.piernaDer.rotation.z = -zancada;
            m.cuerpo.position.y = v.baseCuerpoY + Math.abs(Math.cos(v.fase)) * 0.045 * andar + Math.sin(t * 2.2) * 0.008;
            m.cuerpo.rotation.z = -0.07 * andar;
            m.cuerpo.rotation.x = Math.sin(v.fase) * 0.035 * andar;
            m.brazos.rotation.x = Math.sin(v.fase) * 0.05 * andar;
            v.retroceso = Math.max(0, v.retroceso - dt * 9);
            m.brazos.position.x = v.baseBrazosX - 0.06 * v.retroceso;
            m.arma.rotation.z = 0.14 * v.retroceso;

            // Caído: tumbado de espaldas y en gris.
            v.caida += ((j.caido ? 1 : 0) - v.caida) * suavizar(dt, 8);
            m.grupo.rotation.z = v.caida * (Math.PI / 2);
            m.grupo.position.y = v.caida * 0.3;
            if (j.caido !== v.gris) this.ponerGris(v, j.caido);
            const atrasX = -Math.cos(v.ang) * 1.5 * v.caida;
            const atrasZ = -Math.sin(v.ang) * 1.5 * v.caida;
            // La ficha es un plano de frente a la cámara: se adelanta hacia ella para que el collarín, la mochila
            // o el arma no la recorten por la prueba de profundidad (la cámara ya se actualizó en este cuadro).
            _pos.subVectors(this.camara.position, v.raiz.position).setY(0);
            const dCam = _pos.length();
            if (dCam > 1e-4) _pos.multiplyScalar((0.38 * (1 - v.caida)) / dCam);
            v.cabeza.position.set(atrasX + _pos.x, ALTURA.cabeza + (0.45 - ALTURA.cabeza) * v.caida, atrasZ + _pos.z);
            v.etiqueta.position.set(atrasX, ALTURA.etiqueta + (1.25 - ALTURA.etiqueta) * v.caida, atrasZ);

            // Compañero que estorba la vista (muy cerca de la cámara o entre ella y yo): se vuelve translúcido y
            // su nombre no crece de más en pantalla.
            if (!v.esYo) {
                v.opacidad += (this.opacidadCompanero(v.x, v.z, dCam) - v.opacidad) * suavizar(dt, 10);
                const lado = Math.min(1, Math.max(0.2, dCam / 4.5));
                v.etiqueta.scale.set(v.anchoEtiqueta * lado, 0.3 * lado, 1);
                v.matEtiqueta.opacity = v.opacidad;
                for (const o of v.originales) o.mat.opacity = v.opacidad;
            }

            // Parpadeo mientras es invulnerable.
            const parpadeo = j.invulnerable > 0 && !j.caido;
            v.giro.visible = !parpadeo || Math.sin(t * 38) > -0.35;
            v.matCabeza.opacity = (parpadeo ? 0.55 + 0.45 * Math.sin(t * 25) : 1) * v.opacidad;

            v.burbuja.visible = j.escudo > 0;
            if (v.burbuja.visible) {
                const pulso = 1 + Math.sin(t * 6) * 0.03;
                v.burbuja.scale.set(pulso, 1.18 * pulso, pulso);
            }
            const aura = (0.5 + 0.06 * Math.sin(t * 3.3)) * 4.8;
            v.aura.scale.set(aura, 1, aura);
            v.matAura.opacity = j.caido ? 0.18 : 0.55;

            v.aroFondo.visible = j.caido;
            v.aroRevivir.visible = j.caido && j.revive > 0.005;
            if (v.aroRevivir.visible) v.geoAro.setDrawRange(0, Math.round(limitar(j.revive, 0, 1) * 64) * 6);

            if (v.marcador && v.matMarcador) {
                v.marcador.position.y = ALTURA.marcador + Math.sin(t * 3) * 0.08;
                v.matMarcador.color.setHex(j.caido ? 0xff3d5e : v.color).multiplyScalar(1.5);
                const s = 0.034 * (j.caido ? 1 + Math.sin(t * 8) * 0.15 : 1);
                v.marcador.scale.set(s, s, 1);
            }

            this.ponerSombra(v.x, v.z, j.caido ? 2 : 1.3);

            // Sonido y fogonazo de los disparos que calcula el anfitrión.
            if (this.cfg.modo !== 'invitado' && j.cdDisparo > v.ultimoCd + 0.01) {
                this.sonidoDisparo(p.arma.tipo, j.id === this.cfg.yo.id ? 1 : 0.4);
                this.fogonazo(j.id, p.color);
            }
            v.ultimoCd = j.cdDisparo;
            // Invitado: fogonazo del compañero según las balas que llegaron en la foto.
            if (this.fogonazosPendientes.has(j.id)) {
                this.fogonazosPendientes.delete(j.id);
                if (!j.caido) this.fogonazo(j.id, p.color);
            }
        }
    }

    /**
     * Opacidad del compañero según cuánto estorba: translúcido a menos de ~2.5 m de la cámara o si queda entre
     * la cámara y mi personaje (en el plano del piso).
     */
    private opacidadCompanero(x: number, z: number, dCam: number): number {
        let f = limitar((dCam - 1.1) / 1.4, 0, 1);
        const cam = this.camara.position;
        const sx = this.foco.x - cam.x;
        const sz = this.foco.z - cam.z;
        const largo2 = sx * sx + sz * sz;
        if (largo2 > 1e-4) {
            const k = ((x - cam.x) * sx + (z - cam.z) * sz) / largo2;
            if (k > 0 && k < 1) {
                const px = cam.x + sx * k - x;
                const pz = cam.z + sz * k - z;
                f = Math.min(f, limitar((Math.hypot(px, pz) - 0.45) / 0.6, 0, 1));
            }
        }
        return 0.22 + 0.78 * f;
    }

    private ponerGris(v: VistaJugador, gris: boolean): void {
        v.gris = gris;
        for (const o of v.originales) {
            if (!gris) {
                o.mat.color.copy(o.color);
                o.mat.emissive.copy(o.emisivo);
                o.mat.emissiveIntensity = o.intensidad;
            } else if (o.neon) {
                o.mat.color.setHex(0x444455);
                o.mat.emissive.setHex(0x222233);
                o.mat.emissiveIntensity = 0.4;
            } else {
                o.mat.color.copy(o.color).multiplyScalar(0.5);
            }
        }
        if (gris) v.matCabeza.color.setHex(0x555566);
        else v.matCabeza.color.setScalar(TONO_FICHA);
    }

    private dibujarZombies(dt: number): void {
        for (const tipo of TIPOS_ZOMBIE) this.grupos[tipo].n = 0;
        let nBarras = 0;
        const camQ = this.camara.quaternion;

        for (const z of this.sim.zombies) {
            let est = this.estados.get(z.id);
            if (!est) {
                est = { edad: 0, vidaPrev: z.vida, golpe: 0, visto: 0 };
                this.estados.set(z.id, est);
                this.alAparecer(z);
            }
            est.visto = this.cuadro;
            est.edad += dt;
            // En fracción de la vida: sirve igual en el anfitrión y en el espejo (vidaMax = 1, % redondeado).
            if ((est.vidaPrev - z.vida) / z.vidaMax > 0.004) est.golpe = GOLPE;
            else est.golpe = Math.max(0, est.golpe - dt);
            est.vidaPrev = z.vida;

            const g = this.grupos[z.tipo];
            const x = z.x * E;
            const zz = z.y * E;
            const p = est.edad / APARICION;
            const escala = p >= 1 ? 1 : Math.max(0.001, salidaRebote(p));
            this.ponerSombra(x, zz, aMetros(z.radio) * 3 * Math.min(1, escala));
            if (g.n >= g.max) continue;
            const i = g.n;
            g.n += 1;

            // Bamboleo al caminar: sube y baja, se mece de lado (x) y se inclina (z).
            const paso = z.paso;
            const bote = Math.abs(Math.cos(paso)) * 0.035 * g.altura * 0.6;
            _pos.set(x, bote * escala, zz);
            _euler.set(Math.sin(paso) * 0.07, -z.ang + Math.sin(paso * 0.5) * 0.06, Math.sin(paso * 2) * 0.04, 'YXZ');
            _quat.setFromEuler(_euler);
            _esc.setScalar(escala);
            _mat.compose(_pos, _quat, _esc);
            g.cuerpo.setMatrixAt(i, _mat);
            g.ojos.setMatrixAt(i, _mat);

            const zancada = Math.sin(paso) * 0.5;
            _matPierna.makeRotationZ(zancada).setPosition(0, g.caderaY, 0);
            _matFinal.multiplyMatrices(_mat, _matPierna);
            g.izq.setMatrixAt(i, _matFinal);
            _matPierna.makeRotationZ(-zancada).setPosition(0, g.caderaY, 0);
            _matFinal.multiplyMatrices(_mat, _matPierna);
            g.der.setMatrixAt(i, _matFinal);

            if (est.golpe > 0) _color.setRGB(3.2, 3.2, 3.2);
            else if (z.aturdido > 0) _color.setRGB(0.55, 0.75, 1.9);
            else _color.copy(BLANCO);
            g.cuerpo.setColorAt(i, _color);
            g.izq.setColorAt(i, _color);
            g.der.setColorAt(i, _color);

            // Barra de vida flotante (solo gordo y jefe).
            if ((z.tipo === 'gordo' || z.tipo === 'jefe') && nBarras < MAX_BARRAS) {
                const jefe = z.tipo === 'jefe';
                const ancho = jefe ? 2.6 : 0.95;
                const alto = jefe ? 0.13 : 0.08;
                _pos2.set(x, g.altura * escala + (jefe ? 0.5 : 0.32), zz);
                _esc.set(ancho + 0.06, alto + 0.05, 1);
                _mat.compose(_pos2, camQ, _esc);
                this.barrasFondo.setMatrixAt(nBarras, _mat);
                const frac = limitar(z.vida / z.vidaMax, 0, 1);
                _pos2.addScaledVector(_derecha, -ancho / 2);
                _esc.set(Math.max(0.001, ancho * frac), alto, 1);
                _mat.compose(_pos2, camQ, _esc);
                this.barrasRelleno.setMatrixAt(nBarras, _mat);
                _color.setHex(COLOR_ZOMBIE[z.tipo]).multiplyScalar(1.6);
                this.barrasRelleno.setColorAt(nBarras, _color);
                nBarras += 1;
            }
        }

        for (const tipo of TIPOS_ZOMBIE) {
            const g = this.grupos[tipo];
            for (const m of g.mallas) {
                m.count = g.n;
                m.visible = g.n > 0;
                if (g.n > 0) {
                    m.instanceMatrix.needsUpdate = true;
                    if (m.instanceColor) m.instanceColor.needsUpdate = true;
                }
            }
        }
        this.barrasFondo.count = nBarras;
        this.barrasRelleno.count = nBarras;
        this.barrasFondo.visible = nBarras > 0;
        this.barrasRelleno.visible = nBarras > 0;
        if (nBarras > 0) {
            this.barrasFondo.instanceMatrix.needsUpdate = true;
            this.barrasRelleno.instanceMatrix.needsUpdate = true;
            if (this.barrasRelleno.instanceColor) this.barrasRelleno.instanceColor.needsUpdate = true;
        }

        // Olvida los zombies que ya no están.
        this.estados.forEach(this.limpiarEstado);
    }

    private readonly limpiarEstado = (est: EstadoZombie, id: number): void => {
        if (est.visto !== this.cuadro) this.estados.delete(id);
    };

    /** Un zombie brota del suelo: tierra del color del tipo y una onda. */
    private alAparecer(z: Zombie): void {
        const x = z.x * E;
        const zz = z.y * E;
        const color = COLOR_ZOMBIE[z.tipo];
        if (z.tipo === 'jefe') {
            this.anillos.lanzar(x, zz, color, 6, 0.8);
            this.anillos.lanzar(x, zz, 0xffffff, 3.5, 0.5);
            this.destellos.lanzar(x, 1.5, zz, color, 6, 0.5);
            this.particulas.emitir({ x, y: 0.3, z: zz, cantidad: this.cant(50), color, velocidad: 8, vida: 0.9, gravedad: 9, tamano: 0.22, arriba: 4 });
            return;
        }
        this.anillos.lanzar(x, zz, color, aMetros(z.radio) * 2.4, 0.45);
        this.particulas.emitir({ x, y: 0.15, z: zz, cantidad: this.cant(8), color, velocidad: 3, vida: 0.5, gravedad: 7, tamano: 0.1, arriba: 2 });
    }

    private dibujarBalas(): void {
        const balas = this.sim.balas;
        let nb = 0;
        let nm = 0;
        const t = this.reloj;
        for (let i = 0; i < balas.length; i++) {
            const b = balas[i];
            const x = b.x * E;
            const z = b.y * E;
            const ang = Math.atan2(b.vy, b.vx);
            if (b.tipo === 'billete') {
                if (nm >= MAX_BALAS) continue;
                // Billetes girando en el aire.
                _pos.set(x, ALTURA.bala, z);
                _euler.set(t * 9 + i * 0.7, -ang, t * 6 + i, 'YXZ');
                _quat.setFromEuler(_euler);
                _esc.set(1, 1, 1);
                _mat.compose(_pos, _quat, _esc);
                this.billetes.setMatrixAt(nm, _mat);
                nm += 1;
                continue;
            }
            if (nb >= MAX_BALAS) continue;
            const forma = FORMA_BALA[b.tipo];
            const vel = Math.hypot(b.vx, b.vy) * E;
            const largo = Math.max(forma.grosor, vel * forma.largo);
            const grosor = b.tipo === 'acido' ? forma.grosor * (1 + 0.15 * Math.sin(t * 20 + i)) : forma.grosor;
            // La trazadora queda detrás de la punta (la posición real de la bala).
            const atras = (largo - grosor) * 0.5;
            const dx = Math.cos(ang);
            const dz = Math.sin(ang);
            _pos.set(x - dx * atras, ALTURA.bala, z - dz * atras);
            _quat.setFromAxisAngle(EJE_Y, -ang);
            _esc.set(largo, grosor, grosor);
            _mat.compose(_pos, _quat, _esc);
            this.balas.setMatrixAt(nb, _mat);
            // En baja no hay bloom ni tone mapping para estos colores: con más de 1 se recortarían a blanco.
            _color.setHex(COLOR_BALA[b.tipo]).multiplyScalar(this.alta ? forma.brillo : 1.1);
            this.balas.setColorAt(nb, _color);
            // Halo de la punta (de frente a la cámara): el color se lee aunque la bala vaya de espaldas.
            _pos.set(x, ALTURA.bala, z);
            _quat.identity();
            _esc.set(forma.halo, forma.halo, 1);
            _mat.compose(_pos, _quat, _esc);
            this.halos.setMatrixAt(nb, _mat);
            _color.setHex(COLOR_BALA[b.tipo]).multiplyScalar(this.alta ? 0.55 : 0.75);
            this.halos.setColorAt(nb, _color);
            nb += 1;
        }
        this.balas.count = nb;
        this.halos.count = nb;
        this.billetes.count = nm;
        this.balas.visible = nb > 0;
        this.halos.visible = nb > 0;
        this.billetes.visible = nm > 0;
        if (nb > 0) {
            this.balas.instanceMatrix.needsUpdate = true;
            this.halos.instanceMatrix.needsUpdate = true;
            if (this.balas.instanceColor) this.balas.instanceColor.needsUpdate = true;
            if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true;
        }
        if (nm > 0) this.billetes.instanceMatrix.needsUpdate = true;
    }

    private dibujarTorretas(dt: number): void {
        for (const t of this.sim.torretas) {
            let v = this.torretas.get(t.id);
            if (!v) {
                v = this.torretasLibres.pop() ?? { id: 0, modelo: crearTorreta(), edad: 0, visto: 0, x: 0, z: 0, dx: 0, dz: 0 };
                v.id = t.id;
                v.edad = 0;
                v.modelo.grupo.visible = true;
                this.desplazarTorreta(v, t.x, t.y, t.ang);
                this.escena.add(v.modelo.grupo);
                this.torretas.set(t.id, v);
            }
            v.visto = this.cuadro;
            v.edad += dt;
            v.x = limitar(t.x * E + v.dx, BORDE_M + 0.5, ANCHO_M - BORDE_M - 0.5);
            v.z = limitar(t.y * E + v.dz, BORDE_M + 0.5, ALTO_M - BORDE_M - 0.5);
            const p = v.edad / 0.25;
            const escala = p >= 1 ? 1 : Math.max(0.001, salidaRebote(p));
            v.modelo.grupo.position.set(v.x, 0, v.z);
            v.modelo.grupo.scale.setScalar(escala);
            v.modelo.canon.rotation.y = -t.ang;
            this.ponerSombra(v.x, v.z, 1.4);
        }
        this.torretas.forEach(this.retirarTorreta);
    }

    /**
     * La simulación pone la torreta justo donde está el jugador y el modelo se encimaría con sus piernas: solo en
     * pantalla se adelanta un poco hacia donde apuntaba quien la puso (el jugador más cercano).
     */
    private desplazarTorreta(v: VistaTorreta, x: number, y: number, angTorreta: number): void {
        let ang = angTorreta;
        let mejor = 70 * 70;
        let cerca = false;
        for (const j of this.sim.jugadores) {
            const d = (j.x - x) * (j.x - x) + (j.y - y) * (j.y - y);
            if (d < mejor) {
                mejor = d;
                ang = j.ang;
                cerca = true;
            }
        }
        v.dx = cerca ? Math.cos(ang) * ADELANTE_TORRETA : 0;
        v.dz = cerca ? Math.sin(ang) * ADELANTE_TORRETA : 0;
    }

    /** Quita las torretas que ya no están (función guardada: no crea nada en cada cuadro). */
    private readonly retirarTorreta = (v: VistaTorreta, id: number): void => {
        if (v.visto === this.cuadro) return;
        this.particulas.emitir({ x: v.x, y: 0.5, z: v.z, cantidad: this.cant(10), color: 0xff9a1f, velocidad: 4, vida: 0.45, gravedad: 7, tamano: 0.1 });
        this.escena.remove(v.modelo.grupo);
        this.torretas.delete(id);
        this.torretasLibres.push(v);
    };

    private liberarTorreta(v: VistaTorreta): void {
        this.escena.remove(v.modelo.grupo);
        v.modelo.grupo.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        for (const m of v.modelo.materiales) m.dispose();
    }

    // ——— HUD ——————————————————————————————————————————————————————————————————————————————————————

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
            bloqueado: this.bloqueado(),
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
}

// ———————————————————————————————————————————————————————————————————————————————————————————————
// Entrada pública
// ———————————————————————————————————————————————————————————————————————————————————————————————

/** Si el navegador no puede iniciar WebGL: un aviso en lugar del juego (el botón «SALIR» sigue funcionando). */
function controlSinGraficos(padre: HTMLElement): ControlJuego {
    const aviso = document.createElement('div');
    Object.assign(aviso.style, {
        position: 'absolute',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        color: '#ff8fb0',
        font: '600 14px ui-monospace, monospace',
        background: '#05030c',
    });
    aviso.textContent = 'Tu navegador no pudo iniciar los gráficos 3D (WebGL). Prueba con otro navegador o activa la aceleración por hardware.';
    padre.appendChild(aviso);
    return {
        mandoTactil: () => undefined,
        habilidad: () => undefined,
        companeroSalio: () => undefined,
        capturarMouse: () => undefined,
        destruir: () => aviso.remove(),
    };
}

/** Arranca el juego 3D dentro de `padre`. */
export function crearJuego(padre: HTMLElement, cfg: ConfigPartida): ControlJuego {
    let juego: Juego3D;
    try {
        juego = new Juego3D(padre, cfg);
    } catch (error) {
        console.error(error);
        return controlSinGraficos(padre);
    }
    return {
        mandoTactil: (mx, my, ax, ay) => juego.mandoTactil(mx, my, ax, ay),
        habilidad: () => juego.habilidad(),
        companeroSalio: () => juego.companeroSalio(),
        capturarMouse: () => juego.capturarMouse(),
        destruir: () => juego.destruir(),
    };
}
