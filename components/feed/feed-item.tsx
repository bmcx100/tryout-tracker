interface FeedItemData {
  date: string
  playerNumber: number
  personalName: string
  description: string
  tag?: string
}

export function FeedItem({ item }: { item: FeedItemData }) {
  return (
    <div className="feed-item">
      <span className="feed-item-time">{item.date}</span>
      <div className="feed-item-content">
        <span className="feed-item-player">
          #{item.playerNumber} {item.personalName}
        </span>
        <span className="feed-item-desc">{item.description}</span>
      </div>
    </div>
  )
}
