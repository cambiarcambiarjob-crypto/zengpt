import cancionUrl from './musica-1.mp3';

export type Pista = 'cancion' | 'tetris' | 'polka';

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

type Pieza = { corchea: number; melodia: [number, number][]; pasos: number };
const PIEZAS: Record<'tetris' | 'polka', Pieza> = {
    tetris: { corchea: 60 / 150 / 2, melodia: MELODIA, pasos: 64 },
    polka: { corchea: 60 / 168 / 2, melodia: POLKA, pasos: 64 },
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
    private cancion: HTMLAudioElement;
    private temporizador: number | null = null;
    private corchea = 0;
    private siguiente = 0;
    private nota = 0;
    private notaFin = 0;
    private pista: Pista | null = null;
    private pieza: Pieza = PIEZAS.tetris;
    private pausada = false;
    silenciada = false;

    constructor() {
        // La canción empieza a descargarse en cuanto se abre el juego.
        this.cancion = new Audio(cancionUrl);
        this.cancion.loop = true;
        this.cancion.preload = 'auto';
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

        const fuente = this.ctx.createMediaElementSource(this.cancion);
        const volCancion = this.ctx.createGain();
        volCancion.gain.value = 0.55;
        fuente.connect(volCancion).connect(this.general);

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
            if (!this.pausada) void this.cancion.play().catch(() => {});
        } else {
            this.pieza = PIEZAS[pista];
            if (this.eco) this.eco.delayTime.value = this.pieza.corchea * 1.5;
            this.cancion.pause();
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
            this.cancion.pause();
            void this.ctx.suspend();
        } else {
            void this.ctx.resume();
            if (this.pista === 'cancion') void this.cancion.play().catch(() => {});
        }
    }

    alternarSilencio(): boolean {
        this.silenciada = !this.silenciada;
        if (this.general && this.ctx) this.general.gain.setTargetAtTime(this.silenciada ? 0 : 1, this.ctx.currentTime, 0.05);
        return this.silenciada;
    }

    detener(): void {
        this.pararTetris();
        this.cancion.pause();
        this.cancion.removeAttribute('src');
        this.cancion.load();
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
        const { corchea, melodia, pasos } = this.pieza;
        const esPolka = this.pieza === PIEZAS.polka;

        while (this.siguiente < this.ctx.currentTime + 0.15) {
            const t = this.siguiente;
            const paso = this.corchea % pasos;

            if (paso === this.notaFin) {
                const [nota, largo] = melodia[this.nota];
                if (nota) this.melodia(t, midi(nota), largo * corchea);
                this.notaFin = (this.notaFin + largo) % pasos;
                this.nota = (this.nota + 1) % melodia.length;
            }

            if (esPolka) {
                // «Um-pa» de polka: bajo en los tiempos y acorde corto en los contratiempos.
                const [raiz, menor] = POLKA_ACORDES[Math.floor(paso / 4)];
                if (paso % 2 === 0) this.bajo(t, midi(paso % 4 === 0 ? raiz : raiz + 7), corchea);
                else this.acorde(t, raiz + 24, menor, corchea);
                if (paso % 4 === 0) this.bombo(t);
            } else {
                const raiz = BAJO[Math.floor(paso / 8)];
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

    private melodia(t: number, frecuencia: number, largo: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = frecuencia;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
        g.gain.setValueAtTime(0.16, t + largo * 0.7);
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
