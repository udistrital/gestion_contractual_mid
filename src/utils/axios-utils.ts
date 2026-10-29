import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();

export async function fetchWithRetry<T>(
  axiosCall: () => Promise<T>,
  retries = 3,
  delay = 1000,
  ): Promise<T> {
  try {
      return await axiosCall();
  } catch (error) {
      if (retries > 0 && axios.isAxiosError(error)) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(axiosCall, retries - 1, delay * 2);
      }
      throw error;
  }
}

export function createAxiosInstance(endpointKey: string): AxiosInstance {
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