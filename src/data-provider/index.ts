import { apiProvider } from './api-provider';
import { supabaseProvider } from './supabase-provider';
import { authProvider } from './auth-provider';
import type { IAuthProvider, IBugsProvider, IDataProvider } from './types';

type DataProvider = IDataProvider & IAuthProvider & IBugsProvider;

export const dataProvider: DataProvider = {
  listEvents: (filters) => supabaseProvider.listEvents(filters),
  getEventById: (id) => supabaseProvider.getEventById(id),
  createEvent: (payload) => supabaseProvider.createEvent(payload),
  deleteEvent: (id) => supabaseProvider.deleteEvent(id),

  listComments: (eventId) => supabaseProvider.listComments(eventId),
  createComment: (payload) => supabaseProvider.createComment(payload),
  deleteComment: (id) => supabaseProvider.deleteComment(id),

  checkInEvent: (eventId, lat, lon, token) => apiProvider.checkInEvent(eventId, lat, lon, token),

  reportEvent: (eventId, payload, token) => apiProvider.reportEvent(eventId, payload, token),
  reportComment: (commentId, payload, token) => apiProvider.reportComment(commentId, payload, token),

  purchaseItem: (payload, token) => apiProvider.purchaseItem(payload, token),

  getProfile: (userId) => supabaseProvider.getProfile(userId),
  updateProfile: (userId, payload) => supabaseProvider.updateProfile(userId, payload),

  earnLumo: (payload) => supabaseProvider.earnLumo(payload),
  spendLumo: (payload) => supabaseProvider.spendLumo(payload),

  toggleFavorite: (eventId) => supabaseProvider.toggleFavorite(eventId),
  toggleInterest: (eventId) => supabaseProvider.toggleInterest(eventId),
  like: (eventId) => supabaseProvider.like(eventId),

  listEventsByCreator: (creatorId) => supabaseProvider.listEvents({ creatorId }),
  uploadAvatar: (userId, uri) => supabaseProvider.uploadAvatar(userId, uri),

  submitBug: (payload) => supabaseProvider.submitBug(payload),

  signIn: (email, password) => authProvider.signIn(email, password),
  signUp: (email, password) => authProvider.signUp(email, password),
  signOut: () => authProvider.signOut(),
  getSession: () => authProvider.getSession(),
  getUser: () => authProvider.getUser(),
  ensureProfile: (userId, email) => authProvider.ensureProfile(userId, email),
  onAuthStateChange: (callback) => authProvider.onAuthStateChange(callback),
};
