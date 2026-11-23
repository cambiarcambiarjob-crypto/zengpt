<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="robots" content="noindex, nofollow">
    <title>Iniciar sesión en Google · ZenGPT</title>
    @include('partials.visor-estilos')
</head>
<body>
    <header>
        <div>
            <h1>Iniciar sesión en Google</h1>
            <p>{{ $cuenta->email }} · Chrome del servidor</p>
        </div>
        <span id="estado" class="estado"><span class="punto"></span><span id="estado-texto">Conectando…</span></span>
        <span class="espacio"></span>
        <button type="button" id="ir-login">Recargar el Chrome de esta cuenta</button>
        <form method="POST" action="/google/visor/{{ $cuenta->id }}/cerrar" style="margin:0">
            @csrf
            <button type="submit">Cerrar visor</button>
        </form>
    </header>

    <main>
        <div id="pantalla" aria-label="Pantalla del Chrome del servidor">
            <p id="espera">Abriendo el Chrome de esta cuenta en su propia pantalla…</p>
            <div id="ocupadas" role="alert">
                <div>
                    <p><b>Todas las pantallas del visor están en uso.</b> Cada cuenta abre el suyo; ahorita los tienen:</p>
                    <ul id="ocupadas-lista"></ul>
                    <p>Ciérralos desde su pestaña (al cerrar la pestaña se libera solo) o cierra el más viejo para abrir esta cuenta.</p>
                    <button type="button" id="forzar" class="primario">Cerrar el visor más viejo y abrir esta cuenta</button>
                </div>
            </div>
        </div>

        <aside>
            <p class="paso"><b>1.</b> La pantalla es el Chrome de <b>esta cuenta</b>, en su propia pantalla (cada cuenta tiene la suya y se cierra sola al cerrar esta pestaña). Si Google pide iniciar sesión, sigue los pasos.</p>
            <p class="paso"><b>2.</b> Da clic en el campo de la pantalla y pica <b>Pegar en el visor</b>: lo escribe por ti.</p>

            <div class="dato">
                <label>Correo</label>
                <div class="valor">{{ $cuenta->email }}</div>
                <div class="acciones">
                    <button type="button" data-copiar="correo">Copiar</button>
                    <button type="button" data-pegar="correo">Pegar en el visor</button>
                </div>
            </div>

            <div class="dato">
                <label>Contraseña</label>
                <div class="valor" id="clave-visible">{{ $cuenta->password ? '••••••••••' : 'No está guardada en la cuenta' }}</div>
                @if ($cuenta->password)
                    <div class="acciones">
                        <button type="button" data-copiar="clave">Copiar</button>
                        <button type="button" data-pegar="clave">Pegar en el visor</button>
                        <button type="button" id="mostrar-clave">Mostrar</button>
                    </div>
                @endif
            </div>

            <div class="dato">
                <label>Código de 2 pasos</label>
                @if ($tiene2fa)
                    <div class="valor codigo" id="codigo">······</div>
                    <div class="barra"><i id="barra" style="width:100%"></i></div>
                    <div class="acciones">
                        <button type="button" data-copiar="codigo">Copiar</button>
                        <button type="button" data-pegar="codigo">Pegar en el visor</button>
                    </div>
                @else
                    <div class="valor" style="font-family:inherit;font-weight:400;color:var(--suave)">No hay liga de 2FA guardada en la cuenta.</div>
                @endif
            </div>

            <p class="paso"><b>3.</b> Cuando ya veas tu grupo familiar en la pantalla:</p>
            <form method="POST" action="/google/visor/{{ $cuenta->id }}/listo">
                @csrf
                <button type="submit" id="listo" class="primario" style="width:100%" disabled>Ya inicié sesión · revisar grupo</button>
            </form>
            @if (session('error'))
                <div class="aviso mal">{{ session('error') }}</div>
            @endif
            @if (session('success'))
                <div class="aviso ok">{{ session('success') }}</div>
            @endif
            <div id="aviso" class="aviso"></div>

            @if ($cuenta->por_activar)
                {{-- Cuentas por activar con clientes viejos que no renovaron: se sacan todos de una vez (menos el administrador). --}}
                <div class="sacar">
                    <p><b>Cuenta por activar.</b> Saca del grupo familiar a los clientes que ya no renovaron: a todos menos al administrador. Si Google pide el 2FA, el sistema lo pone solo.</p>
                    <button type="button" id="sacar" class="peligro" style="width:100%" disabled>Sacar a todos los miembros</button>
                    <div id="sacar-estado" class="sacar-estado" hidden aria-live="polite">
                        <div class="sacar-fila"><span id="sacar-texto">Empezando…</span><span id="sacar-reloj" class="reloj" role="timer">0:00</span></div>
                        <div class="barra"><i id="sacar-barra" style="width:0%"></i></div>
                        <p id="sacar-nota">Suele tardar de 1 a 3 minutos. Lo ves en la pantalla: no muevas nada mientras trabaja.</p>
                    </div>
                </div>
            @endif

            {{-- Si al invitar Google dice «Has alcanzado el límite de invitaciones al grupo familiar». «Revisar grupo» también lo detecta solo. --}}
            <div class="bloqueo">
                @if ($bloqueo)
                    <p><b>Invitaciones inválidas por Google</b> hasta el {{ $bloqueo }}.</p>
                    <form method="POST" action="/cuentas/{{ $cuenta->id }}/bloqueo">
                        @csrf @method('PUT')
                        <input type="hidden" name="accion" value="quitar">
                        <button type="submit" style="width:100%">Google ya deja invitar · quitar bloqueo</button>
                    </form>
                @else
                    <p>¿Google dice <i>«Has alcanzado el límite de invitaciones al grupo familiar»</i>?</p>
                    <form method="POST" action="/cuentas/{{ $cuenta->id }}/bloqueo">
                        @csrf @method('PUT')
                        <input type="hidden" name="accion" value="bloquear">
                        <button type="submit" class="peligro" style="width:100%">Marcar invitaciones bloqueadas ({{ config('zengpt.google.dias_bloqueo', 7) }} días)</button>
                    </form>
                @endif
            </div>
        </aside>
    </main>

    <script type="module">
        import RFB from '/zenbot-visor/core/rfb.js';

        const datos = {
            correo: @json($cuenta->email),
            clave: @json((string) $cuenta->password),
            codigo: null,
        };
        const csrf = document.querySelector('meta[name=csrf-token]').content;
        const aviso = document.getElementById('aviso');
        const avisar = (texto, bien = true) => { aviso.textContent = texto; aviso.className = 'aviso ' + (bien ? 'ok' : 'mal'); clearTimeout(avisar.t); avisar.t = setTimeout(() => (aviso.className = 'aviso'), 3500); };
        const estado = (texto, clase) => { document.getElementById('estado-texto').textContent = texto; document.getElementById('estado').className = 'estado ' + (clase || ''); };

        // Ficha de esta pestaña: al cerrarla se cierra el Chrome de la cuenta, salvo que otra pestaña lo haya vuelto a abrir.
        const ficha = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
        // La pantalla se conecta cuando el Chrome de ESTA cuenta ya está abierto, en su propia pantalla (pN). Hasta entonces
        // «Pegar en el visor» y «Ya inicié sesión» no hacen nada: nunca se teclea en el Chrome de otra cuenta.
        const caja = document.getElementById('pantalla');
        let rfb = null;
        let pantalla = null;
        let propio = false;
        let sacandoAhora = false;
        const permitir = (si) => {
            propio = si;
            document.querySelectorAll('[data-pegar]').forEach((b) => (b.disabled = !si));
            // Mientras se saca a los miembros, el Chrome está ocupado: no se revisa el grupo ni se reabre.
            document.querySelectorAll('#listo, #sacar').forEach((b) => (b.disabled = !si || sacandoAhora));
        };
        const conectar = (n) => {
            if (rfb && pantalla === n) return;
            if (rfb) { try { rfb.disconnect(); } catch {} }
            pantalla = n;
            document.getElementById('espera').style.display = 'none';
            rfb = new RFB(caja, `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/zenbot-visor/websockify?token=p${n}`);
            rfb.scaleViewport = true;
            rfb.focusOnClick = true;
            rfb.addEventListener('disconnect', () => { if (pantalla === n) { estado('Desconectado: recarga la página', 'mal'); permitir(false); } });
        };

        // Pegar en el visor: teclea el dato, letra por letra, en el campo que tenga el foco en la pantalla.
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        let tecleando = false;
        const pegar = async (clave) => {
            if (!propio || !rfb) return avisar('La pantalla todavía no es de esta cuenta: espera a que abra.', false);
            const texto = datos[clave];
            if (!texto) return avisar('No hay dato para pegar.', false);
            if (tecleando) return;
            tecleando = true;
            rfb.focus();
            for (const letra of texto) {
                const cp = letra.codePointAt(0);
                rfb.sendKey(cp < 0x100 ? cp : 0x01000000 + cp);
                await esperar(25);
            }
            tecleando = false;
            avisar('Listo: se escribió en el campo seleccionado de la pantalla.');
        };
        const copiar = async (clave) => {
            const texto = datos[clave];
            if (!texto) return avisar('No hay dato para copiar.', false);
            try { await navigator.clipboard.writeText(texto); avisar('Copiado.'); } catch { avisar('Tu navegador no dejó copiar; usa «Pegar en el visor».', false); }
        };
        document.querySelectorAll('[data-pegar]').forEach((b) => b.addEventListener('click', () => pegar(b.dataset.pegar)));
        document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiar(b.dataset.copiar)));

        const mostrar = document.getElementById('mostrar-clave');
        if (mostrar) mostrar.addEventListener('click', () => {
            const visible = document.getElementById('clave-visible');
            const oculta = visible.textContent.startsWith('•');
            visible.textContent = oculta ? datos.clave : '••••••••••';
            mostrar.textContent = oculta ? 'Ocultar' : 'Mostrar';
        });

        // Código de 2 pasos: se pide al servidor y se renueva solo cada 30 s.
        const cajaCodigo = document.getElementById('codigo');
        const barra = document.getElementById('barra');
        let restante = 0;
        const traerCodigo = async () => {
            try {
                const r = await fetch(location.pathname + '/codigo', { headers: { Accept: 'application/json' }, cache: 'no-store' });
                const j = await r.json();
                datos.codigo = j.codigo;
                restante = j.restante;
                if (cajaCodigo) cajaCodigo.textContent = j.codigo ?? '------';
            } catch { if (cajaCodigo) cajaCodigo.textContent = 'error'; }
        };
        if (cajaCodigo) {
            await traerCodigo();
            setInterval(async () => {
                restante -= 1;
                if (restante <= 0) await traerCodigo();
                barra.style.width = `${Math.max(0, (restante / 30) * 100)}%`;
            }, 1000);
        }

        // Abre el Chrome de ESTA cuenta en su pantalla (al entrar y con el botón de recargar).
        const boton = document.getElementById('ir-login');
        const ocupadas = document.getElementById('ocupadas');
        const abrirChrome = async (forzar = false) => {
            boton.disabled = true;
            ocupadas.classList.remove('si');
            estado('Abriendo el Chrome de esta cuenta…');
            try {
                const cuerpo = new FormData();
                cuerpo.append('ficha', ficha);
                if (forzar) cuerpo.append('forzar', '1');
                const r = await fetch(location.pathname + '/login', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' }, body: cuerpo });
                const j = await r.json();
                if (j.ok) {
                    conectar(j.pantalla);
                    permitir(true);
                    estado(`${j.sesion ? 'Sesión de Google iniciada' : 'Inicia sesión en la pantalla'} · pantalla ${j.pantalla}`, 'ok');
                    avisar(j.sesion ? 'Esta cuenta ya tiene su sesión: pica «Ya inicié sesión» para revisar el grupo.' : 'Google pide iniciar sesión: usa los datos de la derecha.');
                } else {
                    permitir(false);
                    estado('No se pudo abrir', 'mal');
                    if (j.ocupadas) {
                        const lista = document.getElementById('ocupadas-lista');
                        lista.replaceChildren(...j.ocupadas.map((c) => Object.assign(document.createElement('li'), { textContent: c })));
                        ocupadas.classList.add('si');
                    } else {
                        avisar(j.mensaje || 'No se pudo abrir el Chrome de la cuenta.', false);
                    }
                }
            } catch { permitir(false); estado('No se pudo abrir', 'mal'); avisar('No se pudo abrir el Chrome de la cuenta.', false); }
            boton.disabled = false;
        };
        boton.addEventListener('click', () => abrirChrome());

        // «Sacar a todos los miembros»: corre en el servidor; aquí se ve el avance y el tiempo que lleva.
        const sacarBoton = document.getElementById('sacar');
        if (sacarBoton) {
            const caja = document.getElementById('sacar-estado');
            const texto = document.getElementById('sacar-texto');
            const reloj = document.getElementById('sacar-reloj');
            const barraSacar = document.getElementById('sacar-barra');
            let estadoSacar = @json($sacando);
            let desfaseReloj = 0;
            let consulta = null;
            const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
            const pintar = () => {
                if (!estadoSacar || !estadoSacar.estado) return;
                caja.hidden = false;
                const e = estadoSacar;
                const fin = e.fin ?? Math.floor(Date.now() / 1000 + desfaseReloj);
                reloj.textContent = mmss(fin - e.inicio);
                caja.className = 'sacar-estado' + (e.estado === 'listo' ? ' ok' : e.estado === 'error' ? ' mal' : '');
                const a = e.avance || {};
                if (e.estado === 'sacando') {
                    texto.textContent = a.paso === 'sacando' && a.total ? `Sacando ${Math.min(a.sacados + 1, a.total)} de ${a.total}: ${a.actual ?? ''}`
                        : a.paso === 'comprobando' ? 'Comprobando que ya no estén…'
                        : a.paso === 'detenido' ? 'Se detuvo: revisa la pantalla…'
                        : 'Leyendo el grupo en Google…';
                    barraSacar.style.width = a.total ? `${Math.round((a.sacados / a.total) * 100)}%` : '4%';
                } else {
                    texto.textContent = e.mensaje || (e.estado === 'listo' ? 'Listo.' : 'No se pudo terminar.');
                    barraSacar.style.width = e.estado === 'listo' ? '100%' : barraSacar.style.width;
                }
                sacandoAhora = e.estado === 'sacando';
                permitir(propio);
                sacarBoton.textContent = sacandoAhora ? 'Sacando miembros…' : 'Sacar a todos los miembros';
            };
            const preguntar = async () => {
                try {
                    const r = await fetch(location.pathname + '/sacar-miembros', { headers: { Accept: 'application/json' }, cache: 'no-store' });
                    const j = await r.json();
                    desfaseReloj = j.ahora - Date.now() / 1000;
                    estadoSacar = j;
                    pintar();
                    if (j.estado !== 'sacando') { clearInterval(consulta); consulta = null; }
                } catch {}
            };
            const seguir = () => { if (!consulta) consulta = setInterval(preguntar, 2000); };
            setInterval(() => { if (estadoSacar && estadoSacar.estado === 'sacando') pintar(); }, 1000);
            sacarBoton.addEventListener('click', async () => {
                if (!confirm('Se saca del grupo familiar a TODOS los miembros de esta cuenta (menos el administrador). Google no les deja unirse a otro grupo familiar en 12 meses. ¿Continuar?')) return;
                sacarBoton.disabled = true;
                try {
                    const r = await fetch(location.pathname + '/sacar-miembros', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' } });
                    const j = await r.json();
                    if (!j.ok) { avisar(j.mensaje || 'No se pudo empezar.', false); permitir(propio); return; }
                    estadoSacar = j;
                    pintar();
                    seguir();
                } catch { avisar('No se pudo empezar.', false); permitir(propio); }
            });
            if (estadoSacar && estadoSacar.estado) { pintar(); if (estadoSacar.estado === 'sacando') seguir(); }
        }
        document.getElementById('forzar').addEventListener('click', () => {
            if (confirm('Se cierra el visor que lleva más tiempo abierto (si alguien lo está usando, se le corta). ¿Continuar?')) abrirChrome(true);
        });
        permitir(false);
        abrirChrome();

        // Al cerrar (o dejar) esta pestaña, se cierra el Chrome de la cuenta y su pantalla queda libre.
        window.addEventListener('pagehide', () => {
            if (!propio) return;
            const cuerpo = new FormData();
            cuerpo.append('_token', csrf);
            cuerpo.append('ficha', ficha);
            navigator.sendBeacon(location.pathname + '/cerrar', cuerpo);
        });
    </script>
</body>
</html>
