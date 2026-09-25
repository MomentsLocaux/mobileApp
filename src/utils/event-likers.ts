/** People who follow the viewer and whom the viewer follows back. */
export function mutualFriendIds(followingIds: Iterable<string>, followerIds: Iterable<string>): Set<string> {
  const following = followingIds instanceof Set ? followingIds : new Set(followingIds);
  const friends = new Set<string>();
  for (const id of followerIds) {
    if (following.has(id)) friends.add(id);
  }
  return friends;
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
