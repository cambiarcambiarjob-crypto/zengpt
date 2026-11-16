// Grupo familiar de Google con el navegador del servidor (zenbot-navegador, sesión del administrador del grupo,
// depuración solo en 127.0.0.1). Abre una pestaña, hace UNA acción y la cierra. Siempre responde un JSON.
//
//   node familia.cjs abrir-login     → deja una pestaña en el inicio de sesión de Google (para el visor)
//   node familia.cjs leer            → {"ok":true,"admin":"…","miembros":[…],"invitaciones":[…]}
//   node familia.cjs invitar CORREO  → {"ok":true,"invitado":"correo"}
//   node familia.cjs sacar CORREO    → {"ok":true,"sacado":"correo","era":"miembro"|"invitacion"}
//   errores                          → {"ok":false,"error":"sin_sesion"|"sin_navegador"|"otra_cuenta"|"no_encontrado"|"sin_lugar"|"no_confirmado"|"…"}
const crypto = require('crypto');
const { chromium } = require('playwright');

const CDP = process.env.ZENBOT_CDP || 'http://127.0.0.1:9333';
const BASE = 'https://myaccount.google.com/';
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
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
            throw falla('verificacion_distinta');
        } else if (/signin\/(v2\/)?(identifier|rejected)|deniedsigninrejected/.test(url)) {
            throw falla('sin_sesion');
        }

        await pagina.waitForURL((u) => u.toString() !== url, { timeout: 20000 }).catch(() => {});
        await pagina.waitForTimeout(1500);
        if (pagina.url() === url) {
            const texto = (await pagina.innerText('body').catch(() => '')).toLowerCase();
            throw falla(/incorrect|wrong|erróne|equivocad/.test(texto) ? 'verificacion_rechazada' : 'verificacion_atorada');
        }
    }

    if (pagina.url().startsWith('https://accounts.google.com/')) throw falla('verificacion_atorada');
}

let pestana = null;
const salir = async (dato, codigo = 0) => {
    if (pestana) await pestana.close().catch(() => {});
    process.stdout.write(JSON.stringify(dato));
    process.exit(codigo);
};
const falla = (codigo) => Object.assign(new Error(codigo), { codigo });

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
    await pagina.waitForURL(/invitationcomplete/, { timeout: 25000 }).catch(() => {});
    if (!/invitationcomplete/.test(pagina.url())) {
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
    let navegador;
    try {
        navegador = await chromium.connectOverCDP(CDP, { timeout: 10000 });
    } catch {
        return salir({ ok: false, error: 'sin_navegador' }, 1);
    }

    const pagina = (pestana = await navegador.contexts()[0].newPage());
    try {
        if (accion === 'abrir-login') {
            // Para iniciar sesión a mano desde el visor: la pestaña se queda abierta y al frente.
            await pagina.goto('https://accounts.google.com/ServiceLogin?hl=es&continue=' + encodeURIComponent(BASE + 'family/details?hl=es'), { waitUntil: 'domcontentloaded', timeout: 30000 });
            await pagina.bringToFront();
            pestana = null;
            return await salir({ ok: true, url: pagina.url().split('?')[0] });
        }
        if (accion === 'leer') {
            const grupo = await leer(pagina);
            return await salir({ ok: true, ...grupo, leido: new Date().toISOString() });
        }
        if (['invitar', 'sacar', 'ver-quitar'].includes(accion) && CORREO.test(objetivo)) {
            return await salir(accion === 'invitar' ? await invitar(pagina, objetivo) : await sacar(pagina, objetivo));
        }

        return await salir({ ok: false, error: 'accion_invalida' }, 2);
    } catch (e) {
        return await salir({ ok: false, error: e.codigo || String(e.message || e).slice(0, 200) }, 1);
    }
})();
