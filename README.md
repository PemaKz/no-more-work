# no-more-work

Aplicación construida sobre [Zyket](https://www.npmjs.com/package/zyket) (backend con Express + better-auth) y un frontend React/Vite servido por el mismo proceso.

El registro público está deshabilitado: los usuarios se crean exclusivamente vía script CLI.

---

## Requisitos

- Node.js 18+
- npm
- (Opcional) Redis si quieres usar `CACHE_URL`
- (Opcional) PostgreSQL si cambias `DATABASE_DIALECT` a `postgresql`

---

## Instalación

```bash
npm install
```

Esto instala las dependencias del backend. El frontend (en [frontend/](frontend/)) se monta con Vite a través del servicio `vite` de Zyket, por lo que no requiere `npm install` separado.

---

## Arranque

```bash
npm run dev
```

Esto arranca el `Kernel` definido en [index.js](index.js), que monta:

- API en `http://localhost:3000` (incluye `/api/auth/*` de better-auth)
- Frontend (Vite) en `http://localhost:5173`

Abrir el frontend en `http://localhost:5173`. Te redirige a `/auth` (login).

---

## Migraciones de la base de datos

La primera vez (y cuando cambies el esquema de auth) ejecuta:

```bash
npm run migrate
```

Esto lanza el CLI de `@better-auth/cli` apuntando a [src/services/auth/auth.js](src/services/auth/auth.js) y crea/actualiza las tablas `user`, `session`, `account`, `verification`, `organization`, `member`, etc.

> SQLite (por defecto) crea el fichero [database.sqlite](database.sqlite) en la raíz del proyecto.

---

## Crear usuarios

El registro desde la UI está deshabilitado. Para crear usuarios usa el script:

### Interactivo

```bash
npm run create-user
```

Te preguntará email, nombre y contraseña (mínimo 8 caracteres).

### Con argumentos

```bash
npm run create-user -- --email=admin@example.com --name="Admin" --password=12345678
```

### Crear un admin

```bash
npm run create-user -- --email=admin@example.com --name="Admin" --password=12345678 --role=admin
```

> El script ([scripts/create-user.js](scripts/create-user.js)) boota el `Kernel` con el mismo `AuthService` que la app y llama a `auth.api.signUpEmail` de better-auth. Usa un PORT aleatorio internamente para no chocar con un `npm run dev` en marcha.

---

## Variables de entorno (`.env`)

Las variables se cargan automáticamente al boot del Kernel desde el `.env` en la raíz del proyecto. `AUTH_SECRET`, `TRUSTED_ORIGINS` y `BETTER_AUTH_URL` las añade Zyket si no existen.

### Core

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor HTTP (API + auth). |
| `DEBUG` | `false` | Si `true`, activa logs de nivel debug. |
| `LOG_DIRECTORY` | `./logs` | Carpeta donde se escriben los logs. |

### Base de datos (requerido por better-auth)

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_DIALECT` | — | `sqlite` o `postgresql`. **Obligatorio.** |
| `DATABASE_URL` | — | Ruta al fichero SQLite (ej. `./database.sqlite`) o connection string de Postgres. Si vacío con SQLite, usa `./database.sqlite`. Si vacío con Postgres, falla. |

> Cuando `DATABASE_URL` está definido, Zyket también registra un servicio `database` (Sequelize) para uso general — independiente de better-auth.

### Auth (better-auth)

| Variable | Default (Zyket auto-genera) | Descripción |
|---|---|---|
| `AUTH_SECRET` | `change-this-secret-in-production` | Secreto para firmar cookies/JWT. **Cambiar en producción.** |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL base donde está montado `/api/auth`. |
| `TRUSTED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Orígenes permitidos (CORS), separados por coma. |

### Frontend (Vite)

| Variable | Default | Descripción |
|---|---|---|
| `VITE_ROOT` | `./frontend` | Raíz del proyecto Vite. Si vacío, el servicio vite no arranca. |
| `VITE_PORT` | `5173` | Puerto del dev server de Vite. |
| `DISABLE_VITE` | `false` | `true` para no arrancar Vite. |
| `VITE_API_BASE` | `http://localhost:3000` | URL base del backend, leída por el frontend para construir el cliente de better-auth ([frontend/src/store/storeAuth.jsx](frontend/src/store/storeAuth.jsx)). |

### Cache

| Variable | Default | Descripción |
|---|---|---|
| `CACHE_URL` | (vacío) | Vacío = cache en memoria. Para Redis: `redis://localhost:6379`. Se usa como `secondaryStorage` de better-auth (sesiones). |

### Servicios opcionales (flags)

| Variable | Default | Descripción |
|---|---|---|
| `DISABLE_EXPRESS` | `false` | `true` para no arrancar Express. |
| `DISABLE_SOCKET` | `false` | `true` para no arrancar Socket.IO. |
| `DISABLE_EVENTS` | `false` | `true` para no arrancar el bus de eventos. |
| `DISABLE_BULLMQ` | `false` | `true` para no arrancar BullMQ. |
| `DISABLE_SCHEDULER` | `false` | `true` para no arrancar el scheduler de cron. |
| `QUEUES` | (vacío) | Lista de colas BullMQ separadas por coma. |

### S3 (opcional)

Sólo se activa si los cuatro primeros están definidos.

| Variable | Descripción |
|---|---|
| `S3_ENDPOINT` | Host del bucket (sin protocolo). |
| `S3_PORT` | Puerto. |
| `S3_USE_SSL` | `true`/`false`. |
| `S3_ACCESS_KEY` | Access key. |
| `S3_SECRET_KEY` | Secret key. |

---

## Estructura

```
.
├── index.js                       # Boot del Kernel de Zyket
├── src/
│   ├── services/auth/             # CustomAuthService (extiende AuthService de zyket)
│   ├── routes/                    # Rutas HTTP custom
│   └── middlewares/               # Middlewares HTTP custom
├── scripts/
│   └── create-user.js             # CLI para crear usuarios
├── frontend/
│   └── src/
│       ├── layouts/auth/          # Layout y rutas de /auth (solo login)
│       ├── views/auth/            # Vista de login
│       ├── hooks/useAuth.jsx      # login / logout / sesión
│       ├── store/storeAuth.jsx    # Cliente de better-auth (Zustand)
│       └── middlewares/           # LoggedMiddleware / NotLogged / Admin
└── .env
```

---

## Flujo de auth

- **Servidor:** `AuthService` (extendido en [src/services/auth/index.js](src/services/auth/index.js)) configura `better-auth` con plugins `admin`, `bearer`, `organization` y monta `/api/auth/*` en Express.
- **Cliente:** [frontend/src/store/storeAuth.jsx](frontend/src/store/storeAuth.jsx) crea el `authClient` apuntando a `${VITE_API_BASE}/api/auth/`. El hook [useAuth](frontend/src/hooks/useAuth.jsx) expone `login`, `logout`, `user`, `session`.
- **Registro:** deshabilitado en la UI — únicamente vía [scripts/create-user.js](scripts/create-user.js).
