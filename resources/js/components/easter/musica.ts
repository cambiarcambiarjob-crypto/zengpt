/**
 * Música electrónica original para el easter egg, sintetizada en vivo con Web Audio (sin archivos):
 * bombo a negras, hi-hat a contratiempo, bajo y arpegio sobre Lam–Fa–Do–Sol a 128 BPM, con eco.
 */
export class Musica {
    private ctx: AudioContext | null = null;
    private maestro: GainNode | null = null;
    private eco: DelayNode | null = null;
    private ruido: AudioBuffer | null = null;
    private temporizador: number | null = null;
    private paso = 0;
    private siguiente = 0;
    private volumen = 0.2;
    silenciada = false;

    private static readonly BPM = 128;
    // Raíces de los acordes (Hz): La2, Fa2, Do3, Sol2. Cuatro compases de 16 semicorcheas.
    private static readonly RAICES = [110, 87.31, 130.81, 98];
    // Arpegio en semitonos sobre la raíz (dos octavas arriba).
    private static readonly ARPEGIO = [0, 7, 12, 15, 19, 15, 12, 7, 0, 7, 12, 19, 24, 19, 12, 7];
    private static readonly MAYOR = [0, 7, 12, 16, 19, 16, 12, 7, 0, 7, 12, 19, 24, 19, 12, 7];

    iniciar(): void {
        if (this.ctx) {
            void this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;

        this.ctx = new Ctx();
        this.maestro = this.ctx.createGain();
        this.maestro.gain.value = this.silenciada ? 0 : this.volumen;
        this.maestro.connect(this.ctx.destination);

        // Eco a 3/16 con retroalimentación suave.
        this.eco = this.ctx.createDelay(1);
        this.eco.delayTime.value = (60 / Musica.BPM) * 0.75;
        const retro = this.ctx.createGain();
        retro.gain.value = 0.32;
        this.eco.connect(retro).connect(this.eco);
        this.eco.connect(this.maestro);

        // Ruido blanco para los platillos.
        this.ruido = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
        const datos = this.ruido.getChannelData(0);
        for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;

        this.siguiente = this.ctx.currentTime + 0.08;
        this.temporizador = window.setInterval(() => this.programar(), 25);
    }

    detener(): void {
        if (this.temporizador !== null) window.clearInterval(this.temporizador);
        this.temporizador = null;
        void this.ctx?.close();
        this.ctx = null;
    }

    pausar(pausada: boolean): void {
        if (!this.ctx) return;
        void (pausada ? this.ctx.suspend() : this.ctx.resume());
    }

    alternarSilencio(): boolean {
        this.silenciada = !this.silenciada;
        if (this.maestro && this.ctx) this.maestro.gain.setTargetAtTime(this.silenciada ? 0 : this.volumen, this.ctx.currentTime, 0.05);
        return this.silenciada;
    }

    /** Sonido corto al comer (más agudo en niveles altos). */
    comer(nivel: number): void {
        if (!this.ctx || !this.maestro) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(660 + nivel * 40, t);
        o.frequency.exponentialRampToValueAtTime(1320 + nivel * 60, t + 0.08);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(this.maestro);
        o.start(t);
        o.stop(t + 0.13);
    }

    /** Caída al perder. */
    perder(): void {
        if (!this.ctx || !this.maestro) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(440, t);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.7);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        o.connect(g).connect(this.maestro);
        o.start(t);
        o.stop(t + 0.8);
    }

    private programar(): void {
        if (!this.ctx) return;
        const semicorchea = 60 / Musica.BPM / 4;
        while (this.siguiente < this.ctx.currentTime + 0.12) {
            this.tocarPaso(this.paso, this.siguiente);
            this.siguiente += semicorchea;
            this.paso = (this.paso + 1) % 64;
        }
    }

    private tocarPaso(paso: number, t: number): void {
        const compas = Math.floor(paso / 16);
        const p = paso % 16;
        const raiz = Musica.RAICES[compas];

        if (p % 4 === 0) this.bombo(t);
        if (p % 4 === 2) this.platillo(t, 0.09);
        if (p % 8 === 4) this.platillo(t, 0.05, 0.12);
        // Bajo en contratiempo (la nota de cada octava sube en el último tiempo).
        if (p % 2 === 1) this.bajo(t, p >= 12 ? raiz * 2 : raiz);
        const escala = compas === 0 ? Musica.ARPEGIO : Musica.MAYOR;
        this.arpegio(t, raiz * 2 * Math.pow(2, escala[p] / 12));
    }

    private bombo(t: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g).connect(this.maestro!);
        o.start(t);
        o.stop(t + 0.32);
    }

    private platillo(t: number, volumen: number, largo = 0.05): void {
        const ctx = this.ctx!;
        const fuente = ctx.createBufferSource();
        fuente.buffer = this.ruido;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'highpass';
        filtro.frequency.value = 7000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(volumen, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + largo);
        fuente.connect(filtro).connect(g).connect(this.maestro!);
        fuente.start(t);
        fuente.stop(t + largo + 0.02);
    }

    private bajo(t: number, frecuencia: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const filtro = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = frecuencia;
        filtro.type = 'lowpass';
        filtro.frequency.setValueAtTime(900, t);
        filtro.frequency.exponentialRampToValueAtTime(180, t + 0.12);
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        o.connect(filtro).connect(g).connect(this.maestro!);
        o.start(t);
        o.stop(t + 0.14);
    }

    private arpegio(t: number, frecuencia: number): void {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = frecuencia;
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        o.connect(g);
        g.connect(this.maestro!);
        g.connect(this.eco!);
        o.start(t);
        o.stop(t + 0.12);
    }
}
