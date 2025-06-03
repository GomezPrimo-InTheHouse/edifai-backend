// utils/totp.util.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const qrterminal = require('qrcode-terminal');

/**
 * Genera un secret TOTP y un QR code para escanear.
 * @param {string} userEmail
 * @returns {Promise<{ otpauth_url: string, base32: string, qrImage: string }>}
 */

const generarTotp = async (userEmail) => {
  const secret = speakeasy.generateSecret({
    name: `Eventos (${userEmail})`, // aparece así en la app
  });

  // Generar código QR en terminal
  qrterminal.generate(secret.otpauth_url, { small: true });

  // Generar QR en base64 para enviar al frontend (opcional)
  const qrImage = await qrcode.toDataURL(secret.otpauth_url);

  return {
    otpauth_url: secret.otpauth_url,
    base32: secret.base32,
    qrImage,
  };
};

/**
 * Verifica un código TOTP contra el secret base32
 */
const verificarTotp = (token, base32Secret) => {
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token,
    window: 1, // tolerancia de 1 intervalo (30s)
  });
};

module.exports = { generarTotp, verificarTotp };
