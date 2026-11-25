{{-- Estilos compartidos de los visores del Chrome del servidor (iniciar sesión y crear cuenta). --}}
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
        #pantalla { background: #000; min-height: 0; overflow: hidden; position: relative; }
        #espera { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; color: var(--suave); font-size: 14px; line-height: 1.5; }
        #ocupadas { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; padding: 24px; background: rgba(0,0,0,.85); z-index: 2; }
        #ocupadas.si { display: flex; }
        #ocupadas div { max-width: 460px; border: 1px solid rgba(229,83,75,.4); background: var(--superficie); border-radius: 8px; padding: 18px; display: grid; gap: 12px; font-size: 13px; color: var(--suave); line-height: 1.5; }
        #ocupadas b { color: var(--texto); }
        #ocupadas ul { margin: 0; padding-left: 18px; color: var(--texto); }
        [data-pegar]:disabled, #listo:disabled { opacity: .45; cursor: not-allowed; }
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
        .sacar { padding: 10px; border: 1px solid rgba(229,83,75,.35); border-radius: 6px; background: rgba(229,83,75,.05); font-size: 12px; color: var(--suave); display: grid; gap: 8px; }
        .sacar p { margin: 0; line-height: 1.4; }
        .sacar b { color: var(--texto); }
        .sacar-estado { display: grid; gap: 6px; }
        .sacar-estado[hidden] { display: none; }
        .sacar-fila { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
        .reloj { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--texto); font-size: 14px; }
        .sacar-estado.ok #sacar-texto { color: var(--acento); }
        .sacar-estado.mal #sacar-texto { color: var(--peligro); }
        #sacar:disabled { opacity: .45; cursor: not-allowed; }
        #mayus.activadas { border-color: var(--alerta); background: rgba(217,162,58,.14); color: var(--alerta); font-weight: 600; }
        button.peligro:hover { background: rgba(229,83,75,.12); border-color: var(--peligro); color: var(--peligro); }
        a { color: var(--acento); }
        @media (max-width: 860px) { main { grid-template-columns: 1fr; grid-template-rows: 60vh auto; } aside { border-left: 0; border-top: 1px solid var(--borde); } }
    </style>
