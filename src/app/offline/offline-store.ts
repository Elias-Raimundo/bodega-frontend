/*
 * Almacenamiento del modo sin conexión.
 *
 * Usa IndexedDB (la base de datos del navegador), que admite cientos de MB.
 * localStorage tiene un límite de ~5 MB por sitio y ya lo ocupa en parte el
 * logo de la empresa: con una lista grande de productos se llenaba y el
 * navegador rechazaba los guardados sin avisar.
 *
 * Todo se mantiene también en memoria, así las lecturas son instantáneas;
 * cada cambio se guarda en IndexedDB en segundo plano.
 */

const DB_NAME = 'bodega-offline';
const STORE = 'kv';

export class OfflineStore {

  private mem = new Map<string, any>();
  private db: IDBDatabase | null = null;

  // Se resuelve cuando terminó de cargar lo guardado
  readonly ready: Promise<void>;

  // Avisa si un guardado falló (para mostrar un error en pantalla)
  onWriteError: (key: string) => void = () => {};

  constructor() {
    this.ready = this.init();
  }

  get<T>(key: string, fallback: T): T {
    if (!this.mem.has(key)) return fallback;
    // Copia, para que nadie modifique lo guardado sin querer
    return structuredClone(this.mem.get(key));
  }

  has(key: string): boolean {
    return this.mem.has(key);
  }

  set(key: string, value: any) {
    const copy = structuredClone(value);
    this.mem.set(key, copy);

    // La cola de pendientes es lo más importante: además se guarda una
    // copia de respaldo en localStorage (es chica).
    if (key.endsWith(':queue')) {
      try {
        localStorage.setItem(key + '-backup', JSON.stringify(copy));
      } catch {
        // si no entra, queda igual en IndexedDB
      }
    }

    if (!this.db) {
      this.onWriteError(key);
      return;
    }

    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(copy, key);
      tx.onerror = () => this.onWriteError(key);
      tx.onabort = () => this.onWriteError(key);
    } catch {
      this.onWriteError(key);
    }
  }

  private async init() {
    try {
      this.db = await this.open();
      await this.loadAll();
    } catch {
      this.db = null;
    }

    this.migrateFromLocalStorage();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private loadAll(): Promise<void> {
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE, 'readonly');
      const cursorReq = tx.objectStore(STORE).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          this.mem.set(String(cursor.key), cursor.value);
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    });
  }

  // La versión anterior guardaba todo en localStorage: se pasa a IndexedDB
  // y se borra de localStorage para liberar espacio.
  private migrateFromLocalStorage() {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('offline:')) keys.push(k);
      }

      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw == null) continue;

        if (k.endsWith(':queue-backup')) {
          // Si por algo la cola no está en IndexedDB, se recupera del respaldo
          const queueKey = k.replace(/-backup$/, '');
          if (!this.mem.has(queueKey)) {
            this.set(queueKey, JSON.parse(raw));
          }
          continue;
        }

        if (!this.mem.has(k)) {
          this.set(k, JSON.parse(raw));
        }
        localStorage.removeItem(k);
      }
    } catch {
      // ignorado
    }
  }
}
