import { useEffect, useState } from "react";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeSocket,
} from "../store/socket";
import useAuth from "./useAuth";

/**
 * Hook que devuelve la instancia (singleton) del socket conectado a la
 * sesión actual. Si el usuario no tiene sesión, devuelve null y deja
 * desconectado.
 *
 * El socket se inicializa una sola vez por sesión gracias al store
 * compartido — múltiples llamadas a useSocket() retornan la misma
 * instancia.
 */
export default function useSocket() {
  const { session } = useAuth();
  const token = session?.token || null;
  const [socket, setSocket] = useState(() => getSocket());

  // Inicia/cierra conexión según haya token
  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    connectSocket(token);
  }, [token]);

  // Mantiene el state local sincronizado con la instancia del store
  useEffect(() => subscribeSocket(setSocket), []);

  return socket;
}
