class AlertEvent < ApplicationRecord
  belongs_to :user
  belongs_to :price_alert_rule, optional: true

  before_validation :normalize_identity_fields
  before_validation :normalize_direction
  before_validation :default_triggered_at

  validates :coin_id, presence: true
  validates :name, presence: true
  validates :symbol, presence: true
  validates :direction, presence: true, inclusion: { in: PriceAlertRule::DIRECTIONS }
  validates :target_price_usd,
    presence: true,
    numericality: { greater_than: 0 }
  validates :triggered_price_usd,
    presence: true,
    numericality: { greater_than: 0 }
  validates :triggered_at, presence: true

  private

  def normalize_identity_fields
    self.coin_id = coin_id.to_s.strip
    self.name = name.to_s.strip
    self.symbol = symbol.to_s.strip.downcase
  end

  def normalize_direction
    self.direction = direction.to_s.strip.downcase
  end

  def default_triggered_at
    self.triggered_at ||= Time.current
  end
end
