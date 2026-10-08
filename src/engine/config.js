// Constantes globales del motor isométrico.
// Proyección dimétrica 2:1 (pixel-art clásico): 1 tile = 32×16 px, 1 unidad de altura = 16 px.
export const HW = 16; // medio ancho de tile en px
export const HH = 8; // media altura de tile en px
export const UNIT_Z = 16; // px por unidad de altura

export const WALL_H = 2.75; // altura de pared (unidades)
export const WALL_T = 0.25; // grosor de pared
export const SLAB = 0.35; // grosor del piso (look diorama)

export const ROOM_MIN = 4;
export const ROOM_MAX = 16;
export const MAX_ITEMS = 200;
export const HASH_MAX = 4096; // límite defensivo para datos que vienen de la URL

// IDs reservados en el id-buffer (0 = vacío, 1..MAX_ITEMS = índice de item + 1)
export const ID_FLOOR = 65000;
export const ID_WALL_L = 65001;
export const ID_WALL_R = 65002;
export const ID_AVATAR = 65010;

export const STORAGE_KEY = 'd33.room.v1';
export const PREFS_KEY = 'd33.prefs.v1';
