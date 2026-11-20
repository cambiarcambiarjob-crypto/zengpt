<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="robots" content="noindex, nofollow">
    <title>Iniciar sesión en Google · ZenGPT</title>
    <style>
        :root {
            --fondo: #0a0d0c; --superficie: #111614; --superficie-2: #161c1a; --borde: #232b28; --borde-fuerte: #2f3935;
            --texto: #e8eeec; --suave: #a3b0ab; --tenue: #6f7c77; --acento: #1ba981; --acento-hondo: #128063;
            --peligro: #e5534b; --alerta: #d9a23a; --info: #5b9bf0;
            color-scheme: dark;
        }
        * { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; }
        body { background: var(--fondo); color: var(--texto); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
        header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding: 12px 16px; border-bottom: 1px solid var(--borde); background: var(--superficie); }
        header h1 { margin: 0; font-size: 15px; font-weight: 600; }
        header p { margin: 0; color: var(--suave); font-size: 13px; }
        .estado { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--suave); }
        .punto { width: 7px; height: 7px; border-radius: 50%; background: var(--tenue); }
        .estado.ok .punto { background: var(--acento); }
        .estado.mal .punto { background: var(--peligro); }
        .espacio { flex: 1; }
        main { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 320px; min-height: 0; }
        #pantalla { background: #000; min-height: 0; overflow: hidden; }
        aside { border-left: 1px solid var(--borde); background: var(--superficie); padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
        .paso { color: var(--suave); font-size: 13px; margin: 0; }
        .paso b { color: var(--texto); font-weight: 600; }
        .dato { border: 1px solid var(--borde); background: var(--superficie-2); border-radius: 6px; padding: 10px 12px; }
        .dato label { display: block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--tenue); font-weight: 600; margin-bottom: 4px; }
        .valor { font: 600 14px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; min-height: 18px; }
        .valor.codigo { font-size: 22px; letter-spacing: .12em; }
        .acciones { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
        button { font: inherit; cursor: pointer; border-radius: 5px; border: 1px solid var(--borde-fuerte); background: var(--superficie); color: var(--texto); padding: 6px 10px; font-size: 12px; font-weight: 500; }
        button:hover { border-color: var(--acento); color: var(--acento); }
        button.primario { background: var(--acento); border-color: var(--acento); color: #04140e; font-weight: 600; padding: 9px 14px; font-size: 13px; }
        button.primario:hover { background: var(--acento-hondo); border-color: var(--acento-hondo); color: #fff; }
        button:disabled { opacity: .55; cursor: default; }
        .barra { height: 3px; background: var(--borde); border-radius: 2px; overflow: hidden; margin-top: 6px; }
        .barra i { display: block; height: 100%; background: var(--acento); transition: width 1s linear; }
        .aviso { font-size: 12px; padding: 8px 10px; border-radius: 5px; display: none; }
        .aviso.ok { display: block; background: rgba(27,169,129,.12); color: var(--acento); }
        .aviso.mal { display: block; background: rgba(229,83,75,.12); color: var(--peligro); }
        .bloqueo { margin-top: auto; padding: 10px; border: 1px solid rgba(229,83,75,.35); border-radius: 6px; background: rgba(229,83,75,.07); font-size: 12px; color: var(--suave); display: grid; gap: 8px; }
        .bloqueo p { margin: 0; line-height: 1.4; }
        .bloqueo b { color: var(--peligro); }
        button.peligro { border-color: rgba(229,83,75,.5); color: var(--peligro); }
        button.peligro:hover { background: rgba(229,83,75,.12); border-color: var(--peligro); color: var(--peligro); }
        a { color: var(--acento); }
        @media (max-width: 860px) { main { grid-template-columns: 1fr; grid-template-rows: 60vh auto; } aside { border-left: 0; border-top: 1px solid var(--borde); } }
    </style>
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
        <div id="pantalla" aria-label="Pantalla del Chrome del servidor"></div>

        <aside>
            <p class="paso"><b>1.</b> La pantalla es el Chrome de <b>esta cuenta</b> (cada cuenta tiene el suyo). Si Google pide iniciar sesión, sigue los pasos.</p>
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
                <button type="submit" class="primario" style="width:100%">Ya inicié sesión · revisar grupo</button>
            </form>
            @if (session('error'))
                <div class="aviso mal">{{ session('error') }}</div>
            @endif
            @if (session('success'))
                <div class="aviso ok">{{ session('success') }}</div>
            @endif
            <div id="aviso" class="aviso"></div>

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

        // Pantalla del Chrome del servidor (solo pasa si nginx confirma que eres el administrador).
        const rfb = new RFB(document.getElementById('pantalla'), `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/zenbot-visor/websockify`);
        rfb.scaleViewport = true;
        rfb.focusOnClick = true;
        rfb.addEventListener('connect', () => {});
        rfb.addEventListener('disconnect', () => estado('Desconectado: recarga la página', 'mal'));

        // Pegar en el visor: teclea el dato, letra por letra, en el campo que tenga el foco en la pantalla.
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        let tecleando = false;
        const pegar = async (clave) => {
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
        const caja = document.getElementById('codigo');
        const barra = document.getElementById('barra');
        let restante = 0;
        const traerCodigo = async () => {
            try {
                const r = await fetch(location.pathname + '/codigo', { headers: { Accept: 'application/json' }, cache: 'no-store' });
                const j = await r.json();
                datos.codigo = j.codigo;
                restante = j.restante;
                if (caja) caja.textContent = j.codigo ?? '------';
            } catch { if (caja) caja.textContent = 'error'; }
        };
        if (caja) {
            await traerCodigo();
            setInterval(async () => {
                restante -= 1;
                if (restante <= 0) await traerCodigo();
                barra.style.width = `${Math.max(0, (restante / 30) * 100)}%`;
            }, 1000);
        }

        // Abre el Chrome de ESTA cuenta en la pantalla (al entrar y con el botón de recargar).
        const boton = document.getElementById('ir-login');
        const abrirChrome = async () => {
            boton.disabled = true;
            estado('Abriendo el Chrome de esta cuenta…');
            try {
                const r = await fetch(location.pathname + '/login', { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' } });
                const j = await r.json();
                if (j.ok) {
                    estado(j.sesion ? 'Sesión de Google iniciada' : 'Inicia sesión en la pantalla', 'ok');
                    avisar(j.sesion ? 'Esta cuenta ya tiene su sesión: pica «Ya inicié sesión» para revisar el grupo.' : 'Google pide iniciar sesión: usa los datos de la derecha.');
                } else {
                    estado('No se pudo abrir', 'mal');
                    avisar(j.mensaje, false);
                }
            } catch { estado('No se pudo abrir', 'mal'); avisar('No se pudo abrir el Chrome de la cuenta.', false); }
            boton.disabled = false;
        };
        boton.addEventListener('click', abrirChrome);
        abrirChrome();
    </script>
</body>
</html>
