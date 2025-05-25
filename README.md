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

# table tokens en pgAdmin

# CREATE TABLE tokens (
#  id SERIAL PRIMARY KEY,
#  username VARCHAR(50) unique NOT NULL,
#  access_token TEXT,
#  refresh_token TEXT,
#  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
# ); # 

# CREATE TABLE users (
#  id SERIAL PRIMARY KEY,
#  name VARCHAR(50) UNIQUE NOT NULL,
#  password TEXT NOT NULL,
#  role VARCHAR(20) NOT NULL,
#  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
# );

# CREATE TABLE historial (
#  id SERIAL PRIMARY KEY,
#  username VARCHAR(50),
#  accion VARCHAR(100),
#  estado VARCHAR(20),
#  mensaje TEXT,
#  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
# );


