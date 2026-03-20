-- Migration: Create formas_pago and pagos tables
-- Date: $(date +%Y%m%d_%H%M%S)

CREATE TABLE formas_pago (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO formas_pago (nombre) VALUES ('Efectivo'), ('Transferencia'), ('Cheque'), ('Tarjeta');

-- Pagos
CREATE TABLE pagos (
  id SERIAL PRIMARY KEY,
  presupuesto_id INT NOT NULL REFERENCES presupuestos(id),
  trabajador_id INT NOT NULL REFERENCES trabajadores(id),
  monto NUMERIC NOT NULL,
  fecha DATE NOT NULL,
  motivo TEXT,
  forma_pago_id INT REFERENCES formas_pago(id),
  estado VARCHAR NOT NULL DEFAULT 'Pendiente',
  comprobante_url VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
