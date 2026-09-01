// crypto-js se carga de forma dinámica y perezosa, y se pasa como valor opaco a los scripts
// de usuario (ver ScriptRunnerService) — no necesitamos sus tipos reales dentro de la app.
declare module 'crypto-js';
