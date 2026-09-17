// A card's unique identity as used across the whole site (search results,
// collections, wishlist). The dataset doesn't expose the pipeline's internal
// card_id, so set+number+name is the stable, always-present substitute.
export function cardKey(d) {
  return `${d.set}||${d.number}||${d.name}`
}
