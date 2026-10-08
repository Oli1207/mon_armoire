import { create } from 'zustand';
import { cartAPI } from '../utils/api';
import { errorText } from '../utils/errors';

const CART_ID_KEY = 'ma_cart_id';

function getCartId() {
  let id = localStorage.getItem(CART_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CART_ID_KEY, id);
  }
  return id;
}

const useCartStore = create((set, get) => ({
  cart: null,
  loading: false,
  error: '',

  fetchCart: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await cartAPI.get(getCartId());
      set({ cart: data, loading: false });
    } catch (err) {
      set({ loading: false, error: errorText(err, 'Votre panier n’a pas pu être chargé.') });
    }
  },

  addVariant: async (variantId, quantity = 1, giftWrap = false, giftMessage = '', engravingText = '') => {
    const { data } = await cartAPI.add(getCartId(), {
      variant_id: variantId,
      quantity,
      gift_wrap: giftWrap,
      gift_message: giftMessage,
      engraving_text: engravingText,
    });
    set({ cart: data });
  },

  addCoffretConfiguration: async (coffretConfigurationId, giftWrap = false, giftMessage = '') => {
    const { data } = await cartAPI.add(getCartId(), {
      coffret_configuration_id: coffretConfigurationId,
      quantity: 1,
      gift_wrap: giftWrap,
      gift_message: giftMessage,
    });
    set({ cart: data });
  },

  updateItem: async (itemId, payload) => {
    const { data } = await cartAPI.update(getCartId(), itemId, payload);
    set({ cart: data });
  },

  removeItem: async (itemId) => {
    const { data } = await cartAPI.remove(getCartId(), itemId);
    set({ cart: data });
  },

  itemCount: () => get().cart?.items?.reduce((sum, i) => sum + i.quantity, 0) || 0,
}));

export default useCartStore;
