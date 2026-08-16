import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function getSecret() {
  const secret = import.meta.env.JWT_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Falta JWT_SECRET. Copia .env.example a .env y define un secreto.");
  }
  return encoder.encode(secret);
}

export const SESSION_COOKIE_NAME =
  import.meta.env.SESSION_COOKIE_NAME ?? process.env.SESSION_COOKIE_NAME ?? "sisges_session";

/** Datos que viajan dentro del JWT una vez el usuario eligió empresa. */
export interface SessionPayload {
  idusuario: number;
  usuario: string;
  nombreCompleto: string;
  idempresa: number;
  empresaNombre: string;
  administrador: boolean;
  permisos: {
    inventario: boolean;
    caja: boolean;
    contabilidad: boolean;
    personal: boolean;
    finanzas: boolean;
    facturas: boolean;
    herramientas: boolean;
    reportes: boolean;
    crearCajero: boolean;
    esAdminEmpresa: boolean;
  };
}

/** Sesión "parcial": el usuario ya puso usuario/clave correctos pero
 * todavía no eligió con qué empresa va a trabajar. */
export interface PreSessionPayload {
  idusuario: number;
  usuario: string;
  nombreCompleto: string;
  administrador: boolean;
  step: "elegir-empresa";
}

export async function signSession(payload: SessionPayload | PreSessionPayload) {
  const expiresIn = "step" in payload ? "10m" : "12h";
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifySession<T extends SessionPayload | PreSessionPayload>(
  token: string | undefined
): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as T;
  } catch {
    return null;
  }
}
