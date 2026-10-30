/** Panel global de cuentas: la propia, las de la familia y la contraseña. */
export const accountPanel = $state({ open: false });

export type Account = { id: string; username: string; name: string; is_admin: boolean; created: string };
