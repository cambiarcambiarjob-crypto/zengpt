// Grupo familiar de Google con el navegador del servidor (zenbot-navegador, sesión del administrador del grupo,
// depuración solo en 127.0.0.1). Abre una pestaña, hace UNA acción y la cierra. Siempre responde un JSON.
//
//   node familia.cjs leer            → {"ok":true,"admin":"…","miembros":[…],"invitaciones":[…]}
//   node familia.cjs invitar CORREO  → {"ok":true,"invitado":"correo"}
//   node familia.cjs sacar CORREO    → {"ok":true,"sacado":"correo","era":"miembro"|"invitacion"}
//   errores                          → {"ok":false,"error":"sin_sesion"|"sin_navegador"|"otra_cuenta"|"no_encontrado"|"sin_lugar"|"no_confirmado"|"…"}
const { chromium } = require('playwright');

const CDP = process.env.ZENBOT_CDP || 'http://127.0.0.1:9333';
const BASE = 'https://myaccount.google.com/';
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// ZENBOT_ADMIN: correo esperado del administrador; si la sesión es de otra cuenta, no se hace nada.
const ESPERADO = (process.env.ZENBOT_ADMIN || '').trim().toLowerCase();
const [accion, objetivo] = [process.argv[2], (process.argv[3] || '').trim().toLowerCase()];

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
        await abrir(pagina, enlace.href);
        await pagina.waitForFunction(() => /@/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        const cuerpo = await pagina.innerText('body');
        const correo = (cuerpo.slice(Math.max(0, cuerpo.indexOf('Volver'))).match(CORREO) || [null])[0];
        const esAdmin = /Administrador(a)? familiar/i.test(enlace.texto);
        if (!correo) continue;
        if (esAdmin) admin = correo.toLowerCase();
        miembros.push({ email: correo.toLowerCase(), nombre: enlace.texto.replace(/Administrador(a)? familiar|Miembro/gi, '').trim(), admin: esAdmin, href: enlace.href });
    }

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

async function sacar(pagina, correo) {
    const grupo = await leer(pagina);
    const invitacion = grupo.invitaciones.find((i) => i.email === correo);
    const miembro = grupo.miembros.find((m) => m.email === correo && !m.admin);
    const destino = invitacion || miembro;
    if (!destino) throw falla('no_encontrado');

    await abrir(pagina, destino.href, 'button');
    const boton = pagina.getByRole('button', { name: /Cancelar invitación|Quitar (miembro|de la familia)|Eliminar miembro|Quitar/i }).first();
    await boton.click({ timeout: 10000 });
    const dialogo = pagina.locator('[role=dialog], [role=alertdialog]').last();
    await dialogo.waitFor({ timeout: 10000 });
    await dialogo.getByRole('button', { name: /^(Sí|Quitar|Eliminar|Confirmar)$/i }).first().click();
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
        if (accion === 'leer') {
            const grupo = await leer(pagina);
            return await salir({ ok: true, ...grupo, leido: new Date().toISOString() });
        }
        if ((accion === 'invitar' || accion === 'sacar') && CORREO.test(objetivo)) {
            return await salir(accion === 'invitar' ? await invitar(pagina, objetivo) : await sacar(pagina, objetivo));
        }

        return await salir({ ok: false, error: 'accion_invalida' }, 2);
    } catch (e) {
        return await salir({ ok: false, error: e.codigo || String(e.message || e).slice(0, 200) }, 1);
    }
})();
