import cancionUrl from './musica-1.mp3';

export type Pista = 'cancion' | 'tetris' | 'polka' | 'caricatura' | 'robots';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/*
 * «Korobéiniki» (canción popular rusa, dominio público), la melodía que popularizó Tetris.
 * [nota MIDI, duración en corcheas]; 0 = silencio. 8 compases de 8 corcheas.
 */
const MELODIA: [number, number][] = [
    [76, 2], [71, 1], [72, 1], [74, 2], [72, 1], [71, 1],
    [69, 2], [69, 1], [72, 1], [76, 2], [74, 1], [72, 1],
    [71, 3], [72, 1], [74, 2], [76, 2],
    [72, 2], [69, 2], [69, 4],
    [0, 1], [74, 2], [77, 1], [81, 2], [79, 1], [77, 1],
    [76, 3], [72, 1], [76, 2], [74, 1], [72, 1],
    [71, 2], [71, 1], [72, 1], [74, 2], [76, 2],
    [72, 2], [69, 2], [69, 2], [0, 2],
];
// Raíz del bajo por compás (Mi, La, Mi, La, Re, Do, Mi, La).
const BAJO = [40, 45, 40, 45, 38, 36, 40, 45];

/*
 * Polka finlandesa tradicional («Ievan polkka», melodía popular) en versión chiptune, en La menor.
 * Cuatro frases de 16 corcheas (4 compases de 2/4 cada una).
 */
const POLKA: [number, number][] = [
    [64, 1], [69, 1], [69, 1], [71, 1], [72, 1], [71, 1], [69, 1], [69, 1], [67, 1], [69, 1], [71, 1], [67, 5],
    [64, 1], [69, 1], [69, 1], [71, 1], [72, 1], [71, 1], [69, 1], [67, 1], [64, 8],
    [72, 1], [74, 1], [76, 1], [76, 1], [74, 1], [72, 1], [71, 1], [72, 1], [74, 1], [71, 7],
    [72, 1], [74, 1], [76, 1], [76, 1], [74, 1], [72, 1], [71, 1], [72, 1], [69, 8],
];
// Acorde por compás de 2/4: [raíz MIDI del bajo, menor?]. Am Am Em Em · Am Am E Am · C C G G · C G E Am
const POLKA_ACORDES: [number, boolean][] = [
    [45, true], [45, true], [40, true], [40, true],
    [45, true], [45, true], [40, false], [45, true],
    [48, false], [48, false], [43, false], [43, false],
    [48, false], [43, false], [40, false], [45, true],
];

/*
 * Composiciones ORIGINALES para el juego (no copian ninguna canción con derechos):
 * «caricatura»: rock de 8 bits con aire de caricatura ochentera, en Mi menor.
 * «robots»: himno épico con galope de bajo, en Do menor.
 */
const CARICATURA: [number, number][] = [
    [76, 1], [76, 1], [79, 1], [76, 1], [81, 2], [79, 1], [76, 1],
    [74, 1], [76, 1], [74, 1], [71, 1], [74, 2], [76, 2],
    [76, 1], [76, 1], [79, 1], [76, 1], [81, 2], [83, 1], [81, 1],
    [79, 2], [76, 2], [74, 1], [76, 3],
    [72, 1], [72, 1], [76, 1], [72, 1], [79, 2], [81, 1], [79, 1],
    [74, 1], [74, 1], [78, 1], [74, 1], [81, 2], [79, 1], [78, 1],
    [76, 1], [79, 1], [83, 1], [88, 1], [86, 2], [83, 2],
    [88, 4], [83, 2], [0, 2],
];
const CARICATURA_BAJO = [40, 40, 40, 40, 36, 38, 40, 40];

const ROBOTS: [number, number][] = [
    [72, 2], [79, 2], [77, 1], [75, 1], [74, 1], [75, 1],
    [72, 6], [0, 2],
    [68, 2], [75, 2], [74, 1], [72, 1], [70, 1], [72, 1],
    [67, 6], [0, 2],
    [72, 2], [79, 2], [80, 2], [79, 1], [77, 1],
    [75, 2], [77, 2], [79, 4],
    [80, 2], [79, 1], [77, 1], [75, 2], [74, 2],
    [72, 6], [0, 2],
];
const ROBOTS_BAJO = [36, 36, 32, 31, 36, 39, 32, 31];

type Ritmo = 'tetris' | 'polka' | 'rock' | 'epica';
type Pieza = { corchea: number; melodia: [number, number][]; pasos: number; ritmo: Ritmo; bajo: number[]; octava?: boolean };
const PIEZAS: Record<Exclude<Pista, 'cancion'>, Pieza> = {
    tetris: { corchea: 60 / 150 / 2, melodia: MELODIA, pasos: 64, ritmo: 'tetris', bajo: BAJO },
    polka: { corchea: 60 / 168 / 2, melodia: POLKA, pasos: 64, ritmo: 'polka', bajo: [] },
    caricatura: { corchea: 60 / 152 / 2, melodia: CARICATURA, pasos: 64, ritmo: 'rock', bajo: CARICATURA_BAJO },
    robots: { corchea: 60 / 132 / 2, melodia: ROBOTS, pasos: 64, ritmo: 'epica', bajo: ROBOTS_BAJO, octava: true },
};

/**
 * Música del easter egg: la canción (archivo, en bucle) y dos piezas chiptune sintetizadas con Web Audio (estilo
 * Tetris y polka),
 * más los efectos de sonido. Todo pasa por un volumen general para silenciar con un botón.
 */
export class Musica {
    private ctx: AudioContext | null = null;
    private general: GainNode | null = null;
    private sinte: GainNode | null = null;
    private eco: DelayNode | null = null;
    private ruido: AudioBuffer | null = null;
    private cancion: HTMLAudioElement | null = null;
    private ultimoEfecto: Record<string, number> = {};
    private temporizador: number | null = null;
    private corchea = 0;
    private siguiente = 0;
    private nota = 0;
    private notaFin = 0;
    private pista: Pista | null = null;
    private pieza: Pieza = PIEZAS.tetris;
    private pausada = false;
    silenciada = false;

    /** `precargarCancion`: la canción (5 MB) empieza a descargarse ya; si no, solo cuando se pida. */
    constructor(precargarCancion = true) {
        if (precargarCancion) this.prepararCancion();
    }

    private prepararCancion(): HTMLAudioElement {
        if (!this.cancion) {
            this.cancion = new Audio(cancionUrl);
            this.cancion.loop = true;
            this.cancion.preload = 'auto';
            if (this.ctx) this.conectarCancion();
        }
        return this.cancion;
    }

    private conectarCancion(): void {
        if (!this.ctx || !this.general || !this.cancion) return;
        const fuente = this.ctx.createMediaElementSource(this.cancion);
        const volCancion = this.ctx.createGain();
        volCancion.gain.value = 0.55;
        fuente.connect(volCancion).connect(this.general);
    }

    /** Debe llamarse desde un gesto (tecla o toque): los navegadores no dejan sonar sin uno. */
    iniciar(): void {
        if (this.ctx) {
            void this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;

        this.ctx = new Ctx();
        this.general = this.ctx.createGain();
        this.general.gain.value = this.silenciada ? 0 : 1;
        this.general.connect(this.ctx.destination);

        this.conectarCancion();

        this.sinte = this.ctx.createGain();
        this.sinte.gain.value = 0.3;
        this.sinte.connect(this.general);

        this.eco = this.ctx.createDelay(1);
        this.eco.delayTime.value = PIEZAS.tetris.corchea * 1.5;
        const retro = this.ctx.createGain();
        retro.gain.value = 0.25;
        this.eco.connect(retro).connect(this.eco);
        this.eco.connect(this.sinte);

        this.ruido = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
        const datos = this.ruido.getChannelData(0);
        for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    }

    /** Cambia entre la canción y la pieza estilo Tetris. */
    tocar(pista: Pista): void {
        if (!this.ctx || this.pista === pista) return;
        this.pista = pista;

        if (pista === 'cancion') {
            this.pararTetris();
            const cancion = this.prepararCancion();
            if (!this.pausada) void cancion.play().catch(() => {});
        } else {
            this.pieza = PIEZAS[pista];
            if (this.eco) this.eco.delayTime.value = this.pieza.corchea * 1.5;
            this.cancion?.pause();
            this.corchea = 0;
            this.nota = 0;
            this.notaFin = 0;
            this.siguiente = this.ctx.currentTime + 0.1;
            if (this.temporizador === null) this.temporizador = window.setInterval(() => this.programar(), 25);
        }
    }

    pausar(pausada: boolean): void {
        this.pausada = pausada;
        if (!this.ctx) return;
        if (pausada) {
            this.cancion?.pause();
            void this.ctx.suspend();
        } else {
            void this.ctx.resume();
            if (this.pista === 'cancion') void this.cancion?.play().catch(() => {});
        }
    }

    alternarSilencio(): boolean {
        this.silenciada = !this.silenciada;
        if (this.general && this.ctx) this.general.gain.setTargetAtTime(this.silenciada ? 0 : 1, this.ctx.currentTime, 0.05);
        return this.silenciada;
    }

    detener(): void {
        this.pararTetris();
        if (this.cancion) {
            this.cancion.pause();
            this.cancion.removeAttribute('src');
            this.cancion.load();
        }
        void this.ctx?.close();
        this.ctx = null;
        this.pista = null;
    }

    /** Sonido al comer (más agudo en niveles altos). */
    comer(nivel: number): void {
        if (!this.ctx || !this.general) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(660 + nivel * 40, t);
        o.frequency.exponentialRampToValueAtTime(1320 + nivel * 60, t + 0.08);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(this.general);
        o.start(t);
        o.stop(t + 0.13);
    }

    /** Fanfarria corta al subir de nivel. */
    subir(): void {
        if (!this.ctx || !this.general) return;
        const t = this.ctx.currentTime;
        [72, 76, 79, 84].forEach((n, i) => {
            const o = this.ctx!.createOscillator();
            const g = this.ctx!.createGain();
            o.type = 'square';
            o.frequency.value = midi(n);
            g.gain.setValueAtTime(0.1, t + i * 0.07);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.16);
            o.connect(g).connect(this.general!);
            o.start(t + i * 0.07);
            o.stop(t + i * 0.07 + 0.17);
        });
    }

    /**
     * Efectos del juego de zombies. Cada tipo tiene un mínimo de tiempo entre uno y otro para no saturar
     * (p. ej. muchas balas por segundo).
     */
    efecto(tipo: 'disparo' | 'perdigon' | 'cañon' | 'impacto' | 'muerte' | 'dolor' | 'rugido' | 'laser' | 'curar' | 'torreta' | 'dash' | 'billetes' | 'oleada' | 'revivir', volumen = 1): void {
        if (!this.ctx || !this.general) return;
        const t = this.ctx.currentTime;
        const minimo = { disparo: 0.05, perdigon: 0.08, cañon: 0.1, impacto: 0.04, muerte: 0.05 }[tipo as string] ?? 0.03;
        if (t - (this.ultimoEfecto[tipo] ?? -1) < minimo) return;
        this.ultimoEfecto[tipo] = t;

        const tono = (forma: OscillatorType, de: number, a: number, largo: number, vol: number, retraso = 0) => {
            const o = this.ctx!.createOscillator();
            const g = this.ctx!.createGain();
            o.type = forma;
            o.frequency.setValueAtTime(de, t + retraso);
            o.frequency.exponentialRampToValueAtTime(Math.max(20, a), t + retraso + largo);
            g.gain.setValueAtTime(vol * volumen, t + retraso);
            g.gain.exponentialRampToValueAtTime(0.0001, t + retraso + largo);
            o.connect(g).connect(this.general!);
            o.start(t + retraso);
            o.stop(t + retraso + largo + 0.02);
        };
        const ruido = (corte: number, largo: number, vol: number, tipoFiltro: BiquadFilterType = 'lowpass') => {
            if (!this.ruido) return;
            const f = this.ctx!.createBufferSource();
            f.buffer = this.ruido;
            const filtro = this.ctx!.createBiquadFilter();
            filtro.type = tipoFiltro;
            filtro.frequency.value = corte;
            const g = this.ctx!.createGain();
            g.gain.setValueAtTime(vol * volumen, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + largo);
            f.connect(filtro).connect(g).connect(this.general!);
            f.start(t);
            f.stop(t + Math.min(0.29, largo + 0.02));
        };

        switch (tipo) {
            case 'disparo':
                tono('square', 900, 260, 0.06, 0.05);
                break;
            case 'perdigon':
                ruido(2200, 0.12, 0.16);
                tono('square', 300, 90, 0.08, 0.05);
                break;
            case 'cañon':
                ruido(900, 0.2, 0.2);
                tono('sawtooth', 160, 45, 0.18, 0.08);
                break;
            case 'impacto':
                tono('triangle', 420, 160, 0.05, 0.05);
                break;
            case 'muerte':
                ruido(700, 0.16, 0.12);
                tono('sawtooth', 220, 55, 0.18, 0.05);
                break;
            case 'dolor':
                tono('sawtooth', 200, 80, 0.2, 0.12);
                break;
            case 'rugido':
                ruido(500, 0.28, 0.3);
                tono('sawtooth', 110, 40, 0.5, 0.18);
                break;
            case 'laser':
                tono('sawtooth', 1800, 300, 0.35, 0.1);
                tono('square', 900, 150, 0.35, 0.05);
                break;
            case 'curar':
                [0, 4, 7, 12].forEach((n, i) => tono('triangle', midi(72 + n), midi(72 + n), 0.18, 0.08, i * 0.06));
                break;
            case 'torreta':
                tono('square', 300, 600, 0.12, 0.08);
                tono('square', 600, 900, 0.1, 0.06, 0.1);
                break;
            case 'dash':
                ruido(4000, 0.18, 0.14, 'highpass');
                break;
            case 'billetes':
                for (let i = 0; i < 5; i++) tono('square', 1200 + i * 200, 1600 + i * 200, 0.05, 0.05, i * 0.03);
                break;
            case 'oleada':
                [0, 3, 7, 12].forEach((n, i) => tono('square', midi(57 + n), midi(57 + n), 0.22, 0.08, i * 0.09));
                break;
            case 'revivir':
                [0, 7, 12, 19].forEach((n, i) => tono('triangle', midi(64 + n), midi(64 + n), 0.2, 0.09, i * 0.07));
                break;
        }
    }

    perder(): void {
        if (!this.ctx || !this.general) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(440, t);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.7);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        o.connect(g).connect(this.general);
        o.start(t);
        o.stop(t + 0.8);
    }

    private pararTetris(): void {
        if (this.temporizador !== null) window.clearInterval(this.temporizador);
        this.temporizador = null;
    }

    /** Programa por adelantado las corcheas de la pieza sintetizada (Tetris o polka). */
    private programar(): void {
        if (!this.ctx) return;
        const { corchea, melodia, pasos, ritmo, bajo, octava } = this.pieza;

        while (this.siguiente < this.ctx.currentTime + 0.15) {
            const t = this.siguiente;
            const paso = this.corchea % pasos;

            if (paso === this.notaFin) {
                const [nota, largo] = melodia[this.nota];
                if (nota) {
                    this.melodia(t, midi(nota), largo * corchea);
                    // El himno épico dobla la melodía una octava abajo para sonar más grande.
                    if (octava) this.melodia(t, midi(nota - 12), largo * corchea, 0.08);
                }
                this.notaFin = (this.notaFin + largo) % pasos;
                this.nota = (this.nota + 1) % melodia.length;
            }

            if (ritmo === 'polka') {
                // «Um-pa» de polka: bajo en los tiempos y acorde corto en los contratiempos.
                const [raiz, menor] = POLKA_ACORDES[Math.floor(paso / 4)];
                if (paso % 2 === 0) this.bajo(t, midi(paso % 4 === 0 ? raiz : raiz + 7), corchea);
                else this.acorde(t, raiz + 24, menor, corchea);
                if (paso % 4 === 0) this.bombo(t);
            } else if (ritmo === 'rock') {
                // Bajo de rock a corcheas, bombo en 1 y 3, tarola en 2 y 4, hi-hat constante.
                const raiz = bajo[Math.floor(paso / 8)];
                this.bajo(t, midi(paso % 8 === 6 ? raiz + 12 : raiz), corchea);
                if (paso % 8 === 0 || paso % 8 === 4) this.bombo(t);
                if (paso % 8 === 2 || paso % 8 === 6) this.tarola(t);
                this.platillo(t);
            } else if (ritmo === 'epica') {
                // Galope de bajo y tambores grandes.
                const raiz = bajo[Math.floor(paso / 8)];
                this.bajo(t, midi(paso % 4 === 3 ? raiz + 7 : raiz), corchea);
                if (paso % 8 === 0 || paso % 8 === 3 || paso % 8 === 4) this.bombo(t);
                if (paso % 8 === 2 || paso % 8 === 6) this.tarola(t);
            } else {
                const raiz = bajo[Math.floor(paso / 8)];
                this.bajo(t, midi(paso % 2 === 0 ? raiz : raiz + 12), corchea);
                if (paso % 4 === 0) this.bombo(t);
                if (paso % 2 === 1) this.platillo(t);
            }

            this.siguiente += corchea;
            this.corchea += 1;
        }
    }

    /** Acorde corto (tríada) en onda cuadrada suave: el «pa» de la polka. */
    private acorde(t: number, raiz: number, menor: boolean, largo: number): void {
        const ctx = this.ctx!;
        for (const intervalo of [0, menor ? 3 : 4, 7]) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'square';
            o.frequency.value = midi(raiz + intervalo);
            g.gain.setValueAtTime(0.035, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + largo * 0.6);
            o.connect(g).connect(this.sinte!);
            o.start(t);
            o.stop(t + largo * 0.65);
        }
    }

    private melodia(t: number, frecuencia: number, largo: number, volumen = 0.16): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = frecuencia;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
        g.gain.setValueAtTime(volumen, t + largo * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + largo * 0.95);
        o.connect(g);
        g.connect(this.sinte!);
        g.connect(this.eco!);
        o.start(t);
        o.stop(t + largo);
    }

    private bajo(t: number, frecuencia: number, corchea: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = frecuencia;
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + corchea * 0.9);
        o.connect(g).connect(this.sinte!);
        o.start(t);
        o.stop(t + corchea);
    }

    private bombo(t: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g).connect(this.sinte!);
        o.start(t);
        o.stop(t + 0.22);
    }

    /** Tarola: ruido con filtro de banda y un golpe tonal corto. */
    private tarola(t: number): void {
        const ctx = this.ctx!;
        const f = ctx.createBufferSource();
        f.buffer = this.ruido;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'bandpass';
        filtro.frequency.value = 1800;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        f.connect(filtro).connect(g).connect(this.sinte!);
        f.start(t);
        f.stop(t + 0.13);
    }

    private platillo(t: number): void {
        const ctx = this.ctx!;
        const f = ctx.createBufferSource();
        f.buffer = this.ruido;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'highpass';
        filtro.frequency.value = 8000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        f.connect(filtro).connect(g).connect(this.sinte!);
        f.start(t);
        f.stop(t + 0.05);
    }
}
