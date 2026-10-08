// Droits du personnel : `user.staff.permissions` vient du serveur (/api/auth/me/).
// Ceci ne sert qu'à masquer les écrans inutiles ; c'est le serveur qui refuse réellement toute action non permise.
export const can = (user, ...perms) => {
  const granted = user?.staff?.permissions || [];
  return perms.some((perm) => granted.includes(perm));
};
