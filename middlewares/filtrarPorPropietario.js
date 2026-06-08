// // const ROL_ADMIN_PRIVADO = 9;
// // const ROLES_ADMIN = [1, 3, 4, 6];

// // function getFiltro(req) {
// //   const { rol_id, userId } = req.user;

// //   if (ROLES_ADMIN.includes(rol_id)) {
// //     return { where: '', params: [], offset: 0 };
// //   }

// //   if (rol_id === ROL_ADMIN_PRIVADO) {
// //     return { where: 'AND propietario_id = $1', params: [userId], offset: 1 };
// //   }

// //   return null; // rol sin acceso
// // }

// // module.exports = { getFiltro, ROL_ADMIN_PRIVADO, ROLES_ADMIN };

// const ROL_ADMIN_PRIVADO = 9;
// const ROLES_ADMIN = [1, 3, 4, 6];

// function getFiltro(req) {
//   const { rol_id, userId } = req.user;

//   if (!req.user) {
//     return { where: '', params: [], offset: 0 };
//   }

//   if (ROLES_ADMIN.includes(rol_id)) {
//     // Admins globales ven solo datos sin propietario (propietario_id IS NULL)
//     return { where: 'AND propietario_id IS NULL', params: [], offset: 0 };
//   }

//   if (rol_id === ROL_ADMIN_PRIVADO) {
//     // Admin privado ve solo sus propios datos
//     return { where: 'AND propietario_id = $1', params: [userId], offset: 1 };
//   }

//   return { where: '', params: [], offset: 0 };
// }

// module.exports = { getFiltro, ROL_ADMIN_PRIVADO, ROLES_ADMIN };

const ROL_ADMIN_PRIVADO = 9;
const ROLES_ADMIN = [1, 3, 4, 6];

function getFiltro(req) {
  if (!req.user) {
    return { where: '', params: [], offset: 0 };
  }

  const { rol_id, userId } = req.user;

  if (ROLES_ADMIN.includes(rol_id)) {
    // Admins globales ven datos globales (propietario_id IS NULL)
    // + sus propias compras del market (origen = 'market' y propietario_id = userId)
    return {
      where: `AND (propietario_id IS NULL OR (origen = 'market' AND propietario_id = ${userId}))`,
      params: [],
      offset: 0,
    };
  }

  if (rol_id === ROL_ADMIN_PRIVADO) {
    // Admin privado ve solo sus propios datos
    return { where: 'AND propietario_id = $1', params: [userId], offset: 1 };
  }

  return { where: '', params: [], offset: 0 };
}

module.exports = { getFiltro, ROL_ADMIN_PRIVADO, ROLES_ADMIN };