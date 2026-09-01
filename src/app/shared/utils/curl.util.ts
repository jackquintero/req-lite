import { ResolvedRequest } from '../../core/services/http-executor.service';

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurlCommand(request: ResolvedRequest): string {
  const parts = [`curl -X ${request.method} ${quote(request.url)}`];

  for (const [key, value] of Object.entries(request.headers)) {
    parts.push(`-H ${quote(`${key}: ${value}`)}`);
  }

  if (request.body instanceof FormData) {
    for (const [key, value] of request.body.entries()) {
      if (value instanceof File) {
        // Los navegadores no exponen la ruta absoluta de un archivo elegido por seguridad;
        // hay que completar la ruta local a mano antes de correr el comando.
        parts.push(`-F ${quote(`${key}=@/ruta/local/${value.name}`)}`);
      } else {
        parts.push(`-F ${quote(`${key}=${value}`)}`);
      }
    }
  } else if (typeof request.body === 'string' && request.body) {
    parts.push(`--data-raw ${quote(request.body)}`);
  }

  return parts.join(' \\\n  ');
}
