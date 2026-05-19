const getSupabase = require('../../connection/supabase');

const uploadImagenAvance = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const supabase = getSupabase();
    const ext = req.file.originalname.split('.').pop();
    const fileName = `avance-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('avances')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Error subiendo a Supabase:', error);
      return res.status(500).json({ error: 'Error al subir la imagen' });
    }

    const { data } = supabase.storage.from('avances').getPublicUrl(fileName);
    return res.status(200).json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error('Error en uploadImagenAvance:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { uploadImagenAvance };