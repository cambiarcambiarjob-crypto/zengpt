/*
 * Sala del juego en tiempo real con Laravel Reverb: canal de presencia «arena» (quién está conectado) y
 * mensajes directos entre los dos jugadores («whispers», no pasan por la base de datos).
 * Echo y pusher-js se descargan solo al abrir el juego.
 */

export interface Miembro {
    id: string;
    nombre: string;
}

type Oyente = (datos: never) => void;

export interface Sala {
    /** Quiénes están en la sala (incluyéndome). */
    miembros(): Miembro[];
    alCambiarMiembros(fn: (miembros: Miembro[]) => void): void;
    enviar(evento: string, datos: object): void;
    escuchar<T>(evento: string, fn: (datos: T) => void): void;
    salir(): void;
}

const configurada = () => Boolean(import.meta.env.VITE_REVERB_APP_KEY);

/** Lee la cookie XSRF-TOKEN de Laravel para autorizar el canal. */
function xsrf(): string {
    const valor = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
    return valor ? decodeURIComponent(valor.split('=')[1]) : '';
}

/** Entra a la sala. Devuelve null si el tiempo real no está configurado o no conecta (se juega solo). */
export async function entrarSala(): Promise<Sala | null> {
    if (!configurada()) return null;

    const [{ default: Echo }, { default: Pusher }] = await Promise.all([import('laravel-echo'), import('pusher-js')]);
    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

    const esquema = (import.meta.env.VITE_REVERB_SCHEME as string | undefined) ?? 'https';
    const puerto = Number(import.meta.env.VITE_REVERB_PORT ?? (esquema === 'https' ? 443 : 80));
    const echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY as string,
        wsHost: (import.meta.env.VITE_REVERB_HOST as string | undefined) ?? window.location.hostname,
        wsPort: puerto,
        wssPort: puerto,
        forceTLS: esquema === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/broadcasting/auth',
        auth: { headers: { 'X-XSRF-TOKEN': xsrf(), Accept: 'application/json' } },
    });

    let lista: Miembro[] = [];
    const avisos: ((m: Miembro[]) => void)[] = [];
    const cambiar = (nueva: Miembro[]) => {
        lista = nueva;
        avisos.forEach((fn) => fn(lista));
    };
    const normalizar = (m: { id: number | string; nombre: string }): Miembro => ({ id: String(m.id), nombre: m.nombre });

    const canal = echo.join('arena');

    const conectado = await new Promise<boolean>((resolver) => {
        const limite = window.setTimeout(() => resolver(false), 8000);
        canal
            .here((miembros: { id: number; nombre: string }[]) => {
                window.clearTimeout(limite);
                cambiar(miembros.map(normalizar));
                resolver(true);
            })
            .joining((m: { id: number; nombre: string }) => cambiar([...lista.filter((x) => x.id !== String(m.id)), normalizar(m)]))
            .leaving((m: { id: number; nombre: string }) => cambiar(lista.filter((x) => x.id !== String(m.id))))
            .error(() => {
                window.clearTimeout(limite);
                resolver(false);
            });
    });

    if (!conectado) {
        echo.leave('arena');
        echo.disconnect();
        return null;
    }

    return {
        miembros: () => lista,
        alCambiarMiembros: (fn) => {
            avisos.push(fn);
        },
        enviar: (evento, datos) => {
            canal.whisper(evento, datos);
        },
        escuchar: (evento, fn) => {
            canal.listenForWhisper(evento, fn as Oyente);
        },
        salir: () => {
            echo.leave('arena');
            echo.disconnect();
        },
    };
}
