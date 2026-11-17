import * as THREE from 'three';
import { texturaAnillo, texturaBrillo, texturaMancha } from './texturas';

/*
 * Efectos visuales del modo Zombies 3D: partículas, ondas en el piso, rayos láser, manchas y destellos.
 * Todo funciona con pools creados una sola vez en el constructor: en cada cuadro solo se escriben números
 * en arreglos ya reservados y se reutilizan objetos temporales (nada de `new` por cuadro). Los materiales
 * son aditivos, sin escribir profundidad y sin tone mapping, para que brillen con el bloom.
 */

// ---------------------------------------------------------------------------------------------------------
// Temporales compartidos (nunca se guardan referencias a ellos fuera de una llamada).
// ---------------------------------------------------------------------------------------------------------

const _color = new THREE.Color();
const _matriz = new THREE.Matrix4();
const _posicion = new THREE.Vector3();
const _escala = new THREE.Vector3();
const _rotacion = new THREE.Quaternion();
const _direccion = new THREE.Vector3();
const _tamanoBufer = new THREE.Vector2();
const EJE_Y = new THREE.Vector3(0, 1, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
/** Giro que acuesta un plano XY sobre el piso (mirando hacia +Y). */
const ACOSTADO = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _giroPiso = new THREE.Quaternion();
/** Matriz con escala cero: esconde una instancia sin cambiar `count`. */
const MATRIZ_OCULTA = new THREE.Matrix4().makeScale(0, 0, 0);

/** Opciones comunes de los materiales aditivos. */
const ADITIVO = {
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
} as const;

const azar = (min: number, max: number) => min + Math.random() * (max - min);

/** Suavizado de salida (rápido al principio, lento al final). */
const salida = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);

// ---------------------------------------------------------------------------------------------------------
// Brillos de frente a la cámara (billboards instanciados)
// ---------------------------------------------------------------------------------------------------------

const VERTICE_BRILLO = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
        vUv = uv;
        vColor = vec3( 1.0 );
        #ifdef USE_INSTANCING_COLOR
            vColor = instanceColor;
        #endif
        #ifdef USE_INSTANCING
            // El centro sale de la traslación de la instancia; el cuadro se abre de frente a la cámara con el
            // giro y la escala que trae la parte 2×2 de su matriz (una matriz en cero lo esconde).
            vec4 mv = modelViewMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 );
            mv.xy += mat2( instanceMatrix[ 0 ].xy, instanceMatrix[ 1 ].xy ) * position.xy;
        #else
            vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        #endif
        gl_Position = projectionMatrix * mv;
    }
`;

const FRAGMENTO_BRILLO = /* glsl */ `
    uniform sampler2D uMapa;
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
        vec4 t = texture2D( uMapa, vUv );
        // Aditivo: el color ya trae la opacidad multiplicada.
        gl_FragColor = vec4( vColor * t.rgb, t.a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

/**
 * Material aditivo para un `InstancedMesh` de cuadros (`PlaneGeometry(1, 1)`) que siempre miran a la cámara:
 * posición, giro (en Z) y tamaño salen de la matriz de cada instancia y el color (× opacidad) de
 * `instanceColor`. Todos los brillos de un tipo se dibujan en una sola llamada.
 */
export function materialBrillo(textura: THREE.Texture): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: { uMapa: { value: textura } },
        vertexShader: VERTICE_BRILLO,
        fragmentShader: FRAGMENTO_BRILLO,
        fog: false,
        ...ADITIVO,
    });
}

// ---------------------------------------------------------------------------------------------------------
// Partículas
// ---------------------------------------------------------------------------------------------------------

const VERTICE_PARTICULAS = /* glsl */ `
    attribute float size;
    attribute float alpha;
    uniform float uAltoPx;
    varying vec3 vColor;
    varying float vAlfa;

    void main() {
        vColor = color;
        vAlfa = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // Tamaño en metros → píxeles con perspectiva (projectionMatrix[1][1] = 1 / tan(fov / 2)).
        float px = alpha > 0.0 ? size * projectionMatrix[1][1] * uAltoPx / max(-mvPosition.z, 0.05) : 0.0;
        gl_PointSize = min(px, 256.0);
        // Las ranuras libres se mandan fuera del recorte para no gastar fragmentos.
        if (alpha <= 0.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
    }
`;

const FRAGMENTO_PARTICULAS = /* glsl */ `
    varying vec3 vColor;
    varying float vAlfa;

    void main() {
        // Punto redondo con borde suave y núcleo más claro.
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d) * 4.0;
        if (r2 > 1.0) discard;
        float suave = 1.0 - r2;
        float nucleo = suave * suave;
        vec3 c = mix(vColor, vec3(1.0), nucleo * 0.35);
        gl_FragColor = vec4(c, vAlfa * suave);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export type OpcionesEmision = {
    x: number;
    y: number;
    z: number;
    cantidad: number;
    color: number;
    /** Velocidad inicial media (m/s). */
    velocidad?: number;
    /** Vida media (s). */
    vida?: number;
    /** Aceleración hacia abajo (m/s²). */
    gravedad?: number;
    /** Tamaño medio (m). */
    tamano?: number;
    /** Empuje extra hacia +Y (m/s). */
    arriba?: number;
};

/** Arrastre del aire (1/s): las partículas frenan de forma exponencial. */
const ARRASTRE = 2.2;
/** Altura mínima: rebotan un poco al tocar el piso. */
const PISO = 0.03;

/**
 * Nube de partículas en un solo `THREE.Points`. Las ranuras se reciclan de forma circular: si se pide más
 * de lo que cabe, se sobrescriben las más viejas.
 */
export class Particulas {
    private readonly escena: THREE.Scene;
    private readonly max: number;
    private readonly geometria: THREE.BufferGeometry;
    private readonly material: THREE.ShaderMaterial;
    private readonly puntos: THREE.Points;

    private readonly posiciones: Float32Array;
    private readonly colores: Float32Array;
    private readonly tamanos: Float32Array;
    private readonly alfas: Float32Array;
    private readonly attrPosicion: THREE.BufferAttribute;
    private readonly attrColor: THREE.BufferAttribute;
    private readonly attrTamano: THREE.BufferAttribute;
    private readonly attrAlfa: THREE.BufferAttribute;

    /** Estado en CPU por ranura. */
    private readonly velocidades: Float32Array;
    private readonly vida: Float32Array;
    private readonly vidaMax: Float32Array;
    private readonly gravedades: Float32Array;
    private readonly tamanoBase: Float32Array;

    private cursor = 0;
    private vivas = 0;
    private sucio = false;
    /** Ranuras escritas por `emitir` desde la última subida del color (rango a subir; −1 = nada). */
    private emitidaMin = -1;
    private emitidaMax = -1;

    constructor(escena: THREE.Scene, max: number) {
        this.escena = escena;
        this.max = Math.max(1, Math.floor(max));
        const n = this.max;

        this.posiciones = new Float32Array(n * 3);
        this.colores = new Float32Array(n * 3);
        this.tamanos = new Float32Array(n);
        this.alfas = new Float32Array(n);
        this.velocidades = new Float32Array(n * 3);
        this.vida = new Float32Array(n);
        this.vidaMax = new Float32Array(n);
        this.gravedades = new Float32Array(n);
        this.tamanoBase = new Float32Array(n);

        this.geometria = new THREE.BufferGeometry();
        this.attrPosicion = new THREE.BufferAttribute(this.posiciones, 3).setUsage(THREE.DynamicDrawUsage);
        this.attrColor = new THREE.BufferAttribute(this.colores, 3).setUsage(THREE.DynamicDrawUsage);
        this.attrTamano = new THREE.BufferAttribute(this.tamanos, 1).setUsage(THREE.DynamicDrawUsage);
        this.attrAlfa = new THREE.BufferAttribute(this.alfas, 1).setUsage(THREE.DynamicDrawUsage);
        this.geometria.setAttribute('position', this.attrPosicion);
        this.geometria.setAttribute('color', this.attrColor);
        this.geometria.setAttribute('size', this.attrTamano);
        this.geometria.setAttribute('alpha', this.attrAlfa);
        // Esfera fija y generosa: las posiciones cambian cada cuadro y no se recalcula nada.
        this.geometria.boundingSphere = new THREE.Sphere(new THREE.Vector3(22.5, 0, 15), 400);

        this.material = new THREE.ShaderMaterial({
            uniforms: { uAltoPx: { value: 400 } },
            vertexShader: VERTICE_PARTICULAS,
            fragmentShader: FRAGMENTO_PARTICULAS,
            vertexColors: true,
            ...ADITIVO,
        });

        this.puntos = new THREE.Points(this.geometria, this.material);
        this.puntos.frustumCulled = false;
        this.puntos.renderOrder = 3;
        this.puntos.visible = false;
        // La mitad de la altura del búfer de dibujo, para pasar de metros a píxeles en el shader.
        const uniforme = this.material.uniforms.uAltoPx;
        this.puntos.onBeforeRender = (renderer) => {
            renderer.getDrawingBufferSize(_tamanoBufer);
            uniforme.value = _tamanoBufer.y * 0.5;
        };
        escena.add(this.puntos);
    }

    emitir(o: OpcionesEmision): void {
        const cantidad = Math.min(this.max, Math.max(0, Math.floor(o.cantidad)));
        if (cantidad === 0) {
            return;
        }
        const velocidad = o.velocidad ?? 4;
        const vida = o.vida ?? 0.7;
        const gravedad = o.gravedad ?? 9;
        const tamano = o.tamano ?? 0.18;
        const arriba = o.arriba ?? 0;
        _color.setHex(o.color);

        for (let k = 0; k < cantidad; k++) {
            const i = this.cursor;
            this.cursor = (this.cursor + 1) % this.max;
            if (this.vida[i] <= 0) {
                this.vivas++;
            }
            const i3 = i * 3;

            // Dirección uniforme en la esfera, con rapidez variable.
            const u = Math.random() * 2 - 1;
            const th = Math.random() * Math.PI * 2;
            const r = Math.sqrt(1 - u * u);
            const rapidez = velocidad * azar(0.3, 1);
            this.velocidades[i3] = r * Math.cos(th) * rapidez;
            this.velocidades[i3 + 1] = u * rapidez + arriba * azar(0.6, 1);
            this.velocidades[i3 + 2] = r * Math.sin(th) * rapidez;

            this.posiciones[i3] = o.x;
            this.posiciones[i3 + 1] = o.y;
            this.posiciones[i3 + 2] = o.z;

            // Ligera variación de brillo por partícula.
            const brillo = azar(0.8, 1.25);
            this.colores[i3] = _color.r * brillo;
            this.colores[i3 + 1] = _color.g * brillo;
            this.colores[i3 + 2] = _color.b * brillo;

            const v = vida * azar(0.6, 1.1);
            this.vida[i] = v;
            this.vidaMax[i] = v;
            this.gravedades[i] = gravedad;
            const t = tamano * azar(0.65, 1.35);
            this.tamanoBase[i] = t;
            this.tamanos[i] = t;
            this.alfas[i] = 1;

            if (this.emitidaMin < 0 || i < this.emitidaMin) {
                this.emitidaMin = i;
            }
            if (i > this.emitidaMax) {
                this.emitidaMax = i;
            }
        }

        this.sucio = true;
        this.puntos.visible = true;
    }

    actualizar(dt: number): void {
        if (this.vivas <= 0 && !this.sucio) {
            return;
        }
        const freno = Math.exp(-ARRASTRE * dt);
        let vivas = 0;
        // Solo se sube a la GPU el tramo de ranuras que cambió (vivas o recién apagadas).
        let min = this.max;
        let max = -1;
        // Al ver todas las vivas se puede cortar el recorrido.
        let porVer = this.vivas;

        for (let i = 0; i < this.max && porVer > 0; i++) {
            if (this.vida[i] <= 0) {
                continue;
            }
            porVer--;
            if (i < min) {
                min = i;
            }
            max = i;
            const restante = this.vida[i] - dt;
            if (restante <= 0) {
                this.vida[i] = 0;
                this.alfas[i] = 0;
                this.tamanos[i] = 0;
                continue;
            }
            this.vida[i] = restante;
            vivas++;

            const i3 = i * 3;
            let vx = this.velocidades[i3] * freno;
            let vy = (this.velocidades[i3 + 1] - this.gravedades[i] * dt) * freno;
            let vz = this.velocidades[i3 + 2] * freno;

            let y = this.posiciones[i3 + 1] + vy * dt;
            if (y < PISO) {
                // Rebote amortiguado y fricción con el piso.
                y = PISO;
                vy = vy < 0 ? -vy * 0.3 : vy;
                vx *= 0.6;
                vz *= 0.6;
            }
            this.posiciones[i3] += vx * dt;
            this.posiciones[i3 + 1] = y;
            this.posiciones[i3 + 2] += vz * dt;
            this.velocidades[i3] = vx;
            this.velocidades[i3 + 1] = vy;
            this.velocidades[i3 + 2] = vz;

            // Se desvanece y encoge poco a poco (con un destello breve al nacer).
            const p = restante / this.vidaMax[i];
            this.alfas[i] = p * p * (3 - 2 * p);
            this.tamanos[i] = this.tamanoBase[i] * (0.45 + 0.55 * p) * (p > 0.92 ? 1.25 : 1);
        }

        this.vivas = vivas;
        this.sucio = false;
        // Los rangos se acumulan hasta que el renderer los sube (él los vacía): si un cuadro no se dibuja,
        // no se pierde nada.
        if (max >= min) {
            const n = max - min + 1;
            this.attrPosicion.addUpdateRange(min * 3, n * 3);
            this.attrTamano.addUpdateRange(min, n);
            this.attrAlfa.addUpdateRange(min, n);
            this.attrPosicion.needsUpdate = true;
            this.attrTamano.needsUpdate = true;
            this.attrAlfa.needsUpdate = true;
        }
        if (this.emitidaMax >= 0) {
            this.attrColor.addUpdateRange(this.emitidaMin * 3, (this.emitidaMax - this.emitidaMin + 1) * 3);
            this.attrColor.needsUpdate = true;
            this.emitidaMin = -1;
            this.emitidaMax = -1;
        }
        this.puntos.visible = vivas > 0;
    }

    dispose(): void {
        this.escena.remove(this.puntos);
        this.puntos.onBeforeRender = () => {};
        this.geometria.dispose();
        this.material.dispose();
    }
}

// ---------------------------------------------------------------------------------------------------------
// Base para efectos instanciados (anillos, manchas)
// ---------------------------------------------------------------------------------------------------------

/** Crea un `InstancedMesh` con `instanceColor` inicializado en negro y todas las instancias ocultas. */
function crearInstanciado(
    geometria: THREE.BufferGeometry,
    material: THREE.Material,
    max: number,
): THREE.InstancedMesh {
    const malla = new THREE.InstancedMesh(geometria, material, max);
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    _color.setRGB(0, 0, 0);
    for (let i = 0; i < max; i++) {
        malla.setMatrixAt(i, MATRIZ_OCULTA);
        malla.setColorAt(i, _color);
    }
    malla.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    malla.frustumCulled = false;
    malla.visible = false;
    return malla;
}

// ---------------------------------------------------------------------------------------------------------
// Anillos (ondas en el piso)
// ---------------------------------------------------------------------------------------------------------

/** En `texturaAnillo` la línea queda a 104 px del centro en un lienzo de 256: lado del plano = radio · 256/104. */
const LADO_POR_RADIO_ANILLO = 256 / 104;

/** Ondas expansivas planas sobre el piso, en un solo `InstancedMesh`. */
export class Anillos {
    private readonly escena: THREE.Scene;
    private readonly max: number;
    private readonly textura: THREE.CanvasTexture;
    private readonly geometria: THREE.PlaneGeometry;
    private readonly material: THREE.MeshBasicMaterial;
    private readonly malla: THREE.InstancedMesh;

    private readonly x: Float32Array;
    private readonly y: Float32Array;
    private readonly z: Float32Array;
    private readonly r: Float32Array;
    private readonly g: Float32Array;
    private readonly b: Float32Array;
    private readonly radio: Float32Array;
    private readonly tiempo: Float32Array;
    private readonly duracion: Float32Array;

    private cursor = 0;
    private activos = 0;

    constructor(escena: THREE.Scene, max = 24) {
        this.escena = escena;
        this.max = Math.max(1, Math.floor(max));
        const n = this.max;
        this.x = new Float32Array(n);
        this.y = new Float32Array(n);
        this.z = new Float32Array(n);
        this.r = new Float32Array(n);
        this.g = new Float32Array(n);
        this.b = new Float32Array(n);
        this.radio = new Float32Array(n);
        this.tiempo = new Float32Array(n);
        this.duracion = new Float32Array(n);

        this.textura = texturaAnillo();
        this.geometria = new THREE.PlaneGeometry(1, 1);
        this.material = new THREE.MeshBasicMaterial({
            map: this.textura,
            side: THREE.DoubleSide,
            fog: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            ...ADITIVO,
        });
        this.malla = crearInstanciado(this.geometria, this.material, n);
        this.malla.renderOrder = 2;
        escena.add(this.malla);
    }

    lanzar(x: number, z: number, color: number, radio: number, duracion: number, y = 0.06): void {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;
        if (this.duracion[i] <= 0) {
            this.activos++;
        }
        _color.setHex(color);
        this.x[i] = x;
        this.y[i] = y;
        this.z[i] = z;
        // Un poco por encima de 1 para que el bloom lo agarre.
        this.r[i] = _color.r * 1.6;
        this.g[i] = _color.g * 1.6;
        this.b[i] = _color.b * 1.6;
        this.radio[i] = Math.max(0.01, radio);
        this.tiempo[i] = 0;
        this.duracion[i] = Math.max(0.05, duracion);
        this.malla.visible = true;
    }

    actualizar(dt: number): void {
        if (this.activos <= 0) {
            return;
        }
        let activos = 0;
        for (let i = 0; i < this.max; i++) {
            if (this.duracion[i] <= 0) {
                continue;
            }
            const t = this.tiempo[i] + dt;
            const p = t / this.duracion[i];
            if (p >= 1) {
                this.duracion[i] = 0;
                this.malla.setMatrixAt(i, MATRIZ_OCULTA);
                _color.setRGB(0, 0, 0);
                this.malla.setColorAt(i, _color);
                continue;
            }
            this.tiempo[i] = t;
            activos++;

            const lado = Math.max(0.001, salida(p) * this.radio[i] * LADO_POR_RADIO_ANILLO);
            _posicion.set(this.x[i], this.y[i], this.z[i]);
            _escala.set(lado, lado, 1);
            _matriz.compose(_posicion, ACOSTADO, _escala);
            this.malla.setMatrixAt(i, _matriz);

            // Aditivo: oscurecer el color equivale a bajar la opacidad.
            const f = (1 - p) * (1 - p);
            _color.setRGB(this.r[i] * f, this.g[i] * f, this.b[i] * f);
            this.malla.setColorAt(i, _color);
        }
        this.activos = activos;
        this.malla.instanceMatrix.needsUpdate = true;
        if (this.malla.instanceColor) {
            this.malla.instanceColor.needsUpdate = true;
        }
        this.malla.visible = activos > 0;
    }

    dispose(): void {
        this.escena.remove(this.malla);
        this.malla.dispose();
        this.geometria.dispose();
        this.material.dispose();
        this.textura.dispose();
    }
}

// ---------------------------------------------------------------------------------------------------------
// Rayos (láser)
// ---------------------------------------------------------------------------------------------------------

/** Rayos láser: cilindro exterior del color y núcleo blanco (dos `InstancedMesh`, dos llamadas de dibujo). */
export class Rayos {
    private readonly escena: THREE.Scene;
    private readonly max: number;
    private readonly geometria: THREE.CylinderGeometry;
    private readonly materialExterior: THREE.MeshBasicMaterial;
    private readonly materialNucleo: THREE.MeshBasicMaterial;
    private readonly exterior: THREE.InstancedMesh;
    private readonly nucleo: THREE.InstancedMesh;

    /** Por ranura: centro, rotación y largo (se calculan al lanzar; en el cuadro solo cambia el grosor). */
    private readonly centros: THREE.Vector3[] = [];
    private readonly giros: THREE.Quaternion[] = [];
    private readonly largo: Float32Array;
    private readonly grosor: Float32Array;
    private readonly r: Float32Array;
    private readonly g: Float32Array;
    private readonly b: Float32Array;
    private readonly tiempo: Float32Array;
    private readonly duracion: Float32Array;

    private cursor = 0;
    private activos = 0;

    constructor(escena: THREE.Scene, max = 8) {
        this.escena = escena;
        this.max = Math.max(1, Math.floor(max));
        const n = this.max;
        for (let i = 0; i < n; i++) {
            this.centros.push(new THREE.Vector3());
            this.giros.push(new THREE.Quaternion());
        }
        this.largo = new Float32Array(n);
        this.grosor = new Float32Array(n);
        this.r = new Float32Array(n);
        this.g = new Float32Array(n);
        this.b = new Float32Array(n);
        this.tiempo = new Float32Array(n);
        this.duracion = new Float32Array(n);

        // Cilindro de radio 1 y alto 1 centrado en el origen, a lo largo de +Y.
        this.geometria = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
        this.materialExterior = new THREE.MeshBasicMaterial({ fog: false, ...ADITIVO, opacity: 0.85 });
        this.materialNucleo = new THREE.MeshBasicMaterial({ fog: false, ...ADITIVO });
        this.exterior = crearInstanciado(this.geometria, this.materialExterior, n);
        this.nucleo = crearInstanciado(this.geometria, this.materialNucleo, n);
        this.exterior.renderOrder = 4;
        this.nucleo.renderOrder = 5;
        escena.add(this.exterior, this.nucleo);
    }

    lanzar(desde: THREE.Vector3, hasta: THREE.Vector3, color: number, grosor: number, duracion: number): void {
        _direccion.subVectors(hasta, desde);
        const largo = _direccion.length();
        if (largo < 1e-4) {
            return;
        }
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;
        if (this.duracion[i] <= 0) {
            this.activos++;
        }
        _direccion.divideScalar(largo);
        this.centros[i].addVectors(desde, hasta).multiplyScalar(0.5);
        this.giros[i].setFromUnitVectors(EJE_Y, _direccion);
        this.largo[i] = largo;
        this.grosor[i] = Math.max(0.005, grosor);
        _color.setHex(color);
        this.r[i] = _color.r * 1.8;
        this.g[i] = _color.g * 1.8;
        this.b[i] = _color.b * 1.8;
        this.tiempo[i] = 0;
        this.duracion[i] = Math.max(0.03, duracion);
        this.exterior.visible = true;
        this.nucleo.visible = true;
    }

    actualizar(dt: number): void {
        if (this.activos <= 0) {
            return;
        }
        let activos = 0;
        for (let i = 0; i < this.max; i++) {
            if (this.duracion[i] <= 0) {
                continue;
            }
            const t = this.tiempo[i] + dt;
            const p = t / this.duracion[i];
            if (p >= 1) {
                this.duracion[i] = 0;
                _color.setRGB(0, 0, 0);
                this.exterior.setMatrixAt(i, MATRIZ_OCULTA);
                this.nucleo.setMatrixAt(i, MATRIZ_OCULTA);
                this.exterior.setColorAt(i, _color);
                this.nucleo.setColorAt(i, _color);
                continue;
            }
            this.tiempo[i] = t;
            activos++;

            // Golpe inicial un poco más grueso; luego se adelgaza y se apaga.
            const golpe = p < 0.12 ? 1 + (1 - p / 0.12) * 0.35 : 1;
            const radio = this.grosor[i] * 0.5 * Math.sqrt(1 - p) * golpe;
            const f = (1 - p) * (1 - p);

            _escala.set(radio, this.largo[i], radio);
            _matriz.compose(this.centros[i], this.giros[i], _escala);
            this.exterior.setMatrixAt(i, _matriz);
            _color.setRGB(this.r[i] * f, this.g[i] * f, this.b[i] * f);
            this.exterior.setColorAt(i, _color);

            const rn = radio * 0.35;
            _escala.set(rn, this.largo[i], rn);
            _matriz.compose(this.centros[i], this.giros[i], _escala);
            this.nucleo.setMatrixAt(i, _matriz);
            _color.setRGB(2 * f, 2 * f, 2 * f);
            this.nucleo.setColorAt(i, _color);
        }
        this.activos = activos;
        Rayos.marcar(this.exterior, activos > 0);
        Rayos.marcar(this.nucleo, activos > 0);
    }

    /** Marca los búferes de instancias para subirlos a la GPU (sin crear arreglos por cuadro). */
    private static marcar(malla: THREE.InstancedMesh, visible: boolean): void {
        malla.instanceMatrix.needsUpdate = true;
        if (malla.instanceColor) {
            malla.instanceColor.needsUpdate = true;
        }
        malla.visible = visible;
    }

    dispose(): void {
        this.escena.remove(this.exterior, this.nucleo);
        this.exterior.dispose();
        this.nucleo.dispose();
        this.geometria.dispose();
        this.materialExterior.dispose();
        this.materialNucleo.dispose();
    }
}

// ---------------------------------------------------------------------------------------------------------
// Manchas en el piso
// ---------------------------------------------------------------------------------------------------------

/** Cuánto dura una mancha (s) y cuánto de ese tiempo tarda en encogerse al final. */
const VIDA_MANCHA = 7;
const ENCOGER_MANCHA = 1.4;
/** Aparición rápida (s): la mancha «salpica» al crecer. */
const APARECER_MANCHA = 0.12;
/** Intensidad del color (aditivo sobre el piso oscuro: tenue para no deslumbrar). */
const BRILLO_MANCHA = 0.55;

/** Manchas teñidas sobre el piso (un `InstancedMesh`); la más vieja se recicla al llenarse. */
export class Manchas {
    private readonly escena: THREE.Scene;
    private readonly max: number;
    private readonly textura: THREE.CanvasTexture;
    private readonly geometria: THREE.PlaneGeometry;
    private readonly material: THREE.MeshBasicMaterial;
    private readonly malla: THREE.InstancedMesh;

    private readonly x: Float32Array;
    private readonly y: Float32Array;
    private readonly z: Float32Array;
    private readonly giro: Float32Array;
    private readonly escalas: Float32Array;
    private readonly r: Float32Array;
    private readonly g: Float32Array;
    private readonly b: Float32Array;
    private readonly edad: Float32Array;
    private readonly activa: Uint8Array;

    private cursor = 0;
    private activos = 0;

    constructor(escena: THREE.Scene, max = 60) {
        this.escena = escena;
        this.max = Math.max(1, Math.floor(max));
        const n = this.max;
        this.x = new Float32Array(n);
        this.y = new Float32Array(n);
        this.z = new Float32Array(n);
        this.giro = new Float32Array(n);
        this.escalas = new Float32Array(n);
        this.r = new Float32Array(n);
        this.g = new Float32Array(n);
        this.b = new Float32Array(n);
        this.edad = new Float32Array(n);
        this.activa = new Uint8Array(n);

        this.textura = texturaMancha();
        this.geometria = new THREE.PlaneGeometry(1, 1);
        this.material = new THREE.MeshBasicMaterial({
            map: this.textura,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            ...ADITIVO,
        });
        this.malla = crearInstanciado(this.geometria, this.material, n);
        this.malla.renderOrder = 1;
        escena.add(this.malla);
    }

    poner(x: number, z: number, color: number, escala: number): void {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;
        if (!this.activa[i]) {
            this.activos++;
        }
        this.activa[i] = 1;
        _color.setHex(color);
        this.x[i] = x;
        // Altura apenas distinta por ranura para que no parpadeen entre sí.
        this.y[i] = 0.015 + (i % 8) * 0.0015;
        this.z[i] = z;
        this.giro[i] = Math.random() * Math.PI * 2;
        this.escalas[i] = Math.max(0.05, escala) * azar(0.85, 1.15);
        this.r[i] = _color.r * BRILLO_MANCHA;
        this.g[i] = _color.g * BRILLO_MANCHA;
        this.b[i] = _color.b * BRILLO_MANCHA;
        this.edad[i] = 0;
        this.malla.visible = true;
    }

    actualizar(dt: number): void {
        if (this.activos <= 0) {
            return;
        }
        let activos = 0;
        for (let i = 0; i < this.max; i++) {
            if (!this.activa[i]) {
                continue;
            }
            const edad = this.edad[i] + dt;
            if (edad >= VIDA_MANCHA) {
                this.activa[i] = 0;
                this.malla.setMatrixAt(i, MATRIZ_OCULTA);
                _color.setRGB(0, 0, 0);
                this.malla.setColorAt(i, _color);
                continue;
            }
            this.edad[i] = edad;
            activos++;

            let factor = 1;
            let f = 1;
            if (edad < APARECER_MANCHA) {
                factor = salida(edad / APARECER_MANCHA);
            } else if (edad > VIDA_MANCHA - ENCOGER_MANCHA) {
                const q = (VIDA_MANCHA - edad) / ENCOGER_MANCHA;
                factor = q;
                f = q;
            }
            const lado = Math.max(0.001, this.escalas[i] * factor);
            _giroPiso.setFromAxisAngle(EJE_Y, this.giro[i]).multiply(ACOSTADO);
            _posicion.set(this.x[i], this.y[i], this.z[i]);
            _escala.set(lado, lado, 1);
            _matriz.compose(_posicion, _giroPiso, _escala);
            this.malla.setMatrixAt(i, _matriz);
            _color.setRGB(this.r[i] * f, this.g[i] * f, this.b[i] * f);
            this.malla.setColorAt(i, _color);
        }
        this.activos = activos;
        this.malla.instanceMatrix.needsUpdate = true;
        if (this.malla.instanceColor) {
            this.malla.instanceColor.needsUpdate = true;
        }
        this.malla.visible = activos > 0;
    }

    dispose(): void {
        this.escena.remove(this.malla);
        this.malla.dispose();
        this.geometria.dispose();
        this.material.dispose();
        this.textura.dispose();
    }
}

// ---------------------------------------------------------------------------------------------------------
// Destellos (brillos aditivos de frente a la cámara)
// ---------------------------------------------------------------------------------------------------------

/**
 * Fogonazos, impactos y explosiones: un solo `InstancedMesh` de cuadros que miran a la cámara (una sola
 * llamada de dibujo aditiva, sin importar cuántos destellos haya). La ranura más vieja se recicla.
 */
export class Destellos {
    private readonly escena: THREE.Scene;
    private readonly max: number;
    private readonly textura: THREE.CanvasTexture;
    private readonly geometria: THREE.PlaneGeometry;
    private readonly material: THREE.ShaderMaterial;
    private readonly malla: THREE.InstancedMesh;

    private readonly x: Float32Array;
    private readonly y: Float32Array;
    private readonly z: Float32Array;
    private readonly r: Float32Array;
    private readonly g: Float32Array;
    private readonly b: Float32Array;
    private readonly giro: Float32Array;
    private readonly tamano: Float32Array;
    private readonly tiempo: Float32Array;
    private readonly duracion: Float32Array;

    private cursor = 0;
    private activos = 0;

    constructor(escena: THREE.Scene, max = 32) {
        this.escena = escena;
        this.max = Math.max(1, Math.floor(max));
        const n = this.max;
        this.x = new Float32Array(n);
        this.y = new Float32Array(n);
        this.z = new Float32Array(n);
        this.r = new Float32Array(n);
        this.g = new Float32Array(n);
        this.b = new Float32Array(n);
        this.giro = new Float32Array(n);
        this.tamano = new Float32Array(n);
        this.tiempo = new Float32Array(n);
        this.duracion = new Float32Array(n);

        this.textura = texturaBrillo();
        this.geometria = new THREE.PlaneGeometry(1, 1);
        this.material = materialBrillo(this.textura);
        this.malla = crearInstanciado(this.geometria, this.material, n);
        this.malla.renderOrder = 6;
        escena.add(this.malla);
    }

    lanzar(x: number, y: number, z: number, color: number, tamano: number, duracion: number): void {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;
        if (this.duracion[i] <= 0) {
            this.activos++;
        }
        _color.setHex(color);
        this.x[i] = x;
        this.y[i] = y;
        this.z[i] = z;
        // Un poco por encima de 1 para que el bloom lo agarre.
        this.r[i] = _color.r * 1.6;
        this.g[i] = _color.g * 1.6;
        this.b[i] = _color.b * 1.6;
        this.giro[i] = Math.random() * Math.PI * 2;
        this.tamano[i] = Math.max(0.001, tamano);
        this.tiempo[i] = 0;
        this.duracion[i] = Math.max(0.02, duracion);
        // La primera pose se escribe ya, por si se dibuja antes del siguiente `actualizar`.
        this.escribir(i, 0);
        this.marcar();
        this.malla.visible = true;
    }

    actualizar(dt: number): void {
        if (this.activos <= 0) {
            return;
        }
        let activos = 0;
        for (let i = 0; i < this.max; i++) {
            if (this.duracion[i] <= 0) {
                continue;
            }
            const t = this.tiempo[i] + dt;
            const p = t / this.duracion[i];
            if (p >= 1) {
                this.duracion[i] = 0;
                this.malla.setMatrixAt(i, MATRIZ_OCULTA);
                _color.setRGB(0, 0, 0);
                this.malla.setColorAt(i, _color);
                continue;
            }
            this.tiempo[i] = t;
            activos++;
            this.escribir(i, p);
        }
        this.activos = activos;
        this.marcar();
        this.malla.visible = activos > 0;
    }

    /** Pose de la ranura `i` en el avance `p` (0…1): crece rápido y se apaga. */
    private escribir(i: number, p: number): void {
        const lado = this.tamano[i] * (0.4 + 0.6 * salida(p));
        _posicion.set(this.x[i], this.y[i], this.z[i]);
        _rotacion.setFromAxisAngle(EJE_Z, this.giro[i]);
        _escala.set(lado, lado, 1);
        _matriz.compose(_posicion, _rotacion, _escala);
        this.malla.setMatrixAt(i, _matriz);
        // Aditivo: oscurecer el color equivale a bajar la opacidad.
        const f = (1 - p) * (1 - p);
        _color.setRGB(this.r[i] * f, this.g[i] * f, this.b[i] * f);
        this.malla.setColorAt(i, _color);
    }

    private marcar(): void {
        this.malla.instanceMatrix.needsUpdate = true;
        if (this.malla.instanceColor) {
            this.malla.instanceColor.needsUpdate = true;
        }
    }

    dispose(): void {
        this.escena.remove(this.malla);
        this.malla.dispose();
        this.geometria.dispose();
        this.material.dispose();
        this.textura.dispose();
    }
}
