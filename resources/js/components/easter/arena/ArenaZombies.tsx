import { useCallback, useEffect, useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import GradientText from '@/components/reactbits/GradientText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import StarBorder from '@/components/reactbits/StarBorder';
import { usePagina } from '@/lib/pagina';
import { Musica } from '../musica';
import type { ControlJuego, Hud, JugadorPartida, Resumen } from './tipos';
import { PERSONAJES, personaje, type IdPersonaje } from './personajes';
import { entrarSala, type Miembro, type Sala } from './red';

/**
 * Easter egg «zombies»: shooter cooperativo en 3D (tercera persona) para 2 en línea (o solo). Sala para elegir
 * personaje, pantalla de juego con Three.js (se descarga aparte, solo al jugar) y resultados. El tiempo real va
 * por Laravel Reverb.
 */

type Estado = 'conectando' | 'sala' | 'jugando' | 'fin';
type Lobby = { id: string; personaje: IdPersonaje; listo: boolean };

const ELEGIDO = 'zengpt.zombies.personaje';
const RECORD = 'zengpt.zombies.record';
const leer = (k: string) => {
    try {
        return localStorage.getItem(k);
    } catch {
        return null;
    }
};
const guardar = (k: string, v: string) => {
    try {
        localStorage.setItem(k, v);
    } catch {
        // Sin almacenamiento: no pasa nada.
    }
};
const neon = (color: string) => ({ color, textShadow: `0 0 6px ${color}, 0 0 16px ${color}` });
const fuente = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };
const esTactil = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export default function ArenaZombies({ alCerrar }: { alCerrar: () => void }) {
    const { auth } = usePagina();
    const yo = { id: String(auth.user?.id ?? 'yo'), nombre: auth.user?.name ?? 'Yo' };

    const [estado, setEstado] = useState<Estado>('conectando');
    const [sala, setSala] = useState<Sala | null>(null);
    const [miembros, setMiembros] = useState<Miembro[]>([]);
    const [elegido, setElegido] = useState<IdPersonaje>(() => (leer(ELEGIDO) as IdPersonaje | null) ?? 'leon');
    const [listo, setListo] = useState(false);
    const [otroLobby, setOtroLobby] = useState<Lobby | null>(null);
    const [hud, setHud] = useState<Hud | null>(null);
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [record, setRecord] = useState(() => Number(leer(RECORD) ?? 0));

    const contenedor = useRef<HTMLDivElement>(null);
    const control = useRef<ControlJuego | null>(null);
    const musica = useRef<Musica | null>(null);
    const estadoRef = useRef(estado);
    estadoRef.current = estado;

    const otroMiembro = miembros.find((m) => m.id !== yo.id) ?? null;

    // ——— Conexión a la sala ——————————————————————————————————————————————————
    useEffect(() => {
        let vivo = true;
        let laSala: Sala | null = null;
        entrarSala()
            .then((s) => {
                if (!vivo) {
                    s?.salir();
                    return;
                }
                laSala = s;
                setSala(s);
                setMiembros(s?.miembros() ?? []);
                s?.alCambiarMiembros(setMiembros);
                setEstado('sala');
            })
            .catch(() => vivo && setEstado('sala'));

        return () => {
            vivo = false;
            laSala?.salir();
        };
    }, []);

    // Avisar al compañero de mi elección (y repetirlo cuando él entra).
    useEffect(() => {
        if (!sala || estado !== 'sala') return;
        sala.enviar('lobby', { id: yo.id, personaje: elegido, listo } satisfies Lobby);
    }, [sala, estado, elegido, listo, otroMiembro?.id, yo.id]);

    useEffect(() => {
        if (!otroMiembro) setOtroLobby(null);
    }, [otroMiembro]);

    const salirDelJuego = useCallback(() => {
        control.current?.destruir();
        control.current = null;
        musica.current?.detener();
        musica.current = null;
    }, []);

    const cerrar = useCallback(() => {
        salirDelJuego();
        alCerrar();
    }, [alCerrar, salirDelJuego]);

    // ——— Empezar partida ———————————————————————————————————————————————————
    const empezar = useCallback(
        async (modo: 'solo' | 'anfitrion' | 'invitado', jugadorYo: JugadorPartida, otro?: JugadorPartida) => {
            if (!musica.current) {
                musica.current = new Musica(false);
                musica.current.silenciada = leer('zengpt.snake.silencio') === '1';
            }
            musica.current.iniciar();
            setResumen(null);
            setHud(null);
            setEstado('jugando');
            await new Promise((r) => requestAnimationFrame(r));
            const { crearJuego } = await import('./escena3d');
            if (!contenedor.current || estadoRef.current !== 'jugando') return;
            control.current?.destruir();
            control.current = crearJuego(contenedor.current, {
                modo,
                yo: jugadorYo,
                otro,
                sala,
                musica: musica.current,
                calidad: esTactil() || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'baja' : 'alta',
                alHud: setHud,
                alTerminar: (r) => {
                    setResumen(r);
                    setEstado('fin');
                    setListo(false);
                    if (r.puntos > Number(leer(RECORD) ?? 0)) {
                        guardar(RECORD, String(r.puntos));
                        setRecord(r.puntos);
                    }
                },
            });
        },
        [sala],
    );

    // Mensajes de la sala: elección del compañero e inicio de la partida.
    useEffect(() => {
        if (!sala) return;
        sala.escuchar<Lobby>('lobby', (l) => l.id !== yo.id && setOtroLobby(l));
        sala.escuchar<{ anfitrion: string; jugadores: JugadorPartida[] }>('inicio', (m) => {
            if (m.anfitrion === yo.id) return;
            const mio = m.jugadores.find((j) => j.id === yo.id);
            const suyo = m.jugadores.find((j) => j.id !== yo.id);
            if (mio && suyo) void empezar('invitado', mio, suyo);
        });
        // Solo la primera vez: los oyentes viven lo que viva la sala.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala]);

    // Los dos listos: arranca el de id menor (anfitrión).
    useEffect(() => {
        if (estado !== 'sala' || !sala || !listo || !otroLobby?.listo || !otroMiembro) return;
        const soyAnfitrion = Number(yo.id) < Number(otroMiembro.id);
        if (!soyAnfitrion) return;
        const jugadorYo = { id: yo.id, nombre: yo.nombre, personaje: elegido };
        const otro = { id: otroMiembro.id, nombre: otroMiembro.nombre, personaje: otroLobby.personaje };
        sala.enviar('inicio', { anfitrion: yo.id, jugadores: [jugadorYo, otro] });
        void empezar('anfitrion', jugadorYo, otro);
    }, [estado, sala, listo, otroLobby, otroMiembro, yo.id, yo.nombre, elegido, empezar]);

    // Si el compañero se va a mitad de la partida.
    const habiaOtro = useRef(false);
    useEffect(() => {
        if (estado === 'jugando' && habiaOtro.current && !otroMiembro) {
            control.current?.companeroSalio();
            setAviso('Tu compañero salió de la partida.');
            window.setTimeout(() => setAviso(null), 4000);
        }
        habiaOtro.current = Boolean(otroMiembro);
    }, [estado, otroMiembro]);

    useEffect(() => {
        const tecla = (e: KeyboardEvent) => {
            // Durante la partida, Esc solo libera el mouse (lo hace el navegador); no cierra el juego.
            if (e.key === 'Escape' && estadoRef.current !== 'jugando') cerrar();
            if (e.key.toLowerCase() === 'm' && musica.current) {
                const nuevo = musica.current.alternarSilencio();
                guardar('zengpt.snake.silencio', nuevo ? '1' : '0');
            }
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [cerrar]);

    useEffect(() => () => salirDelJuego(), [salirDelJuego]);

    const elegir = (id: IdPersonaje) => {
        setElegido(id);
        setListo(false);
        guardar(ELEGIDO, id);
    };

    const volverASala = () => {
        salirDelJuego();
        setEstado('sala');
        setResumen(null);
    };

    // ——— Pantallas ——————————————————————————————————————————————————————————
    return (
        <div className="fixed inset-0 z-[100] bg-[#020108] text-white" style={fuente} role="dialog" aria-modal="true" aria-label="Juego de zombies">
            <div ref={contenedor} className="absolute inset-0" />

            {estado === 'conectando' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <GradientText colors={['#3dff7a', '#22e5ff', '#3dff7a']} animationSpeed={2} className="text-3xl font-bold tracking-[0.3em]">
                        CONECTANDO…
                    </GradientText>
                </div>
            )}

            {estado === 'sala' && (
                <SalaJuego
                    yo={yo}
                    otro={otroMiembro}
                    otroLobby={otroLobby}
                    enLinea={sala !== null}
                    elegido={elegido}
                    listo={listo}
                    record={record}
                    alElegir={elegir}
                    alListo={() => setListo((l) => !l)}
                    alSolo={() => void empezar('solo', { id: yo.id, nombre: yo.nombre, personaje: elegido })}
                />
            )}

            {estado === 'jugando' && hud && <Pantalla hud={hud} yo={{ ...yo, personaje: elegido }} control={control} />}

            {estado === 'fin' && resumen && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md border border-[#3dff7a]/40 bg-[#05040f]/90 p-6 text-center shadow-[0_0_40px_rgba(61,255,122,0.25)]">
                        <GradientText colors={['#ff3d5e', '#ff3dd8', '#ff3d5e']} animationSpeed={2} glow={1} className="text-3xl font-bold tracking-[0.2em] sm:text-4xl">
                            FIN DE LA PARTIDA
                        </GradientText>
                        <p className="mt-4 text-lg" style={neon('#3dff7a')}>
                            Oleada {resumen.oleada} · {resumen.puntos} puntos
                        </p>
                        {resumen.puntos >= record && resumen.puntos > 0 && <p className="mt-1 text-sm" style={neon('#ffe600')}>¡Nuevo récord!</p>}
                        <ul className="mt-5 space-y-2 text-left text-sm">
                            {resumen.jugadores.map((j) => (
                                <li key={j.nombre} className="flex items-center gap-3 border border-white/10 bg-black/40 px-3 py-2">
                                    <img src={personaje(j.personaje).cara} alt="" className="size-9 rounded-full border-2" style={{ borderColor: personaje(j.personaje).color }} />
                                    <span className="flex-1">{j.nombre}</span>
                                    <span style={neon(personaje(j.personaje).color)}>{j.bajas} zombies</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-6 flex gap-2">
                            <StarBorder as="button" type="button" onClick={volverASala} theme="dark" color="#3dff7a" radius={0} thickness={1} className="flex-1 text-sm tracking-widest">
                                OTRA VEZ
                            </StarBorder>
                            <StarBorder as="button" type="button" onClick={cerrar} theme="dark" color="#ff3d5e" radius={0} thickness={1} className="flex-1 text-sm tracking-widest">
                                SALIR
                            </StarBorder>
                        </div>
                    </div>
                </div>
            )}

            {aviso && <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 border border-[#ffe600]/50 bg-black/70 px-4 py-2 text-sm text-[#ffe600]">{aviso}</div>}

            {estado !== 'fin' && (
                <button type="button" onClick={cerrar} className="absolute top-3 right-3 z-10 border border-white/20 bg-black/50 px-3 py-1.5 text-xs tracking-widest text-white/80 hover:border-[#ff3d5e] hover:text-[#ff3d5e]">
                    {estado === 'jugando' ? 'SALIR' : 'SALIR (ESC)'}
                </button>
            )}
        </div>
    );
}

// ——— Sala: elegir personaje ——————————————————————————————————————————————————
function SalaJuego(props: {
    yo: { id: string; nombre: string };
    otro: Miembro | null;
    otroLobby: Lobby | null;
    enLinea: boolean;
    elegido: IdPersonaje;
    listo: boolean;
    record: number;
    alElegir: (id: IdPersonaje) => void;
    alListo: () => void;
    alSolo: () => void;
}) {
    const { otro, otroLobby, enLinea, elegido, listo } = props;
    const maxVida = Math.max(...PERSONAJES.map((p) => p.vida));
    const maxVel = Math.max(...PERSONAJES.map((p) => p.velocidad));

    return (
        <div className="absolute inset-0 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(61,255,122,0.12),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(122,75,255,0.18),transparent_60%)] px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-5xl">
                <div className="text-center">
                    <GradientText colors={['#3dff7a', '#22e5ff', '#ff3dd8', '#3dff7a']} animationSpeed={3} glow={1.2} className="text-4xl font-bold tracking-[0.25em] sm:text-6xl">
                        ZOMBIES
                    </GradientText>
                    <p className="mt-2 text-xs tracking-[0.4em] text-white/60">EQUIPO DE 2 · OLEADAS · JEFES CADA 5</p>
                    {props.record > 0 && <p className="mt-1 text-xs" style={neon('#ffe600')}>Récord en este equipo: {props.record}</p>}
                </div>

                <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {PERSONAJES.map((p) => {
                        const mio = p.id === elegido;
                        const suyo = otroLobby?.personaje === p.id;
                        return (
                            <li key={p.id}>
                                <button type="button" onClick={() => props.alElegir(p.id)} className="block h-full w-full text-left" aria-pressed={mio}>
                                    <SpotlightCard
                                        theme="dark"
                                        spotlightColor={`${p.color}40`}
                                        className="h-full !rounded-none p-3 transition-[border-color,box-shadow] sm:p-4"
                                        style={{ borderColor: mio ? p.color : 'rgba(255,255,255,0.1)', boxShadow: mio ? `0 0 22px ${p.color}55` : undefined, background: 'rgba(5,4,15,0.85)' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <img src={p.cara} alt="" className="size-12 shrink-0 rounded-full border-2 object-cover sm:size-14" style={{ borderColor: p.color, boxShadow: `0 0 12px ${p.color}` }} />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold sm:text-base" style={neon(p.color)}>
                                                    {p.nombre}
                                                </p>
                                                <p className="text-[11px] text-white/50">{p.arma_nombre}</p>
                                            </div>
                                        </div>
                                        <p className="mt-3 text-xs font-bold" style={{ color: p.color }}>
                                            {p.habilidad.nombre}
                                        </p>
                                        <p className="mt-0.5 text-[11px] leading-snug text-white/65">{p.habilidad.descripcion}</p>
                                        <div className="mt-3 space-y-1 text-[10px] text-white/50">
                                            {[
                                                ['VIDA', p.vida / maxVida],
                                                ['VELOCIDAD', p.velocidad / maxVel],
                                            ].map(([t, v]) => (
                                                <div key={t as string} className="flex items-center gap-2">
                                                    <span className="w-16">{t}</span>
                                                    <span className="h-1 flex-1 bg-white/10">
                                                        <span className="block h-full" style={{ width: `${(v as number) * 100}%`, background: p.color }} />
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 flex min-h-5 flex-wrap gap-1 text-[10px]">
                                            {mio && <span className="bg-white/10 px-1.5 py-0.5">TÚ</span>}
                                            {suyo && <span className="bg-white/10 px-1.5 py-0.5">{otro?.nombre ?? 'Compañero'}</span>}
                                        </div>
                                    </SpotlightCard>
                                </button>
                            </li>
                        );
                    })}
                </ul>

                <div className="mt-6 flex flex-col items-center gap-3 pb-8 text-center">
                    {!enLinea ? (
                        <p className="text-xs text-white/50">Sin conexión en tiempo real: por ahora solo modo individual.</p>
                    ) : otro ? (
                        <p className="text-sm">
                            <span style={neon('#3dff7a')}>{otro.nombre}</span> está en la sala{' '}
                            {otroLobby?.listo ? <span className="text-[#3dff7a]">· listo ✓</span> : <span className="text-white/50">· eligiendo…</span>}
                        </p>
                    ) : (
                        <p className="text-xs text-white/60">Esperando a tu compañero: dile que abra ZenGPT y escriba «zombies».</p>
                    )}
                    <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
                        {enLinea && (
                            <StarBorder as="button" type="button" onClick={props.alListo} disabled={!otro} theme="dark" color="#3dff7a" radius={0} thickness={1} className="flex-1 text-sm tracking-widest disabled:opacity-40">
                                {listo ? (otroLobby?.listo ? 'EMPEZANDO…' : `LISTO ✓ · ESPERANDO`) : 'JUGAR EN EQUIPO'}
                            </StarBorder>
                        )}
                        <StarBorder as="button" type="button" onClick={props.alSolo} theme="dark" color="#22e5ff" radius={0} thickness={1} className="flex-1 text-sm tracking-widest">
                            JUGAR SOLO
                        </StarBorder>
                    </div>
                    <p className="text-[11px] leading-relaxed text-white/45">
                        Compu: WASD moverte · mouse mirar y apuntar · clic disparar · Q/E/clic derecho/Espacio habilidad · M música
                        <br />
                        Celular: palanca izquierda moverte · palanca derecha girar y disparar
                        <br />
                        Si tu compañero cae, quédate junto a él para revivirlo.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ——— Pantalla de juego (HUD y mando táctil) ———————————————————————————————————
function Pantalla({ hud, yo, control }: { hud: Hud; yo: { nombre: string; personaje: IdPersonaje }; control: React.RefObject<ControlJuego | null> }) {
    const p = personaje(yo.personaje);
    const tactil = esTactil();
    const recargaFrac = hud.yo.recargaMax > 0 ? hud.yo.recarga / hud.yo.recargaMax : 0;
    const mando = useRef({ mx: 0, my: 0, ax: 0, ay: 0 });
    const actualizar = (parte: Partial<typeof mando.current>) => {
        mando.current = { ...mando.current, ...parte };
        const m = mando.current;
        control.current?.mandoTactil(m.mx, m.my, m.ax, m.ay);
    };

    return (
        <div className="pointer-events-none absolute inset-0 select-none">
            <div className="relative z-10 flex flex-wrap items-start gap-2 p-3 pr-32 sm:pr-36">
                <Tarjeta nombre={yo.nombre} personaje={yo.personaje} vida={hud.yo.vida} vidaMax={hud.yo.vidaMax} caido={hud.yo.caido} bajas={hud.yo.bajas}>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/70">
                        <span className="h-1 flex-1 bg-white/10">
                            <span className="block h-full transition-[width] duration-100" style={{ width: `${(1 - recargaFrac) * 100}%`, background: recargaFrac > 0 ? 'rgba(255,255,255,0.4)' : p.color }} />
                        </span>
                        <span style={recargaFrac > 0 ? undefined : neon(p.color)}>{recargaFrac > 0 ? `${hud.yo.recarga.toFixed(1)}s` : p.habilidad.nombre.toUpperCase()}</span>
                    </div>
                </Tarjeta>
                {hud.otro && <Tarjeta nombre={hud.otro.nombre} personaje={hud.otro.personaje} vida={hud.otro.vida} vidaMax={hud.otro.vidaMax} caido={hud.otro.caido} bajas={hud.otro.bajas} />}
                <div className="ml-auto border border-white/10 bg-black/65 px-3 py-1.5 text-right">
                    <p className="text-[10px] tracking-[0.3em] text-white/70">OLEADA</p>
                    <p className="text-2xl leading-none font-bold" style={neon('#3dff7a')}>
                        {hud.oleada}
                    </p>
                </div>
                <div className="border border-white/10 bg-black/65 px-3 py-1.5 text-right">
                    <p className="text-[10px] tracking-[0.3em] text-white/70">PUNTOS</p>
                    <p className="text-2xl leading-none font-bold tabular-nums" style={neon('#22e5ff')}>
                        {hud.puntos}
                    </p>
                </div>
            </div>

            <div className="absolute inset-x-0 top-[22%] z-10 flex flex-col items-center text-center">
                {hud.fase === 'preparando' && <Banner texto="¡PREPÁRENSE!" sub="Los zombies vienen en camino" color="#3dff7a" />}
                {hud.fase === 'descanso' && <Banner texto={`OLEADA ${hud.oleada} SUPERADA`} sub={`Siguiente en ${Math.ceil(hud.tiempoFase)}… (recuperan vida)`} color="#22e5ff" />}
                {hud.fase === 'oleada' && hud.restantes > 0 && (
                    <p className="bg-black/55 px-2.5 py-1 text-xs tracking-[0.3em] text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                        <span className="tabular-nums">{hud.restantes}</span> ZOMBIES RESTANTES
                    </p>
                )}
                {hud.yo.caido && hud.fase !== 'fin' && (
                    <Banner texto="CAÍSTE" sub={hud.otro && !hud.otro.caido ? 'Tu compañero puede revivirte: que se quede junto a ti' : ''} color="#ff3d5e" />
                )}
                {hud.otro?.caido && !hud.yo.caido && <p className="mt-2 animate-pulse text-sm motion-reduce:animate-none" style={neon('#ff3d5e')}>¡{hud.otro.nombre} cayó! Ve a revivirlo</p>}
            </div>

            {hud.jefe !== null && (
                <div className="absolute inset-x-0 bottom-6 mx-auto w-[min(560px,80%)] text-center">
                    <p className="mb-1 text-xs tracking-[0.4em]" style={neon('#ff3d6e')}>
                        ZOMBIE JEFE
                    </p>
                    <div className="h-3 border border-[#ff3d6e]/60 bg-black/60">
                        <div className="h-full bg-gradient-to-r from-[#ff3d6e] to-[#ff3dd8] transition-[width] duration-150" style={{ width: `${hud.jefe * 100}%` }} />
                    </div>
                </div>
            )}

            {!tactil && hud.bloqueado && !hud.yo.caido && <Mira color={p.color} />}

            {!tactil && !hud.bloqueado && hud.fase !== 'fin' && (
                <button
                    type="button"
                    onClick={() => control.current?.capturarMouse()}
                    className="pointer-events-auto absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/55"
                >
                    <GradientText colors={[p.color, '#ffffff', p.color]} animationSpeed={2} glow={1} className="text-2xl font-bold tracking-[0.3em] sm:text-4xl">
                        HAZ CLIC PARA JUGAR
                    </GradientText>
                    <span className="text-[11px] tracking-widest text-white/60">WASD moverte · mouse mirar y apuntar · clic disparar · Q/E/clic derecho/Espacio habilidad · Esc soltar el mouse</span>
                </button>
            )}

            {tactil && (
                <>
                    <Palanca lado="izquierda" alMover={(x, y) => actualizar({ mx: x, my: y })} />
                    <Palanca lado="derecha" alMover={(x, y) => actualizar({ ax: x, ay: y })} />
                    <button
                        type="button"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            control.current?.habilidad();
                        }}
                        className="pointer-events-auto absolute right-6 bottom-40 flex size-16 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                        style={{ borderColor: p.color, background: recargaFrac > 0 ? 'rgba(0,0,0,0.5)' : `${p.color}33`, boxShadow: recargaFrac > 0 ? undefined : `0 0 18px ${p.color}`, color: p.color }}
                    >
                        {recargaFrac > 0 ? `${hud.yo.recarga.toFixed(0)}s` : 'HAB'}
                    </button>
                </>
            )}
        </div>
    );
}

function Tarjeta(props: { nombre: string; personaje: IdPersonaje; vida: number; vidaMax: number; caido: boolean; bajas: number; children?: React.ReactNode }) {
    const p = personaje(props.personaje);
    const frac = Math.max(0, props.vida / props.vidaMax);
    return (
        <div className="flex w-[min(230px,44vw)] items-center gap-2 border bg-black/55 px-2 py-1.5" style={{ borderColor: `${p.color}66` }}>
            <img src={p.cara} alt="" className="size-9 shrink-0 rounded-full border-2 object-cover" style={{ borderColor: p.color, filter: props.caido ? 'grayscale(1)' : undefined }} />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="truncate" style={{ color: p.color }}>
                        {props.nombre}
                    </span>
                    <span className="text-white/50">{props.bajas}☠</span>
                </div>
                <div className="mt-1 h-2 bg-white/10">
                    <div className="h-full transition-[width] duration-150" style={{ width: `${frac * 100}%`, background: frac > 0.35 ? p.color : '#ff3d5e', boxShadow: `0 0 8px ${frac > 0.35 ? p.color : '#ff3d5e'}` }} />
                </div>
                {props.children}
            </div>
        </div>
    );
}

/** Mira neón al centro de la pantalla (solo compu, con el mouse capturado). */
function Mira({ color }: { color: string }) {
    const brillo = { background: color, boxShadow: `0 0 6px ${color}, 0 0 12px ${color}` };
    return (
        <div className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <span className="absolute top-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2" style={brillo} />
            <span className="absolute bottom-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2" style={brillo} />
            <span className="absolute top-1/2 left-0 h-0.5 w-2.5 -translate-y-1/2" style={brillo} />
            <span className="absolute top-1/2 right-0 h-0.5 w-2.5 -translate-y-1/2" style={brillo} />
            <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ boxShadow: `0 0 6px ${color}` }} />
            <span className="absolute inset-[3px] rounded-full border opacity-50" style={{ borderColor: color }} />
        </div>
    );
}

function Banner({ texto, sub, color }: { texto: string; sub: string; color: string }) {
    return (
        <>
            <GradientText colors={[color, '#ffffff', color]} animationSpeed={2} glow={1} className="text-3xl font-bold tracking-[0.2em] sm:text-5xl">
                {texto}
            </GradientText>
            {sub && <p className="mt-2 text-xs tracking-widest text-white/70 sm:text-sm">{sub}</p>}
        </>
    );
}

/** Palanca táctil (mitad de la pantalla). Devuelve un vector −1…1. */
function Palanca({ lado, alMover }: { lado: 'izquierda' | 'derecha'; alMover: (x: number, y: number) => void }) {
    const [pos, setPos] = useState<{ cx: number; cy: number; x: number; y: number } | null>(null);
    const id = useRef<number | null>(null);
    const R = 56;

    const mover = (e: EventoPuntero<HTMLDivElement>, base: { cx: number; cy: number }) => {
        let dx = e.clientX - base.cx;
        let dy = e.clientY - base.cy;
        const d = Math.hypot(dx, dy);
        if (d > R) {
            dx = (dx / d) * R;
            dy = (dy / d) * R;
        }
        setPos({ ...base, x: dx, y: dy });
        alMover(dx / R, dy / R);
    };

    return (
        <div
            className={`pointer-events-auto absolute bottom-0 h-[55%] w-1/2 touch-none ${lado === 'izquierda' ? 'left-0' : 'right-0'}`}
            onPointerDown={(e) => {
                if (id.current !== null) return;
                id.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                const base = { cx: e.clientX, cy: e.clientY };
                setPos({ ...base, x: 0, y: 0 });
                alMover(0, 0);
            }}
            onPointerMove={(e) => {
                if (e.pointerId !== id.current || !pos) return;
                mover(e, pos);
            }}
            onPointerUp={(e) => {
                if (e.pointerId !== id.current) return;
                id.current = null;
                setPos(null);
                alMover(0, 0);
            }}
            onPointerCancel={() => {
                id.current = null;
                setPos(null);
                alMover(0, 0);
            }}
        >
            {pos && (
                <div className="pointer-events-none fixed" style={{ left: pos.cx - R, top: pos.cy - R, width: R * 2, height: R * 2 }}>
                    <div className="absolute inset-0 rounded-full border-2 border-white/25 bg-white/5" />
                    <div
                        className="absolute size-12 rounded-full border-2"
                        style={{ left: R - 24 + pos.x, top: R - 24 + pos.y, borderColor: lado === 'izquierda' ? '#22e5ff' : '#ff3dd8', background: lado === 'izquierda' ? '#22e5ff44' : '#ff3dd844' }}
                    />
                </div>
            )}
        </div>
    );
}
