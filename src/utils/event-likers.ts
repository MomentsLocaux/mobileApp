/** People who follow the viewer and whom the viewer follows back. */
export function mutualFriendIds(followingIds: Iterable<string>, followerIds: Iterable<string>): Set<string> {
  const following = followingIds instanceof Set ? followingIds : new Set(followingIds);
  const friends = new Set<string>();
  for (const id of followerIds) {
    if (following.has(id)) friends.add(id);
  }
  return friends;
}

/**
 * Mutual friends stay named. Someone the viewer follows who does not follow
 * back is omitted, so a one-way follow cannot be used to browse their likes.
 * Everyone else who liked the event stays visible.
 */
export function likersVisibleToViewer<T extends { id: string }>(
  likers: T[],
  followingIds: Iterable<string>,
  followerIds: Iterable<string>,
): (T & { isFriend: boolean })[] {
  const friends = mutualFriendIds(followingIds, followerIds);
  const following = followingIds instanceof Set ? followingIds : new Set(followingIds);
  const visible = likers.filter((person) => friends.has(person.id) || !following.has(person.id));
  return orderLikersFriendsFirst(visible, friends);
}

export function orderLikersFriendsFirst<T extends { id: string }>(
  likers: T[],
  friendIds: ReadonlySet<string>,
): (T & { isFriend: boolean })[] {
  const friends: (T & { isFriend: boolean })[] = [];
  const others: (T & { isFriend: boolean })[] = [];
  for (const liker of likers) {
    if (friendIds.has(liker.id)) friends.push({ ...liker, isFriend: true });
    else others.push({ ...liker, isFriend: false });
  }
  return [...friends, ...others];
}
