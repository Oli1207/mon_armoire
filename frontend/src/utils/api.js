import axiosInstance from './axios';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data) => axiosInstance.post('/api/auth/token/', data),
  register:       (data) => axiosInstance.post('/api/auth/register/', data),
  me:             ()     => axiosInstance.get('/api/auth/me/'),
  updateProfile:  (data) => axiosInstance.patch('/api/auth/me/update/', data),
  changePassword: (data) => axiosInstance.post('/api/auth/me/password/', data),
  forgotPassword: (data) => axiosInstance.post('/api/auth/forgot-password/', data),
  resetPassword:  (data) => axiosInstance.post('/api/auth/reset-password/', data),
};

// ── Adresses ──────────────────────────────────────────────────────────────────
export const addressesAPI = {
  list:   ()          => axiosInstance.get('/api/auth/addresses/'),
  create: (data)       => axiosInstance.post('/api/auth/addresses/', data),
  update: (id, data)   => axiosInstance.patch(`/api/auth/addresses/${id}/`, data),
  remove: (id)          => axiosInstance.delete(`/api/auth/addresses/${id}/`),
};

// ── Favoris ───────────────────────────────────────────────────────────────────
export const favoritesAPI = {
  list:   (params = {}) => axiosInstance.get('/api/auth/favorites/', { params }),
  ids:    ()            => axiosInstance.get('/api/auth/favorites/ids/'),
  toggle: (productId)   => axiosInstance.post(`/api/auth/favorites/${productId}/toggle/`),
};

// ── Catégories & collections ─────────────────────────────────────────────────
export const categoriesAPI = {
  list: () => axiosInstance.get('/api/categories/'),
};

export const collectionsAPI = {
  list: (kind) => axiosInstance.get('/api/collections/', { params: kind ? { kind } : {} }),
};

// ── Produits ──────────────────────────────────────────────────────────────────
export const productsAPI = {
  list:    (params = {}) => axiosInstance.get('/api/products/', { params }),
  detail:  (slug)         => axiosInstance.get(`/api/products/${slug}/`),
  suggest: (q)            => axiosInstance.get('/api/search/suggest/', { params: { q } }),
};

// ── Cartes cadeaux ─────────────────────────────────────────────────────────────
export const giftcardsAPI = {
  purchase: (payload) => axiosInstance.post('/api/giftcards/purchase/', payload),
  check:    (code)    => axiosInstance.get('/api/giftcards/check/', { params: { code } }),
};

// ── Fidélité ──────────────────────────────────────────────────────────────────
export const loyaltyAPI = {
  balance: () => axiosInstance.get('/api/loyalty/balance/'),
};

// ── Liste d'attente ───────────────────────────────────────────────────────────
export const waitlistAPI = {
  join: (payload) => axiosInstance.post('/api/waitlist/', payload),
};

// ── Guide des symboles / Lookbook ─────────────────────────────────────────────
export const symbolsAPI = {
  list: () => axiosInstance.get('/api/symbols/'),
};

export const lookbookAPI = {
  list: () => axiosInstance.get('/api/lookbook/'),
};

// ── Coffrets ──────────────────────────────────────────────────────────────────
export const coffretsAPI = {
  list:      ()          => axiosInstance.get('/api/coffrets/'),
  detail:    (slug)       => axiosInstance.get(`/api/coffrets/${slug}/`),
  configure: (payload)    => axiosInstance.post('/api/coffrets/configure/', payload),
};

// ── Panier ────────────────────────────────────────────────────────────────────
export const cartAPI = {
  get:    (cartId)              => axiosInstance.get('/api/cart/', { params: { cart_id: cartId } }),
  add:    (cartId, payload)     => axiosInstance.post('/api/cart/add/', { cart_id: cartId, ...payload }),
  update: (cartId, itemId, payload) => axiosInstance.patch(`/api/cart/items/${itemId}/`, { cart_id: cartId, ...payload }),
  remove: (cartId, itemId)      => axiosInstance.delete(`/api/cart/items/${itemId}/remove/`, { params: { cart_id: cartId } }),
};

// ── Zones de livraison ────────────────────────────────────────────────────────
export const deliveryZonesAPI = {
  list: () => axiosInstance.get('/api/delivery-zones/'),
};

// ── Commandes ─────────────────────────────────────────────────────────────────
export const ordersAPI = {
  create: (payload)      => axiosInstance.post('/api/orders/', payload),
  mine:   (params = {})   => axiosInstance.get('/api/orders/mine/', { params }),
  detail: (orderNumber)   => axiosInstance.get(`/api/orders/${orderNumber}/`),
  track:  (orderNumber, email) => axiosInstance.post('/api/orders/track/', { order_number: orderNumber, email }),
};

// ── Paiement (GeniusPay / Paystack) ──────────────────────────────────────────
export const paymentsAPI = {
  initiate: (orderNumber, provider) => axiosInstance.post(`/api/orders/${orderNumber}/pay/`, { provider }),
  verify:   (orderNumber, provider) => axiosInstance.get(`/api/orders/${orderNumber}/pay/verify/`, { params: { provider } }),
};

// ── Avis produit ──────────────────────────────────────────────────────────────
export const reviewsAPI = {
  list:     (slug, params = {}) => axiosInstance.get(`/api/products/${slug}/reviews/`, { params }),
  create:   (slug, payload) => axiosInstance.post(`/api/products/${slug}/reviews/`, payload),
  featured: ()               => axiosInstance.get('/api/reviews/featured/'),
};

// ── Verset du jour / notifications ───────────────────────────────────────────
export const notificationsAPI = {
  verseOfTheDay: ()          => axiosInstance.get('/api/notifications/verse-of-the-day/'),
  week:          ()          => axiosInstance.get('/api/notifications/verses/week/'),
  setOverride:   (date, payload) => axiosInstance.put(`/api/notifications/verses/week/${date}/`, payload),
  clearOverride: (date)       => axiosInstance.delete(`/api/notifications/verses/week/${date}/`),
};

// ── Back-office ───────────────────────────────────────────────────────────────
export const adminAPI = {
  stats:          ()             => axiosInstance.get('/api/admin/stats/'),
  customers:      (params = {})  => axiosInstance.get('/api/admin/customers/', { params }),
  customerDetail: (id)           => axiosInstance.get(`/api/admin/customers/${id}/`),
  orders:         (params = {})  => axiosInstance.get('/api/admin/orders/', { params }),
  updateOrderStatus: (orderNumber, status, note) =>
    axiosInstance.patch(`/api/orders/${orderNumber}/status/`, { status, note }),

  // Catégories
  categories:       ()           => axiosInstance.get('/api/admin/categories/'),
  createCategory:   (data)       => axiosInstance.post('/api/admin/categories/', data),
  updateCategory:   (id, data)   => axiosInstance.patch(`/api/admin/categories/${id}/`, data),
  deleteCategory:   (id)         => axiosInstance.delete(`/api/admin/categories/${id}/`),

  // Produits
  products:         (params = {}) => axiosInstance.get('/api/admin/products/', { params }),
  variantOptions:   ()           => axiosInstance.get('/api/admin/variant-options/'),
  productDetail:    (id)         => axiosInstance.get(`/api/admin/products/${id}/`),
  createProduct:    (data)       => axiosInstance.post('/api/admin/products/', data),
  updateProduct:    (id, data)   => axiosInstance.patch(`/api/admin/products/${id}/`, data),
  deleteProduct:    (id)         => axiosInstance.delete(`/api/admin/products/${id}/`),

  // Variantes
  createVariant:    (productId, data) => axiosInstance.post(`/api/admin/products/${productId}/variants/`, data),
  updateVariant:    (id, data)   => axiosInstance.patch(`/api/admin/variants/${id}/`, data),
  deleteVariant:    (id)         => axiosInstance.delete(`/api/admin/variants/${id}/`),

  // Images
  createImage:      (productId, formData) => axiosInstance.post(`/api/admin/products/${productId}/images/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteImage:      (id)         => axiosInstance.delete(`/api/admin/images/${id}/`),

  // Coffrets
  coffrets:         ()           => axiosInstance.get('/api/admin/coffrets/'),
  coffretDetail:    (id)         => axiosInstance.get(`/api/admin/coffrets/${id}/`),
  createCoffret:    (data)       => axiosInstance.post('/api/admin/coffrets/', data),
  updateCoffret:    (id, data)   => axiosInstance.patch(`/api/admin/coffrets/${id}/`, data),
  deleteCoffret:    (id)         => axiosInstance.delete(`/api/admin/coffrets/${id}/`),

  // Emplacements coffret
  createSlot:       (coffretId, data) => axiosInstance.post(`/api/admin/coffrets/${coffretId}/slots/`, data),
  updateSlot:       (id, data)   => axiosInstance.patch(`/api/admin/slots/${id}/`, data),
  deleteSlot:       (id)         => axiosInstance.delete(`/api/admin/slots/${id}/`),

  // Éléments inclus coffret
  createCoffretItem: (coffretId, data) => axiosInstance.post(`/api/admin/coffrets/${coffretId}/items/`, data),
  updateCoffretItem: (id, data)  => axiosInstance.patch(`/api/admin/coffret-items/${id}/`, data),
  deleteCoffretItem: (id)        => axiosInstance.delete(`/api/admin/coffret-items/${id}/`),

  // Avis
  reviews:          (params = {}) => axiosInstance.get('/api/admin/reviews/', { params }),
  updateReview:     (id, data)   => axiosInstance.patch(`/api/admin/reviews/${id}/`, data),
  deleteReview:     (id)         => axiosInstance.delete(`/api/admin/reviews/${id}/`),

  // Guide des symboles
  symbols:          ()           => axiosInstance.get('/api/admin/symbols/'),
  createSymbol:     (data)       => axiosInstance.post('/api/admin/symbols/', data),
  updateSymbol:     (id, data)   => axiosInstance.patch(`/api/admin/symbols/${id}/`, data),
  deleteSymbol:     (id)         => axiosInstance.delete(`/api/admin/symbols/${id}/`),

  // Lookbook
  lookbook:         ()           => axiosInstance.get('/api/admin/lookbook/'),
  createLookbookEntry: (data)    => axiosInstance.post('/api/admin/lookbook/', data),
  updateLookbookEntry: (id, data) => axiosInstance.patch(`/api/admin/lookbook/${id}/`, data),
  deleteLookbookEntry: (id)      => axiosInstance.delete(`/api/admin/lookbook/${id}/`),

  // Cartes cadeaux
  giftcards:        (params = {}) => axiosInstance.get('/api/admin/giftcards/', { params }),

  // Liste d'attente
  waitlist:         (params = {}) => axiosInstance.get('/api/admin/waitlist/', { params }),
};
