import { Head, useForm } from '@inertiajs/react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FondoAurora } from '@/components/fondos/FondoAurora';
import GradientText from '@/components/reactbits/GradientText';
import ShinyText from '@/components/reactbits/ShinyText';
import StarBorder from '@/components/reactbits/StarBorder';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Emblema } from '@/components/ui/Marca';

const TITULAR = ['Tus', 'cuentas,', 'tus', 'ventas', 'y', 'el', 'reparto,'];

export default function Login() {
    const form = useForm({ username: '', password: '' });
    const [verContrasena, setVerContrasena] = useState(false);
    const usuario = useRef<HTMLInputElement>(null);
    const contrasena = useRef<HTMLInputElement>(null);

    // En escritorio el cursor empieza en «Usuario»; en celular no, para no abrir el teclado sobre la pantalla.
    useEffect(() => {
        if (window.matchMedia('(pointer: fine)').matches) usuario.current?.focus({ preventScroll: true });
    }, []);

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();
        form.post('/login', {
            onError: () => {
                form.reset('password');
                contrasena.current?.focus();
            },
        });
    };

    return (
        <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-fondo">
            <Head title="Iniciar sesión" />

            {/* Fondo: aurora de React Bits (se carga aparte) sobre una rejilla tenue. */}
            <div className="fondo-rejilla pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]" aria-hidden="true" />
            <FondoAurora className="-z-10 opacity-60 lg:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-fondo via-fondo/80 to-transparent" aria-hidden="true" />

            <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
                <section className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-xl">
                    <div className="flex animate-entrada items-center gap-3">
                        <Emblema className="size-10 lg:size-11" titulo="ZenGPT" />
                        <ShinyText text="ZenGPT" color="#e8eeeb" shineColor="#34d8a6" speed={2.4} delay={2.5} glow={0.35} className="font-titulo text-[1.75rem] font-semibold tracking-tight lg:text-3xl" />
                    </div>

                    <h1 className="mt-7 text-[2rem] leading-[1.08] font-semibold text-balance text-texto sm:text-[2.5rem] lg:mt-10 lg:text-[3.5rem]">
                        {TITULAR.map((palabra, i) => (
                            <span key={i} className="inline-block animate-enfocar whitespace-pre" style={{ animationDelay: `${120 + i * 60}ms` }}>
                                {palabra}{' '}
                            </span>
                        ))}
                        <span className="inline-block animate-enfocar" style={{ animationDelay: `${120 + TITULAR.length * 60}ms` }}>
                            <GradientText colors={['#34d8a6', '#b4f5df', '#7fd4f5', '#34d8a6']} animationSpeed={7} className="font-titulo">
                                en calma.
                            </GradientText>
                        </span>
                    </h1>

                    <p className="mt-5 hidden max-w-md animate-entrada text-base leading-relaxed text-suave sm:block lg:text-[17px]" style={{ animationDelay: '520ms' }}>
                        El sistema interno de ZenGPT: los espacios de cada cuenta, las ventas del día y las ganancias de cada quien, siempre al corriente.
                    </p>
                </section>

                <section className="mx-auto w-full max-w-md animate-entrada lg:mx-0 lg:justify-self-end" style={{ animationDelay: '180ms' }} aria-labelledby="titulo-acceso">
                    <StarBorder
                        as="div"
                        color="#34d8a6"
                        duration={7}
                        radius={22}
                        trailLength={0.35}
                        glow={0.5}
                        hover="none"
                        clickPulse={false}
                        backgroundColor="rgb(15 20 19 / 0.94)"
                        textColor="#e8eeeb"
                        borderColor="rgb(255 255 255 / 0.09)"
                        // «!» pisa el diseño de botón que trae StarBorder: aquí envuelve una tarjeta.
                        className="block! w-full p-0! font-normal! shadow-flotante"
                    >
                        <form onSubmit={enviar} noValidate className="flex flex-col gap-5 p-6 sm:p-8">
                            <div>
                                <h2 id="titulo-acceso" className="text-xl font-semibold text-texto">
                                    Iniciar sesión
                                </h2>
                                <p className="mt-1 text-sm text-suave">Entra con tu usuario y tu contraseña.</p>
                            </div>

                            <Campo
                                ref={usuario}
                                etiqueta="Usuario"
                                name="username"
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                required
                                maxLength={120}
                                prefijo={<UserRound className="size-4" aria-hidden="true" />}
                                value={form.data.username}
                                onChange={(evento) => form.setData('username', evento.target.value)}
                                error={form.errors.username}
                            />

                            <Campo
                                ref={contrasena}
                                etiqueta="Contraseña"
                                name="password"
                                type={verContrasena ? 'text' : 'password'}
                                autoComplete="current-password"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                required
                                maxLength={255}
                                prefijo={<LockKeyhole className="size-4" aria-hidden="true" />}
                                sufijo={
                                    <button
                                        type="button"
                                        onClick={() => setVerContrasena((ver) => !ver)}
                                        aria-pressed={verContrasena}
                                        aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        className="flex size-8 items-center justify-center rounded-md text-tenue transition-colors hover:bg-superficie-3 hover:text-texto"
                                    >
                                        {verContrasena ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                                    </button>
                                }
                                value={form.data.password}
                                onChange={(evento) => form.setData('password', evento.target.value)}
                                error={form.errors.password}
                            />

                            <Boton type="submit" variante="primario" tamano="lg" anchoCompleto cargando={form.processing} iconoFinal={<ArrowRight className="size-4" aria-hidden="true" />} className="mt-1">
                                Entrar
                            </Boton>

                            <p className="text-center text-xs leading-relaxed text-tenue">Tu sesión queda abierta en este dispositivo hasta que la cierres.</p>
                        </form>
                    </StarBorder>
                </section>
            </main>

            <footer className="px-5 pb-6 text-center text-xs text-tenue sm:px-8">Acceso privado · Uso interno de ZenGPT</footer>
        </div>
    );
}
