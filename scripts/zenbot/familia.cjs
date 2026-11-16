// Lector del grupo familiar de Google (SOLO LECTURA).
// Se conecta al Chrome del servidor que ya tiene la sesión del administrador del grupo (zenbot-navegador,
// depuración solo en 127.0.0.1), abre una pestaña, lee miembros e invitaciones pendientes, la cierra y
// escribe un JSON en la salida. Nunca da clic en nada.
//
//   node familia.cjs leer   →  {"ok":true,"admin":"x@gmail.com","miembros":[...],"invitaciones":[...]}
//                           →  {"ok":false,"error":"sin_sesion" | "..."}
const { chromium } = require('playwright');

const CDP = process.env.ZENBOT_CDP || 'http://127.0.0.1:9333';
const BASE = 'https://myaccount.google.com/';
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

let pestana = null;
const salir = async (dato, codigo = 0) => {
    if (pestana) await pestana.close().catch(() => {});
    process.stdout.write(JSON.stringify(dato));
    process.exit(codigo);
};

/** Abre una página de la cuenta y espera a que aparezca `listo` (selector). Si Google manda a iniciar sesión, avisa. */
async function abrir(pagina, ruta, listo) {
    await pagina.goto(BASE + ruta + (ruta.includes('?') ? '&' : '?') + 'hl=es', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!pagina.url().startsWith(BASE)) throw Object.assign(new Error('sin_sesion'), { codigo: 'sin_sesion' });
    await pagina.waitForSelector(listo, { timeout: 20000 });
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
        await abrir(pagina, 'family/details', 'a[href*="family/member/"]');
        const enlaces = await pagina.$$eval('a[href*="family/member/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), texto: a.innerText.replace(/\s+/g, ' ').trim() })));

        const miembros = [];
        const invitaciones = [];
        let admin = null;

        for (const enlace of enlaces) {
            if (enlace.href.includes('family/member/i/')) {
                const correo = (enlace.texto.match(CORREO) || [null])[0];
                const caduca = (enlace.texto.match(/caduca el (.+)$/) || [null, null])[1];
                if (correo) invitaciones.push({ email: correo.toLowerCase(), caduca });
                continue;
            }

            // Miembro: el correo solo aparece en su propia página.
            await abrir(pagina, enlace.href.replace(/^\//, ''), 'body');
            await pagina.waitForFunction(() => /@/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
            // Solo el contenido (después de «Volver a la página anterior»), no la cabecera de la cuenta.
            const cuerpo = await pagina.innerText('body');
            const texto = cuerpo.slice(Math.max(0, cuerpo.indexOf('Volver')));
            const correo = (texto.match(CORREO) || [null])[0];
            const esAdmin = /Administrador(a)? familiar/i.test(enlace.texto);
            if (!correo) continue;
            if (esAdmin) admin = correo.toLowerCase();
            miembros.push({ email: correo.toLowerCase(), nombre: enlace.texto.replace(/Administrador(a)? familiar|Miembro/gi, '').trim(), admin: esAdmin });
        }

        await salir({ ok: true, admin, miembros, invitaciones, leido: new Date().toISOString() });
    } catch (e) {
        await salir({ ok: false, error: e.codigo || String(e.message || e).slice(0, 200) }, 1);
    }
})();
