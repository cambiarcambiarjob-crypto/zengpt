<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="robots" content="noindex, nofollow">
    <title>Crear cuenta de Google · ZenGPT</title>
    @include('partials.visor-estilos')
    <style>
        .dato input { width: 100%; font: 600 14px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--texto); background: var(--fondo); border: 1px solid var(--borde-fuerte); border-radius: 5px; padding: 7px 9px; }
        .dato input:focus { outline: none; border-color: var(--acento); }
        .dato small { display: block; margin-top: 6px; color: var(--tenue); font-size: 12px; line-height: 1.4; }
        .error { color: var(--peligro); font-size: 12px; margin-top: 6px; }
    </style>
</head>
<body>
    <header>
        <div>
            <h1>Crear cuenta de Google</h1>
            <p>Chrome nuevo del servidor · al guardarla, este Chrome queda asignado a la cuenta</p>
        </div>
        <span id="estado" class="estado"><span class="punto"></span><span id="estado-texto">Conectando…</span></span>
        <span class="espacio"></span>
        <button type="button" id="ir-login">Recargar el Chrome</button>
        <button type="button" id="mayus" disabled title="Bloq Mayús de la pantalla del servidor: si está activado, todo lo que escribas sale en mayúsculas (también la contraseña). Pícale para cambiarlo.">Bloq Mayús: …</button>
        <form method="POST" action="/google/crear/{{ $clave }}/cerrar" style="margin:0" onsubmit="return confirm('Se cierra este Chrome y se borra lo que llevas de la cuenta nueva. ¿Cancelar?')">
            @csrf
            <button type="submit">Cancelar</button>
        </form>
    </header>

    <main>
        <div id="pantalla" aria-label="Pantalla del Chrome del servidor">
            <p id="espera">Abriendo un Chrome nuevo en el alta de Google…</p>
            <div id="ocupadas" role="alert">
                <div>
                    <p><b>Todas las pantallas del visor están en uso.</b> Cada visor abre la suya; ahorita las tienen:</p>
                    <ul id="ocupadas-lista"></ul>
                    <p>Ciérralos desde su pestaña (al cerrar la pestaña se libera sola) o cierra el más viejo para abrir este.</p>
                    <button type="button" id="forzar" class="primario">Cerrar el visor más viejo y abrir este</button>
                </div>
            </div>
        </div>

        <aside>
            <p class="paso"><b>1.</b> En la pantalla está el alta de Google («Crear cuenta»). Llénala tú: nombre, fecha de nacimiento, el Gmail que quieras y la contraseña. Si Google pide un teléfono o confirmar que eres una persona, también se hace ahí.</p>
            <p class="paso"><b>2.</b> Para escribir en la pantalla: da clic en el campo y pica <b>Pegar en el visor</b>.</p>

            <form id="guardar" method="POST" action="/google/crear/{{ $clave }}/guardar">@csrf</form>

            <div class="dato">
                <label for="clave">Contraseña de la cuenta</label>
                <input id="clave" name="password" form="guardar" type="password" autocomplete="new-password" maxlength="255" spellcheck="false">
                <div class="acciones">
                    <button type="button" id="generar">Generar una</button>
                    <button type="button" id="mostrar-clave">Mostrar</button>
                    <button type="button" data-copiar="clave">Copiar</button>
                    <button type="button" data-pegar="clave">Pegar en el visor</button>
                </div>
                <small>Se guarda con la cuenta al final. Si recargas esta página, se queda aquí.</small>
            </div>

            <div class="dato">
                <label for="correo">Gmail que creaste</label>
                <input id="correo" name="email" form="guardar" type="email" inputmode="email" autocomplete="off" spellcheck="false" placeholder="nombre@gmail.com" value="{{ old('email') }}" maxlength="255" required>
                <div class="acciones">
                    <button type="button" data-pegar="usuario">Pegar el nombre en el visor</button>
                </div>
                <small>Google pide solo la parte antes de la @: eso es lo que se pega.</small>
                @error('email')<p class="error">{{ $message }}</p>@enderror
            </div>

            <div class="dato">
                <label for="dosfa">Liga de 2FA (opcional)</label>
                <input id="dosfa" name="twofa_url" form="guardar" type="url" autocomplete="off" spellcheck="false" placeholder="https://…" value="{{ old('twofa_url') }}" maxlength="500">
                @error('twofa_url')<p class="error">{{ $message }}</p>@enderror
            </div>

            <p class="paso"><b>3.</b> Cuando Google ya haya creado la cuenta:</p>
            <button type="submit" form="guardar" id="listo" class="primario" style="width:100%">Ya la creé · guardar en «Sin Gemini»</button>
            @if (session('error'))
                <div class="aviso mal">{{ session('error') }}</div>
            @endif
            @error('password')<div class="aviso mal">{{ $message }}</div>@enderror
            <div id="aviso" class="aviso"></div>
            <p class="paso">Si cierras esta pestaña sin guardar, el Chrome se cierra pero lo que llevas se guarda 2 días: vuelve a abrir esta misma dirección.</p>
        </aside>
    </main>

    <script type="module">
        import RFB from '/zenbot-visor/core/rfb.js';

        const csrf = document.querySelector('meta[name=csrf-token]').content;
        const aviso = document.getElementById('aviso');
        const avisar = (texto, bien = true) => { aviso.textContent = texto; aviso.className = 'aviso ' + (bien ? 'ok' : 'mal'); clearTimeout(avisar.t); avisar.t = setTimeout(() => (aviso.className = 'aviso'), 3500); };
        const estado = (texto, clase) => { document.getElementById('estado-texto').textContent = texto; document.getElementById('estado').className = 'estado ' + (clase || ''); };

        // La contraseña no viaja de vuelta en la sesión del servidor: se recuerda solo en esta pestaña por si se recarga.
        const campoClave = document.getElementById('clave');
        const campoCorreo = document.getElementById('correo');
        const llave = 'alta-clave:' + location.pathname;
        try { campoClave.value = sessionStorage.getItem(llave) || ''; } catch {}
        const recordar = () => { try { sessionStorage.setItem(llave, campoClave.value); } catch {} };
        campoClave.addEventListener('input', recordar);
        document.getElementById('generar').addEventListener('click', () => {
            const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
            const azar = crypto.getRandomValues(new Uint32Array(12));
            campoClave.value = Array.from(azar, (n) => letras[n % letras.length]).join('') + '#7';
            recordar();
            campoClave.type = 'text';
            document.getElementById('mostrar-clave').textContent = 'Ocultar';
        });
        document.getElementById('mostrar-clave').addEventListener('click', (e) => {
            const oculta = campoClave.type === 'password';
            campoClave.type = oculta ? 'text' : 'password';
            e.currentTarget.textContent = oculta ? 'Ocultar' : 'Mostrar';
        });
        const dato = (clave) => clave === 'clave' ? campoClave.value : clave === 'usuario' ? campoCorreo.value.trim().split('@')[0] : '';

        // Ficha de esta pestaña: al cerrarla se cierra su Chrome, salvo que otra pestaña lo haya vuelto a abrir.
        const ficha = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
        const caja = document.getElementById('pantalla');
        let rfb = null;
        let pantalla = null;
        let propio = false;
        const permitir = (si) => {
            propio = si;
            document.querySelectorAll('[data-pegar]').forEach((b) => (b.disabled = !si));
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

        // Bloq Mayús de la pantalla del servidor: si alguien lo pica dentro del visor se queda activado y todo sale en
        // mayúsculas (la contraseña también). El botón lo muestra y lo cambia; «Pegar en el visor» lo apaga antes de escribir.
        const botonMayus = document.getElementById('mayus');
        let mayus = null;
        const pintarMayus = () => {
            botonMayus.textContent = mayus === null ? 'Bloq Mayús: …' : mayus ? 'Bloq Mayús: ACTIVADO' : 'Bloq Mayús: desactivado';
            botonMayus.classList.toggle('activadas', mayus === true);
            botonMayus.disabled = !propio || mayus === null;
        };
        const leerMayus = async () => {
            if (!propio) return pintarMayus();
            try { mayus = (await (await fetch(location.pathname + '/mayusculas', { headers: { Accept: 'application/json' }, cache: 'no-store' })).json()).activadas; } catch {}
            pintarMayus();
        };
        const fijarMayus = async (activar) => {
            try {
                const r = await fetch(location.pathname + '/mayusculas', { method: 'PUT', headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ activar }) });
                mayus = (await r.json()).activadas;
            } catch {}
            pintarMayus();
        };
        botonMayus.addEventListener('click', () => fijarMayus(!mayus));
        setInterval(leerMayus, 5000);

        // Pegar en el visor: teclea el dato, letra por letra, en el campo que tenga el foco en la pantalla.
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        let tecleando = false;
        const pegar = async (clave) => {
            if (!propio || !rfb) return avisar('La pantalla todavía no abre: espera un momento.', false);
            const texto = dato(clave);
            if (!texto) return avisar(clave === 'clave' ? 'Escribe o genera la contraseña primero.' : 'Escribe primero el Gmail.', false);
            if (tecleando) return;
            tecleando = true;
            // Con Bloq Mayús activado el correo y la contraseña saldrían en mayúsculas: se apaga antes de escribir.
            if (mayus !== false) await fijarMayus(false);
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
            const texto = dato(clave);
            if (!texto) return avisar('No hay dato para copiar.', false);
            try { await navigator.clipboard.writeText(texto); avisar('Copiado.'); } catch { avisar('Tu navegador no dejó copiar; usa «Pegar en el visor».', false); }
        };
        document.querySelectorAll('[data-pegar]').forEach((b) => b.addEventListener('click', () => pegar(b.dataset.pegar)));
        document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiar(b.dataset.copiar)));

        // Abre (o vuelve a mostrar) el Chrome de esta alta en su pantalla.
        const boton = document.getElementById('ir-login');
        const ocupadas = document.getElementById('ocupadas');
        const abrirChrome = async (forzar = false) => {
            boton.disabled = true;
            ocupadas.classList.remove('si');
            estado('Abriendo el Chrome…');
            try {
                const cuerpo = new FormData();
                cuerpo.append('ficha', ficha);
                if (forzar) cuerpo.append('forzar', '1');
                const r = await fetch(location.pathname + '/login', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' }, body: cuerpo });
                const j = await r.json();
                if (j.ok) {
                    conectar(j.pantalla);
                    permitir(true);
                    leerMayus();
                    estado(`Alta de Google · pantalla ${j.pantalla}`, 'ok');
                } else {
                    permitir(false);
                    estado('No se pudo abrir', 'mal');
                    if (j.ocupadas) {
                        const lista = document.getElementById('ocupadas-lista');
                        lista.replaceChildren(...j.ocupadas.map((c) => Object.assign(document.createElement('li'), { textContent: c })));
                        ocupadas.classList.add('si');
                    } else {
                        avisar(j.mensaje || 'No se pudo abrir el Chrome.', false);
                    }
                }
            } catch { permitir(false); estado('No se pudo abrir', 'mal'); avisar('No se pudo abrir el Chrome.', false); }
            boton.disabled = false;
        };
        boton.addEventListener('click', () => abrirChrome());
        document.getElementById('forzar').addEventListener('click', () => {
            if (confirm('Se cierra el visor que lleva más tiempo abierto (si alguien lo está usando, se le corta). ¿Continuar?')) abrirChrome(true);
        });

        // Al guardar no se cierra el Chrome desde aquí: el servidor lo cierra y se lo pasa a la cuenta.
        let guardando = false;
        document.getElementById('guardar').addEventListener('submit', () => { guardando = true; });

        permitir(false);
        abrirChrome();

        // Cada minuto la pestaña avisa que sigue abierta: si deja de avisar 5 minutos, el servidor cierra su Chrome.
        const latido = () => { if (propio) fetch(location.pathname + '/latido', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf }, keepalive: true }).catch(() => {}); };
        setInterval(latido, 60000);

        // Al cerrar (o dejar) esta pestaña, se cierra su Chrome y la pantalla queda libre (el perfil se guarda 2 días).
        window.addEventListener('pagehide', () => {
            if (!propio || guardando) return;
            const cuerpo = new FormData();
            cuerpo.append('_token', csrf);
            cuerpo.append('ficha', ficha);
            navigator.sendBeacon(location.pathname + '/cerrar', cuerpo);
        });
    </script>
</body>
</html>
