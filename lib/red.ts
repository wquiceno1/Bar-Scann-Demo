import NetInfo from '@react-native-community/netinfo';

/**
 * True si hay conexión utilizable. `isInternetReachable` puede ser null
 * (aún sin determinar); solo descartamos cuando es explícitamente false.
 */
export async function hayRed(): Promise<boolean> {
  const estado = await NetInfo.fetch();
  return Boolean(estado.isConnected) && estado.isInternetReachable !== false;
}
