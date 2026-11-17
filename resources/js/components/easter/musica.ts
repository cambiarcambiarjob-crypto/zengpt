import cancionUrl from './musica-1.mp3';

export type Pista = 'cancion' | 'tetris';

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

/**
 * Música del easter egg: la canción (archivo, en bucle) y una pieza estilo Tetris sintetizada con Web Audio,
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
    private pausada = false;
    silenciada = false;

    private static readonly CORCHEA = 60 / 150 / 2;

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
        this.eco.delayTime.value = Musica.CORCHEA * 1.5;
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

    /** Programa por adelantado las corcheas de la pieza estilo Tetris. */
    private programar(): void {
        if (!this.ctx) return;
        while (this.siguiente < this.ctx.currentTime + 0.15) {
            const t = this.siguiente;
            const paso = this.corchea % 64;

            if (paso === this.notaFin) {
                const [nota, largo] = MELODIA[this.nota];
                if (nota) this.melodia(t, midi(nota), largo * Musica.CORCHEA);
                this.notaFin = (this.notaFin + largo) % 64;
                this.nota = (this.nota + 1) % MELODIA.length;
            }

            const raiz = BAJO[Math.floor(paso / 8)];
            this.bajo(t, midi(paso % 2 === 0 ? raiz : raiz + 12));
            if (paso % 4 === 0) this.bombo(t);
            if (paso % 2 === 1) this.platillo(t);

            this.siguiente += Musica.CORCHEA;
            this.corchea += 1;
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

    private bajo(t: number, frecuencia: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = frecuencia;
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + Musica.CORCHEA * 0.9);
        o.connect(g).connect(this.sinte!);
        o.start(t);
        o.stop(t + Musica.CORCHEA);
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
