const getSupabase = require('../../connection/supabase');

const uploadImagenMaterial = async (req, res) => {
  const supabase = getSupabase();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const ext = req.file.originalname.split('.').pop();
    const fileName = `material-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('materiales')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Error subiendo a Supabase:', error);
      return res.status(500).json({ error: 'Error al subir la imagen' });
    }

    const { data } = supabase.storage
      .from('materiales')
      .getPublicUrl(fileName);

    return res.status(200).json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error('Error en uploadImagenMaterial:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { uploadImagenMaterial };