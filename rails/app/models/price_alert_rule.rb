class PriceAlertRule < ApplicationRecord
  DIRECTIONS = %w[above below].freeze

  belongs_to :user
  has_many :alert_events, dependent: :nullify

  before_validation :normalize_identity_fields
  before_validation :normalize_direction

  validates :coin_id, presence: true
  validates :name, presence: true
  validates :symbol, presence: true
  validates :direction, presence: true, inclusion: { in: DIRECTIONS }
  validates :target_price_usd,
    presence: true,
    numericality: { greater_than: 0 }
  validates :coin_id,
    uniqueness: {
      scope: [:user_id, :direction, :target_price_usd],
      message: "alert already exists"
    }

  scope :active, -> { where(active: true) }
  scope :for_coin, ->(coin_id) { where(coin_id: coin_id.to_s.strip) }

  def triggered_by?(price_usd)
    price = BigDecimal(price_usd.to_s)

    case direction
    when "above"
      price >= target_price_usd
    when "below"
      price <= target_price_usd
    else
      false
    end
  rescue ArgumentError
    false
  end

  private

  def normalize_identity_fields
    self.coin_id = coin_id.to_s.strip
    self.name = name.to_s.strip
    self.symbol = symbol.to_s.strip.downcase
  end

  def normalize_direction
    self.direction = direction.to_s.strip.downcase
  end
end
