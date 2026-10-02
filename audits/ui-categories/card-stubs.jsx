// Native/backend dependencies replaced only in the isolated browser fixture.
import React from 'react';
import { View } from 'react-native';
export const useAuth = () => ({ profile: null });
export const prefetchEventMedia = () => {};
export const UserAvatar = () => null;
export const EventHeartButton = () => null;
export const EventCoverImage = ({ style }) => <View testID="opaque-cover" style={[style, { backgroundColor: '#4a6064' }]} />;
