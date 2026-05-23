import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  getCalls: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await apiClient.get('/calls', { params });
    return response.data;
  },

  getCall: async (id: string) => {
    const response = await apiClient.get(`/calls/${id}`);
    return response.data;
  },

  startCall: async (data: { phoneNumber?: string; userId?: string; metadata?: any }) => {
    const response = await apiClient.post('/calls/start', data);
    return response.data;
  },

  endCall: async (callId: string) => {
    const response = await apiClient.post('/calls/end', { callId });
    return response.data;
  },

  getLiveKitToken: async (callId: string, identity: string) => {
    const response = await apiClient.post(`/calls/${callId}/token`, { identity });
    return response.data.data as { token: string; url: string; room: string };
  },
};
