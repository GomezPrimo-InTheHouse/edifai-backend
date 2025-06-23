# refresh-token


# env 
# AUTH_USERNAME=JULIAN
# AUTH_PASSWORD=1234
# JWT_SECRET=supersecret


# PGUSER=postgres
# PGPASSWORD=1995
# PGHOST=localhost
# PGPORT=5433
#### PGDATABASE=refresh-token

# 📝 Explicación del proceso de registro de usuarios
El sistema cuenta con una ruta RESTful POST /auth/register que permite registrar nuevos usuarios de forma segura, validada y lista para autenticación en dos pasos (2FA). A continuación se detalla el flujo completo del registro.

1. 📥 Recepción de datos
El endpoint espera recibir un cuerpo (body) en formato JSON con los siguientes campos:

nombre: Nombre completo del usuario.

email: Correo electrónico único.

password: Contraseña en texto plano, que será encriptada antes de almacenarse.

rol: Rol del usuario dentro del sistema. Solo se aceptan valores válidos predefinidos.

2. ✅ Validaciones iniciales
Antes de procesar la creación del usuario, se realiza lo siguiente:

Validación de campos obligatorios: Se verifica que todos los campos hayan sido enviados.

Validación de rol permitido: Solo se aceptan los roles 'usuario', 'admin', 'expositor', 'asistente' y 'organizador'. Si se recibe un rol distinto, el sistema lo rechaza.

Verificación de email duplicado: Se consulta la base de datos para asegurarse de que el correo no esté ya registrado.

3. 🔐 Seguridad de la contraseña
La contraseña proporcionada por el usuario es hasheada utilizando bcrypt, con un costo de procesamiento de 10 rondas. Esto garantiza que, incluso en caso de filtración de datos, las contraseñas no puedan ser fácilmente revertidas.

4. 🔒 Configuración de segundo factor (2FA)
Como medida de seguridad adicional, se genera un código secreto TOTP (Time-based One-Time Password) asociado al email del usuario. Este secreto se almacena en la base de datos y se genera un código QR en formato data:image/png;base64, el cual puede ser escaneado con aplicaciones como Google Authenticator o Authy.

5. 🗃️ Almacenamiento en base de datos
Una vez completadas todas las validaciones, se inserta el nuevo usuario en la tabla usuarios con los siguientes datos:

Rol y nombre.

Email único.

Contraseña hasheada.

Clave secreta TOTP.

Fecha de creación (NOW()).

Estado inicial como "activo".

6. 📤 Respuesta al cliente
La API responde con un código 201 Created e incluye:

Los datos públicos del usuario recién creado (sin contraseña).

Un mensaje de confirmación.

El QR codificado en base64 para configurar el segundo factor desde frontend.

Este proceso asegura que cada usuario se registre de forma válida, segura, única y preparada para autenticación en dos pasos, reforzando la integridad del sistema.

# Explicacion de apiRest /login
✅ Flujo de autenticación
Autenticación básica (Basic Auth):

1. El middleware basicAuth valida las credenciales básicas (email y contraseña) contra los datos almacenados en la base de datos.

Si son válidas, se adjunta el usuario como req.user.

2. Verificación del TOTP (2FA):

Se toma el código totp del body.

Se verifica usando la librería speakeasy con el secreto almacenado en la base de datos.

Si el código no es válido (por tiempo o token incorrecto), se rechaza la solicitud con error 401 Unauthorized.

3. Generación de tokens JWT:

Si el login es exitoso, se generan dos tokens:

accessToken válido por 1 hora.

refreshToken válido por 7 días.

Ambos tokens incluyen información segura del usuario, y están firmados con claves almacenadas en variables de entorno:

JWT_SECRET

JWT_REFRESH_SECRET

Registro de sesión:

4. Se crea un registro de sesión en la tabla sesiones, asociando el usuario con sus tokens y el estado actual de la sesión


# Explicacion apiRest  /refresh-token :
📤 Endpoint
Ruta: POST /auth/refresh-token

Requiere autenticación previa: ✅ (con refreshToken válido guardado en la sesión del usuario)

Request Body:


{
  "email": "usuario@example.com"
}
⚙️ Funcionamiento
1. Verificación del usuario:

Se busca el usuario en la base de datos utilizando el email proporcionado en el body.

Si el usuario no existe, se responde con 404 Usuario no encontrado.

2. Verificación de la sesión activa:

Se consulta la tabla sesiones buscando la última sesión activa del usuario (ordenada por fecha).

Si no hay ninguna sesión, se responde con 403 Sesión no encontrada.

3. Verificación del refreshToken:

El refresh_token de la sesión es verificado usando jwt.verify con la clave JWT_REFRESH_SECRET.

Si el token es inválido o expiró:

Se elimina la sesión de la base de datos.

Se responde con 403 Refresh token inválido o expirado.

4. Generación de nuevo accessToken:

Si el refreshToken es válido:

Se genera un nuevo accessToken válido por 15 minutos (expiresIn: '1h').

Se actualiza la sesión en la base de datos con el nuevo token y el timestamp actual.

Respuesta al cliente:


{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
🔐 Seguridad implementada
Solo los usuarios con sesiones activas pueden renovar su accessToken.

Los refreshTokens están firmados con una clave secreta y se almacenan en la base de datos para control de validez.

Las sesiones se eliminan automáticamente si el refreshToken está comprometido o caducado.

El accessToken renovado tiene una vida útil corta (15 minutos), lo que permite un control más fino sobre la seguridad de las sesiones.


# Script SQL para la creacion de tablas:

```sql
-- Tabla estado
CREATE TABLE estado (
id SERIAL PRIMARY KEY,
nombre VARCHAR(50) UNIQUE NOT NULL,
descripcion TEXT
);

-- Tabla usuarios
CREATE TABLE usuarios (
id SERIAL PRIMARY KEY,
nombre VARCHAR(100) NOT NULL,
email VARCHAR(100) UNIQUE NOT NULL,
password_hash TEXT NOT NULL,
rol VARCHAR(30) NOT NULL,
totp_seed TEXT,
estado_id INTEGER REFERENCES estado(id),
creado_en TIMESTAMP DEFAULT NOW(),
actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla sesiones
CREATE TABLE sesiones (
id SERIAL PRIMARY KEY,
usuario_id INTEGER REFERENCES usuarios(id),
access_token TEXT NOT NULL,
refresh_token TEXT NOT NULL,
creado_en TIMESTAMP DEFAULT NOW(),
actualizado_en TIMESTAMP DEFAULT NOW(),
estado_id INTEGER REFERENCES estado(id)
);

-- Tabla ubicacion
CREATE TABLE ubicacion (
id SERIAL PRIMARY KEY,
nombre TEXT,
localidad VARCHAR(100),
provincia VARCHAR(100),
descripcion TEXT
);

-- Tabla eventos
CREATE TABLE eventos (
id SERIAL PRIMARY KEY,
nombre VARCHAR(100) NOT NULL,
descripcion TEXT,
capacidad INT,
fecha_inicio_evento DATE NOT NULL,
fecha_fin_evento DATE NOT NULL,
ubicacion_id INTEGER REFERENCES ubicacion(id),
estado_id INTEGER REFERENCES estado(id),
creado_en TIMESTAMP DEFAULT NOW(),
actualizado_en TIMESTAMP
);

-- Tabla participantes
CREATE TABLE participantes (
id SERIAL PRIMARY KEY,
nombre VARCHAR(100) NOT NULL,
apellido VARCHAR(100) NOT NULL,
email VARCHAR(100) UNIQUE NOT NULL,
telefono VARCHAR(20),
creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla tipo_inscripcion
CREATE TABLE tipo_inscripcion (
id SERIAL PRIMARY KEY,
nombre TEXT,
tarifa INT
);

-- Tabla inscripciones
CREATE TABLE inscripciones (
id SERIAL PRIMARY KEY,
participante_id INTEGER REFERENCES participantes(id),
evento_id INTEGER REFERENCES eventos(id),
tipo_tarifa_id INTEGER REFERENCES tipo_inscripcion(id),
ingreso_registrado BOOLEAN DEFAULT FALSE,
qr_code TEXT,
estado_id INTEGER REFERENCES estado(id),
creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla notificacion
CREATE TABLE notificacion (
id SERIAL PRIMARY KEY,
destinatarioId INTEGER REFERENCES usuarios(id),
mensaje TEXT,
fechaEnvio TIMESTAMP,
tipo VARCHAR,
estadoId INTEGER REFERENCES estado(id)
);

-- Tabla salas
CREATE TABLE salas (
id SERIAL PRIMARY KEY,
nombre VARCHAR,
ubicacion VARCHAR,
capacidad INT
);

-- Tabla actividades
CREATE TABLE actividades (
id SERIAL PRIMARY KEY,
titulo VARCHAR,
descripcion TEXT,
fecha TIMESTAMP,
duracion_estimada INT,
hora_inicio TEXT,
hora_fin TEXT,
estado_id INTEGER REFERENCES estado(id),
evento_id INTEGER REFERENCES eventos(id),
sala_id INTEGER REFERENCES salas(id),
creado_en TIMESTAMP,
actualizado_en TIMESTAMP
);

-- Tabla actividad_expositores
CREATE TABLE actividad_expositores (
id SERIAL PRIMARY KEY,
actividad_id INTEGER NOT NULL REFERENCES actividades(id),
usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
UNIQUE (actividad_id, usuario_id)
);
```



