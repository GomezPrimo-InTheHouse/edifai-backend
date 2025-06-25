// utils/totp.util.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const qrterminal = require('qrcode-terminal');

/**
 * Genera un secret TOTP y un QR code para escanear.
 * @param {string} userEmail
 * @returns {Promise<{ otpauth_url: string, base32: string, qrImage: string }>}
 */


function generarTotp(email) {
  const secret = speakeasy.generateSecret({
    name: `Edifai: (${email})`, 
  });

  return secret; // Contiene { ascii, hex, base32, otpauth_url }
}

async function generarQRCodeTerminal(otpauth_url) {
  qrterminal.generate(otpauth_url, { small: true });
}

async function generarQRCodeDataURL(otpauth_url) {
  return await qrcode.toDataURL(otpauth_url);
}

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

module.exports = { 
  generarTotp, 
  verificarTotp, 
  generarQRCodeTerminal,
  generarQRCodeDataURL };
