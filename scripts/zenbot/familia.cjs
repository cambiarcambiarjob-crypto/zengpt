// Grupo familiar de Google con el Chrome del servidor. CADA cuenta tiene su propio perfil de Chrome (su propia
// sesión de Google) en ZENBOT_PERFILES/<correo>. El Chrome de una cuenta se abre en la pantalla virtual solo
// mientras trabaja (o mientras el visor está abierto) y se cierra al terminar; nunca hay dos abiertos a la vez.
// ZENBOT_ADMIN dice de qué cuenta se trata. Hace UNA acción y siempre responde un JSON.
//
//   node familia.cjs abrir           → abre el Chrome de la cuenta para el visor (se queda abierto)
//   node familia.cjs cerrar          → cierra el Chrome de la cuenta (fin del visor)
//   node familia.cjs leer            → {"ok":true,"admin":"…","miembros":[…],"invitaciones":[…],"limite":false}
//                                       (limite: alguna pestaña abierta, p. ej. la del visor, mostraba el límite de invitaciones)
//   node familia.cjs invitar CORREO  → {"ok":true,"invitado":"correo"}
//   node familia.cjs sacar CORREO    → {"ok":true,"sacado":"correo","era":"miembro"|"invitacion"}
//   errores                          → {"ok":false,"error":"sin_sesion"|"sin_navegador"|"visor_ocupado"|"otra_cuenta"|"no_encontrado"|"sin_lugar"|"no_confirmado"|"limite_invitaciones"|"…"}
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const CHROME = process.env.ZENBOT_CHROME || '/opt/zenbot/navegadores/chromium-1148/chrome-linux/chrome';
const PERFILES = process.env.ZENBOT_PERFILES || '/var/lib/zenbot/perfiles';
const CASA = process.env.ZENBOT_HOME || '/var/lib/zenbot/home';
const PANTALLA = process.env.ZENBOT_DISPLAY || ':99';
const PUERTO = Number(process.env.ZENBOT_PUERTO || 9333);
const ESTADO = path.join(PERFILES, '.estado.json');
// Un visor olvidado deja de apartar el Chrome después de este tiempo.
const VISOR_MINUTOS = 20;
const BASE = 'https://myaccount.google.com/';
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// «Has alcanzado el límite de invitaciones al grupo familiar. Inténtalo de nuevo más tarde.» (Google deja de aceptar
// invitaciones de la cuenta unos días).
const LIMITE = /l[ií]mite de invitaciones|reached the limit[^.]{0,40}invit/i;
// ZENBOT_ADMIN: correo esperado del administrador; si la sesión es de otra cuenta, no se hace nada.
const ESPERADO = (process.env.ZENBOT_ADMIN || '').trim().toLowerCase();
const [accion, objetivo] = [process.argv[2], (process.argv[3] || '').trim().toLowerCase()];

// Para cuando Google pide «verifica que eres tú» (p. ej. al quitar a un miembro): la contraseña de la cuenta y la
// clave de su 2FA llegan por variables de entorno desde el sistema (nunca por la línea de comandos).
const CLAVE = process.env.ZENBOT_PASS || '';
const SECRETO_2FA = (process.env.ZENBOT_TOTP || '').replace(/[^A-Za-z2-7]/g, '').toUpperCase();

/** Código de 6 dígitos (TOTP, RFC 6238, 30 s) a partir de la clave base32: lo mismo que una app autenticadora. */
function codigo2fa(secreto, desfase = 0) {
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const c of secreto) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
    const clave = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
    const contador = Buffer.alloc(8);
    contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + desfase));
    const h = crypto.createHmac('sha1', clave).update(contador).digest();
    const o = h[h.length - 1] & 15;

    return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

/** Si Google pide confirmar identidad, la completa con la contraseña y el código 2FA. Devuelve al terminar. */
async function verificarIdentidad(pagina) {
    for (let intento = 0; intento < 5; intento++) {
        await pagina.waitForLoadState('domcontentloaded').catch(() => {});
        const url = pagina.url();
        if (!url.startsWith('https://accounts.google.com/')) return;

        // Captcha («No soy un robot») u otra prueba de que hay una persona: eso lo hace siempre una persona, en el visor.
        const captcha = /recaptcha|challenge\/(recaptcha|dp|ipe)/.test(url) || (await pagina.locator('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]').count().catch(() => 0)) > 0;
        if (captcha) throw falla('requiere_persona', new URL(url).pathname);

        if (/challenge\/pwd/.test(url)) {
            if (!CLAVE) throw falla('falta_contrasena');
            const campo = pagina.locator('input[type=password]').first();
            await campo.waitFor({ timeout: 15000 });
            await campo.fill('');
            await campo.pressSequentially(CLAVE, { delay: 35 });
            await campo.press('Enter');
        } else if (/challenge\/totp/.test(url)) {
            if (!SECRETO_2FA) throw falla('falta_2fa');
            const campo = pagina.locator('input[type=tel], input[name=totpPin], input#totpPin').first();
            await campo.waitFor({ timeout: 15000 });
            await campo.fill('');
            await campo.pressSequentially(codigo2fa(SECRETO_2FA), { delay: 60 });
            await campo.press('Enter');
        } else if (/challenge\/selection|challenge\/ootp|challenge\/az|challenge\/ipp|challenge\/sk/.test(url)) {
            throw falla('verificacion_distinta', new URL(url).pathname);
        } else if (/signin\/(v2\/)?(identifier|rejected)|deniedsigninrejected/.test(url)) {
            throw falla('sin_sesion');
        }

        await pagina.waitForURL((u) => u.toString() !== url, { timeout: 20000 }).catch(() => {});
        await pagina.waitForTimeout(1500);
        if (pagina.url() === url) {
            const texto = (await pagina.innerText('body').catch(() => '')).toLowerCase();
            throw falla(/incorrect|wrong|erróne|equivocad/.test(texto) ? 'verificacion_rechazada' : 'verificacion_atorada', new URL(url).pathname);
        }
    }

    if (pagina.url().startsWith('https://accounts.google.com/')) throw falla('verificacion_atorada', new URL(pagina.url()).pathname);
}

// ——— Un Chrome por cuenta ———————————————————————————————————————————————————————————————

const perfilDe = (correo) => path.join(PERFILES, correo.replace(/[^a-z0-9@._-]/g, '_'));
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const leerEstado = () => { try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch { return null; } };
const guardarEstado = (e) => (e ? fs.writeFileSync(ESTADO, JSON.stringify(e)) : fs.rmSync(ESTADO, { force: true }));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cierra el Chrome abierto (deja que guarde la sesión: SIGTERM y, si no responde, SIGKILL). */
async function cerrarChrome(estado) {
    if (estado && vivo(estado.pid)) {
        try { process.kill(-estado.pid, 'SIGTERM'); } catch { try { process.kill(estado.pid, 'SIGTERM'); } catch {} }
        for (let i = 0; i < 40 && vivo(estado.pid); i++) await dormir(200);
        if (vivo(estado.pid)) { try { process.kill(-estado.pid, 'SIGKILL'); } catch { try { process.kill(estado.pid, 'SIGKILL'); } catch {} } }
    }
    guardarEstado(null);
}

/**
 * Deja abierto el Chrome de `correo` y se conecta a él. Si está abierto el de otra cuenta, lo cierra antes (salvo que
 * su visor esté en uso). Con `visor`, el Chrome queda apartado para la pantalla del visor.
 */
async function chromeDe(correo, visor = false) {
    let estado = leerEstado();
    if (estado && !vivo(estado.pid)) { guardarEstado(null); estado = null; }

    if (estado && estado.correo !== correo) {
        if (estado.visor && Date.now() - estado.desde < VISOR_MINUTOS * 60000) throw falla('visor_ocupado');
        await cerrarChrome(estado);
        estado = null;
    }

    if (!estado) {
        const perfil = perfilDe(correo);
        fs.mkdirSync(perfil, { recursive: true });
        fs.mkdirSync(CASA, { recursive: true });
        const hijo = spawn(CHROME, [
            `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--lang=es-MX',
            '--window-position=0,0', '--window-size=1366,860',
            '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${PUERTO}`, 'about:blank',
        ], { detached: true, stdio: 'ignore', env: { ...process.env, DISPLAY: PANTALLA, HOME: CASA, ZENBOT_PASS: '', ZENBOT_TOTP: '' } });
        hijo.unref();
        estado = { correo, pid: hijo.pid, visor: false, desde: Date.now() };
    }

    if (visor) { estado.visor = true; estado.desde = Date.now(); }
    guardarEstado(estado);

    for (let i = 0; i < 50; i++) {
        try { return { navegador: await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO}`, { timeout: 3000 }), estado }; } catch { await dormir(300); }
    }
    throw falla('sin_navegador');
}

let pestana = null;
let conexion = null;
let alSalir = null;
const salir = async (dato, codigo = 0) => {
    if (pestana) await pestana.close().catch(() => {});
    if (conexion) await conexion.close().catch(() => {});
    if (alSalir) await alSalir().catch(() => {});
    process.stdout.write(JSON.stringify(dato));
    process.exit(codigo);
};
// `detalle`: en qué pantalla de Google se quedó (solo la ruta, sin parámetros ni datos), para diagnosticar.
const falla = (codigo, detalle = null) => Object.assign(new Error(codigo), { codigo, detalle });

/** Abre una página de la cuenta y espera `listo`. Si Google manda a iniciar sesión, avisa. */
async function abrir(pagina, ruta, listo = 'body') {
    await pagina.goto(BASE + ruta.replace(/^\//, '') + (ruta.includes('?') ? '&' : '?') + 'hl=es', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!pagina.url().startsWith(BASE)) throw falla('sin_sesion');
    await pagina.waitForSelector(listo, { timeout: 20000 });
}

/** Miembros (con correo) e invitaciones pendientes del grupo. */
async function leer(pagina) {
    await abrir(pagina, 'family/details', 'a[href*="family/member/"]');
    const enlaces = await pagina.$$eval('a[href*="family/member/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), texto: a.innerText.replace(/\s+/g, ' ').trim() })));
    const quedan = await pagina.evaluate(() => (document.body.innerText.match(/quedan (\d+)/) || [null, null])[1]);
    const miembros = [];
    const invitaciones = [];
    let admin = null;

    for (const enlace of enlaces) {
        if (enlace.href.includes('family/member/i/')) {
            const correo = (enlace.texto.match(CORREO) || [null])[0];
            const caduca = (enlace.texto.match(/caduca el (.+)$/) || [null, null])[1];
            if (correo) invitaciones.push({ email: correo.toLowerCase(), caduca, href: enlace.href });
            continue;
        }

        // Miembro: el correo solo aparece en su propia página (después de «Volver…», no en la cabecera).
        let correo = null;
        for (let intento = 0; intento < 2 && !correo; intento++) {
            await abrir(pagina, enlace.href);
            await pagina
                .waitForFunction(() => { const t = document.body.innerText; const i = t.indexOf('Volver'); return i >= 0 && /@/.test(t.slice(i)); }, null, { timeout: 25000 })
                .catch(() => {});
            const cuerpo = await pagina.innerText('body');
            correo = (cuerpo.slice(Math.max(0, cuerpo.indexOf('Volver'))).match(CORREO) || [null])[0];
        }
        if (!correo && /Administrador(a)? familiar/i.test(enlace.texto)) throw falla('lectura_incompleta');
        const esAdmin = /Administrador(a)? familiar/i.test(enlace.texto);
        if (!correo) continue;
        if (esAdmin) admin = correo.toLowerCase();
        miembros.push({ email: correo.toLowerCase(), nombre: enlace.texto.replace(/Administrador(a)? familiar|Miembro/gi, '').trim(), admin: esAdmin, href: enlace.href });
    }

    if (!admin) throw falla('lectura_incompleta');
    if (ESPERADO && admin !== ESPERADO) throw falla('otra_cuenta');

    return { admin, miembros, invitaciones, quedan: quedan === null ? null : Number(quedan) };
}

async function invitar(pagina, correo) {
    const grupo = await leer(pagina);
    if (grupo.miembros.some((m) => m.email === correo) || grupo.invitaciones.some((i) => i.email === correo)) return { ok: true, invitado: correo, ya: true };
    if (grupo.quedan === 0) throw falla('sin_lugar');

    await abrir(pagina, 'family/invitemembers', 'input[placeholder="Escribe un nombre o correo"]');
    const campo = pagina.locator('input[placeholder="Escribe un nombre o correo"]');
    await campo.click();
    await campo.pressSequentially(correo, { delay: 45 });
    await pagina.waitForTimeout(1200);
    await campo.press('Enter');
    await pagina.waitForTimeout(1200);
    await pagina.getByRole('button', { name: 'Enviar', exact: true }).click();
    // Termina en «invitationcomplete» o en «Tu invitación no se ha enviado» (p. ej. por el límite de invitaciones).
    await pagina
        .waitForFunction((patron) => /invitationcomplete/.test(location.href) || new RegExp(patron, 'i').test(document.body.innerText), LIMITE.source, { timeout: 25000 })
        .catch(() => {});
    if (!/invitationcomplete/.test(pagina.url())) {
        if (LIMITE.test(await pagina.innerText('body').catch(() => ''))) throw falla('limite_invitaciones');
        if (!pagina.url().startsWith(BASE)) throw falla('sin_sesion');
        throw falla('no_confirmado');
    }

    return { ok: true, invitado: correo };
}

/** Confirma la baja: un diálogo «¿Cancelar invitación?» o la página family/remove de Google. `soloVer` no confirma. */
async function confirmarQuitar(pagina, soloVer) {
    const dialogo = pagina.locator('[role=dialog], [role=alertdialog]').last();
    if (await dialogo.isVisible().catch(() => false)) {
        if (!soloVer) await dialogo.getByRole('button', { name: /^(Sí|Retirar|Quitar|Eliminar|Confirmar)$/i }).first().click();
        return;
    }
    if (!pagina.url().startsWith(BASE)) throw falla('sin_sesion');
    await pagina.waitForSelector('button', { timeout: 15000 });
    if (soloVer) return;
    await pagina.getByRole('button', { name: /^(Retirar|Quitar|Quitar miembro|Eliminar|Confirmar|Sí)$/i }).last().click({ timeout: 10000 });
}

async function sacar(pagina, correo) {
    const grupo = await leer(pagina);
    const invitacion = grupo.invitaciones.find((i) => i.email === correo);
    const miembro = grupo.miembros.find((m) => m.email === correo && !m.admin);
    const destino = invitacion || miembro;
    if (!destino) throw falla('no_encontrado');

    await abrir(pagina, destino.href, 'button');
    await pagina.getByRole('button', { name: /^(Cancelar invitación|Quitar miembro)$/i }).first().click({ timeout: 10000 });
    await pagina.waitForTimeout(2500);
    await verificarIdentidad(pagina);
    await confirmarQuitar(pagina, accion === 'ver-quitar');
    if (accion === 'ver-quitar') return { ok: true, vista: (await pagina.innerText('body')).replace(/\n{2,}/g, '\n').slice(0, 900), url: pagina.url().split('?')[0] };
    await pagina.waitForTimeout(3000);
    if (!pagina.url().startsWith(BASE)) throw falla('sin_sesion');

    // Comprobación: ya no debe aparecer.
    const despues = await leer(pagina);
    if (despues.miembros.some((m) => m.email === correo) || despues.invitaciones.some((i) => i.email === correo)) throw falla('no_confirmado');

    return { ok: true, sacado: correo, era: invitacion ? 'invitacion' : 'miembro' };
}

(async () => {
    if (!CORREO.test(ESPERADO)) return salir({ ok: false, error: 'sin_cuenta' }, 2);

    if (accion === 'cerrar') {
        const estado = leerEstado();
        if (estado && estado.correo === ESPERADO) await cerrarChrome(estado);
        return salir({ ok: true });
    }

    let navegador;
    let estado;
    try {
        ({ navegador, estado } = await chromeDe(ESPERADO, accion === 'abrir'));
    } catch (e) {
        return salir({ ok: false, error: e.codigo || 'sin_navegador' }, 1);
    }
    conexion = navegador;
    // Si nadie tiene abierto el visor de esta cuenta, el Chrome se cierra al terminar.
    if (!estado.visor) alSalir = () => cerrarChrome(leerEstado());

    const contexto = navegador.contexts()[0];
    // Lo que ya estaba en pantalla (el visor): ¿Google mostraba el límite de invitaciones?
    let limite = false;
    if (accion === 'leer') {
        for (const abierta of contexto.pages()) {
            if (LIMITE.test(await abierta.innerText('body', { timeout: 3000 }).catch(() => ''))) limite = true;
        }
    }
    const pagina = (pestana = await contexto.newPage());
    try {
        if (accion === 'abrir') {
            // Visor: deja una sola pestaña al frente, en el grupo familiar (Google manda a iniciar sesión si hace falta).
            for (const otra of contexto.pages()) if (otra !== pagina) await otra.close().catch(() => {});
            await pagina.goto(BASE + 'family/details?hl=es', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await pagina.bringToFront();
            pestana = null;
            const dentro = pagina.url().startsWith(BASE);
            return await salir({ ok: true, sesion: dentro });
        }
        if (accion === 'leer') {
            const grupo = await leer(pagina);
            return await salir({ ok: true, ...grupo, limite, leido: new Date().toISOString() });
        }
        if (['invitar', 'sacar', 'ver-quitar'].includes(accion) && CORREO.test(objetivo)) {
            return await salir(accion === 'invitar' ? await invitar(pagina, objetivo) : await sacar(pagina, objetivo));
        }

        return await salir({ ok: false, error: 'accion_invalida' }, 2);
    } catch (e) {
        // Si Google pide algo que debe hacer una persona, el Chrome se queda abierto en esa pantalla para el visor.
        if (['requiere_persona', 'verificacion_distinta', 'verificacion_atorada', 'verificacion_rechazada'].includes(e.codigo)) {
            const actual = leerEstado();
            if (actual && actual.correo === ESPERADO) guardarEstado({ ...actual, visor: true, desde: Date.now() });
            alSalir = null;
            await pagina.bringToFront().catch(() => {});
            pestana = null;
        }

        return await salir({ ok: false, error: e.codigo || String(e.message || e).slice(0, 200), detalle: e.detalle || null }, 1);
    }
})();
