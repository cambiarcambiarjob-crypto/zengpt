import { useForm } from '@inertiajs/react';
import { AtSign, Check, CircleCheck, Eye, EyeOff, Infinity as Infinito, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { FondoHilos } from '@/components/fondos/FondoHilos';
import GlareHover from '@/components/reactbits/GlareHover';
import ShinyText from '@/components/reactbits/ShinyText';
import { porciento } from '@/components/reportes/periodos';
import { Aparecer } from '@/components/ui/Aparecer';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Insignia } from '@/components/ui/Insignia';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { iniciales } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';

const MINIMO = 10;

type CampoClave = 'current_password' | 'password' | 'password_confirmation';

function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-campo border border-borde bg-superficie-2 text-tenue" aria-hidden="true">
                {icono}
            </span>
            <dt className="w-20 shrink-0 text-[13px] text-suave">{etiqueta}</dt>
            <dd className="min-w-0 flex-1 truncate text-right text-sm font-medium text-texto">{children}</dd>
        </div>
    );
}

/** Renglón de la lista de requisitos: se palomea en cuanto se cumple (el icono no es la única pista: cambia el texto oculto). */
function Requisito({ cumplido, children }: { cumplido: boolean; children: ReactNode }) {
    return (
        <li className={cn('flex items-center gap-2 text-[13px] transition-colors duration-200', cumplido ? 'text-texto' : 'text-tenue')}>
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200', cumplido ? 'border-acento bg-acento text-sobre-acento' : 'border-borde-fuerte')} aria-hidden="true">
                {cumplido && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span>
                {children}
                <span className="sr-only">{cumplido ? ' (cumplido)' : ' (pendiente)'}</span>
            </span>
        </li>
    );
}

/**
 * Perfil: quién eres en el sistema (nombre, usuario y rol) y el cambio de contraseña. El nombre y el usuario los
 * administra el dueño; aquí solo se cambia la contraseña.
 */
export default function PerfilShow() {
    const { auth, negocio } = usePagina();
    const usuario = auth.user;
    const form = useForm({ current_password: '', password: '', password_confirmation: '' });
    const [visibles, setVisibles] = useState<Record<CampoClave, boolean>>({ current_password: false, password: false, password_confirmation: false });
    const actual = useRef<HTMLInputElement>(null);
    const nueva = useRef<HTMLInputElement>(null);

    if (!usuario) return null;

    const rol = usuario.is_admin ? 'Administrador' : 'Socio';
    const largo = form.data.password.length;
    const coinciden = largo > 0 && form.data.password === form.data.password_confirmation;

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();
        form.put('/perfil/password', {
            preserveScroll: true,
            onSuccess: () => {
                // El aviso «Contraseña actualizada.» sale arriba (layout) y junto al botón.
                form.reset();
                setVisibles({ current_password: false, password: false, password_confirmation: false });
            },
            onError: (errores) => {
                if (errores.current_password) {
                    form.reset('current_password');
                    actual.current?.focus();
                } else if (errores.password) {
                    form.reset('password', 'password_confirmation');
                    nueva.current?.focus();
                }
            },
        });
    };

    /** Botón de ojo dentro del campo: muestra u oculta lo escrito sin perder el foco del formulario. */
    const ojo = (campo: CampoClave, nombre: string) => (
        <button
            type="button"
            onClick={() => setVisibles((previos) => ({ ...previos, [campo]: !previos[campo] }))}
            aria-label={`${visibles[campo] ? 'Ocultar' : 'Mostrar'} ${nombre}`}
            aria-pressed={visibles[campo]}
            className="flex size-9 items-center justify-center rounded-[8px] text-tenue transition-colors hover:bg-superficie-3 hover:text-texto"
        >
            {visibles[campo] ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
    );

    return (
        <AppLayout titulo="Perfil" descripcion="Tus datos en ZenGPT y tu contraseña">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                <Aparecer indice={0} className="lg:col-span-5">
                    {/* Tarjeta de identidad: destello de GlareHover al pasar el cursor (y una vez al entrar) sobre los hilos de Threads. */}
                    <GlareHover
                        background="#0f1413"
                        borderColor="#222b28"
                        borderRadius="16px"
                        glareColor="#6ee9c2"
                        glareOpacity={0.14}
                        glareSize={34}
                        transitionDuration={900}
                        intro
                        className="grid! w-full place-items-stretch! shadow-tarjeta"
                    >
                        <section aria-labelledby="titulo-identidad" className="min-w-0">
                            <div className="relative isolate overflow-hidden border-b border-borde px-5 pt-8 pb-6 sm:px-6">
                                <FondoHilos className="-z-10" opacidad={0.5} hilos={18} />
                                <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-superficie via-superficie/70 to-transparent" aria-hidden="true" />
                                <div className="flex items-center gap-4">
                                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-acento/40 bg-superficie font-titulo text-xl font-semibold text-acento shadow-brillo" aria-hidden="true">
                                        {iniciales(usuario.name)}
                                    </span>
                                    <div className="min-w-0">
                                        <h2 id="titulo-identidad" className="truncate text-xl leading-tight font-semibold">
                                            <ShinyText text={usuario.name} color="#e8eeeb" shineColor="#34d8a6" speed={2.2} delay={6} />
                                        </h2>
                                        <p className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <Insignia estado={usuario.is_admin ? 'acento' : 'info'}>{rol}</Insignia>
                                            <span className="truncate text-[13px] text-suave">@{usuario.username}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 sm:p-6">
                                <dl className="divide-y divide-borde/70">
                                    <Dato icono={<UserRound className="size-4" />} etiqueta="Nombre">
                                        {usuario.name}
                                    </Dato>
                                    <Dato icono={<AtSign className="size-4" />} etiqueta="Usuario">
                                        {usuario.username}
                                    </Dato>
                                    <Dato icono={<ShieldCheck className="size-4" />} etiqueta="Rol">
                                        {rol}
                                    </Dato>
                                    <Dato icono={<Infinito className="size-4" />} etiqueta="Sesión">
                                        No caduca en este equipo
                                    </Dato>
                                </dl>

                                <p className="mt-5 rounded-campo border border-borde bg-superficie-2/60 px-3.5 py-3 text-[13px] leading-relaxed text-suave">
                                    {usuario.is_admin
                                        ? 'Como administrador ves y capturas todo: cuentas, clientes, publicidad y vendedores.'
                                        : `Como socio ves todo y capturas cuentas y clientes; la publicidad y los vendedores los lleva el administrador. Tu parte es el ${porciento(negocio.porcentaje_socio)} del neto.`}
                                </p>
                                <p className="mt-3 text-xs leading-relaxed text-tenue">Para cambiar tu nombre o tu usuario, pídeselo a quien administra el sistema.</p>
                            </div>
                        </section>
                    </GlareHover>
                </Aparecer>

                <Aparecer indice={1} className="lg:col-span-7">
                    <Tarjeta
                        titulo={
                            <span className="flex items-center gap-2.5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-campo border border-acento/30 bg-acento/10 text-acento" aria-hidden="true">
                                    <KeyRound className="size-4" />
                                </span>
                                Cambiar contraseña
                            </span>
                        }
                        descripcion={`Escribe la actual y elige una nueva de al menos ${MINIMO} caracteres.`}
                    >
                        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
                            {/* Ayuda a los gestores de contraseñas a guardar la nueva en el usuario correcto. */}
                            <input type="text" name="username" autoComplete="username" value={usuario.username} readOnly hidden />

                            <Campo
                                ref={actual}
                                etiqueta="Contraseña actual"
                                name="current_password"
                                type={visibles.current_password ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={form.data.current_password}
                                onChange={(evento) => form.setData('current_password', evento.target.value)}
                                error={form.errors.current_password}
                                sufijo={ojo('current_password', 'la contraseña actual')}
                                required
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Campo
                                    ref={nueva}
                                    etiqueta="Contraseña nueva"
                                    name="password"
                                    type={visibles.password ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={form.data.password}
                                    onChange={(evento) => form.setData('password', evento.target.value)}
                                    error={form.errors.password}
                                    sufijo={ojo('password', 'la contraseña nueva')}
                                    minLength={MINIMO}
                                    required
                                />
                                <Campo
                                    etiqueta="Repite la contraseña nueva"
                                    name="password_confirmation"
                                    type={visibles.password_confirmation ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={form.data.password_confirmation}
                                    onChange={(evento) => form.setData('password_confirmation', evento.target.value)}
                                    error={form.errors.password_confirmation}
                                    sufijo={ojo('password_confirmation', 'la repetición de la contraseña')}
                                    required
                                />
                            </div>

                            {/* Requisitos en vivo: la barra se llena hasta los 10 caracteres (solo transform, sin mover nada). */}
                            <div className="rounded-campo border border-borde bg-superficie-2/60 px-3.5 py-3">
                                <div className="h-1.5 overflow-hidden rounded-full bg-superficie-3" aria-hidden="true">
                                    <div
                                        className={cn('h-full w-full origin-left rounded-full transition-[transform,background-color] duration-300 ease-suave', largo >= MINIMO ? 'bg-acento' : 'bg-alerta')}
                                        style={{ transform: `scaleX(${Math.min(1, largo / MINIMO)})` }}
                                    />
                                </div>
                                <ul className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-6">
                                    <Requisito cumplido={largo >= MINIMO}>
                                        Al menos {MINIMO} caracteres
                                        {largo > 0 && largo < MINIMO && <span className="cifras text-tenue"> · llevas {largo}</span>}
                                    </Requisito>
                                    <Requisito cumplido={coinciden}>Las dos contraseñas nuevas coinciden</Requisito>
                                </ul>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                                <p role="status" className={cn('flex min-h-5 items-center gap-1.5 text-sm font-medium text-exito transition-opacity duration-300', form.recentlySuccessful ? 'opacity-100' : 'opacity-0')}>
                                    {form.recentlySuccessful && (
                                        <>
                                            <CircleCheck className="size-4" aria-hidden="true" />
                                            Contraseña actualizada
                                        </>
                                    )}
                                </p>
                                <Boton type="submit" variante="primario" cargando={form.processing} className="max-sm:w-full">
                                    Guardar contraseña
                                </Boton>
                            </div>
                        </form>
                    </Tarjeta>
                </Aparecer>
            </div>
        </AppLayout>
    );
}
