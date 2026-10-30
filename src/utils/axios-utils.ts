import axios, { AxiosError, AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

export const fetchWithRetry = async <T>(
  axiosCall: () => Promise<T>,
  retries = 3,
  delay = 1000,
  ): Promise<T> => {
  try {
      return await axiosCall();
  } catch (error: any) {
    const transitorio = axios.isAxiosError(error) &&
      (!error.response || error.response.status >= 500);
    if (retries > 0 && transitorio) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(axiosCall, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const createAxiosInstance = (
  configService: ConfigService,
  endpointKey: string
): AxiosInstance => {
  const baseURL = configService.get<string>(endpointKey);
  if (!baseURL) {
    throw new Error(`Configuración faltante para ${endpointKey}`);
  }
  return axios.create({
    baseURL,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}