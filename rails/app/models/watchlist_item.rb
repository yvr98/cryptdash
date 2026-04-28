class WatchlistItem < ApplicationRecord
  belongs_to :user

  before_validation :normalize_identity_fields
  before_validation :default_added_at

  validates :coin_id, presence: true, uniqueness: { scope: :user_id }
  validates :name, presence: true
  validates :symbol, presence: true
  validates :added_at, presence: true

  private

  def normalize_identity_fields
    self.coin_id = coin_id.to_s.strip
    self.name = name.to_s.strip
    self.symbol = symbol.to_s.strip.downcase
    self.thumb_url = thumb_url.to_s.strip.presence
  end

  def default_added_at
    self.added_at ||= Time.current
  end
end
