import axiosInstance from './axios';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Les notifications push ne sont pas supportées par ce navigateur.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission de notification refusée.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const key = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');

  await axiosInstance.post('/api/notifications/push-subscribe/', {
    endpoint: subscription.endpoint,
    p256dh_key: btoa(String.fromCharCode(...new Uint8Array(key))),
    auth_key: btoa(String.fromCharCode(...new Uint8Array(auth))),
  });

  return subscription;
}

/** 'unsupported' | 'denied' | 'off' | 'on' pour cet appareil. */
export async function getPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !VAPID_PUBLIC_KEY) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;
  await axiosInstance.post('/api/notifications/push-unsubscribe/', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
